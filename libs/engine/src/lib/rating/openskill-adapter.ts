/**
 * OpenSkill adapter — wraps openskill.js for Warp 12.
 * Provides type conversions and utility functions for rating updates.
 */

import { rating as createRating, rate, ordinal } from 'openskill';
import type { Rating as OpenSkillRating, Options } from 'openskill';
import type { PlayerRating } from './types.js';

/**
 * Convert our PlayerRating to OpenSkill's Rating format.
 */
export function toOpenSkillRating(r: PlayerRating): OpenSkillRating {
  return createRating({ mu: r.mu, sigma: r.sigma });
}

/**
 * Convert OpenSkill's Rating back to our PlayerRating format.
 * Increments match count.
 */
export function fromOpenSkillRating(
  r: OpenSkillRating,
  previousMatches: number
): PlayerRating {
  return {
    mu: r.mu,
    sigma: r.sigma,
    matches: previousMatches + 1,
  };
}

/**
 * Update ratings for a multiplayer FFA or team game.
 *
 * @param teams - Array of teams, where each team is an array of PlayerRatings.
 *                For FFA, each team has one player. For team games, multiple players per team.
 * @param ranks - Competition ranks for each team (1 = winner, 2 = second, etc.)
 * @param options - Optional OpenSkill configuration (tau, beta, etc.)
 * @returns Updated teams in the same structure
 */
export function updateRatings(
  teams: PlayerRating[][],
  ranks: number[],
  options?: Partial<Options>
): PlayerRating[][] {
  // Convert to OpenSkill format
  const openskillTeams = teams.map((team) =>
    team.map((player) => toOpenSkillRating(player))
  );

  // Run OpenSkill update
  const updatedTeams = rate(openskillTeams, { rank: ranks, ...options });

  // Convert back to our format
  return updatedTeams.map((team, teamIdx) =>
    team.map((player, playerIdx) =>
      fromOpenSkillRating(player, teams[teamIdx]![playerIdx]!.matches)
    )
  );
}

/**
 * Calculate ordinal rating for matchmaking.
 * Uses OpenSkill's ordinal function (μ - 3σ by default).
 */
export function calculateOrdinal(r: PlayerRating): number {
  const openskillRating = toOpenSkillRating(r);
  return ordinal(openskillRating);
}

/**
 * Default OpenSkill options for Warp 12.
 * - tau: dynamics factor (skill drift over time) — default 0.0833
 * - beta: skill class width — default 4.167
 * Can be overridden per-update if needed.
 */
export const DEFAULT_OPTIONS: Partial<Options> = {
  // Use OpenSkill defaults for now
  // Can tune later based on convergence analysis
};
