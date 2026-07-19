import type { RoundState, TableState } from '../types/game-state.js';
import type { PlayerId, DistressBeacon } from '../types/player.js';
import type { WarpTrail } from '../types/trails.js';
import type { ChartRoute } from '../types/actions.js';
import type { Coordinate } from '../types/coordinate.js';
import { trailKeyFor } from './squadrons.js';

export const DESPERATION_DIG_MAX_DRAWS = 3;
export const DESPERATION_DIG_BEACON_TURNS = 2;

export function deployDesperationBeacon(trail: WarpTrail): WarpTrail {
  return {
    ...trail,
    distressBeacon: {
      active: true,
      chartedOwnTrailSinceDown: false,
      forcedOpenRemaining: DESPERATION_DIG_BEACON_TURNS,
    },
  };
}

/** Prefer own trail, then Neutral Zone, then any other legal route. */
export function pickDesperationDigRoute(
  moves: readonly { coordinate: Coordinate; route: ChartRoute }[],
  playerId: PlayerId,
  round: RoundState
): ChartRoute | null {
  if (moves.length === 0) {
    return null;
  }
  const ownKey = trailKeyFor(round, playerId);
  const own = moves.find(
    (m) => m.route.kind === 'warp-trail' && m.route.playerId === ownKey
  );
  if (own) {
    return own.route;
  }
  const nz = moves.find((m) => m.route.kind === 'neutral-zone');
  if (nz) {
    return nz.route;
  }
  return moves[0]!.route;
}

export function beaconBlocksClear(beacon: DistressBeacon): boolean {
  return (beacon.forcedOpenRemaining ?? 0) > 0;
}

/**
 * After the trail holder’s turn ends, tick down Desperation Dig forced-open.
 */
export function tickDesperationBeaconOnTurnEnd(
  table: TableState,
  outgoingPlayerId: PlayerId,
  round: RoundState
): TableState {
  const key = trailKeyFor(round, outgoingPlayerId);
  const trail = table.warpTrails[key];
  if (!trail) {
    return table;
  }
  const remaining = trail.distressBeacon.forcedOpenRemaining ?? 0;
  if (remaining <= 0) {
    return table;
  }
  const next = remaining - 1;
  return {
    ...table,
    warpTrails: {
      ...table.warpTrails,
      [key]: {
        ...trail,
        distressBeacon: {
          ...trail.distressBeacon,
          forcedOpenRemaining: next > 0 ? next : undefined,
        },
      },
    },
  };
}
