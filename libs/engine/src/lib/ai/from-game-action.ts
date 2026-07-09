import { coordinateKey, type Coordinate } from '../types/coordinate.js';
import type { ChartRoute } from '../types/actions.js';
import type { GameAction } from '../types/actions.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';

function routeKey(route: ChartRoute): string {
  switch (route.kind) {
    case 'warp-trail':
      return `trail:${route.playerId}`;
    case 'neutral-zone':
      return 'neutral-zone';
    case 'fracture-stabilizer':
      return 'fracture';
    case 'red-alert-cover':
      return route.neutralZone
        ? 'red-alert:nz'
        : `red-alert:${route.trailPlayerId ?? 'trail'}`;
  }
}

/** Stable key for comparing AI / human moves in reports and tests. */
export function warpAiActionKey(action: WarpAiAction): string {
  switch (action.kind) {
    case 'chart':
      return `chart:${coordinateKey(action.move.coordinate)}:${routeKey(
        action.move.route
      )}`;
    case 'catch-drop-to-impulse':
      return `catch-dti:${action.targetPlayerId}`;
    case 'invoke-continuum-flash':
      return `continuum-flash:${action.effect}`;
    case 'resolve-continuum-wager':
      return `q-gamble:${action.keepIndex}`;
    default:
      return action.kind;
  }
}

/** Lower a recorded engine action into the AI action space when possible. */
export function gameActionToWarpAi(
  action: GameAction,
  actingPlayerId: PlayerId
): WarpAiAction | null {
  switch (action.type) {
    case 'CHART_COORDINATE':
      return {
        kind: 'chart',
        move: { coordinate: action.coordinate, route: action.route },
      };
    case 'DRAW_FROM_UNCHARTED':
      return { kind: 'draw' };
    case 'DEPLOY_DISTRESS_BEACON':
      return { kind: 'deploy-beacon' };
    case 'PASS_RED_ALERT':
      return { kind: 'pass-red-alert' };
    case 'PASS_TURN':
      return { kind: 'pass-turn' };
    case 'ALL_STOP':
      return { kind: 'all-stop' };
    case 'RAISE_SHIELDS':
      return { kind: 'raise-shields' };
    case 'DROP_TO_IMPULSE':
      return { kind: 'drop-to-impulse' };
    case 'CATCH_DROP_TO_IMPULSE':
      if (action.challengerId !== actingPlayerId) {
        return null;
      }
      return {
        kind: 'catch-drop-to-impulse',
        targetPlayerId: action.targetPlayerId,
      };
    case 'INVOKE_CONTINUUM_FLASH':
      return { kind: 'invoke-continuum-flash', effect: action.effect };
    case 'RESOLVE_CONTINUUM_WAGER':
      return { kind: 'resolve-continuum-wager', keepIndex: action.keepIndex };
    case 'END_ROUND':
      return null;
  }
}

export function coordinateLabel(coordinate: Coordinate): string {
  return `${coordinate.low}-${coordinate.high}`;
}
