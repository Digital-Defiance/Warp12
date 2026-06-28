import type { PlacedCoordinate } from './coordinate.js';
import type { RoundState } from './game-state.js';
import { isRedAlertDoubleDead } from '../table/pip-inventory.js';

/**
 * Subspace Fracture (Chicken Foot) — fleet navigation halts until three
 * stabilizing coordinates branch from the fracture double.
 */
export interface SubspaceFracture {
  readonly active: boolean;
  readonly anchor: PlacedCoordinate;
  readonly stabilizers: readonly PlacedCoordinate[];
  readonly requiredValue: number;
}

/** Red Alert — a double must be covered before the turn can advance. */
export interface RedAlert {
  readonly active: boolean;
  readonly anchor: PlacedCoordinate;
  readonly responsiblePlayerId: string | null;
  /** Warp trail hosting the uncovered double (ignored when neutralZone is true). */
  readonly trailPlayerId: string;
  /** Uncovered double was charted on the Neutral Zone. */
  readonly neutralZone?: boolean;
}

export function stabilizersPlaced(
  fracture: SubspaceFracture
): 0 | 1 | 2 | 3 {
  return Math.min(fracture.stabilizers.length, 3) as 0 | 1 | 2 | 3;
}

export function isFractureResolved(fracture: SubspaceFracture | null): boolean {
  return fracture === null || fracture.stabilizers.length >= 3;
}

export function isNavigationHaltedByFracture(
  fracture: SubspaceFracture | null
): boolean {
  return fracture?.active === true && fracture.stabilizers.length < 3;
}

export function isRedAlertBlocking(
  redAlert: RedAlert | null,
  playerId: string
): boolean {
  return (
    redAlert?.active === true && redAlert.responsiblePlayerId === playerId
  );
}

/** Active Red Alert that still requires a cover tile (excludes dead doubles). */
export function isTrueRedAlert(round: RoundState): boolean {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active) {
    return false;
  }
  return !isRedAlertDoubleDead(round);
}
