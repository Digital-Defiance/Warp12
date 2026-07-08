import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import { requireVerifiedUser } from './auth';
import {
  opponentTeiForObjective,
  rankCompetition,
  resolveEffectivePlayerTei,
  type AiSkillLevel,
  type RatedObjective,
  type TeiRankedPlayer,
} from './tei/stats-elo';
import {
  applyHumanTeiForPlayer,
  applyGroupTeiForPlayer,
  groupObjectiveTeiStats,
  groupRatedClaimId,
  humanObjectiveTeiStats,
  startingTeiForObjective,
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  type PlayerStatsDocument,
} from './tei';
import {
  loadCharter,
  validateCharterRatedMatch,
} from './charters';
import type { CharterHouseRulesInput, CharterModulesInput } from './tei';

const db = admin.firestore();
const AI_ID_PREFIX = 'ai:';
const AI_SKILL_LEVELS: readonly AiSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];
const MAX_MATCH_HISTORY = 60;

/** Minimal view of the shared game document — only fields rating needs. */
interface GameCaptainDoc {
  id: string;
  displayName: string;
  pointsScore?: number;
  isAi?: boolean;
  skill?: string;
  class1Star?: boolean;
}

interface GameRoundDoc {
  roundWinnerId?: string | null;
  handCounts?: Record<string, number>;
}

interface GameDoc {
  id: string;
  phase: string;
  objective: string;
  rated?: boolean;
  campaignRounds?: number;
  charterId?: string;
  rulesProfileId?: string;
  modules?: {
    qContinuum: boolean;
    salamanderPenalty: boolean;
    subspaceFracture: boolean;
    subspaceFractureScope: string;
  };
  houseRules?: Record<string, boolean | number | undefined>;
  captains: GameCaptainDoc[];
  round?: GameRoundDoc | null;
}

/** Outcome of the eligibility gate — a match is either rated or explained. */
export type OnlineRatingEligibility =
  | { rated: true }
  | { rated: false; reason: OnlineRatingIneligibleReason };

export type OnlineRatingIneligibleReason =
  | 'casual'
  | 'objective_not_rated'
  | 'not_enough_humans'
  | 'class1_star_present'
  | 'unrated_ai';

export function isAiGameCaptain(captain: GameCaptainDoc): boolean {
  return captain.isAi === true || captain.id.startsWith(AI_ID_PREFIX);
}

function aiSkill(captain: GameCaptainDoc): AiSkillLevel {
  return (AI_SKILL_LEVELS as readonly string[]).includes(captain.skill ?? '')
    ? (captain.skill as AiSkillLevel)
    : 'lieutenant';
}

/**
 * Verify the roster is rateable under context B (humans anchored against Class
 * II–IV AI). Human verification (non-anonymous accounts) is checked separately
 * against Firebase Auth — this covers only what the game document itself tells us.
 */
export function evaluateOnlineRatingEligibility(
  game: Pick<GameDoc, 'objective' | 'captains' | 'rated'>
): OnlineRatingEligibility {
  if (game.rated === false) {
    return { rated: false, reason: 'casual' };
  }
  if (game.objective !== 'go-out' && game.objective !== 'points') {
    return { rated: false, reason: 'objective_not_rated' };
  }

  const humans = game.captains.filter((c) => !isAiGameCaptain(c));
  const ais = game.captains.filter(isAiGameCaptain);

  if (humans.length < 2) {
    return { rated: false, reason: 'not_enough_humans' };
  }

  for (const ai of ais) {
    if (ai.class1Star === true) {
      return { rated: false, reason: 'class1_star_present' };
    }
    if (ai.skill !== undefined && !AI_SKILL_LEVELS.includes(ai.skill as AiSkillLevel)) {
      return { rated: false, reason: 'unrated_ai' };
    }
  }

  return { rated: true };
}

/** Competition ranks across the full table (humans + AI), 1 = best. */
export function computeOnlineRanks(game: GameDoc): Map<string, number> {
  if (game.objective === 'go-out') {
    const winner = game.round?.roundWinnerId ?? null;
    const handCounts = game.round?.handCounts ?? {};
    return rankCompetition(
      game.captains.map((c) => ({
        playerId: c.id,
        // Winner sorts strictly ahead; the rest by tiles remaining (fewer = better).
        score: c.id === winner ? -1 : handCounts[c.id] ?? Number.MAX_SAFE_INTEGER,
      })),
      true
    );
  }

  return rankCompetition(
    game.captains.map((c) => ({ playerId: c.id, score: c.pointsScore ?? 0 })),
    true
  );
}

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

