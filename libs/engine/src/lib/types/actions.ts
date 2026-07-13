import type { Coordinate } from './coordinate.js';
import type { PlayerId } from './player.js';

import type { FlashEffectKind } from './continuum.js';

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
  | { type: 'SENSOR_SWEEP'; playerId: PlayerId; coordinate: Coordinate }
  | { 
      type: 'SPOOL_WARP_DRIVE'; 
      playerId: PlayerId; 
      route: Exclude<ChartRoute, { kind: 'fracture-stabilizer' } | { kind: 'red-alert-cover' }>;
    }
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
  | { type: 'INVOKE_CONTINUUM_FLASH'; playerId: PlayerId; effect: FlashEffectKind }
  | { type: 'RESOLVE_CONTINUUM_WAGER'; playerId: PlayerId; keepIndex: 0 | 1 }
  /** Module Epsilon: Pick a tile from your draft pack. */
  | { type: 'PICK_FROM_PACK'; playerId: PlayerId; coordinate: Coordinate }
  | { type: 'END_ROUND'; winnerId: PlayerId | null };

export type ActionResult =
  | { ok: true; state: import('./game-state.js').GameState }
  | { ok: false; violation: ActionViolation };

export type ActionViolation =
  | 'NOT_YOUR_TURN'
  | 'GAME_NOT_ACTIVE'
  | 'ROUND_NOT_PLAYING'
  | 'ROUND_NOT_DRAFTING'
  | 'COORDINATE_NOT_IN_HAND'
  | 'COORDINATE_NOT_IN_PACK'
  | 'COORDINATE_NOT_IN_SENSOR_GRID'
  | 'INVALID_ROUTE'
  | 'SHIELDS_UP'
  | 'NAVIGATION_HALTED'
  | 'RED_ALERT_REQUIRED'
  | 'FRACTURE_REQUIRES_STABILIZER'
  | 'EMPTY_UNCHARTED'
  | 'EMPTY_SENSOR_GRID'
  | 'SPOOL_NOT_ALLOWED'
  | 'MODULE_NOT_ENABLED'
  | 'ALL_STOP_NOT_REQUIRED'
  | 'DROP_TO_IMPULSE_NOT_REQUIRED'
  | 'DROP_TO_IMPULSE_CHART_BLOCKED'
  | 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED'
  | 'RED_ALERT_NOT_ACTIVE'
  | 'CONTINUUM_FLASH_NOT_PENDING'
  | 'CONTINUUM_WAGER_NOT_PENDING'
  | 'CONTINUUM_FLASH_UNAVAILABLE'
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

/** Available warp drive spool targets (Module Delta). */
export interface SpoolOption {
  route: Exclude<ChartRoute, { kind: 'fracture-stabilizer' } | { kind: 'red-alert-cover' }>;
}

