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
  humanObjectiveTeiStats,
  startingTeiForObjective,
  type PlayerStatsDocument,
} from './tei';

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
      const track = humanObjectiveTeiStats(stats, objective);
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
        tei: opponentTeiForObjective(objective, aiSkill(a)),
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
    } | null = null;

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
        if (fresh?.humanRatedGameIds?.includes(gameId)) {
          return null;
        }

        const result = applyHumanTeiForPlayer(fresh, objective, table, human.id);
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
          opponentContext: 'human' as const,
          playerCount: game.captains.length,
          finishRank: result.rank,
          won: result.won,
          advisorUsed: false,
          teiBefore: result.teiBefore,
          teiAfter: result.teiAfter,
          teiDelta: result.teiAfter - result.teiBefore,
        };
        const priorHistory =
          (base as { matchHistory?: unknown[] }).matchHistory ?? [];

        tx.set(
          ref,
          {
            ...base,
            displayName: human.displayName || base.displayName,
            matchesCompleted: base.matchesCompleted + 1,
            matchesWon: base.matchesWon + (result.won ? 1 : 0),
            humanTei: result.humanTei,
            humanRatedGameIds: [...(base.humanRatedGameIds ?? []), gameId],
            matchHistory: [historyEntry, ...priorHistory].slice(
              0,
              MAX_MATCH_HISTORY
            ),
            lastPlayedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        return result;
      });

      if (applied && human.id === callerUid) {
        callerReport = {
          rated: true,
          won: applied.won,
          rank: applied.rank,
          teiBefore: applied.teiBefore,
          teiAfter: applied.teiAfter,
          teiDelta: applied.teiAfter - applied.teiBefore,
        };
      }
    }

    return callerReport ?? { rated: true, alreadyApplied: true };
  }
);
