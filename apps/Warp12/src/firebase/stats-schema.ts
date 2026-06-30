import type { GameObjective, WarpSkillLevel } from 'warp12-engine';

export type AiSkillLevel = WarpSkillLevel;
export type RatedObjective = Extract<GameObjective, 'go-out' | 'penalty'>;

/** One completed local-AI match for profile trend charts. */
export interface MatchHistoryEntry {
  readonly playedAt: string;
  readonly objective: RatedObjective;
  readonly opponentSkill: WarpSkillLevel;
  readonly won: boolean;
  readonly advisorUsed: boolean;
  readonly decisionPct?: number;
  readonly decisionGrade?: string;
  readonly eloBefore?: number;
  readonly eloAfter?: number;
  readonly eloDelta?: number;
}

export interface MatchOutcomeStats {
  matchesCompleted: number;
  matchesWon: number;
}

/** Solo (unassisted) rated record for one objective mode. */
export interface ObjectiveEloStats {
  unassistedMatches: number;
  unassistedWins: number;
  unassistedElo?: number;
}

/** Per-skill local stats, split by tactical advisor use. */
export interface LocalAiSkillStats extends MatchOutcomeStats {
  advisorMatches: number;
  advisorWins: number;
  goOut?: ObjectiveEloStats;
  penalty?: ObjectiveEloStats;
}

export type LocalAiStats = Record<AiSkillLevel, LocalAiSkillStats>;

export interface PlayerStatsDocument {
  uid: string;
  displayName: string;
  matchesCompleted: number;
  matchesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  totalPenaltyPoints: number;
  /** Optional self-reported seed before the first rated game per objective. */
  startingElo?: Partial<Record<'goOut' | 'penalty', number>>;
  /** Recent local-AI matches for profile trends (newest first). */
  matchHistory?: MatchHistoryEntry[];
  localAi?: LocalAiStats;
  bestRoundTimeMs?: number;
  lastPlayedAt?: string;
  updatedAt: string;
}

export function emptyMatchOutcomeStats(): MatchOutcomeStats {
  return { matchesCompleted: 0, matchesWon: 0 };
}

export function emptyObjectiveEloStats(): ObjectiveEloStats {
  return { unassistedMatches: 0, unassistedWins: 0 };
}

export function emptyLocalAiSkillStats(): LocalAiSkillStats {
  return {
    matchesCompleted: 0,
    matchesWon: 0,
    advisorMatches: 0,
    advisorWins: 0,
  };
}

export function emptyLocalAiStats(): LocalAiStats {
  return {
    beginner: emptyLocalAiSkillStats(),
    intermediate: emptyLocalAiSkillStats(),
    advanced: emptyLocalAiSkillStats(),
  };
}

export function objectiveEloKey(objective: RatedObjective): 'goOut' | 'penalty' {
  return objective === 'go-out' ? 'goOut' : 'penalty';
}

export function objectiveEloStats(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): ObjectiveEloStats {
  const key = objectiveEloKey(objective);
  return { ...emptyObjectiveEloStats(), ...stats[key] };
}

export function unassistedMatchStats(
  stats: LocalAiSkillStats
): MatchOutcomeStats {
  return {
    matchesCompleted: stats.matchesCompleted - stats.advisorMatches,
    matchesWon: stats.matchesWon - stats.advisorWins,
  };
}

export function assistedMatchStats(
  stats: LocalAiSkillStats
): MatchOutcomeStats {
  return {
    matchesCompleted: stats.advisorMatches,
    matchesWon: stats.advisorWins,
  };
}

export function matchWinRate(stats: MatchOutcomeStats): number {
  if (stats.matchesCompleted <= 0) {
    return 0;
  }
  return stats.matchesWon / stats.matchesCompleted;
}

export const DEFAULT_UNASSISTED_ELO = 1000;

export function displayUnassistedElo(
  elo: number | undefined,
  unassistedMatches: number
): number | null {
  if (unassistedMatches <= 0) {
    return null;
  }
  return elo ?? DEFAULT_UNASSISTED_ELO;
}

export function displayObjectiveElo(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveEloStats(stats, objective);
  return displayUnassistedElo(bucket.unassistedElo, bucket.unassistedMatches);
}

export function objectiveWinRate(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveEloStats(stats, objective);
  if (bucket.unassistedMatches <= 0) {
    return null;
  }
  return bucket.unassistedWins / bucket.unassistedMatches;
}

export function localAiWinRate(stats: LocalAiSkillStats): number {
  return matchWinRate(stats);
}
