/**
 * Binary action encoder (binary-v2).
 * Encodes GameAction to compact binary; coordinates are little-endian u16.
 */

import type { GameAction } from '../types/actions.js';
import {
  ActionCode,
  encodeFlashEffect,
  encodeRoute,
} from './action-codes.js';
import {
  COORDINATE_ENCODED_BYTES,
  writeCoordinate,
} from './encode-coordinate.js';

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
 * Returns a Uint8Array of 2–6 bytes depending on action type (v2).
 */
export function encodeAction(action: GameAction, ctx: EncodeContext): Uint8Array {
  switch (action.type) {
    case 'CHART_COORDINATE': {
      // opcode + player + coord(u16) + route = 5
      const bytes = new Uint8Array(3 + COORDINATE_ENCODED_BYTES);
      bytes[0] = ActionCode.CHART_COORDINATE;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      writeCoordinate(bytes, 2, action.coordinate, ctx.maxPip);
      bytes[2 + COORDINATE_ENCODED_BYTES] = encodeRoute(
        action.route,
        ctx.playerIds
      );
      return bytes;
    }

    case 'DRAW_FROM_UNCHARTED': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.DRAW_FROM_UNCHARTED;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      return bytes;
    }

    case 'SENSOR_SWEEP': {
      const bytes = new Uint8Array(2 + COORDINATE_ENCODED_BYTES);
      bytes[0] = ActionCode.SENSOR_SWEEP;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      writeCoordinate(bytes, 2, action.coordinate, ctx.maxPip);
      return bytes;
    }

    case 'SPOOL_WARP_DRIVE': {
      const bytes = new Uint8Array(3);
      bytes[0] = ActionCode.SPOOL_WARP_DRIVE;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = encodeRoute(action.route, ctx.playerIds);
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
      const bytes = new Uint8Array(2 + COORDINATE_ENCODED_BYTES);
      bytes[0] = ActionCode.PICK_FROM_PACK;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      writeCoordinate(bytes, 2, action.coordinate, ctx.maxPip);
      return bytes;
    }

    case 'END_ROUND': {
      const bytes = new Uint8Array(2);
      bytes[0] = ActionCode.END_ROUND;
      bytes[1] =
        action.winnerId === null ? 0xff : encodePlayerId(action.winnerId, ctx);
      return bytes;
    }

    case 'SALAMANDER_PENALTY': {
      // opcode + holder + scoredOn + points u16 LE = 5
      const bytes = new Uint8Array(5);
      bytes[0] = ActionCode.SALAMANDER_PENALTY;
      bytes[1] = encodePlayerId(action.holderId, ctx);
      bytes[2] = encodePlayerId(action.scoredOnId, ctx);
      const view = new DataView(bytes.buffer);
      view.setUint16(3, action.points, true);
      return bytes;
    }

    case 'LONGEST_TRAIL_BONUS': {
      // opcode + playerId + trailLength u8 + points i16 LE = 5
      const bytes = new Uint8Array(5);
      bytes[0] = ActionCode.LONGEST_TRAIL_BONUS;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = Math.min(255, Math.max(0, action.trailLength));
      const view = new DataView(bytes.buffer);
      view.setInt16(3, action.points, true);
      return bytes;
    }

    case 'TEMPORAL_DEBT_PENALTY': {
      // opcode + playerId + tokens u8 + points u16 LE = 5
      const bytes = new Uint8Array(5);
      bytes[0] = ActionCode.TEMPORAL_DEBT_PENALTY;
      bytes[1] = encodePlayerId(action.playerId, ctx);
      bytes[2] = Math.min(255, Math.max(0, action.tokens));
      const view = new DataView(bytes.buffer);
      view.setUint16(3, Math.max(0, action.points), true);
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
export function encodeActions(
  actions: readonly GameAction[],
  ctx: EncodeContext
): Uint8Array {
  if (actions.length === 0) {
    return new Uint8Array(4); // Just the count (0)
  }

  const encoded = actions.map((action) => encodeAction(action, ctx));
  const totalSize = 4 + encoded.reduce((sum, bytes) => sum + bytes.length, 0);

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  view.setUint32(0, actions.length, true);

  let offset = 4;
  for (const bytes of encoded) {
    buffer.set(bytes, offset);
    offset += bytes.length;
  }

  return buffer;
}
