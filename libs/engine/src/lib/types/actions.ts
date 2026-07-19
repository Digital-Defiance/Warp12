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
  /** Module Eta (Go-out): optional dig up to 3 from Uncharted; auto-chart first playable. */
  | { type: 'DESPERATION_DIG'; playerId: PlayerId }
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
  | {
      type: 'INVOKE_CONTINUUM_FLASH';
      playerId: PlayerId;
      effect: FlashEffectKind;
      /** Required for Force Draw (Go-out). */
      targetPlayerId?: PlayerId;
    }
  | { type: 'RESOLVE_CONTINUUM_WAGER'; playerId: PlayerId; keepIndex: 0 | 1 }
  /** Module Kappa (Go-out): larger hand returns one coordinate after Hand Exchange steal. */
  | {
      type: 'RESOLVE_HAND_EXCHANGE';
      playerId: PlayerId;
      coordinate: Coordinate;
    }
  /** Module Epsilon: Pick a tile from your draft pack. */
  | { type: 'PICK_FROM_PACK'; playerId: PlayerId; coordinate: Coordinate }
  | { type: 'END_ROUND'; winnerId: PlayerId | null }
  /**
   * Go-out fixed-rounds: host accepts or declines overtime after a tied
   * regulation campaign. Not a playable helm action.
   */
  | {
      type: 'RESOLVE_GO_OUT_OVERTIME';
      playerId: PlayerId;
      accept: boolean;
    }
  /**
   * Scoring annotation (not a playable action): Module Beta charged the held
   * highest double at round end. Emitted into action / binary logs so public
   * standings are auditable. Never submit via applyAction.
   */
  | {
      type: 'SALAMANDER_PENALTY';
      /** Captain who held maxPip-maxPip when the round ended. */
      holderId: PlayerId;
      /** Captain who receives the doubled penalty (holder, or Continuum swap target). */
      scoredOnId: PlayerId;
      /** Points applied for that tile (e.g. 48 on Warp 12, 72 on Warp 18). */
      points: number;
    }
  /**
   * Scoring annotation (not a playable action): Module Theta longest-trail
   * bonus at round end. One entry per tied winner. Never submit via applyAction.
   */
  | {
      type: 'LONGEST_TRAIL_BONUS';
      playerId: PlayerId;
      /** Tiles on that captain's personal Warp Trail at scoring. */
      trailLength: number;
      /** Campaign delta (negative bonus, typically −3). */
      points: number;
    }
  /**
   * Scoring annotation (not a playable action): Module Eta Temporal Debt at
   * round end. One entry per captain with tokens > 0. Never submit via
   * applyAction.
   */
  | {
      type: 'TEMPORAL_DEBT_PENALTY';
      playerId: PlayerId;
      /** Draws from Uncharted that accrued tokens this round. */
      tokens: number;
      /** Campaign delta (tokens × costPerToken). */
      points: number;
    };

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
  | 'HAND_EXCHANGE_NOT_PENDING'
  | 'HAND_EXCHANGE_PENDING'
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