export const reportOnlineMatch = onCall(
  { memory: '256MiB', timeoutSeconds: 60 },
  async (request) => {
    const callerUid = requireVerifiedUser(request);
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

    const ranks = computeOnlineRanks(game);

    // Pre-match ratings snapshot. Read once so every pairwise delta is computed
    // against the same before-match opponent ratings.
    const teiByUid = new Map<string, { tei: number; matches: number }>();
    for (const human of humans) {
      const stats = await loadStats(human.id);
      const track = charter
        ? groupObjectiveTeiStats(
            stats,
            charter.charterId,
            objective,
            charter.seasonKey
          )
        : humanObjectiveTeiStats(stats, objective);
      teiByUid.set(human.id, {
        tei: resolveEffectivePlayerTei(
          track.unassistedTei,
          track.unassistedMatches,
          startingTeiForObjective(stats, objective)
        ),
        matches: track.unassistedMatches,
      });
    }

    const table: TeiRankedPlayer[] = [
      ...humans.map((h) => ({
        playerId: h.id,
        rank: ranks.get(h.id) ?? game.captains.length,
        tei: teiByUid.get(h.id)!.tei,
        unassistedMatches: teiByUid.get(h.id)!.matches,
      })),
      // AI are fixed-rating anchors (context B): they contribute to each human's
      // pairwise sum but never receive a rating update themselves.
      ...ais.map((a) => ({
        playerId: a.id,
        rank: ranks.get(a.id) ?? game.captains.length,
        tei: opponentTeiForObjective(
          objective,
          aiSkill(a),
          game.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID
        ),
        unassistedMatches: 0,
      })),
    ];

    let callerReport: {
      rated: true;
      won: boolean;
      rank: number;
      teiBefore: number;
      teiAfter: number;
      teiDelta: number;
      charterId?: string;
      charterTeiBefore?: number;
      charterTeiAfter?: number;
      charterTeiDelta?: number;
    } | null = null;

    const groupClaim = charter
      ? groupRatedClaimId(charter.charterId, gameId, charter.seasonKey)
      : null;

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

        let humanTei = fresh?.humanTei;
        let groupTei = fresh?.groupTei;
        let teiBefore = 0;
        let teiAfter = 0;
        let won = false;
        let rank = 0;
        let charterTeiBefore: number | undefined;
        let charterTeiAfter: number | undefined;

        if (charter) {
          const groupApplied = applyGroupTeiForPlayer(
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
          groupTei = groupApplied.groupTei;
          charterTeiBefore = groupApplied.teiBefore;
          charterTeiAfter = groupApplied.teiAfter;
          teiBefore = groupApplied.teiBefore;
          teiAfter = groupApplied.teiAfter;
          won = groupApplied.won;
          rank = groupApplied.rank;

          if (charter.isGlobalOfficial) {
            const humanApplied = applyHumanTeiForPlayer(
              fresh,
              objective,
              table,
              human.id
            );
            if (humanApplied) {
              humanTei = humanApplied.humanTei;
              teiBefore = humanApplied.teiBefore;
              teiAfter = humanApplied.teiAfter;
            }
          }
        } else {
          const result = applyHumanTeiForPlayer(fresh, objective, table, human.id);
          if (!result) {
            return null;
          }
          humanTei = result.humanTei;
          teiBefore = result.teiBefore;
          teiAfter = result.teiAfter;
          won = result.won;
          rank = result.rank;
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
          teiBefore,
          teiAfter,
          teiDelta: teiAfter - teiBefore,
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
            humanTei,
            groupTei,
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
          teiBefore,
          teiAfter,
          charterTeiBefore,
          charterTeiAfter,
        };
      });

      if (applied && human.id === callerUid) {
        callerReport = {
          rated: true,
          won: applied.won,
          rank: applied.rank,
          teiBefore: applied.teiBefore,
          teiAfter: applied.teiAfter,
          teiDelta: applied.teiAfter - applied.teiBefore,
          ...(charter
            ? {
                charterId: charter.charterId,
                charterTeiBefore: applied.charterTeiBefore,
                charterTeiAfter: applied.charterTeiAfter,
                charterTeiDelta:
                  applied.charterTeiAfter !== undefined &&
                  applied.charterTeiBefore !== undefined
                    ? applied.charterTeiAfter - applied.charterTeiBefore
                    : undefined,
              }
            : {}),
        };
      }
    }

    return callerReport ?? { rated: true, alreadyApplied: true };
  }
);
