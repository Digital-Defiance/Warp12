import type { TableState } from '../types/game-state.js';
import type { NeutralZone, WarpTrail } from '../types/trails.js';
import type { PlayerId } from '../types/player.js';

export function createInitialTable(
  playerIds: readonly PlayerId[],
  spacedockValue: number,
  spacedockPlacedBy: PlayerId
): TableState {
  const warpTrails: Record<PlayerId, WarpTrail> = {};

  for (const playerId of playerIds) {
    warpTrails[playerId] = {
      playerId,
      tiles: [],
      distressBeacon: { active: false },
    };
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
