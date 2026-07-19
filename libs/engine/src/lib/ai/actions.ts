import type { GameAction, LegalMove, SpoolOption } from '../types/actions.js';
import type { PlayerId } from '../types/player.js';
import type { FlashEffectKind } from '../types/continuum.js';

/**
 * The AI's action space, mirroring the moves a captain can declare. `chart`
 * wraps an engine {@link LegalMove}; the rest map 1:1 onto control actions.
 * Custom variants can extend behavior with new heuristics/generators rather
 * than new kinds, since these already cover every legal Warp 12 action.
 */
export type WarpAiAction =
  | { readonly kind: 'chart'; readonly move: LegalMove }
  | { readonly kind: 'spool'; readonly option: SpoolOption }
  | { readonly kind: 'draw' }
  | { readonly kind: 'desperation-dig' }
  | { readonly kind: 'deploy-beacon' }
  | { readonly kind: 'pass-red-alert' }
  | { readonly kind: 'pass-turn' }
  | { readonly kind: 'all-stop' }
  | { readonly kind: 'raise-shields' }
  | { readonly kind: 'drop-to-impulse' }
  | { readonly kind: 'catch-drop-to-impulse'; readonly targetPlayerId: PlayerId }
  | {
      readonly kind: 'invoke-continuum-flash';
      readonly effect: FlashEffectKind;
      readonly targetPlayerId?: PlayerId;
    }
  | { readonly kind: 'resolve-continuum-wager'; readonly keepIndex: 0 | 1 }
  | { readonly kind: 'pick-from-pack'; readonly coordinate: import('../types/coordinate.js').Coordinate }
  | {
      readonly kind: 'resolve-hand-exchange';
      readonly coordinate: import('../types/coordinate.js').Coordinate;
    };

/** Lowers an AI action into the engine {@link GameAction} for `applyAction`. */
export function toGameAction(
  action: WarpAiAction,
  playerId: PlayerId
): GameAction {
  switch (action.kind) {
    case 'chart':
      return {
        type: 'CHART_COORDINATE',
        playerId,
        coordinate: action.move.coordinate,
        route: action.move.route,
      };
    case 'spool':
      return {
        type: 'SPOOL_WARP_DRIVE',
        playerId,
        route: action.option.route,
      };
    case 'draw':
      return { type: 'DRAW_FROM_UNCHARTED', playerId };
    case 'desperation-dig':
      return { type: 'DESPERATION_DIG', playerId };
    case 'deploy-beacon':
      return { type: 'DEPLOY_DISTRESS_BEACON', playerId };
    case 'pass-red-alert':
      return { type: 'PASS_RED_ALERT', playerId };
    case 'pass-turn':
      return { type: 'PASS_TURN', playerId };
    case 'all-stop':
      return { type: 'ALL_STOP', playerId };
    case 'raise-shields':
      return { type: 'RAISE_SHIELDS', playerId };
    case 'drop-to-impulse':
      return { type: 'DROP_TO_IMPULSE', playerId };
    case 'catch-drop-to-impulse':
      return {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: playerId,
        targetPlayerId: action.targetPlayerId,
      };
    case 'invoke-continuum-flash':
      return {
        type: 'INVOKE_CONTINUUM_FLASH',
        playerId,
        effect: action.effect,
        ...(action.targetPlayerId
          ? { targetPlayerId: action.targetPlayerId }
          : {}),
      };
    case 'resolve-continuum-wager':
      return {
        type: 'RESOLVE_CONTINUUM_WAGER',
        playerId,
        keepIndex: action.keepIndex,
      };
    case 'pick-from-pack':
      return {
        type: 'PICK_FROM_PACK',
        playerId,
        coordinate: action.coordinate,
      };
    case 'resolve-hand-exchange':
      return {
        type: 'RESOLVE_HAND_EXCHANGE',
        playerId,
        coordinate: action.coordinate,
      };
  }
}
