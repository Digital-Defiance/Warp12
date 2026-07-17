import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import {
  aiSkill,
  computeOnlineRanks,
  computeOnlineSquadRanks,
  evaluateOnlineRatingEligibility,
  isAiGameCaptain,
  isSquadGame,
  type GameCaptainDoc,
  type GameDoc,
  type OnlineRatingIneligibleReason,
} from './online-match-eligibility';
export {
  evaluateOnlineRatingEligibility,
  isAiGameCaptain,
  isSquadGame,
  computeOnlineRanks,
  computeOnlineSquadRanks,
  type OnlineRatingEligibility,
  type OnlineRatingIneligibleReason,
} from './online-match-eligibility';
import { requireVerifiedUser } from './auth';
import { assertNotBanned } from './bans';
import {
  getAIAnchorStored,
  resolveEffectivePlayerRating,
  type RatedObjective,
  type RatedPlayer,
} from './tei/stats-openskill';
import {
  applyHumanRatingForPlayer,
  applyGroupRatingForPlayer,
  applySquadRatingForPlayer,
  buildSquadRatingTable,
  groupObjectiveRatingStats,
  groupRatedClaimId,
  humanObjectiveRatingStats,
  squadObjectiveRatingStats,
  startingRatingForObjective,
  writeRatingEventIfAbsent,
  onlineRatingEventId,
  snapshotFromRatedTable,
  objectiveToTrackKey,
  issueOnlineSectorCertificate,
  type PlayerStatsDocument,
  type RatingEventParticipant,
  type SquadRatedPlayer,
  type StoredRating,
} from './tei';
import { buildSquadMatchArchive } from './tei/squad-match-archive';
import {
  loadCharter,
  validateCharterRatedMatch,
} from './charters';
import type { CharterHouseRulesInput, CharterModulesInput } from './tei';

const db = admin.firestore();
const MAX_MATCH_HISTORY = 60;

async function loadStats(uid: string): Promise<PlayerStatsDocument | null> {
  const snap = await db.collection('playerStats').doc(uid).get();
  return snap.exists ? (snap.data() as PlayerStatsDocument) : null;
}

/** Anonymous Firebase users carry no linked provider — they cannot be rated. */
async function isVerifiedAccount(uid: string): Promise<boolean> {
  try {
    const user = await admin.auth().getUser(uid);
    return user.providerData.length > 0;
  } catch {
    return false;
  }
}

/**
 * Whether any human captain consulted the in-game tactical advisor during the
 * sector. Advisor requests are written to `games/{gameId}/presence/{uid}` with
 * `coachUsedThisRound: true`; the presence doc persists for the match.
 */
async function anyCaptainUsedAdvisor(
  gameId: string,
  humans: readonly GameCaptainDoc[]
): Promise<boolean> {
  const presence = await db
    .collection('games')
    .doc(gameId)
    .collection('presence')
    .get();
  const humanIds = new Set(humans.map((h) => h.id));
  return presence.docs.some((docSnap) => {
    const data = docSnap.data() as { coachUsedThisRound?: boolean };
    return data.coachUsedThisRound === true && humanIds.has(docSnap.id);
  });
}

/**
 * Module Zeta squad rating path. Mirrors the FFA branch in `reportOnlineMatch`
 * (pre-match snapshot + per-player transaction + idempotency claim) but ranks
 * *squads* via `computeOnlineSquadRanks` and updates ratings via
 * `applySquadRatingForPlayer` (OpenSkill `updateTeamRatings`, individual
 * per-member credit — see `apply-squad-tei.ts`).
 */
