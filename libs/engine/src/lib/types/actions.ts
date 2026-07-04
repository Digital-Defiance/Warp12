import type { Coordinate } from './coordinate.js';
import type { PlayerId } from './player.js';

import type { QFlashEffectKind } from './q-continuum.js';

/** Route a coordinate may be charted onto. */
export type ChartRoute =
  | { kind: 'warp-trail'; playerId: PlayerId }
  | { kind: 'neutral-zone' }
  | { kind: 'fracture-stabilizer' }
  | { kind: 'red-alert-cover'; trailPlayerId?: PlayerId; neutralZone?: true };

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
  | { type: 'ALL_STOP'; playerId: PlayerId }
  | { type: 'DROP_TO_IMPULSE'; playerId: PlayerId }
  | {
      type: 'CATCH_DROP_TO_IMPULSE';
      challengerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  /** Manual shield control: close your warp trail (house rule). */
  | { type: 'RAISE_SHIELDS'; playerId: PlayerId }
  | { type: 'INVOKE_Q_FLASH'; playerId: PlayerId; effect: QFlashEffectKind }
  | { type: 'RESOLVE_Q_GAMBLE'; playerId: PlayerId; keepIndex: 0 | 1 }
  | { type: 'END_ROUND'; winnerId: PlayerId | null };

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
  | 'ALL_STOP_NOT_REQUIRED'
  | 'DROP_TO_IMPULSE_NOT_REQUIRED'
  | 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED'
  | 'RED_ALERT_NOT_ACTIVE'
  | 'Q_FLASH_NOT_PENDING'
  | 'Q_GAMBLE_NOT_PENDING'
  | 'Q_FLASH_UNAVAILABLE'
  | 'BEACON_NOT_ALLOWED'
  | 'BEACON_ALREADY_ACTIVE'
  | 'MUST_DRAW_FIRST'
  | 'RED_ALERT_COVER_AVAILABLE'
  | 'PASS_NOT_ALLOWED'
  | 'RAISE_SHIELDS_NOT_ALLOWED'
  | 'TURN_CHART_LIMIT'
  | 'DRAW_NOT_ALLOWED';

export interface LegalMove {
  coordinate: Coordinate;
  route: ChartRoute;
}
