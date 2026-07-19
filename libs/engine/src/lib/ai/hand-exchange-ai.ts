import { coordinatePipValue, type Coordinate } from '../types/coordinate.js';
import {
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import type { WarpAiObservation } from './observation.js';

function openEnds(obs: WarpAiObservation): ReadonlySet<number> {
  const round = obs.round;
  const spacedock = round.table.spacedock.value;
  const ends = new Set<number>([spacedock]);
  for (const trail of Object.values(round.table.warpTrails)) {
    ends.add(trailOpenValue(trail, spacedock));
  }
  ends.add(neutralZoneOpenValue(round.table.neutralZone, spacedock));
  return ends;
}

function tileMatchesOpenEnd(
  coordinate: Coordinate,
  ends: ReadonlySet<number>
): boolean {
  return ends.has(coordinate.low) || ends.has(coordinate.high);
}

/**
 * Module Kappa (Go-out) Hand Exchange give-back: prefer dumping a high-pip
 * tile that does not match current open ends. Slight bias to return the
 * stolen tile when it is equally awkward.
 */
export function scoreHandExchangeGiveback(
  coordinate: Coordinate,
  obs: WarpAiObservation
): number {
  const pending = obs.round.handExchangePending;
  const ends = openEnds(obs);
  const pips = coordinatePipValue(coordinate);
  let score = pips * 2;
  if (!tileMatchesOpenEnd(coordinate, ends)) {
    score += 8;
  } else {
    score -= 6;
  }
  if (
    pending &&
    coordinate.low === pending.takenCoordinate.low &&
    coordinate.high === pending.takenCoordinate.high
  ) {
    score += 1;
  }
  return score;
}

export function chooseHandExchangeGiveback(
  obs: WarpAiObservation,
  options?: { rng?: () => number }
): Coordinate | null {
  const pending = obs.round.handExchangePending;
  if (!pending || pending.largerPlayerId !== obs.playerId) {
    return null;
  }
  const hand = obs.round.hands[obs.playerId] ?? [];
  if (hand.length === 0) {
    return null;
  }
  const rng = options?.rng ?? Math.random;
  let best = hand[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const coordinate of hand) {
    const score = scoreHandExchangeGiveback(coordinate, obs) + rng() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = coordinate;
    }
  }
  return best;
}
