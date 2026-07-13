import type { PlayerId } from '../types/player.js';
import type { RoundState } from '../types/game-state.js';

/**
 * Calculate the length of a captain's personal trail.
 * @returns Number of tiles in the trail
 */
export function getTrailLength(round: RoundState, playerId: PlayerId): number {
  const trail = round.table.warpTrails[playerId];
  return trail ? trail.tiles.length : 0;
}

/**
 * Determine which captain(s) have the longest trail.
 * @returns Array of player IDs (may be multiple in case of tie)
 */
export function determineLongestTrailWinners(round: RoundState): PlayerId[] {
  const lengths = new Map<PlayerId, number>();
  
  for (const playerId of round.turnOrder) {
    lengths.set(playerId, getTrailLength(round, playerId));
  }
  
  const maxLength = Math.max(...Array.from(lengths.values()));
  
  // Return all players with the maximum length (handles ties)
  return Array.from(lengths.entries())
    .filter(([_, length]) => length === maxLength)
    .map(([playerId]) => playerId);
}
