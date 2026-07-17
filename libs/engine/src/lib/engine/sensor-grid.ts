import type { Coordinate } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import type { GameModules } from '../types/modules.js';

/**
 * Module Gamma: Long-Range Sensor Sweep
 * 
 * Initialize and maintain a visible "market" of tiles that captains can choose
 * from instead of blind draws. Grid size is typically 4-5 tiles.
 */

/**
 * Initialize the sensor grid at round start when Module Gamma is enabled.
 * Deals the first N tiles from uncharted sectors to the grid.
 */
export function initializeSensorGrid(
  unchartedSectors: readonly Coordinate[],
  gridSize: number
): { readonly sensorGrid: readonly Coordinate[]; readonly unchartedSectors: readonly Coordinate[] } {
  if (gridSize <= 0) {
    return { sensorGrid: [], unchartedSectors };
  }

  const availableSize = Math.min(gridSize, unchartedSectors.length);
  const grid = unchartedSectors.slice(0, availableSize);
  const remaining = unchartedSectors.slice(availableSize);

  return {
    sensorGrid: grid,
    unchartedSectors: remaining,
  };
}

/**
 * Refill the sensor grid up to targetSize from Uncharted Sectors.
 * Used after Sensor Sweep, Warp Drive Spool, Double Down, etc. — Module Gamma’s
 * “constant, refreshing” market (RULES §VI Gamma).
 */
export function refillSensorGrid(
  sensorGrid: readonly Coordinate[],
  unchartedSectors: readonly Coordinate[],
  targetSize: number
): { readonly sensorGrid: readonly Coordinate[]; readonly unchartedSectors: readonly Coordinate[] } {
  if (targetSize <= 0 || sensorGrid.length >= targetSize || unchartedSectors.length === 0) {
    return { sensorGrid, unchartedSectors };
  }

  const need = Math.min(targetSize - sensorGrid.length, unchartedSectors.length);
  return {
    sensorGrid: [...sensorGrid, ...unchartedSectors.slice(0, need)],
    unchartedSectors: unchartedSectors.slice(need),
  };
}

/**
 * Remove a tile from the sensor grid (captain performs sensor sweep).
 * Returns the updated grid and whether the tile was found.
 */
export function removeFromSensorGrid(
  sensorGrid: readonly Coordinate[],
  coordinate: Coordinate
): { readonly sensorGrid: readonly Coordinate[]; readonly found: boolean } {
  const index = sensorGrid.findIndex(
    (tile) => tile.low === coordinate.low && tile.high === coordinate.high
  );

  if (index === -1) {
    return { sensorGrid, found: false };
  }

  const updated = [...sensorGrid];
  updated.splice(index, 1);
  return { sensorGrid: updated, found: true };
}

/**
 * Check if sensor grid should be active for this round.
 */
export function isSensorGridActive(modules: GameModules): boolean {
  return modules.sensorGrid.enabled;
}

/**
 * Apply sensor grid initialization to a new round if Module Gamma is enabled.
 */
export function applySensorGridToRound(
  round: RoundState,
  modules: GameModules
): RoundState {
  if (!isSensorGridActive(modules)) {
    return round;
  }

  const { sensorGrid, unchartedSectors } = initializeSensorGrid(
    round.unchartedSectors,
    modules.sensorGrid.gridSize
  );

  return {
    ...round,
    sensorGrid,
    unchartedSectors,
  };
}
