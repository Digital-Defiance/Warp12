import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { requireSignedIn, requireVerifiedUser, hasRole } from './auth';
import { assertNotBanned } from './bans';
import { practiceMatchTeiEligible } from './practice-match-tei-eligibility.js';
import {
  getAIAnchorRating,
  getAIAnchorStored,
  resolveEffectivePlayerRating,
  type AiSkillLevel,
} from './tei/stats-openskill';
import {
  objectiveTeiKey,
  type RatedObjective,
  type StoredRating,
  type ObjectiveRatingStats,
} from './tei/rated-match-schema';
import { toStoredRatingWithGrade } from './tei/rating-types';
import {
  practiceRatingEventId,
  writeRatingEventIfAbsent,
  objectiveToTrackKey,
} from './tei';
import { hasWarpedModules, updateVsAI, type GameAction } from 'warp12-engine';
import {
  replayLocalAiHumanActions,
  type SerializableLocalGameConfig,
} from './practice-ai-replay';

const db = admin.firestore();
const MAX_MATCH_HISTORY = 60;

function objectiveRatingStats(
  bucket: Record<string, unknown>,
  objective: RatedObjective
): ObjectiveRatingStats {
  const key = objectiveTeiKey(objective);
  const track = (bucket[key] as ObjectiveRatingStats | undefined);
  return track ?? {
    rating: { mu: 25.0, sigma: 25.0 / 3, matches: 0, displayRating: 0.0 },
    wins: 0,
  };
}

function appendMatchHistory(
  current: readonly Record<string, unknown>[] | undefined,
  entry: Record<string, unknown>
): Record<string, unknown>[] {
  return [entry, ...(current ?? [])].slice(0, MAX_MATCH_HISTORY);
}

/** Mirrors apps/Warp12 `isRatedLocalGame` — keep in sync for server TEI gating. */
function isTeiEligiblePracticeConfig(
  config: SerializableLocalGameConfig
): boolean {
  if ((config.maxPip ?? 12) !== 12) {
    return false;
  }
  if (config.rated === false) {
    return false;
  }
  if (hasWarpedModules(config.modules)) {
    return false;
  }
  if ((config.humanCaptains?.length ?? 1) >= 2) {
    return false;
  }
  if (config.aiCaptains?.some((captain) => captain.extendedThinking === true)) {
    return false;
  }
  return true;
}

