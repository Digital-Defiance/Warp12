import { isDouble, type Coordinate } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import { DOUBLE_TWELVE_MAX_PIPS } from '../constants/setup.js';

/** Tiles in a double-N set that contain pip `pip` (N+1 for every pip). */
export function maxTilesWithPipInSet(
  pip: number,
  maxPips = DOUBLE_TWELVE_MAX_PIPS
): number {
  return maxPips + 1;
}

function* chartedTableCoordinates(round: RoundState): Generator<Coordinate> {
  const spacedock = round.spacedockValue;
  yield { low: spacedock, high: spacedock };

  for (const trail of Object.values(round.table.warpTrails)) {
    for (const placed of trail.tiles) {
      yield placed.coordinate;
    }
  }

  for (const placed of round.table.neutralZone.tiles) {
    yield placed.coordinate;
  }

  const fracture = round.table.subspaceFracture;
  if (fracture) {
    for (const placed of fracture.stabilizers) {
      yield placed.coordinate;
    }
  }
}

export function coordinateContainsPip(coordinate: Coordinate, pip: number): boolean {
  return coordinate.low === pip || coordinate.high === pip;
}

/** Count tiles on the table whose pip values include `pip`. */
export function countChartedTilesWithPip(
  round: RoundState,
  pip: number
): number {
  let count = 0;
  for (const coordinate of chartedTableCoordinates(round)) {
    if (coordinateContainsPip(coordinate, pip)) {
      count++;
    }
  }
  return count;
}

/** True when every tile in the set containing `pip` is already charted. */
export function isPipExhausted(
  round: RoundState,
  pip: number,
  maxPips: number = DOUBLE_TWELVE_MAX_PIPS
): boolean {
  return (
    countChartedTilesWithPip(round, pip) >= maxTilesWithPipInSet(pip, maxPips)
  );
}

/** Red Alert double is dead when no tile with that pip remains off the table. */
export function isRedAlertDoubleDead(
  round: RoundState,
  maxPips: number = round.maxPip ?? DOUBLE_TWELVE_MAX_PIPS
): boolean {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active) {
    return false;
  }
  const anchor = redAlert.anchor.coordinate;
  if (!isDouble(anchor)) {
    return false;
  }
  return isPipExhausted(round, anchor.low, maxPips);
}
