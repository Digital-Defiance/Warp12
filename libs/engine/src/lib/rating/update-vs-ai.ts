/**
 * Rating updates for solo play vs AI reference opponents.
 * AI anchors have fixed (μ, σ) and don't update — only human rating moves.
 */

import { updateRatings } from './openskill-adapter.js';
import type { PlayerRating } from './types.js';

/**
 * AI skill tiers (reference opponents).
 * These map to the old Ensign/Lieutenant/Commander (Ensign/Lieutenant/Commander).
 */
export type AiSkillLevel = 'ensign' | 'lieutenant' | 'commander';

/**
 * Update human rating after a solo game vs a fixed-rating AI opponent.
 *
 * @param humanId - Player ID
 * @param humanRating - Current human rating
 * @param aiLevel - AI tier (ensign/lieutenant/commander)
 * @param aiAnchor - Fixed AI rating (doesn't update)
 * @param humanWon - True if human won the match
 * @returns Updated human rating (AI rating unchanged)
 *
 * Example:
 * ```typescript
 * const humanRating = { mu: 25, sigma: 8.33, matches: 0 };
 * const commanderAnchor = { mu: 32, sigma: 3.0, matches: 999 }; // fixed
 * const updated = updateVsAI('alice', humanRating, 'commander', commanderAnchor, true);
 * // human rating increases (beat stronger opponent)
 * // AI rating stays at { mu: 32, sigma: 3.0, matches: 999 }
 * ```
 */
export function updateVsAI(
  humanId: string,
  humanRating: PlayerRating,
  aiLevel: AiSkillLevel,
  aiAnchor: PlayerRating,
  humanWon: boolean
): PlayerRating {
  // Convert to FFA format: human vs AI (2 players)
  const teams = [[humanRating], [aiAnchor]];
  const ranks = humanWon ? [1, 2] : [2, 1]; // human rank 1 if won, else rank 2

  // Run OpenSkill update
  const updatedTeams = updateRatings(teams, ranks);

  // Return only the updated human rating (AI anchor is discarded)
  return updatedTeams[0]![0]!;
}

/**
 * Update human rating for a multiplayer game with mixed human + AI players.
 * Used when human plays online with AI "filler" seats at the table.
 *
 * @param humanId - Player ID
 * @param humanRating - Current human rating
 * @param opponentRatings - Array of opponent ratings (humans have dynamic ratings, AI have fixed anchors)
 * @param ranks - Competition ranks for all players (human + opponents)
 * @returns Map with updated human rating (AI anchors unchanged)
 */
export function updateMixedTable(
  humanId: string,
  humanRating: PlayerRating,
  opponents: ReadonlyArray<{
    playerId: string;
    rating: PlayerRating;
    isAi: boolean;
    humanRank: number;
  }>,
  humanRank: number
): Map<string, PlayerRating> {
  // Build full player list (human + opponents)
  const allPlayers = [
    { playerId: humanId, rating: humanRating, rank: humanRank, isAi: false },
    ...opponents.map((opp) => ({
      playerId: opp.playerId,
      rating: opp.rating,
      rank: opp.humanRank,
      isAi: opp.isAi,
    })),
  ];

  // Convert to OpenSkill format
  const teams = allPlayers.map((p) => [p.rating]);
  const ranks = allPlayers.map((p) => p.rank);

  // Run OpenSkill update
  const updatedTeams = updateRatings(teams, ranks);

  // Return only updated human ratings (discard AI updates)
  const results = new Map<string, PlayerRating>();
  allPlayers.forEach((player, idx) => {
    if (!player.isAi) {
      results.set(player.playerId, updatedTeams[idx]![0]!);
    }
  });

  return results;
}
