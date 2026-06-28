import type { PlacedCoordinate } from './coordinate.js';
import type { DistressBeacon } from './player.js';

/** A captain's personal line of coordinates (Warp Trail). */
export interface WarpTrail {
  readonly playerId: string;
  readonly tiles: readonly PlacedCoordinate[];
  readonly distressBeacon: DistressBeacon;
}

/** The communal Neutral Zone, open to all captains. */
export interface NeutralZone {
  readonly tiles: readonly PlacedCoordinate[];
}

/** Central Spacedock — the round's starting double tile. */
export interface Spacedock {
  /** Pip value of the establishing double (12, 11, 10, …). */
  readonly value: number;
  readonly placedBy: string;
}

export function isTrailOpenToOthers(trail: WarpTrail): boolean {
  return trail.distressBeacon.active;
}
