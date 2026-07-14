import { isDouble } from '../types/coordinate.js';
import type { TableState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { Squadron } from '../types/squadrons.js';
import type { NeutralZone, WarpTrail } from '../types/trails.js';

export function createInitialTable(
  playerIds: readonly PlayerId[],
  spacedockValue: number,
  spacedockPlacedBy: PlayerId,
  squadrons?: readonly Squadron[]
): TableState {
  const warpTrails: Record<PlayerId, WarpTrail> = {};

  if (squadrons && squadrons.length > 0) {
    // Module Zeta (Model C): one shared trail per squad, keyed by the squad's
    // canonical trailKey. Members without the key share the squad trail.
    for (const squad of squadrons) {
      warpTrails[squad.trailKey] = {
        playerId: squad.trailKey,
        tiles: [],
        distressBeacon: { active: false },
      };
    }
  } else {
    for (const playerId of playerIds) {
      warpTrails[playerId] = {
        playerId,
        tiles: [],
        distressBeacon: { active: false },
      };
    }
  }

  return {
    spacedock: { value: spacedockValue, placedBy: spacedockPlacedBy },
    warpTrails,
    neutralZone: { tiles: [] },
    subspaceFracture: null,
    redAlert: null,
  };
}

export function trailOpenValue(
  trail: WarpTrail,
  spacedockValue: number
): number {
  if (trail.tiles.length === 0) {
    return spacedockValue;
  }
  return trail.tiles[trail.tiles.length - 1].openValue;
}

export function neutralZoneOpenValue(
  zone: NeutralZone,
  spacedockValue: number
): number {
  if (zone.tiles.length === 0) {
    return spacedockValue;
  }
  return zone.tiles[zone.tiles.length - 1].openValue;
}

export function isUncoveredDoubleAtTrailEnd(trail: WarpTrail): boolean {
  if (trail.tiles.length === 0) {
    return false;
  }
  const last = trail.tiles[trail.tiles.length - 1];
  const { coordinate, openValue } = last;
  return coordinate.low === coordinate.high && openValue === coordinate.low;
}

export function isUncoveredDoubleAtNeutralZoneEnd(zone: NeutralZone): boolean {
  if (zone.tiles.length === 0) {
    return false;
  }
  const last = zone.tiles[zone.tiles.length - 1];
  const { coordinate, openValue } = last;
  return coordinate.low === coordinate.high && openValue === coordinate.low;
}

/** Any trail or neutral zone ends on an open (uncovered) double. */
export function hasUncoveredDoubleOnTable(table: TableState): boolean {
  if (isUncoveredDoubleAtNeutralZoneEnd(table.neutralZone)) {
    return true;
  }
  for (const trail of Object.values(table.warpTrails)) {
    if (isUncoveredDoubleAtTrailEnd(trail)) {
      return true;
    }
  }
  return false;
}

/** Charted doubles on warp trails and the neutral zone (excludes Spacedock). */
export function countDoublesOnTable(table: TableState): number {
  let count = 0;
  for (const trail of Object.values(table.warpTrails)) {
    for (const placed of trail.tiles) {
      if (isDouble(placed.coordinate)) {
        count += 1;
      }
    }
  }
  for (const placed of table.neutralZone.tiles) {
    if (isDouble(placed.coordinate)) {
      count += 1;
    }
  }
  return count;
}

export function countActiveDistressBeacons(table: TableState): number {
  let count = 0;
  for (const trail of Object.values(table.warpTrails)) {
    if (trail.distressBeacon.active) {
      count += 1;
    }
  }
  return count;
}
