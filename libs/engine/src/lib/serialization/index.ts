/**
 * Binary serialization for compact match logs and network transfer.
 *
 * Wire format: **binary-v2** — coordinates are little-endian u16
 * (supports Warp 9 / 12 / 15 / 18). Actions are typically 2–6 bytes.
 *
 * @example
 * ```typescript
 * const ctx = { playerIds: ['p0', 'p1', 'p2', 'p3'], maxPip: 18 };
 * const actions: GameAction[] = [...];
 *
 * const binary = encodeActions(actions, ctx);
 * const decoded = decodeActions(binary, ctx);
 * ```
 */

/** Match-log / debug-export format tag for the current wire layout. */
export const BINARY_ACTION_LOG_FORMAT = 'binary-v2' as const;

export { ActionCode, RouteKind, FlashCode } from './action-codes.js';
export { encodeRoute, decodeRoute, encodeFlashEffect, decodeFlashEffect } from './action-codes.js';

export {
  encodeCoordinate,
  decodeCoordinate,
  writeCoordinate,
  readCoordinate,
  getMaxEncodedValue,
  canEncodeInOneByte,
  canEncodeInTwoBytes,
  COORDINATE_ENCODED_BYTES,
} from './encode-coordinate.js';

export { ROUND_STATE_BINARY_VERSION } from './encode-state.js';
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
