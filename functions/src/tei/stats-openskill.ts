/**
 * OpenSkill-based rating system for Cloud Functions.
 * Core rating logic is in warp12-engine/rating/*.
 * This file provides Firestore-specific helpers.
 */

import type { PlayerRating } from 'warp12-engine';
import { getAIAnchor } from 'warp12-engine';
import type { RatedObjective, StoredRating } from './rating-types.js';
import { objectiveToTrackKey, toStoredRating } from './rating-types.js';

export type { RatedObjective } from './rated-match-schema.js';
export { WARP12_OFFICIAL_RULES_PROFILE_ID } from './rules-profile.js';

/**
 * AI skill level (matches engine type)
 */
export type AiSkillLevel = 'ensign' | 'lieutenant' | 'commander';

/**
 * Get AI anchor rating for a specific skill level and objective.
 * These are fixed reference ratings used for solo vs AI matches.
 */
export function getAIAnchorRating(
  objective: RatedObjective,
  skillLevel: AiSkillLevel
): PlayerRating {
  const track = objectiveToTrackKey(objective);
  return getAIAnchor(track, skillLevel);
}

/**
 * Get AI anchor as StoredRating (with cached displayRating).
 */
export function getAIAnchorStored(
  objective: RatedObjective,
  skillLevel: AiSkillLevel
): StoredRating {
  return toStoredRating(getAIAnchorRating(objective, skillLevel));
}

/**
 * Provisional rating threshold: players with σ > 6.0 are still
 * establishing their rating and should show a provisional badge.
 */
export const PROVISIONAL_SIGMA_THRESHOLD = 6.0;

/**
 * Check if a rating is provisional (high uncertainty, not yet settled).
 */
export function isProvisionalRating(rating: StoredRating): boolean {
  return rating.sigma > PROVISIONAL_SIGMA_THRESHOLD;
}

/**
 * Resolve effective player rating before a match.
 * - If player has prior matches, use their current rating
 * - If first match, use starting rating (if set) or DEFAULT_RATING
 */
export function resolveEffectivePlayerRating(
  priorRating: StoredRating | undefined,
  matches: number,
  startingRating?: { mu: number; sigma: number }
): StoredRating {
  if (matches > 0 && priorRating) {
    return priorRating;
  }

  // First match — use starting rating or default
  const mu = startingRating?.mu ?? 25.0;
  const sigma = startingRating?.sigma ?? 25.0 / 3; // 8.33
  return toStoredRating({ mu, sigma, matches: 0 });
}

/**
 * Player with rating for FFA updates.
 */
export interface RatedPlayer {
  readonly playerId: string;
  /** Competition rank — 1 is best (winner / lowest points). */
  readonly rank: number;
  readonly rating: StoredRating;
}

/**
 * Competition ranks from sortable scores.
 * `lowerIsBetter: true` for points campaigns; false for go-out tile counts.
 */
export function rankCompetition(
  entries: readonly { playerId: string; score: number }[],
  lowerIsBetter = true
): Map<string, number> {
  const sorted = [...entries].sort((left, right) =>
    lowerIsBetter ? left.score - right.score : right.score - left.score
  );
  const ranks = new Map<string, number>();
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index]!;
    if (index > 0 && sorted[index - 1]!.score === entry.score) {
      ranks.set(entry.playerId, ranks.get(sorted[index - 1]!.playerId)!);
    } else {
      ranks.set(entry.playerId, index + 1);
    }
  }
  return ranks;
}

/**
 * Format top percentile: rank 1 of 25 → "Top 4%"
 */
export function formatTopPercentile(rank: number, total: number): string {
  if (total <= 0) {
    return '—';
  }
  if (total === 1) {
    return 'Top 100%';
  }
  const pct = Math.max(1, Math.min(100, Math.round((rank / total) * 100)));
  return `Top ${pct}%`;
}

