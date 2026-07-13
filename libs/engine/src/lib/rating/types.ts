/**
 * OpenSkill-based rating system types for Warp 12.
 * Uses Bayesian (μ, σ) tuples for skill modeling.
 */

/**
 * A captain's skill rating on one track (points or go-out).
 * - mu: skill estimate (Gaussian mean)
 * - sigma: uncertainty (Gaussian standard deviation)
 * - matches: experience count (affects uncertainty decay)
 */
export interface PlayerRating {
  readonly mu: number;
  readonly sigma: number;
  readonly matches: number;
}

/**
 * Rating track — separate ratings for points and go-out objectives.
 */
export type RatingTrack = 'goOut' | 'points';

/**
 * Default new player rating.
 * μ = 25.0 (OpenSkill default, equivalent to ~1500 rating midpoint)
 * σ = 8.33 (μ/3, high uncertainty for new players)
 * matches = 0 (no experience)
 */
export const DEFAULT_RATING: PlayerRating = {
  mu: 25.0,
  sigma: 25.0 / 3,
  matches: 0,
};

/**
 * Display rating: conservative skill estimate (μ - 3σ).
 * This is the 99.7% confidence lower bound — roughly equivalent
 * to the old TEI display integer.
 *
 * Example progressions:
 * - New player:    μ=25.0, σ=8.33  →  display = 0.0
 * - After 10 games: μ=27.5, σ=6.2   →  display = 8.9
 * - After 50 games: μ=32.1, σ=4.1   →  display = 19.8
 * - Veteran:        μ=35.0, σ=2.5   →  display = 27.5
 */
export function displayRating(rating: PlayerRating): number {
  return Math.max(0, rating.mu - 3 * rating.sigma);
}

/**
 * Ordinal rating for matchmaking: μ - σ (84th percentile lower bound).
 * More conservative than display rating, used to match players of
 * similar proven skill without over-penalizing new players.
 */
export function ordinalRating(rating: PlayerRating): number {
  return rating.mu - rating.sigma;
}

/**
 * Provisional rating threshold: players with σ > 6.0 are still
 * establishing their rating and should show a provisional badge.
 * Corresponds to roughly 10-15 matches of experience.
 */
export const PROVISIONAL_SIGMA_THRESHOLD = 6.0;

/**
 * Check if a rating is provisional (high uncertainty, not yet settled).
 */
export function isProvisional(rating: PlayerRating): boolean {
  return rating.sigma > PROVISIONAL_SIGMA_THRESHOLD;
}

/**
 * Format rating for display in UI: "23.5" (conservative estimate).
 */
export function formatDisplayRating(rating: PlayerRating): string {
  return displayRating(rating).toFixed(1);
}

/**
 * Format full rating with uncertainty for tooltips: "32.1 ± 12.3"
 */
export function formatFullRating(rating: PlayerRating): string {
  return `${rating.mu.toFixed(1)} ± ${(3 * rating.sigma).toFixed(1)}`;
}
