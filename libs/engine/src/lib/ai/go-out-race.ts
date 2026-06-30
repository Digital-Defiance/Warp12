import {
  coordinateKey,
  coordinateMatchesValue,
  type Coordinate,
} from '../types/coordinate.js';
import type { WarpAiObservation } from './observation.js';
import type { GoOutTuning } from './go-out-tuning.js';

/** Go-out tempo: build trail → sprint to empty → block when behind a leader. */
export type GoOutRacePhase = 'build' | 'sprint' | 'defensive';

export function minOpponentHandSize(
  obs: WarpAiObservation,
  playerId: string,
  fallback = Number.POSITIVE_INFINITY
): number {
  let min = fallback;
  for (const captain of obs.captains) {
    if (captain.id === playerId) continue;
    const count = (obs.round.hands[captain.id] ?? []).length;
    if (count < min) min = count;
  }
  return min;
}

export function resolveGoOutRacePhase(
  obs: WarpAiObservation,
  handSize: number,
  tuning: GoOutTuning
): GoOutRacePhase {
  if (obs.objective !== 'go-out') {
    return 'build';
  }

  const minOpp = minOpponentHandSize(obs, obs.playerId, handSize);

  if (minOpp <= tuning.blockLeaderHandSize && handSize > minOpp) {
    return 'defensive';
  }
  if (handSize <= 3 || minOpp <= tuning.blockLeaderHandSize) {
    return 'sprint';
  }
  return 'build';
}

/** Greedy chain length from an open pip on a single line (path-to-zero estimate). */
export function countChainPlaysFromOpenEnd(
  openValue: number,
  hand: readonly Coordinate[],
  excludeKey?: string
): number {
  let chain = 0;
  let current = openValue;
  const remaining = hand.filter(
    (coordinate) => !excludeKey || coordinateKey(coordinate) !== excludeKey
  );
  const pool = [...remaining];

  while (pool.length > 0) {
    const index = pool.findIndex((coordinate) =>
      coordinateMatchesValue(coordinate, current)
    );
    if (index < 0) {
      break;
    }
    const tile = pool[index]!;
    pool.splice(index, 1);
    const { low, high } = tile;
    current = low === current ? high : low;
    chain++;
  }
  return chain;
}

export function defensiveBlockingMultiplier(phase: GoOutRacePhase): number {
  return phase === 'defensive' ? 2.5 : 1;
}