async function reportOnlineSquadMatch(
  game: GameDoc,
  gameId: string,
  humans: readonly GameCaptainDoc[],
  objective: RatedObjective,
  callerUid: string
): Promise<{
  rated: boolean;
  reason?: OnlineRatingIneligibleReason;
  won?: boolean;
  rank?: number;
  squadId?: string;
  ratingBefore?: StoredRating;
  ratingAfter?: StoredRating;
  muDelta?: number;
  alreadyApplied?: boolean;
}> {
  const squadRanks = computeOnlineSquadRanks(game);
  const squads = (game.squadrons ?? []).map((s) => ({
    squadId: s.id,
    memberIds: s.memberIds,
    rank: squadRanks.get(s.id) ?? game.squadrons!.length,
  }));

  // Pre-match ratings snapshot — every human's own squad-track rating, read
  // once so every member's delta is computed against the same before-match
  // teammate/opponent ratings. AI squadmates (if any) use fixed anchors and
  // are excluded from rating updates, same as the FFA path.
  const humanIds = new Set(humans.map((h) => h.id));
  const ratingByUid = new Map<string, StoredRating>();
  for (const squad of squads) {
    for (const uid of squad.memberIds) {
      if (!humanIds.has(uid)) continue; // AI squadmate — never rated
      const stats = await loadStats(uid);
      const track = squadObjectiveRatingStats(stats, objective);
      ratingByUid.set(
        uid,
        resolveEffectivePlayerRating(
          track.rating,
          track.rating.matches,
          startingRatingForObjective(stats, objective)
        )
      );
    }
  }

  const table: SquadRatedPlayer[] = buildSquadRatingTable(
    squads.map((s) => ({
      squadId: s.squadId,
      memberIds: s.memberIds.filter((id) => humanIds.has(id)),
      rank: s.rank,
    })),
    ratingByUid
  );

  let callerReport: {
    rated: true;
    won: boolean;
    rank: number;
    squadId: string;
    ratingBefore: StoredRating;
    ratingAfter: StoredRating;
    muDelta: number;
  } | null = null;

  const squadLedgerParticipants: RatingEventParticipant[] = [];
  const appliedAt = new Date().toISOString();

  for (const human of humans) {
    if (!table.some((p) => p.playerId === human.id)) {
      continue; // human wasn't on a rated squad roster (shouldn't happen)
    }
    const ref = db.collection('playerStats').doc(human.id);

    const applied = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(ref);
      const fresh = freshSnap.exists
        ? (freshSnap.data() as PlayerStatsDocument)
        : null;
      if (fresh?.squadRatedGameIds?.includes(gameId)) {
        return null;
      }

      const result = applySquadRatingForPlayer(fresh, objective, table, human.id);
      if (!result) {
        return null;
      }

      const now = new Date().toISOString();
      const base: PlayerStatsDocument = fresh ?? {
        uid: human.id,
        displayName: human.displayName || 'Captain',
        matchesCompleted: 0,
        matchesWon: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        totalPoints: 0,
        updatedAt: now,
      };

      const historyEntry = {
        playedAt: now,
        objective,
        opponentContext: 'squad' as const,
        playerCount: game.captains.length,
        finishRank: result.rank,
        won: result.won,
        advisorUsed: false,
        ratingBefore: result.ratingBefore,
        ratingAfter: result.ratingAfter,
        muDelta: result.ratingAfter.mu - result.ratingBefore.mu,
        squadId: result.squadId,
      };
      const priorHistory = (base as { matchHistory?: unknown[] }).matchHistory ?? [];

      tx.set(
        ref,
        {
          ...base,
          displayName: human.displayName || base.displayName,
          matchesCompleted: base.matchesCompleted + 1,
          matchesWon: base.matchesWon + (result.won ? 1 : 0),
          squadRating: result.squadRating,
          squadRatedGameIds: [...(base.squadRatedGameIds ?? []), gameId],
          matchHistory: [historyEntry, ...priorHistory].slice(0, MAX_MATCH_HISTORY),
          lastPlayedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      return result;
    });

    if (applied) {
      squadLedgerParticipants.push({
        uid: human.id,
        displayName: human.displayName || 'Captain',
        rank: applied.rank,
        won: applied.won,
        ratingBefore: applied.ratingBefore,
        ratingAfter: applied.ratingAfter,
        squadId: applied.squadId,
      });
    }

    if (applied && human.id === callerUid) {
      callerReport = {
        rated: true,
        won: applied.won,
        rank: applied.rank,
        squadId: applied.squadId,
        ratingBefore: applied.ratingBefore,
        ratingAfter: applied.ratingAfter,
        muDelta: applied.ratingAfter.mu - applied.ratingBefore.mu,
      };
    }
  }

  if (squadLedgerParticipants.length > 0) {
    await writeRatingEventIfAbsent({
      eventId: onlineRatingEventId(gameId, 'squad'),
      source: 'online',
      matchId: gameId,
      pool: 'squad',
      track: objectiveToTrackKey(objective),
      objective,
      playedAt: appliedAt,
      appliedAt,
      memberUids: squadLedgerParticipants.map((p) => p.uid),
      participants: squadLedgerParticipants,
      snapshot: snapshotFromRatedTable(table),
      writer: 'reportOnlineSquadMatch',
    });

    await issueOnlineSectorCertificate({
      gameId,
      objective,
      campaignRounds: game.campaignRounds ?? 13,
      players: squadLedgerParticipants.map((p) => {
        const captain = humans.find((h) => h.id === p.uid);
        return {
          uid: p.uid,
          displayName: p.displayName ?? captain?.displayName ?? 'Captain',
          rank: p.rank,
          score:
            typeof captain?.pointsScore === 'number' ? captain.pointsScore : 0,
          ratingBefore: p.ratingBefore,
          ratingAfter: p.ratingAfter,
        };
      }),
    });
  }

  // Durable squad-vs-squad archive (idempotent on gameId).
  const archiveRef = db.collection('squadMatches').doc(gameId);
  const archiveSnap = await archiveRef.get();
  if (!archiveSnap.exists && (game.squadrons?.length ?? 0) > 0) {
    const archive = buildSquadMatchArchive({
      gameId,
      playedAt: new Date().toISOString(),
      objective,
      maxPip: game.maxPip,
      charterId: game.charterId,
      captains: game.captains.map((c) => ({
        id: c.id,
        displayName: c.displayName,
      })),
      squadrons: game.squadrons!.map((s) => ({
        id: s.id,
        memberIds: s.memberIds,
        ...(s.name ? { name: s.name } : {}),
      })),
      squadRanks,
    });
    await archiveRef.set(archive);
  }

  return callerReport ?? { rated: true, alreadyApplied: true };
}

