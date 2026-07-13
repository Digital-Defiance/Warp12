import type { Coordinate } from '../types/coordinate.js';
import type { PlayerId } from '../types/player.js';

/**
 * Simple draft pick strategy: choose highest pip value tile.
 * This is a basic heuristic for AI drafting.
 */
export function pickHighestPipTile(
  _playerId: PlayerId,
  pack: readonly Coordinate[]
): Coordinate {
  if (pack.length === 0) {
    throw new Error('Cannot pick from empty pack');
  }

  let best = pack[0];
  let bestValue = best.low + best.high;

  for (let i = 1; i < pack.length; i++) {
    const tile = pack[i];
    const value = tile.low + tile.high;
    if (value > bestValue) {
      best = tile;
      bestValue = value;
    }
  }

  return best;
}

/**
 * Draft pick strategy: choose tile with most versatile pips.
 * Prefers tiles that match the most other tiles in the set.
 */
export function pickMostVersatileTile(
  _playerId: PlayerId,
  pack: readonly Coordinate[]
): Coordinate {
  if (pack.length === 0) {
    throw new Error('Cannot pick from empty pack');
  }

  // Count how many times each pip appears across all tiles in pack
  const pipCounts = new Map<number, number>();
  
  pack.forEach((tile) => {
    pipCounts.set(tile.low, (pipCounts.get(tile.low) || 0) + 1);
    if (tile.high !== tile.low) {
      pipCounts.set(tile.high, (pipCounts.get(tile.high) || 0) + 1);
    }
  });

  // Score each tile by versatility (sum of pip counts)
  let best = pack[0];
  let bestScore =
    (pipCounts.get(best.low) || 0) + (pipCounts.get(best.high) || 0);

  for (let i = 1; i < pack.length; i++) {
    const tile = pack[i];
    const score =
      (pipCounts.get(tile.low) || 0) + (pipCounts.get(tile.high) || 0);
    
    // Tiebreaker: higher total pips
    if (
      score > bestScore ||
      (score === bestScore && tile.low + tile.high > best.low + best.high)
    ) {
      best = tile;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Draft pick strategy: balanced approach.
 * Considers both pip value and versatility.
 */
export function pickBalancedTile(
  playerId: PlayerId,
  pack: readonly Coordinate[]
): Coordinate {
  if (pack.length === 0) {
    throw new Error('Cannot pick from empty pack');
  }

  // For first few picks, prioritize versatility
  // For later picks, prioritize high pips (shed heavy tiles)
  if (pack.length > 10) {
    return pickMostVersatileTile(playerId, pack);
  } else {
    return pickHighestPipTile(playerId, pack);
  }
}
