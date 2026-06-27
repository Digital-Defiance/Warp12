import type { Coordinate } from './coordinate.js';
import type { PlayerId } from './player.js';

import type { QFlashEffectKind } from './q-continuum.js';

/** Route a coordinate may be charted onto. */
export type ChartRoute =
  | { kind: 'warp-trail'; playerId: PlayerId }
  | { kind: 'neutral-zone' }
  | { kind: 'fracture-stabilizer' }
  | { kind: 'red-alert-cover'; trailPlayerId: PlayerId };

export type GameAction =
  | {
      type: 'CHART_COORDINATE';
      playerId: PlayerId;
      coordinate: Coordinate;
      route: ChartRoute;
    }
  | { type: 'DRAW_FROM_UNCHARTED'; playerId: PlayerId }
  | { type: 'PASS_RED_ALERT'; playerId: PlayerId }
  | { type: 'PASS_TURN'; playerId: PlayerId }
  | { type: 'DEPLOY_DISTRESS_BEACON'; playerId: PlayerId }
  | { type: 'DECLARE_TREATY'; playerId: PlayerId }
  | { type: 'INVOKE_Q_FLASH'; playerId: PlayerId; effect: QFlashEffectKind }
  | { type: 'RESOLVE_Q_GAMBLE'; playerId: PlayerId; keepIndex: 0 | 1 }
  | { type: 'END_ROUND'; winnerId: PlayerId };

export type ActionResult =
  | { ok: true; state: import('./game-state.js').GameState }
  | { ok: false; violation: ActionViolation };

export type ActionViolation =
  | 'NOT_YOUR_TURN'
  | 'GAME_NOT_ACTIVE'
  | 'ROUND_NOT_PLAYING'
  | 'COORDINATE_NOT_IN_HAND'
  | 'INVALID_ROUTE'
  | 'SHIELDS_UP'
  | 'NAVIGATION_HALTED'
  | 'RED_ALERT_REQUIRED'
  | 'FRACTURE_REQUIRES_STABILIZER'
  | 'EMPTY_UNCHARTED'
  | 'TREATY_NOT_REQUIRED'
  | 'RED_ALERT_NOT_ACTIVE'
  | 'Q_FLASH_NOT_PENDING'
  | 'Q_GAMBLE_NOT_PENDING'
  | 'Q_FLASH_UNAVAILABLE'
  | 'BEACON_NOT_ALLOWED'
  | 'BEACON_ALREADY_ACTIVE'
  | 'MUST_DRAW_FIRST'
  | 'RED_ALERT_COVER_AVAILABLE'
  | 'PASS_NOT_ALLOWED';

export interface LegalMove {
  coordinate: Coordinate;
  route: ChartRoute;
}
