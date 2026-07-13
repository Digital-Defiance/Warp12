/**
 * Binary serialization for compact match logs and network transfer.
 * 
 * Action encoding: 2-5 bytes per action (vs ~100-300 bytes JSON)
 * Full match: ~1KB binary vs ~50-500KB JSON (50-500x compression!)
 * 
 * @example
 * ```typescript
 * const ctx = { playerIds: ['p0', 'p1', 'p2', 'p3'], maxPip: 12 };
 * const actions: GameAction[] = [...];
 * 
 * // Encode to binary
 * const binary = encodeActions(actions, ctx);
 * console.log(`${binary.length} bytes`); // ~600 bytes for 200 actions
 * 
 * // Decode back
 * const decoded = decodeActions(binary, ctx);
 * ```
 */

export { ActionCode, RouteKind, FlashCode } from './action-codes.js';
export { encodeRoute, decodeRoute, encodeFlashEffect, decodeFlashEffect } from './action-codes.js';

export {
  encodeCoordinate,
  decodeCoordinate,
  getMaxEncodedValue,
  canEncodeInOneByte,
} from './encode-coordinate.js';

export {
  encodeAction,
  encodeActions,
  type EncodeContext,
} from './encode-action.js';

export {
  decodeAction,
  decodeActions,
  type DecodeContext,
} from './decode-action.js';

export {
  encodeRoundState,
  encodeGameState,
  type StateEncodeContext,
} from './encode-state.js';

export {
  decodeRoundState,
  decodeGameState,
  type StateDecodeContext,
} from './decode-state.js';
