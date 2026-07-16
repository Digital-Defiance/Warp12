import type { WarpSkillLevel } from 'warp12-engine';

import type { CaptainGender } from '../game/captain-profile.js';
import type {
  ObjectiveRatingStats,
  RatedObjective,
  RatingTrackKey,
  StoredRating,
} from './rating-types.js';
import {
  emptyObjectiveRatingStats,
  objectiveToTrackKey,
} from './rating-types.js';

export type AiSkillLevel = WarpSkillLevel;
export type { RatedObjective, StoredRating, ObjectiveRatingStats };

// Type aliases for backward compatibility with human-pool rating system
export type HumanRatingStats = {
  goOut?: ObjectiveRatingStats;
  points?: ObjectiveRatingStats;
};

export type HumanTeiStats = HumanRatingStats; // Alias for legacy code
export type ObjectiveTeiStats = ObjectiveRatingStats; // Alias for legacy code

/** One completed local-AI match for profile trend charts. */
export interface MatchHistoryEntry {
  readonly playedAt: string;
  readonly objective: RatedObjective;
  /** Present for reference-AI matches; omitted for human-opponent pool. */
  readonly opponentSkill?: WarpSkillLevel;
  /** True when top-tier AI opponents were Ω (experimental neural policy). */
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
  /** Rating before match (OpenSkill) */
  readonly ratingBefore?: StoredRating;
  /** Rating after match (OpenSkill) */
  readonly ratingAfter?: StoredRating;
  /** Change in μ */
  readonly muDelta?: number;
  /** Change in σ (usually negative as confidence improves) */
  readonly sigmaDelta?: number;
  /** Legacy integer TEI fields (deprecated) */
  readonly teiBefore?: number;
  readonly teiAfter?: number;
  readonly teiDelta?: number;
}

export interface MatchOutcomeStats {
  matchesCompleted: number;
  matchesWon: number;
}

/** Per-skill local stats, split by tactical advisor use. */
export interface LocalAiSkillStats extends MatchOutcomeStats {
  advisorMatches: number;
  advisorWins: number;
  /** Go-out campaign rating (unassisted only) */
  goOut?: ObjectiveRatingStats;
  /** Points campaign rating (unassisted only) */
  points?: ObjectiveRatingStats;
}

export type LocalAiStats = Record<AiSkillLevel, LocalAiSkillStats>;

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
  /** Optional self-reported starting rating before first rated game per objective. */
  startingRating?: Partial<
    Record<RatingTrackKey, { mu: number; sigma: number }>
  >;
  /** Human-opponent pool rating (online rated sectors, humans only). */
  humanRating?: HumanRatingStats;
  /** Idempotency — sector game ids already applied to humanRating. */
  humanRatedGameIds?: string[];
  /** Module Zeta: squad-play rating (online rated squad sectors). */
  squadRating?: HumanRatingStats;
  /** Idempotency — sector game ids already applied to squadRating. */
  squadRatedGameIds?: string[];
  /** Recent local-AI matches for profile trends (newest first). */
  matchHistory?: MatchHistoryEntry[];
  localAi?: LocalAiStats;
  bestRoundTimeMs?: number;
  lastPlayedAt?: string;
  updatedAt: string;
}

export function emptyHumanRatingStats(): HumanRatingStats {
  return {};
}

export function emptyMatchOutcomeStats(): MatchOutcomeStats {
  return { matchesCompleted: 0, matchesWon: 0 };
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

export function startingRatingForObjective(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): { mu: number; sigma: number } | undefined {
  const key = objectiveToTrackKey(objective);
  return doc?.startingRating?.[key];
}

export function objectiveRatingStats(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): ObjectiveRatingStats {
  const key = objectiveToTrackKey(objective);
  const existing = stats[key];
  return existing ?? emptyObjectiveRatingStats();
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

/**
 * Get display rating for UI (μ - 3σ).
 * Returns null if no matches played yet.
 */
export function displayRatingValue(
  rating: StoredRating | undefined,
  matches: number
): number | null {
  if (matches <= 0 || !rating) {
    return null;
  }
  return rating.displayRating;
}

/**
 * Get display rating for a specific objective.
 */
export function displayObjectiveRating(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveRatingStats(stats, objective);
  return displayRatingValue(bucket.rating, bucket.rating.matches);
}

export function objectiveWinRate(
  stats: LocalAiSkillStats,
  objective: RatedObjective
): number | null {
  const bucket = objectiveRatingStats(stats, objective);
  if (bucket.rating.matches <= 0) {
    return null;
  }
  return bucket.wins / bucket.rating.matches;
}

export function localAiWinRate(stats: LocalAiSkillStats): number {
  return matchWinRate(stats);
}

/**
 * Check if a rating is provisional (high uncertainty, not yet settled).
 * Provisional threshold: σ > 6.0 (corresponds to ~10-15 matches)
 */
export function isProvisionalRating(rating: StoredRating): boolean {
  return rating.sigma > 6.0;
}

// Re-export rating utilities for convenience
export {
  cacheDisplayRating,
  emptyObjectiveRatingStats,
  objectiveToTrackKey,
  toStoredRating,
} from './rating-types.js';
