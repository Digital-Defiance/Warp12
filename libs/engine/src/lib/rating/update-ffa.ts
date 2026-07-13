/**
 * FFA (free-for-all) rating updates — multiplayer with individual rankings.
 * Used for standard Warp 12 sectors where each captain competes independently.
 */

import { updateRatings } from './openskill-adapter.js';
import type { PlayerRating } from './types.js';

export interface FFAPlayer {
  readonly playerId: string;
  readonly rating: PlayerRating;
  readonly rank: number; // 1 = winner, 2 = second, etc.
}

/**
 * Update ratings after an FFA multiplayer game.
 *
 * @param players - Array of players with current ratings and final ranks
 * @returns Map of playerId → updated PlayerRating
 *
 * Example:
 * ```typescript
 * const players = [
 *   { playerId: 'alice', rating: { mu: 25, sigma: 8.33, matches: 0 }, rank: 1 }, // winner
 *   { playerId: 'bob',   rating: { mu: 25, sigma: 8.33, matches: 0 }, rank: 2 },
 *   { playerId: 'carol', rating: { mu: 25, sigma: 8.33, matches: 0 }, rank: 3 },
 * ];
 * const updated = updateFFARatings(players);
 * // alice.mu increases, bob's stays ~same, carol's decreases
 * ```
 */
export function updateFFARatings(
  players: readonly FFAPlayer[]
): Map<string, PlayerRating> {
  if (players.length === 0) {
    return new Map();
  }

  // Handle single player (no opponent) — no update
  if (players.length === 1) {
    return new Map([[players[0]!.playerId, players[0]!.rating]]);
  }

  // Convert to OpenSkill format: each player is a "team" of one
  const teams = players.map((p) => [p.rating]);
  const ranks = players.map((p) => p.rank);

  // Run OpenSkill update
  const updatedTeams = updateRatings(teams, ranks);

  // Convert back to Map<playerId, rating>
  const results = new Map<string, PlayerRating>();
  players.forEach((player, idx) => {
    const updatedRating = updatedTeams[idx]![0]!;
    results.set(player.playerId, updatedRating);
  });

  return results;
}

/**
 * Convenience function for 2-player head-to-head.
 * Winner has rank 1, loser has rank 2.
 */
export function updateHeadToHead(
  winner: { playerId: string; rating: PlayerRating },
  loser: { playerId: string; rating: PlayerRating }
): Map<string, PlayerRating> {
  return updateFFARatings([
    { ...winner, rank: 1 },
    { ...loser, rank: 2 },
  ]);
}
