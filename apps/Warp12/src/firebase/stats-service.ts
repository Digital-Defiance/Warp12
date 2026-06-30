import { doc, getDoc, runTransaction } from 'firebase/firestore';

import type { GameObjective, WarpSkillLevel } from 'warp12-engine';

import { getFirestoreDb, isFirebaseConfigured } from './config.js';
import {
  DEFAULT_UNASSISTED_ELO,
  kFactor,
  opponentEloForObjective,
  resolveEffectivePlayerElo,
  updateUnassistedElo,
} from './stats-elo.js';
import {
  appendMatchHistory,
  type MatchHistoryEntry,
} from './match-history.js';
import {
  emptyLocalAiSkillStats,
  emptyLocalAiStats,
  objectiveEloKey,
  objectiveEloStats,
  type LocalAiSkillStats,
  type PlayerStatsDocument,
  type RatedObjective,
} from './stats-schema.js';

const PLAYER_STATS = 'playerStats';

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
  eloBefore: number | null;
  eloAfter: number | null;
  eloDelta: number | null;
}

export function startingEloForObjective(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective
): number | undefined {
  const key = objectiveEloKey(objective);
  return doc?.startingElo?.[key];
}

export function incrementLocalAiSkillStats(
  current: LocalAiSkillStats,
  input: Pick<
    ReportLocalAiMatchInput,
    'won' | 'advisorUsed' | 'skill' | 'objective'
  >,
  options?: { startingElo?: number }
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
    const key = objectiveEloKey(input.objective);
    const prior = objectiveEloStats(current, input.objective);
    const eloBefore = resolveEffectivePlayerElo(
      prior.unassistedElo,
      prior.unassistedMatches,
      options?.startingElo
    );
    next[key] = {
      unassistedMatches: prior.unassistedMatches + 1,
      unassistedWins: prior.unassistedWins + (input.won ? 1 : 0),
      unassistedElo: updateUnassistedElo(
        eloBefore,
        opponentEloForObjective(input.objective, input.skill),
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
  startingElo?: number
): LocalAiMatchReport {
  if (input.advisorUsed) {
    return {
      rated: false,
      won: input.won,
      advisorUsed: true,
      objective: input.objective,
      skill: input.skill,
      eloBefore: null,
      eloAfter: null,
      eloDelta: null,
    };
  }

  const prior = objectiveEloStats(current, input.objective);
  const eloBefore = resolveEffectivePlayerElo(
    prior.unassistedElo,
    prior.unassistedMatches,
    startingElo
  );
  const eloAfter = updateUnassistedElo(
    eloBefore,
    opponentEloForObjective(input.objective, input.skill),
    input.won ? 1 : 0,
    kFactor(prior.unassistedMatches)
  );

  return {
    rated: true,
    won: input.won,
    advisorUsed: false,
    objective: input.objective,
    skill: input.skill,
    eloBefore,
    eloAfter,
    eloDelta: eloAfter - eloBefore,
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

export async function setPlayerStartingElo(
  uid: string,
  objective: RatedObjective,
  elo: number
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const clamped = Math.max(400, Math.min(2800, Math.round(elo)));
  const key = objectiveEloKey(objective);
  const now = new Date().toISOString();

  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;

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
        startingElo: {
          ...(existing?.startingElo ?? {}),
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
    const seed = startingEloForObjective(existing, input.objective);
    report = previewLocalAiMatchReport(currentBucket, input, seed);
    localAi[input.skill] = incrementLocalAiSkillStats(currentBucket, input, {
      startingElo: seed,
    });

    const historyEntry: MatchHistoryEntry = {
      playedAt: now,
      objective: input.objective,
      opponentSkill: input.skill,
      won: input.won,
      advisorUsed: input.advisorUsed,
      decisionPct: input.decisionPct,
      decisionGrade: input.decisionGrade,
      eloBefore: report.eloBefore ?? undefined,
      eloAfter: report.eloAfter ?? undefined,
      eloDelta: report.eloDelta ?? undefined,
    };

    const next: PlayerStatsDocument = {
      uid: input.uid,
      displayName: input.displayName.trim() || existing?.displayName || 'Captain',
      matchesCompleted: (existing?.matchesCompleted ?? 0) + 1,
      matchesWon: (existing?.matchesWon ?? 0) + (input.won ? 1 : 0),
      roundsPlayed: existing?.roundsPlayed ?? 0,
      roundsWon: existing?.roundsWon ?? 0,
      totalPenaltyPoints: existing?.totalPenaltyPoints ?? 0,
      startingElo: existing?.startingElo,
      matchHistory: appendMatchHistory(existing?.matchHistory, historyEntry),
      localAi,
      bestRoundTimeMs: existing?.bestRoundTimeMs,
      lastPlayedAt: now,
      updatedAt: now,
    };

    tx.set(ref, next);
  });

  return report;
}

export function displayPlayerObjectiveElo(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): number | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    const seed = startingEloForObjective(stats, objective);
    return seed ?? null;
  }
  const objectiveStats = objectiveEloStats(bucket, objective);
  if (objectiveStats.unassistedMatches > 0) {
    return objectiveStats.unassistedElo ?? DEFAULT_UNASSISTED_ELO;
  }
  return (
    objectiveStats.unassistedElo ??
    startingEloForObjective(stats, objective) ??
    null
  );
}

export function canSetStartingElo(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): boolean {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    return true;
  }
  return objectiveEloStats(bucket, objective).unassistedMatches === 0;
}