export const reportPracticeAiMatch = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = requireSignedIn(request);
    await assertNotBanned(uid, request);
    const data = request.data as {
      displayName?: string;
      skill?: AiSkillLevel;
      objective?: RatedObjective;
      advisorUsed?: boolean;
      /** Bridge console unlock (`GABBAGABBAHEY`) used during this match. */
      devToolsUsed?: boolean;
      opponentClass1Star?: boolean;
      decisionPct?: number;
      decisionGrade?: string;
      seed?: number;
      config?: SerializableLocalGameConfig;
      humanActions?: GameAction[];
    };

    if (
      data.skill !== 'ensign' &&
      data.skill !== 'lieutenant' &&
      data.skill !== 'commander'
    ) {
      throw new HttpsError('invalid-argument', 'Invalid skill.');
    }
    if (data.objective !== 'go-out' && data.objective !== 'points') {
      throw new HttpsError('invalid-argument', 'Invalid objective.');
    }
    if (typeof data.advisorUsed !== 'boolean') {
      logger.warn('reportPracticeAiMatch rejected', {
        uid,
        reason: 'missing_advisor_used',
      });
      throw new HttpsError('invalid-argument', 'advisorUsed required.');
    }
    const devToolsUsed = data.devToolsUsed === true;
    if (data.opponentClass1Star) {
      logger.warn('reportPracticeAiMatch rejected', {
        uid,
        reason: 'class1_star_opponent',
      });
      throw new HttpsError(
        'failed-precondition',
        'Class I* matches are not eligible for verified TEI yet.'
      );
    }
    if (typeof data.seed !== 'number' || !Number.isFinite(data.seed)) {
      logger.warn('reportPracticeAiMatch rejected', { uid, reason: 'missing_seed' });
      throw new HttpsError('invalid-argument', 'seed required.');
    }
    if (!data.config || typeof data.config !== 'object') {
      logger.warn('reportPracticeAiMatch rejected', { uid, reason: 'missing_config' });
      throw new HttpsError('invalid-argument', 'config required.');
    }
    if ((data.config.maxPip ?? 12) !== 12) {
      logger.warn('reportPracticeAiMatch rejected', {
        uid,
        reason: 'exhibition_set',
        maxPip: data.config.maxPip,
      });
      throw new HttpsError(
        'failed-precondition',
        'Warp 9 / 15 / 18 are exhibition sets — TEI is only tracked on Warp 12.'
      );
    }
    if (!Array.isArray(data.humanActions)) {
      logger.warn('reportPracticeAiMatch rejected', {
        uid,
        reason: 'missing_human_actions',
      });
      throw new HttpsError('invalid-argument', 'humanActions required.');
    }

    const teiEligible = practiceMatchTeiEligible({
      configEligible: isTeiEligiblePracticeConfig(data.config),
      advisorUsed: data.advisorUsed,
      devToolsUsed,
      isAdmin: hasRole(request, 'admin'),
    });

    if (devToolsUsed) {
      logger.info('reportPracticeAiMatch console tools', {
        uid,
        teiEligible,
        isAdmin: hasRole(request, 'admin'),
      });
    }

    const replay = await replayLocalAiHumanActions({
      config: data.config,
      seed: data.seed,
      humanActions: data.humanActions,
    });

    if (!replay.ok) {
      logger.warn('reportPracticeAiMatch replay failed', {
        uid,
        violation: replay.violation,
        steps: replay.steps,
        objective: data.objective,
        skill: data.skill,
        teiEligible,
      });
      // Casual / exhibition / advisor-voided matches still hit this callable for
      // localAi counters. Do not scare the captain with a TEI verification error
      // when the sector was never eligible for rating.
      if (!teiEligible) {
        return {
          rated: false,
          won: false,
          ratingBefore: null,
          ratingAfter: null,
          muDelta: null,
        };
      }
      throw new HttpsError(
        'failed-precondition',
        `Match verification failed: ${replay.violation}`
      );
    }

    const won = replay.humanWon;

    if (!data.advisorUsed) {
      requireVerifiedUser(request);
    }

    const ref = db.collection('playerStats').doc(uid);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data()! : null;
    const now = new Date().toISOString();

    const localAi = {
      ...((existing?.localAi as Record<string, Record<string, unknown>>) ?? {}),
    };
    const bucket = { ...(localAi[data.skill] ?? {}) };
    bucket.matchesCompleted = ((bucket.matchesCompleted as number) ?? 0) + 1;
    bucket.matchesWon = ((bucket.matchesWon as number) ?? 0) + (won ? 1 : 0);
    bucket.advisorMatches =
      ((bucket.advisorMatches as number) ?? 0) + (data.advisorUsed ? 1 : 0);
    bucket.advisorWins =
      ((bucket.advisorWins as number) ?? 0) + (data.advisorUsed && won ? 1 : 0);

    let ratingBefore: StoredRating | null = null;
    let ratingAfter: StoredRating | null = null;

    if (teiEligible) {
      const key = objectiveTeiKey(data.objective);
      const prior = objectiveRatingStats(bucket, data.objective);
      const startingRating = existing?.startingRating?.[key] as { mu: number; sigma: number } | undefined;
      
      ratingBefore = resolveEffectivePlayerRating(
        prior.rating,
        prior.rating.matches,
        startingRating
      );

      const aiAnchor = getAIAnchorRating(
        data.objective,
        data.skill
      );

      const updatedRating = updateVsAI(
        uid,
        { mu: ratingBefore.mu, sigma: ratingBefore.sigma, matches: ratingBefore.matches },
        data.skill,
        aiAnchor,
        won
      );

      ratingAfter = toStoredRatingWithGrade(
        {
          ...updatedRating,
          matches: ratingBefore.matches + 1,
        },
        ratingBefore // Pass previous rating for hysteresis
      );

      bucket[key] = {
        rating: ratingAfter,
        wins: prior.wins + (won ? 1 : 0),
      };
    }

    localAi[data.skill] = bucket;

    const historyEntry = {
      playedAt: now,
      objective: data.objective,
      opponentSkill: data.skill,
      won,
      advisorUsed: data.advisorUsed,
      ...(data.decisionPct !== undefined ? { decisionPct: data.decisionPct } : {}),
      ...(data.decisionGrade ? { decisionGrade: data.decisionGrade } : {}),
      ...(ratingBefore != null ? { ratingBefore } : {}),
      ...(ratingAfter != null ? { ratingAfter } : {}),
      ...(ratingBefore != null && ratingAfter != null
        ? { muDelta: ratingAfter.mu - ratingBefore.mu }
        : {}),
      verified: true,
      replaySteps: replay.steps,
    };

    await ref.set(
      {
        uid,
        displayName:
          data.displayName?.trim() || existing?.displayName || 'Captain',
        matchesCompleted: ((existing?.matchesCompleted as number) ?? 0) + 1,
        matchesWon: ((existing?.matchesWon as number) ?? 0) + (won ? 1 : 0),
        roundsPlayed: (existing?.roundsPlayed as number) ?? 0,
        roundsWon: (existing?.roundsWon as number) ?? 0,
        totalPoints: (existing?.totalPoints as number) ?? 0,
        startingRating: existing?.startingRating,
        localAi,
        matchHistory: appendMatchHistory(
          existing?.matchHistory as Record<string, unknown>[] | undefined,
          historyEntry
        ),
        lastPlayedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    if (teiEligible && ratingBefore && ratingAfter) {
      const aiAnchor = getAIAnchorStored(data.objective, data.skill);
      await writeRatingEventIfAbsent({
        eventId: practiceRatingEventId(uid, data.seed, data.skill, data.objective),
        source: 'practice',
        matchId: `practice:${uid}:${data.seed}`,
        pool: 'localAi',
        track: objectiveToTrackKey(data.objective),
        objective: data.objective,
        playedAt: now,
        appliedAt: now,
        memberUids: [uid],
        participants: [
          {
            uid,
            displayName:
              data.displayName?.trim() || existing?.displayName || 'Captain',
            rank: won ? 1 : 2,
            won,
            ratingBefore,
            ratingAfter,
          },
        ],
        snapshot: [
          {
            playerId: uid,
            rank: won ? 1 : 2,
            rating: ratingBefore,
          },
          {
            playerId: `ai:${data.skill}`,
            rank: won ? 2 : 1,
            rating: aiAnchor,
          },
        ],
        skill: data.skill,
        writer: 'reportPracticeAiMatch',
      });
    }

    return {
      rated: teiEligible,
      won,
      ratingBefore,
      ratingAfter,
      muDelta:
        ratingBefore != null && ratingAfter != null
          ? ratingAfter.mu - ratingBefore.mu
          : null,
    };
  }
);
