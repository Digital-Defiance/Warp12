import { doc, getDoc, runTransaction } from 'firebase/firestore';

import type { GameObjective, WarpSkillLevel } from 'warp12-engine';
import {
  clampAcademyTei,
  WARP_SKILL_LEVELS,
} from 'warp12-engine';

import { getFirestoreDb, isFirebaseConfigured } from './config.js';
import {
  DEFAULT_UNASSISTED_TEI,
  kFactor,
  opponentTeiForObjective,
  resolveEffectivePlayerTei,
  updateUnassistedTei,
} from './stats-elo.js';
import {
  appendMatchHistory,
  type MatchHistoryEntry,
} from './match-history.js';
import {
  emptyLocalAiSkillStats,
  emptyLocalAiStats,
  objectiveTeiKey,
  objectiveTeiStats,
  type LocalAiSkillStats,
  type PlayerStatsDocument,
  type RatedObjective,
} from './stats-schema.js';

const PLAYER_STATS = 'playerStats';

/** Firestore rejects explicit `undefined` in documents. */
export function stripUndefinedFieldsForFirestore<T extends Record<string, unknown>>(
  value: T
): T {
  const next = { ...value };
  for (const key of Object.keys(next)) {
    const field = next[key];
    if (field === undefined) {
      delete next[key];
      continue;
    }
    if (key === 'matchHistory' && Array.isArray(field)) {
      next[key] = field.map((entry) =>
        stripUndefinedFieldsForFirestore(entry as Record<string, unknown>)
      );
    }
  }
  return next;
}

export interface ReportLocalAiMatchInput {
  uid: string;
  displayName: string;
  skill: WarpSkillLevel;
  objective: RatedObjective;
  won: boolean;
  advisorUsed: boolean;
  decisionPct?: number;
  decisionGrade?: string;
}

export interface LocalAiMatchReport {
  rated: boolean;
  won: boolean;
  advisorUsed: boolean;
  objective: RatedObjective;
  skill: WarpSkillLevel;
  teiBefore: number | null;
  teiAfter: number | null;
  teiDelta: number | null;
}

export function startingTeiForObjective(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective
): number | undefined {
  const key = objectiveTeiKey(objective);
  return doc?.startingTei?.[key];
}

export function incrementLocalAiSkillStats(
  current: LocalAiSkillStats,
  input: Pick<
    ReportLocalAiMatchInput,
    'won' | 'advisorUsed' | 'skill' | 'objective'
  >,
  options?: { startingTei?: number }
): LocalAiSkillStats {
  const next: LocalAiSkillStats = {
    ...current,
    matchesCompleted: current.matchesCompleted + 1,
    matchesWon: current.matchesWon + (input.won ? 1 : 0),
    advisorMatches: current.advisorMatches + (input.advisorUsed ? 1 : 0),
    advisorWins:
      current.advisorWins + (input.advisorUsed && input.won ? 1 : 0),
  };

  if (!input.advisorUsed) {
    const key = objectiveTeiKey(input.objective);
    const prior = objectiveTeiStats(current, input.objective);
    const teiBefore = resolveEffectivePlayerTei(
      prior.unassistedTei,
      prior.unassistedMatches,
      options?.startingTei
    );
    next[key] = {
      unassistedMatches: prior.unassistedMatches + 1,
      unassistedWins: prior.unassistedWins + (input.won ? 1 : 0),
      unassistedTei: updateUnassistedTei(
        teiBefore,
        opponentTeiForObjective(input.objective, input.skill),
        input.won ? 1 : 0,
        kFactor(prior.unassistedMatches)
      ),
    };
  }

  return next;
}

export function previewLocalAiMatchReport(
  current: LocalAiSkillStats,
  input: ReportLocalAiMatchInput,
  startingTei?: number
): LocalAiMatchReport {
  if (input.advisorUsed) {
    return {
      rated: false,
      won: input.won,
      advisorUsed: true,
      objective: input.objective,
      skill: input.skill,
      teiBefore: null,
      teiAfter: null,
      teiDelta: null,
    };
  }

  const prior = objectiveTeiStats(current, input.objective);
  const teiBefore = resolveEffectivePlayerTei(
    prior.unassistedTei,
    prior.unassistedMatches,
    startingTei
  );
  const teiAfter = updateUnassistedTei(
    teiBefore,
    opponentTeiForObjective(input.objective, input.skill),
    input.won ? 1 : 0,
    kFactor(prior.unassistedMatches)
  );

  return {
    rated: true,
    won: input.won,
    advisorUsed: false,
    objective: input.objective,
    skill: input.skill,
    teiBefore,
    teiAfter,
    teiDelta: teiAfter - teiBefore,
  };
}

export function ratedObjective(objective: GameObjective): RatedObjective | null {
  return objective === 'go-out' || objective === 'penalty' ? objective : null;
}

export async function fetchPlayerStats(
  uid: string
): Promise<PlayerStatsDocument | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }
  const db = getFirestoreDb();
  if (!db) {
    return null;
  }
  const snap = await getDoc(doc(db, PLAYER_STATS, uid));
  if (!snap.exists()) {
    return null;
  }
  return snap.data() as PlayerStatsDocument;
}

