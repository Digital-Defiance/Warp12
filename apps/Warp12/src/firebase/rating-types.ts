/**
 * OpenSkill rating types for Firestore — shared between client and functions.
 * These are the storage types (what goes in/out of Firestore).
 * Engine rating types are in warp12-engine/rating/types.ts
 */

import type { TeiGrade } from 'warp12-engine';

/**
 * A captain's skill rating on one track (points or go-out).
 * Stored in Firestore with cached displayRating for efficient queries.
 */
export interface StoredRating {
  readonly mu: number;
  readonly sigma: number;
  readonly matches: number;
  /** Cached μ - 3σ for leaderboard sorting without recomputation */
  readonly displayRating: number;
  /**
   * Last displayed TEI grade (E/V/C/I/P) for hysteresis.
   * Prevents boundary flickering between adjacent grades.
   * Undefined for new players (no history yet).
   */
  readonly displayGrade?: TeiGrade;
}

/**
 * Per-objective rating stats (e.g., goOut or points).
 * Replaces legacy ObjectiveTeiStats from integer rating schema.
 */
export interface ObjectiveRatingStats {
  readonly rating: StoredRating;
  readonly wins: number;
}

/**
 * Rating track key — 'goOut' or 'points'
 */
export type RatingTrackKey = 'goOut' | 'points';

/**
 * Rating objective (API format, matches engine)
 */
export type RatedObjective = 'go-out' | 'points';

/**
 * Convert objective string to track key
 */
export function objectiveToTrackKey(objective: RatedObjective): RatingTrackKey {
  return objective === 'go-out' ? 'goOut' : 'points';
}

/**
 * Initialize empty rating stats
 */
export function emptyObjectiveRatingStats(): ObjectiveRatingStats {
  return {
    rating: {
      mu: 25.0,
      sigma: 25.0 / 3, // 8.33
      matches: 0,
      displayRating: 0.0, // μ - 3σ = 0 for new players
    },
    wins: 0,
  };
}

/**
 * Calculate and cache display rating (μ - 3σ)
 */
export function cacheDisplayRating(mu: number, sigma: number): number {
  return Math.max(0, mu - 3 * sigma);
}

/**
 * Create a StoredRating from engine PlayerRating with optional display grade for hysteresis
 */
export function toStoredRating(
  rating: {
    mu: number;
    sigma: number;
    matches: number;
  },
  displayGrade?: TeiGrade
): StoredRating {
  return {
    mu: rating.mu,
    sigma: rating.sigma,
    matches: rating.matches,
    displayRating: cacheDisplayRating(rating.mu, rating.sigma),
    ...(displayGrade !== undefined ? { displayGrade } : {}),
  };
}
