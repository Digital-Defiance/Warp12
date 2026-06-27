import type { Rng } from 'doubletwelve';
import { coordinateKey, type Coordinate } from '../types/coordinate.js';
import { generateCoordinateSet } from '../domino/coordinates.js';
import type { ChartRoute } from '../types/actions.js';
import type { RoundState, TableState } from '../types/game-state.js';
import {
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import type { WarpAiObservation } from './observation.js';

/** Shared, pre-computed turn data handed to every Warp heuristic. */
export interface WarpEvalContext {
  readonly obs: WarpAiObservation;
  readonly hand: readonly Coordinate[];
  /** Coordinates neither in this captain's hand nor already on the table. */
  readonly unseen: readonly Coordinate[];
  readonly rng: Rng;
}

/** Every coordinate currently visible on the table (spacedock, trails, zone, fracture). */
export function collectPlacedCoordinates(table: TableState): Coordinate[] {
  const placed: Coordinate[] = [
    { low: table.spacedock.value, high: table.spacedock.value },
  ];

  for (const trail of Object.values(table.warpTrails)) {
    for (const tile of trail.tiles) {
      placed.push(tile.coordinate);
    }
  }
  for (const tile of table.neutralZone.tiles) {
    placed.push(tile.coordinate);
  }
  if (table.subspaceFracture) {
    placed.push(table.subspaceFracture.anchor.coordinate);
    for (const stabilizer of table.subspaceFracture.stabilizers) {
      placed.push(stabilizer.coordinate);
    }
  }
  return placed;
}

/** Open pip value a coordinate must match to chart onto the given route. */
export function connectingValueForRoute(
  round: RoundState,
  route: ChartRoute
): number | null {
  switch (route.kind) {
    case 'warp-trail': {
      const trail = round.table.warpTrails[route.playerId];
      return trail ? trailOpenValue(trail, round.spacedockValue) : null;
    }
    case 'red-alert-cover': {
      const trail = round.table.warpTrails[route.trailPlayerId];
      return trail ? trailOpenValue(trail, round.spacedockValue) : null;
    }
    case 'neutral-zone':
      return neutralZoneOpenValue(round.table.neutralZone, round.spacedockValue);
    case 'fracture-stabilizer':
      return round.table.subspaceFracture
        ? round.table.subspaceFracture.requiredValue
        : null;
  }
}

export function buildWarpContext(
  obs: WarpAiObservation,
  rng: Rng
): WarpEvalContext {
  const hand = obs.round.hands[obs.playerId] ?? [];

  const seen = new Set<string>();
  for (const coordinate of collectPlacedCoordinates(obs.round.table)) {
    seen.add(coordinateKey(coordinate));
  }
  for (const coordinate of hand) {
    seen.add(coordinateKey(coordinate));
  }
  const unseen = generateCoordinateSet(12).filter(
    (coordinate) => !seen.has(coordinateKey(coordinate))
  );

  return { obs, hand, unseen, rng };
}
