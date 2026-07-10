import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

import { requireSignedIn, requireVerifiedUser } from './auth';
import {
  kFactor,
  opponentTeiForObjective,
  resolveEffectivePlayerTei,
  updateUnassistedTei,
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  type AiSkillLevel,
} from './tei/stats-elo';
import { objectiveTeiKey, type RatedObjective } from './tei/rated-match-schema';
import {
  replayLocalAiHumanActions,
  type SerializableLocalGameConfig,
} from './practice-ai-replay';
import type { GameAction } from 'warp12-engine';

const db = admin.firestore();
const MAX_MATCH_HISTORY = 60;

function objectiveTeiStats(
  bucket: Record<string, unknown>,
  objective: RatedObjective
): {
  unassistedMatches: number;
  unassistedWins: number;
  unassistedTei?: number;
} {
  const key = objectiveTeiKey(objective);
  const track = (bucket[key] as Record<string, number> | undefined) ?? {};
  return {
    unassistedMatches: track.unassistedMatches ?? 0,
    unassistedWins: track.unassistedWins ?? 0,
    unassistedTei: track.unassistedTei,
  };
}

function appendMatchHistory(
  current: readonly Record<string, unknown>[] | undefined,
  entry: Record<string, unknown>
): Record<string, unknown>[] {
  return [entry, ...(current ?? [])].slice(0, MAX_MATCH_HISTORY);
}

export const reportPracticeAiMatch = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = requireSignedIn(request);
    const data = request.data as {
      displayName?: string;
      skill?: AiSkillLevel;
      objective?: RatedObjective;
      advisorUsed?: boolean;
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
      });
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

    let teiBefore: number | null = null;
    let teiAfter: number | null = null;

    if (!data.advisorUsed) {
      const key = objectiveTeiKey(data.objective);
      const prior = objectiveTeiStats(bucket, data.objective);
      const startingTei = existing?.startingTei?.[key] as number | undefined;
      teiBefore = resolveEffectivePlayerTei(
        prior.unassistedTei,
        prior.unassistedMatches,
        startingTei
      );
      teiAfter = updateUnassistedTei(
        teiBefore,
        opponentTeiForObjective(
          data.objective,
          data.skill,
          data.config.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID
        ),
        won ? 1 : 0,
        kFactor(prior.unassistedMatches)
      );
      bucket[key] = {
        unassistedMatches: prior.unassistedMatches + 1,
        unassistedWins: prior.unassistedWins + (won ? 1 : 0),
        unassistedTei: teiAfter,
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
      ...(teiBefore != null ? { teiBefore } : {}),
      ...(teiAfter != null ? { teiAfter } : {}),
      ...(teiBefore != null && teiAfter != null
        ? { teiDelta: teiAfter - teiBefore }
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
        startingTei: existing?.startingTei,
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

    return {
      rated: !data.advisorUsed,
      won,
      teiBefore,
      teiAfter,
      teiDelta:
        teiBefore != null && teiAfter != null ? teiAfter - teiBefore : null,
    };
  }
);
