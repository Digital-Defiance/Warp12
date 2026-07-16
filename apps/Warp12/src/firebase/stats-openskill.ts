/**
 * OpenSkill-based rating system for client.
 * Core rating logic is in warp12-engine/rating/*.
 * This file provides Firestore-specific helpers and AI anchors.
 */

import { getAIAnchor, getTeiDisplay, type PlayerRating } from 'warp12-engine';
import type { AiSkillLevel } from './stats-schema.js';
import type { RatedObjective, StoredRating } from './rating-types.js';
import { objectiveToTrackKey, toStoredRating } from './rating-types.js';

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
 * Get AI anchor as StoredRating (with cached displayRating and computed displayGrade).
 */
export function getAIAnchorStored(
  objective: RatedObjective,
  skillLevel: AiSkillLevel
): StoredRating {
  const rating = getAIAnchorRating(objective, skillLevel);
  const teiDisplay = getTeiDisplay(rating);
  return toStoredRating(rating, teiDisplay.grade);
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
 * Format top percentile: rank 1 of 25 → "Top 4%"
 * Used for leaderboard display.
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

/**
 * Get reference TEI for AI opponent (for display purposes).
 * Returns the conservative estimate (μ - 3σ) of the AI anchor rating.
 */
export function opponentTeiForObjective(
  objective: RatedObjective,
  skillLevel: AiSkillLevel
): number {
  const rating = getAIAnchorStored(objective, skillLevel);
  return Math.round(rating.displayRating);
}

/**
 * Get AI opponent TEI grade for display in logs (e.g. "C51").
 * Returns the formatted TEI grade string based on AI anchor rating.
 */
export function opponentTeiGradeForObjective(
  objective: RatedObjective,
  skillLevel: AiSkillLevel
): string {
  const rating = getAIAnchorRating(objective, skillLevel);
  return getTeiDisplay(rating).formatted;
}