export async function setAcademyPlacement(
  uid: string,
  objective: RatedObjective,
  skill: WarpSkillLevel,
  tei: number
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const clamped = clampAcademyTei(skill, tei, objective);
  const key = objectiveTeiKey(objective);
  const now = new Date().toISOString();

  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;

    if (!needsAcademyPlacementForObjective(existing, objective)) {
      return;
    }

    tx.set(
      ref,
      {
        uid,
        displayName: existing?.displayName ?? 'Captain',
        matchesCompleted: existing?.matchesCompleted ?? 0,
        matchesWon: existing?.matchesWon ?? 0,
        roundsPlayed: existing?.roundsPlayed ?? 0,
        roundsWon: existing?.roundsWon ?? 0,
        totalPenaltyPoints: existing?.totalPenaltyPoints ?? 0,
        localAi: existing?.localAi ?? emptyLocalAiStats(),
        startingTei: {
          ...(existing?.startingTei ?? {}),
          [key]: clamped,
        },
        updatedAt: now,
      },
      { merge: true }
    );
  });
}

export async function reportLocalAiMatch(
  input: ReportLocalAiMatchInput
): Promise<LocalAiMatchReport | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const db = getFirestoreDb();
  if (!db) {
    return null;
  }

  const now = new Date().toISOString();
  let report: LocalAiMatchReport | null = null;

  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, input.uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;

    const localAi = {
      ...emptyLocalAiStats(),
      ...(existing?.localAi ?? {}),
    };
    const currentBucket = {
      ...emptyLocalAiSkillStats(),
      ...localAi[input.skill],
    };
    const seed = startingTeiForObjective(existing, input.objective);
    report = previewLocalAiMatchReport(currentBucket, input, seed);
    localAi[input.skill] = incrementLocalAiSkillStats(currentBucket, input, {
      startingTei: seed,
    });

    const historyEntry: MatchHistoryEntry = {
      playedAt: now,
      objective: input.objective,
      opponentSkill: input.skill,
      won: input.won,
      advisorUsed: input.advisorUsed,
      decisionPct: input.decisionPct,
      decisionGrade: input.decisionGrade,
      teiBefore: report.teiBefore ?? undefined,
      teiAfter: report.teiAfter ?? undefined,
      teiDelta: report.teiDelta ?? undefined,
    };

    const next = stripUndefinedFieldsForFirestore({
      uid: input.uid,
      displayName: input.displayName.trim() || existing?.displayName || 'Captain',
      matchesCompleted: (existing?.matchesCompleted ?? 0) + 1,
      matchesWon: (existing?.matchesWon ?? 0) + (input.won ? 1 : 0),
      roundsPlayed: existing?.roundsPlayed ?? 0,
      roundsWon: existing?.roundsWon ?? 0,
      totalPenaltyPoints: existing?.totalPenaltyPoints ?? 0,
      startingTei: existing?.startingTei,
      matchHistory: appendMatchHistory(existing?.matchHistory, historyEntry),
      localAi,
      bestRoundTimeMs: existing?.bestRoundTimeMs,
      lastPlayedAt: now,
      updatedAt: now,
    }) as PlayerStatsDocument;

    tx.set(ref, next);
  });

  return report;
}

export function displayPlayerObjectiveTei(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): number | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    const seed = startingTeiForObjective(stats, objective);
    return seed ?? null;
  }
  const trackStats = objectiveTeiStats(bucket, objective);
  if (trackStats.unassistedMatches > 0) {
    return trackStats.unassistedTei ?? DEFAULT_UNASSISTED_TEI;
  }
  return (
    trackStats.unassistedTei ??
    startingTeiForObjective(stats, objective) ??
    null
  );
}

export function hasStartingTeiPlacedForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  const key = objectiveTeiKey(objective);
  return stats?.startingTei?.[key] !== undefined;
}

export function hasAnyRatedUnassistedMatchForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  if (!stats?.localAi) {
    return false;
  }
  for (const skill of WARP_SKILL_LEVELS) {
    const bucket = stats.localAi[skill];
    if (!bucket) {
      continue;
    }
    if (objectiveTeiStats(bucket, objective).unassistedMatches > 0) {
      return true;
    }
  }
  return false;
}

export function hasAnyRatedUnassistedMatch(
  stats: PlayerStatsDocument | null
): boolean {
  return (
    hasAnyRatedUnassistedMatchForObjective(stats, 'go-out') ||
    hasAnyRatedUnassistedMatchForObjective(stats, 'penalty')
  );
}

export function needsAcademyPlacementForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  if (hasStartingTeiPlacedForObjective(stats, objective)) {
    return false;
  }
  return !hasAnyRatedUnassistedMatchForObjective(stats, objective);
}

export function needsAcademyPlacement(
  stats: PlayerStatsDocument | null
): boolean {
  return (
    needsAcademyPlacementForObjective(stats, 'go-out') ||
    needsAcademyPlacementForObjective(stats, 'penalty')
  );
}

export function canSetStartingTei(
  stats: PlayerStatsDocument | null,
  _skill: WarpSkillLevel,
  objective: RatedObjective
): boolean {
  return needsAcademyPlacementForObjective(stats, objective);
}