export const reportOnlineMatch = onCall(
  { memory: '256MiB', timeoutSeconds: 60 },
  async (request) => {
    const callerUid = requireVerifiedUser(request);
    await assertNotBanned(callerUid, request);
    const { gameId } = (request.data ?? {}) as { gameId?: string };
    if (!gameId || typeof gameId !== 'string') {
      throw new HttpsError('invalid-argument', 'gameId required.');
    }

    const snap = await db.collection('games').doc(gameId).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Match not found.');
    }
    const game = snap.data() as GameDoc;

    if (game.phase !== 'complete') {
      throw new HttpsError(
        'failed-precondition',
        'Match is not complete; standings are not final.'
      );
    }

    if (!game.captains.some((c) => c.id === callerUid && !isAiGameCaptain(c))) {
      throw new HttpsError(
        'permission-denied',
        'Only a captain in this sector can report it.'
      );
    }

    const eligibility = evaluateOnlineRatingEligibility(game);
    if (!eligibility.rated) {
      logger.info('reportOnlineMatch unrated', {
        gameId,
        reason: eligibility.reason,
      });
      return { rated: false, reason: eligibility.reason };
    }

    const objective = game.objective as RatedObjective;
    const humans = game.captains.filter((c) => !isAiGameCaptain(c));
    const ais = game.captains.filter(isAiGameCaptain);

    const charter = game.charterId
      ? await loadCharter(game.charterId)
      : null;

    if (charter) {
      try {
        await validateCharterRatedMatch(charter, {
          objective,
          campaignRounds: game.campaignRounds ?? 13,
          rulesProfileId: game.rulesProfileId,
          playerCount: game.captains.length,
          modules: game.modules as CharterModulesInput | undefined,
          houseRules: game.houseRules as CharterHouseRulesInput | undefined,
          participantUids: humans.map((h) => h.id),
        });
      } catch (error) {
        logger.info('reportOnlineMatch unrated', {
          gameId,
          reason: 'charter_mismatch',
          message: error instanceof Error ? error.message : String(error),
        });
        return { rated: false, reason: 'charter_mismatch' };
      }
    }

    // Every human seat must be a non-anonymous account, or the sector is unrated.
    for (const human of humans) {
      if (!(await isVerifiedAccount(human.id))) {
        logger.info('reportOnlineMatch unrated', {
          gameId,
          reason: 'unrated_participant',
          uid: human.id,
        });
        return { rated: false, reason: 'unrated_participant' };
      }
    }

    // Consulting the tactical advisor during live play makes a sector assisted.
    // A rated sector must be unassisted for every captain, so any advisor use
    // (recorded in the coach-presence subcollection) leaves the sector unrated.
    if (await anyCaptainUsedAdvisor(gameId, humans)) {
      logger.info('reportOnlineMatch unrated', { gameId, reason: 'advisor_used' });
      return { rated: false, reason: 'advisor_used' };
    }

    // Module Zeta: team rating uses updateTeamRatings() + per-player squad
    // ranks instead of the FFA path below. `evaluateOnlineRatingEligibility`
    // already returned unrated above unless SQUADRONS_RATING_CALIBRATED is
    // true, so this only runs post-calibration (5.6).
    if (isSquadGame(game)) {
      return reportOnlineSquadMatch(game, gameId, humans, objective, callerUid);
    }

    const ranks = computeOnlineRanks(game);

    // Pre-match ratings snapshot. Read once so every rating delta is computed
    // against the same before-match opponent ratings.
    const ratingByUid = new Map<string, { rating: StoredRating; matches: number }>();
    for (const human of humans) {
      const stats = await loadStats(human.id);
      const track = charter
        ? groupObjectiveRatingStats(
            stats,
            charter.charterId,
            objective,
            charter.seasonKey
          )
        : humanObjectiveRatingStats(stats, objective);
      ratingByUid.set(human.id, {
        rating: resolveEffectivePlayerRating(
          track.rating,
          track.rating.matches,
          startingRatingForObjective(stats, objective)
        ),
        matches: track.rating.matches,
      });
    }

    const table: RatedPlayer[] = [
      ...humans.map((h) => ({
        playerId: h.id,
        rank: ranks.get(h.id) ?? game.captains.length,
        rating: ratingByUid.get(h.id)!.rating,
      })),
      // AI are fixed-rating anchors (context B): they contribute to each human's
      // rating calculation but never receive a rating update themselves.
      ...ais.map((a) => ({
        playerId: a.id,
        rank: ranks.get(a.id) ?? game.captains.length,
        rating: getAIAnchorStored(objective, aiSkill(a)),
      })),
    ];

    let callerReport: {
      rated: true;
      won: boolean;
      rank: number;
      ratingBefore: StoredRating;
      ratingAfter: StoredRating;
      muDelta: number;
      charterId?: string;
      charterRatingBefore?: StoredRating;
      charterRatingAfter?: StoredRating;
      charterMuDelta?: number;
    } | null = null;

    const groupClaim = charter
      ? groupRatedClaimId(charter.charterId, gameId, charter.seasonKey)
      : null;

    const groupLedgerParticipants: RatingEventParticipant[] = [];
    const humanLedgerParticipants: RatingEventParticipant[] = [];
    const certPlayers: Array<{
      uid: string;
      displayName: string;
      rank: number;
      score: number;
      ratingBefore: StoredRating;
      ratingAfter: StoredRating;
      charterId?: string;
      globalRatingBefore?: StoredRating;
      globalRatingAfter?: StoredRating;
    }> = [];
    const appliedAt = new Date().toISOString();

    for (const human of humans) {
      const ref = db.collection('playerStats').doc(human.id);

      // Per-player transaction: re-check the idempotency claim under lock so two
      // captains reporting the same completed sector concurrently cannot
      // double-apply. Opponent ratings come from the pre-match `table` snapshot.
      const applied = await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(ref);
        const fresh = freshSnap.exists
          ? (freshSnap.data() as PlayerStatsDocument)
          : null;
        if (!charter && fresh?.humanRatedGameIds?.includes(gameId)) {
          return null;
        }
        if (charter?.isGlobalOfficial && fresh?.humanRatedGameIds?.includes(gameId)) {
          return null;
        }
        if (groupClaim && fresh?.groupRatedIds?.includes(groupClaim)) {
          return null;
        }

        let humanRating = fresh?.humanRating;
        let groupRating = fresh?.groupRating;
        let ratingBefore: StoredRating = { mu: 25.0, sigma: 8.33, matches: 0, displayRating: 0.0 };
        let ratingAfter: StoredRating = { mu: 25.0, sigma: 8.33, matches: 0, displayRating: 0.0 };
        let won = false;
        let rank = 0;
        let charterRatingBefore: StoredRating | undefined;
        let charterRatingAfter: StoredRating | undefined;
        let humanPoolBefore: StoredRating | undefined;
        let humanPoolAfter: StoredRating | undefined;

        if (charter) {
          const groupApplied = applyGroupRatingForPlayer(
            fresh,
            charter.charterId,
            objective,
            table,
            human.id,
            charter.seasonKey
          );
          if (!groupApplied) {
            return null;
          }
          groupRating = groupApplied.groupRating;
          charterRatingBefore = groupApplied.ratingBefore;
          charterRatingAfter = groupApplied.ratingAfter;
          ratingBefore = groupApplied.ratingBefore;
          ratingAfter = groupApplied.ratingAfter;
          won = groupApplied.won;
          rank = groupApplied.rank;

          if (charter.isGlobalOfficial) {
            const humanApplied = applyHumanRatingForPlayer(
              fresh,
              objective,
              table,
              human.id
            );
            if (humanApplied) {
              humanRating = humanApplied.humanRating;
              humanPoolBefore = humanApplied.ratingBefore;
              humanPoolAfter = humanApplied.ratingAfter;
              ratingBefore = humanApplied.ratingBefore;
              ratingAfter = humanApplied.ratingAfter;
            }
          }
        } else {
          const result = applyHumanRatingForPlayer(fresh, objective, table, human.id);
          if (!result) {
            return null;
          }
          humanRating = result.humanRating;
          ratingBefore = result.ratingBefore;
          ratingAfter = result.ratingAfter;
          won = result.won;
          rank = result.rank;
          humanPoolBefore = result.ratingBefore;
          humanPoolAfter = result.ratingAfter;
        }

        const now = new Date().toISOString();
        const base: PlayerStatsDocument = fresh ?? {
          uid: human.id,
          displayName: human.displayName || 'Captain',
          matchesCompleted: 0,
          matchesWon: 0,
          roundsPlayed: 0,
          roundsWon: 0,
          totalPoints: 0,
          updatedAt: now,
        };

        const historyEntry = {
          playedAt: now,
          objective,
          opponentContext: 'human' as const,
          playerCount: game.captains.length,
          finishRank: rank,
          won,
          advisorUsed: false,
          ratingBefore,
          ratingAfter,
          muDelta: ratingAfter.mu - ratingBefore.mu,
          charterId: charter?.charterId,
          charterName: charter?.name,
        };
        const priorHistory =
          (base as { matchHistory?: unknown[] }).matchHistory ?? [];

        tx.set(
          ref,
          {
            ...base,
            displayName: human.displayName || base.displayName,
            matchesCompleted: base.matchesCompleted + 1,
            matchesWon: base.matchesWon + (won ? 1 : 0),
            humanRating,
            groupRating,
            humanRatedGameIds:
              !charter || charter.isGlobalOfficial
                ? [...(base.humanRatedGameIds ?? []), gameId]
                : base.humanRatedGameIds,
            groupRatedIds:
              groupClaim
                ? [...(base.groupRatedIds ?? []), groupClaim]
                : base.groupRatedIds,
            matchHistory: [historyEntry, ...priorHistory].slice(
              0,
              MAX_MATCH_HISTORY
            ),
            lastPlayedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        return {
          won,
          rank,
          ratingBefore,
          ratingAfter,
          charterRatingBefore,
          charterRatingAfter,
          humanPoolBefore,
          humanPoolAfter,
        };
      });

      if (applied) {
        if (applied.charterRatingBefore && applied.charterRatingAfter) {
          groupLedgerParticipants.push({
            uid: human.id,
            displayName: human.displayName || 'Captain',
            rank: applied.rank,
            won: applied.won,
            ratingBefore: applied.charterRatingBefore,
            ratingAfter: applied.charterRatingAfter,
          });
        }
        if (applied.humanPoolBefore && applied.humanPoolAfter) {
          humanLedgerParticipants.push({
            uid: human.id,
            displayName: human.displayName || 'Captain',
            rank: applied.rank,
            won: applied.won,
            ratingBefore: applied.humanPoolBefore,
            ratingAfter: applied.humanPoolAfter,
          });
        }

        const score =
          typeof human.pointsScore === 'number' ? human.pointsScore : 0;
        if (applied.charterRatingBefore && applied.charterRatingAfter) {
          certPlayers.push({
            uid: human.id,
            displayName: human.displayName || 'Captain',
            rank: applied.rank,
            score,
            ratingBefore: applied.charterRatingBefore,
            ratingAfter: applied.charterRatingAfter,
            charterId: charter?.charterId,
            globalRatingBefore: applied.humanPoolBefore,
            globalRatingAfter: applied.humanPoolAfter,
          });
        } else if (applied.humanPoolBefore && applied.humanPoolAfter) {
          certPlayers.push({
            uid: human.id,
            displayName: human.displayName || 'Captain',
            rank: applied.rank,
            score,
            ratingBefore: applied.humanPoolBefore,
            ratingAfter: applied.humanPoolAfter,
          });
        }
      }

      if (applied && human.id === callerUid) {
        callerReport = {
          rated: true,
          won: applied.won,
          rank: applied.rank,
          ratingBefore: applied.ratingBefore,
          ratingAfter: applied.ratingAfter,
          muDelta: applied.ratingAfter.mu - applied.ratingBefore.mu,
          ...(charter
            ? {
                charterId: charter.charterId,
                charterRatingBefore: applied.charterRatingBefore,
                charterRatingAfter: applied.charterRatingAfter,
                charterMuDelta:
                  applied.charterRatingAfter !== undefined &&
                  applied.charterRatingBefore !== undefined
                    ? applied.charterRatingAfter.mu - applied.charterRatingBefore.mu
                    : undefined,
              }
            : {}),
        };
      }
    }

    const snapshot = snapshotFromRatedTable(table);
    const track = objectiveToTrackKey(objective);
    if (groupLedgerParticipants.length > 0 && charter) {
      await writeRatingEventIfAbsent({
        eventId: onlineRatingEventId(gameId, 'group'),
        source: 'online',
        matchId: gameId,
        pool: 'group',
        track,
        objective,
        playedAt: appliedAt,
        appliedAt,
        memberUids: groupLedgerParticipants.map((p) => p.uid),
        participants: groupLedgerParticipants,
        snapshot,
        charterId: charter.charterId,
        seasonKey: charter.seasonKey,
        writer: 'reportOnlineMatch',
      });
    }
    if (humanLedgerParticipants.length > 0) {
      await writeRatingEventIfAbsent({
        eventId: onlineRatingEventId(gameId, 'human'),
        source: 'online',
        matchId: gameId,
        pool: 'human',
        track,
        objective,
        playedAt: appliedAt,
        appliedAt,
        memberUids: humanLedgerParticipants.map((p) => p.uid),
        participants: humanLedgerParticipants,
        snapshot,
        writer: 'reportOnlineMatch',
      });
    }

    let certificateMatchCode: string | undefined;
    if (certPlayers.length > 0) {
      const issued = await issueOnlineSectorCertificate({
        gameId,
        objective,
        campaignRounds: game.campaignRounds ?? 13,
        players: certPlayers,
        charter: charter
          ? {
              charterId: charter.charterId,
              name: charter.name,
              slug: charter.slug,
              rulesProfileId: charter.rulesProfileId,
              playerCount: charter.playerCount,
              campaignRounds: charter.campaignRounds,
              seasonLabel: charter.seasonLabel,
            }
          : undefined,
      });
      certificateMatchCode = issued?.matchCode;
    }

    if (callerReport) {
      return {
        ...callerReport,
        ...(certificateMatchCode ? { certificateMatchCode } : {}),
      };
    }
    return {
      rated: true,
      alreadyApplied: true,
      ...(certificateMatchCode ? { certificateMatchCode } : {}),
    };
  }
);
