import type { PlacedCoordinate } from '../types/coordinate.js';
import { coordinateKey } from '../types/coordinate.js';
import type { SubspaceFracture } from '../types/anomalies.js';
import type { TableState } from '../types/game-state.js';

function reindexAtEnd(
  tiles: readonly PlacedCoordinate[],
  incoming: readonly PlacedCoordinate[]
): PlacedCoordinate[] {
  let index = tiles.length;
  return incoming.map((tile) => ({
    ...tile,
    index: index++,
  }));
}

function trailCaptainForFracture(
  table: TableState,
  fracture: SubspaceFracture
): string | null {
  if (fracture.trailCaptainId) {
    return fracture.trailCaptainId;
  }

  const anchorKey = coordinateKey(fracture.anchor.coordinate);
  for (const trail of Object.values(table.warpTrails)) {
    if (
      trail.tiles.some(
        (tile) => coordinateKey(tile.coordinate) === anchorKey
      )
    ) {
      return trail.playerId;
    }
  }

  return null;
}

/** Move resolved stabilizer tiles onto the chart so they are not dropped when a new fracture opens. */
export function archiveFractureStabilizers(
  table: TableState,
  fracture: SubspaceFracture
): TableState {
  const stabilizers = fracture.stabilizers;
  if (stabilizers.length === 0) {
    return table;
  }

  if (fracture.neutralZone) {
    const archived = reindexAtEnd(table.neutralZone.tiles, stabilizers);
    return {
      ...table,
      neutralZone: {
        tiles: [...table.neutralZone.tiles, ...archived],
      },
    };
  }

  const trailCaptainId = trailCaptainForFracture(table, fracture);
  if (!trailCaptainId) {
    return table;
  }

  const trail = table.warpTrails[trailCaptainId];
  if (!trail) {
    return table;
  }

  const archived = reindexAtEnd(trail.tiles, stabilizers);
  return {
    ...table,
    warpTrails: {
      ...table.warpTrails,
      [trailCaptainId]: {
        ...trail,
        tiles: [...trail.tiles, ...archived],
      },
    },
  };
}
