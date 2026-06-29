import type { GameAction, LegalMove } from '../types/actions.js';
import type { PlayerId } from '../types/player.js';
import type { QFlashEffectKind } from '../types/q-continuum.js';

/**
 * The AI's action space, mirroring the moves a captain can declare. `chart`
 * wraps an engine {@link LegalMove}; the rest map 1:1 onto control actions.
 * Custom variants can extend behavior with new heuristics/generators rather
 * than new kinds, since these already cover every legal Warp 12 action.
 */
export type WarpAiAction =
  | { readonly kind: 'chart'; readonly move: LegalMove }
  | { readonly kind: 'draw' }
  | { readonly kind: 'deploy-beacon' }
  | { readonly kind: 'pass-red-alert' }
  | { readonly kind: 'pass-turn' }
  | { readonly kind: 'drop-to-impulse' }
  | { readonly kind: 'invoke-q-flash'; readonly effect: QFlashEffectKind }
  | { readonly kind: 'resolve-q-gamble'; readonly keepIndex: 0 | 1 };

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
    case 'draw':
      return { type: 'DRAW_FROM_UNCHARTED', playerId };
    case 'deploy-beacon':
      return { type: 'DEPLOY_DISTRESS_BEACON', playerId };
    case 'pass-red-alert':
      return { type: 'PASS_RED_ALERT', playerId };
    case 'pass-turn':
      return { type: 'PASS_TURN', playerId };
    case 'drop-to-impulse':
      return { type: 'DROP_TO_IMPULSE', playerId };
    case 'invoke-q-flash':
      return { type: 'INVOKE_Q_FLASH', playerId, effect: action.effect };
    case 'resolve-q-gamble':
      return {
        type: 'RESOLVE_Q_GAMBLE',
        playerId,
        keepIndex: action.keepIndex,
      };
  }
}
