import type { GameObjective, WarpSkillLevel } from 'warp12-engine';

import type { CaptainGender } from '../game/captain-profile.js';

export type AiSkillLevel = WarpSkillLevel;
export type RatedObjective = Extract<GameObjective, 'go-out' | 'points'>;

/** One completed local-AI match for profile trend charts. */
export interface MatchHistoryEntry {
  readonly playedAt: string;
  readonly objective: RatedObjective;
  /** Present for reference-AI matches; omitted for human-opponent pool. */
  readonly opponentSkill?: WarpSkillLevel;
  /** True when top-tier AI opponents were Class Ω (experimental neural policy). */
  readonly opponentOmega?: boolean;
  /** Legacy — Class I* search opponents in older match history. */
  readonly opponentClass1Star?: boolean;
  /** `human` = online human-opponent pool; omitted = reference AI bucket. */
  readonly opponentContext?: 'human' | 'reference';
  readonly playerCount?: number;
  readonly finishRank?: number;
  readonly won: boolean;
  readonly advisorUsed: boolean;
  readonly decisionPct?: number;
  readonly decisionGrade?: string;
  readonly teiBefore?: number;
  readonly teiAfter?: number;
  readonly teiDelta?: number;
}

export interface MatchOutcomeStats {
  matchesCompleted: number;
  matchesWon: number;
}

/** Solo (unassisted) rated record for one objective mode. */
export interface ObjectiveTeiStats {
  unassistedMatches: number;
  unassistedWins: number;
  unassistedTei?: number;
}

/** Per-skill local stats, split by tactical advisor use. */
export interface LocalAiSkillStats extends MatchOutcomeStats {
  advisorMatches: number;
  advisorWins: number;
  goOut?: ObjectiveTeiStats;
  penalty?: ObjectiveTeiStats;
}

export type LocalAiStats = Record<AiSkillLevel, LocalAiSkillStats>;

/** Human-vs-human pool TEI (one rating per objective track). */
export interface HumanTeiStats {
  goOut?: ObjectiveTeiStats;
  points?: ObjectiveTeiStats;
}

export interface PlayerStatsDocument {
  uid: string;
  displayName: string;
  /** Advisor-report icon preference (captain avatar). */
  captainGender?: CaptainGender;
  matchesCompleted: number;
  matchesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  totalPoints: number;
  /** Optional self-reported seed before the first rated game per objective. */
  startingTei?: Partial<Record<'goOut' | 'points', number>>;
  /** Human-opponent pool TEI (online rated sectors, humans only). */
  humanTei?: HumanTeiStats;
  /** Idempotency — sector game ids already applied to humanTei. */
  humanRatedGameIds?: string[];
  /** Recent local-AI matches for profile trends (newest first). */
  matchHistory?: MatchHistoryEntry[];
  localAi?: LocalAiStats;
  bestRoundTimeMs?: number;
  lastPlayedAt?: string;
  updatedAt: string;
}

export function emptyHumanTeiStats(): HumanTeiStats {
  return {};
}

export function emptyMatchOutcomeStats(): MatchOutcomeStats {
  return { matchesCompleted: 0, matchesWon: 0 };
}

export function emptyObjectiveTeiStats(): ObjectiveTeiStats {
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
    ensign: emptyLocalAiSkillStats(),
    lieutenant: emptyLocalAiSkillStats(),
    commander: emptyLocalAiSkillStats(),
  };
}

export function objectiveTeiKey(objective: RatedObjective): 'goOut' | 'points' {
  return objective === 'go-out' ? 'goOut' : 'points';
}

export function startingTeiForObjective(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): number | undefined {
  const key = objectiveTeiKey(objective);
  return doc?.startingTei?.[key];
}

export function objectiveTeiStats(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  return { ...emptyObjectiveTeiStats(), ...stats[key] };
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

export const DEFAULT_UNASSISTED_TEI = 1000;

export function displayUnassistedTei(
  tei: number | undefined,
  unassistedMatches: number
): number | null {
  if (unassistedMatches <= 0) {
    return null;
  }
  return tei ?? DEFAULT_UNASSISTED_TEI;
}

export function displayObjectiveTei(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveTeiStats(stats, objective);
  return displayUnassistedTei(bucket.unassistedTei, bucket.unassistedMatches);
}

export function objectiveWinRate(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveTeiStats(stats, objective);
  if (bucket.unassistedMatches <= 0) {
    return null;
  }
  return bucket.unassistedWins / bucket.unassistedMatches;
}

export function localAiWinRate(stats: LocalAiSkillStats): number {
  return matchWinRate(stats);
}
