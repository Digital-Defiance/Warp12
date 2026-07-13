/**
 * Binary action encoder.
 * Encodes GameAction to compact binary format (2-5 bytes per action).
 */

import type { GameAction } from '../types/actions.js';
import {
  ActionCode,
  encodeFlashEffect,
  encodeRoute,
} from './action-codes.js';
import { encodeCoordinate } from './encode-coordinate.js';

export interface EncodeContext {
  /** Player IDs in order (for index mapping). */
  playerIds: readonly string[];
  /** Maximum pip value (12 for Warp 12, etc.). */
  maxPip: number;
}

/**
 * Encode a player ID to a byte index.
 */
function encodePlayerId(playerId: string, ctx: EncodeContext): number {
  const index = ctx.playerIds.indexOf(playerId);
  if (index === -1) {
    throw new Error(`Unknown player ID: ${playerId}`);
  }
  if (index > 255) {
    throw new Error(`Player index exceeds 1 byte: ${index}`);
  }
  return index;
}

/**
 * Encode a GameAction to binary format.
 * Returns a Uint8Array of 2-5 bytes depending on action type.
 */
export function encodeAction(action: GameAction, ctx: EncodeContext): Uint8Array {
  switch (action.type) {
    case 'CHART_COORDINATE': {
      const bytes = new Uint8Array(4);
      bytes[0] = ActionCode.CHART_COORDINATE;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeCoordinate(action.coordinate, ctx.maxPip);
      bytes[3] = encodeRoute(action.route);
      return bytes;
    }

    case 'DRAW_FROM_UNCHARTED': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.DRAW_FROM_UNCHARTED;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'SENSOR_SWEEP': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.SENSOR_SWEEP;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeCoordinate(action.coordinate, ctx.maxPip);
      return bytes;
    }

    case 'SPOOL_WARP_DRIVE': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.SPOOL_WARP_DRIVE;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeRoute(action.route);
      return bytes;
    }

    case 'PASS_RED_ALERT': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.PASS_RED_ALERT;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'PASS_TURN': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.PASS_TURN;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'DEPLOY_DISTRESS_BEACON': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.DEPLOY_DISTRESS_BEACON;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'ALL_STOP': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.ALL_STOP;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'DROP_TO_IMPULSE': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.DROP_TO_IMPULSE;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'CATCH_DROP_TO_IMPULSE': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.CATCH_DROP_TO_IMPULSE;
      bytes[1] = encodePlayerId(action.challengerId, ctx);
      bytes[2] = encodePlayerId(action.targetPlayerId, ctx);
      return bytes;
    }

    case 'RAISE_SHIELDS': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.RAISE_SHIELDS;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'INVOKE_CONTINUUM_FLASH': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.INVOKE_CONTINUUM_FLASH;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeFlashEffect(action.effect);
      return bytes;
    }

    case 'RESOLVE_CONTINUUM_WAGER': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.RESOLVE_CONTINUUM_WAGER;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = action.keepIndex;
      return bytes;
    }

    case 'PICK_FROM_PACK': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.PICK_FROM_PACK;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeCoordinate(action.coordinate, ctx.maxPip);
      return bytes;
    }

    case 'END_ROUND': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.END_ROUND;
      bytes[1] = action.winnerId === null ? 0xff : encodePlayerId(action.winnerId, ctx);
      return bytes;
    }

    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown action type: ${(exhaustive as GameAction).type}`);
    }
  }
}

/**
 * Encode multiple actions into a single buffer.
 * Format: [count: 4 bytes LE] [action1] [action2] ...
 */
export function encodeActions(actions: readonly GameAction[], ctx: EncodeContext): Uint8Array {
  if (actions.length === 0) {
    return new Uint8Array(4); // Just the count (0)
  }

  // First pass: compute total size
  const encoded = actions.map((action) => encodeAction(action, ctx));
  const totalSize = 4 + encoded.reduce((sum, bytes) => sum + bytes.length, 0);

  // Second pass: write to buffer
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  // Write count (4 bytes, little-endian)
  view.setUint32(0, actions.length, true);

  // Write actions
  let offset = 4;
  for (const bytes of encoded) {
    buffer.set(bytes, offset);
    offset += bytes.length;
  }

  return buffer;
}
