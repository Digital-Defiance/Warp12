import type { PlacedCoordinate } from './coordinate.js';
import type { RoundState } from './game-state.js';
import type { PlayerId } from './player.js';
import { isRedAlertDoubleDead } from '../table/pip-inventory.js';

/**
 * Subspace Fracture (Chicken Foot) — fleet navigation halts until three
 * stabilizing coordinates branch from the fracture double. The third
 * stabilizer satisfies the double and clears Red Alert on that anchor.
 */
export interface SubspaceFracture {
  readonly active: boolean;
  readonly anchor: PlacedCoordinate;
  readonly stabilizers: readonly PlacedCoordinate[];
  readonly requiredValue: number;
  /** Fracture double was charted on the Neutral Zone. */
  readonly neutralZone?: boolean;
  /** Warp trail hosting the fracture double (when not neutralZone). */
  readonly trailCaptainId?: string;
}

/** Red Alert — a double must be satisfied (cover tile, or stabilizers when Subspace Fracture applies). */
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

function fractureAnchorsMatch(
  a: PlacedCoordinate,
  b: PlacedCoordinate
): boolean {
  return (
    a.index === b.index &&
    a.coordinate.low === b.coordinate.low &&
    a.coordinate.high === b.coordinate.high
  );
}

/** True while an open fracture still needs stabilizers before normal play resumes. */
export function isNavigationHaltedByFracture(
  fracture: SubspaceFracture | null,
  redAlert: RedAlert | null = null
): boolean {
  if (!fracture) {
    return false;
  }
  const unresolved = fracture.stabilizers.length < 3;
  const sameDoubleAsRedAlert =
    redAlert?.active === true &&
    fractureAnchorsMatch(fracture.anchor, redAlert.anchor);

  if (unresolved && (fracture.active || sameDoubleAsRedAlert)) {
    return true;
  }
  if (fracture.active && fracture.stabilizers.length >= 3) {
    return true;
  }
  return false;
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

/**
 * An empty hand does not end the round while this captain must still satisfy
 * Red Alert or complete Subspace Fracture stabilizers. Q-Flash resolution
 * defers wins separately via {@link RoundState.pendingRoundWin}.
 */
export function blocksRoundWin(
  round: RoundState,
  playerId: PlayerId
): boolean {
  if (
    round.qPendingInvoker === playerId ||
    round.qGamblePending?.playerId === playerId
  ) {
    return false;
  }
  if (
    isNavigationHaltedByFracture(
      round.table.subspaceFracture,
      round.table.redAlert
    )
  ) {
    return true;
  }
  return isRedAlertBlocking(round.table.redAlert, playerId);
}
