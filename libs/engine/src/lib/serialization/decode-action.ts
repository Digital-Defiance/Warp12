/**
 * Binary action decoder (binary-v2).
 * Decodes compact binary format back to GameAction objects.
 */

import type { GameAction } from '../types/actions.js';
import {
  ActionCode,
  decodeFlashEffect,
  decodeRoute,
} from './action-codes.js';
import {
  COORDINATE_ENCODED_BYTES,
  readCoordinate,
} from './encode-coordinate.js';

export interface DecodeContext {
  /** Player IDs in order (for index mapping). */
  playerIds: readonly string[];
  /** Maximum pip value (12 for Warp 12, etc.). */
  maxPip: number;
}

/**
 * Decode a player index to player ID.
 */
function decodePlayerId(index: number, ctx: DecodeContext): string {
  if (index >= ctx.playerIds.length) {
    throw new Error(`Player index out of range: ${index}`);
  }
  return ctx.playerIds[index];
}

/**
 * Decode a single action from a buffer.
 * Returns the decoded action and the number of bytes consumed.
 */
export function decodeAction(
  buffer: Uint8Array,
  offset: number,
  ctx: DecodeContext
): { action: GameAction; bytesRead: number } {
  if (offset >= buffer.length) {
    throw new Error('Buffer exhausted');
  }

  const opcode = buffer[offset];

  switch (opcode) {
    case ActionCode.CHART_COORDINATE: {
      const size = 3 + COORDINATE_ENCODED_BYTES;
      if (offset + size > buffer.length) {
        throw new Error('Buffer too short for CHART_COORDINATE');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const { coordinate } = readCoordinate(buffer, offset + 2, ctx.maxPip);
      const route = decodeRoute(
        buffer[offset + 2 + COORDINATE_ENCODED_BYTES],
        ctx.playerIds
      );
      return {
        action: { type: 'CHART_COORDINATE', playerId, coordinate, route },
        bytesRead: size,
      };
    }

    case ActionCode.DRAW_FROM_UNCHARTED: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for DRAW_FROM_UNCHARTED');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'DRAW_FROM_UNCHARTED', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.SENSOR_SWEEP: {
      const size = 2 + COORDINATE_ENCODED_BYTES;
      if (offset + size > buffer.length) {
        throw new Error('Buffer too short for SENSOR_SWEEP');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const { coordinate } = readCoordinate(buffer, offset + 2, ctx.maxPip);
      return {
        action: { type: 'SENSOR_SWEEP', playerId, coordinate },
        bytesRead: size,
      };
    }

    case ActionCode.SPOOL_WARP_DRIVE: {
      if (offset + 3 > buffer.length) {
        throw new Error('Buffer too short for SPOOL_WARP_DRIVE');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const route = decodeRoute(buffer[offset + 2], ctx.playerIds);
      if (route.kind === 'fracture-stabilizer' || route.kind === 'red-alert-cover') {
        throw new Error('Invalid route for SPOOL_WARP_DRIVE');
      }
      return {
        action: { type: 'SPOOL_WARP_DRIVE', playerId, route },
        bytesRead: 3,
      };
    }

    case ActionCode.PASS_RED_ALERT: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for PASS_RED_ALERT');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'PASS_RED_ALERT', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.PASS_TURN: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for PASS_TURN');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'PASS_TURN', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.DEPLOY_DISTRESS_BEACON: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for DEPLOY_DISTRESS_BEACON');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'DEPLOY_DISTRESS_BEACON', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.ALL_STOP: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for ALL_STOP');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'ALL_STOP', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.DROP_TO_IMPULSE: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for DROP_TO_IMPULSE');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'DROP_TO_IMPULSE', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.CATCH_DROP_TO_IMPULSE: {
      if (offset + 3 > buffer.length) {
        throw new Error('Buffer too short for CATCH_DROP_TO_IMPULSE');
      }
      const challengerId = decodePlayerId(buffer[offset + 1], ctx);
      const targetPlayerId = decodePlayerId(buffer[offset + 2], ctx);
      return {
        action: { type: 'CATCH_DROP_TO_IMPULSE', challengerId, targetPlayerId },
        bytesRead: 3,
      };
    }

    case ActionCode.RAISE_SHIELDS: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for RAISE_SHIELDS');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      return {
        action: { type: 'RAISE_SHIELDS', playerId },
        bytesRead: 2,
      };
    }

    case ActionCode.INVOKE_CONTINUUM_FLASH: {
      if (offset + 3 > buffer.length) {
        throw new Error('Buffer too short for INVOKE_CONTINUUM_FLASH');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const effect = decodeFlashEffect(buffer[offset + 2]);
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- compact opcode maps to FlashEffectKind
        action: { type: 'INVOKE_CONTINUUM_FLASH', playerId, effect: effect as any },
        bytesRead: 3,
      };
    }

    case ActionCode.RESOLVE_CONTINUUM_WAGER: {
      if (offset + 3 > buffer.length) {
        throw new Error('Buffer too short for RESOLVE_CONTINUUM_WAGER');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const keepIndex = buffer[offset + 2] as 0 | 1;
      if (keepIndex !== 0 && keepIndex !== 1) {
        throw new Error(`Invalid keepIndex: ${keepIndex}`);
      }
      return {
        action: { type: 'RESOLVE_CONTINUUM_WAGER', playerId, keepIndex },
        bytesRead: 3,
      };
    }

    case ActionCode.PICK_FROM_PACK: {
      const size = 2 + COORDINATE_ENCODED_BYTES;
      if (offset + size > buffer.length) {
        throw new Error('Buffer too short for PICK_FROM_PACK');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const { coordinate } = readCoordinate(buffer, offset + 2, ctx.maxPip);
      return {
        action: { type: 'PICK_FROM_PACK', playerId, coordinate },
        bytesRead: size,
      };
    }

    case ActionCode.END_ROUND: {
      if (offset + 2 > buffer.length) {
        throw new Error('Buffer too short for END_ROUND');
      }
      const winnerByte = buffer[offset + 1];
      const winnerId =
        winnerByte === 0xff ? null : decodePlayerId(winnerByte, ctx);
      return {
        action: { type: 'END_ROUND', winnerId },
        bytesRead: 2,
      };
    }

    case ActionCode.SALAMANDER_PENALTY: {
      if (offset + 5 > buffer.length) {
        throw new Error('Buffer too short for SALAMANDER_PENALTY');
      }
      const holderId = decodePlayerId(buffer[offset + 1], ctx);
      const scoredOnId = decodePlayerId(buffer[offset + 2], ctx);
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset + offset + 3,
        2
      );
      const points = view.getUint16(0, true);
      return {
        action: { type: 'SALAMANDER_PENALTY', holderId, scoredOnId, points },
        bytesRead: 5,
      };
    }

    case ActionCode.LONGEST_TRAIL_BONUS: {
      if (offset + 5 > buffer.length) {
        throw new Error('Buffer too short for LONGEST_TRAIL_BONUS');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const trailLength = buffer[offset + 2];
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset + offset + 3,
        2
      );
      const points = view.getInt16(0, true);
      return {
        action: { type: 'LONGEST_TRAIL_BONUS', playerId, trailLength, points },
        bytesRead: 5,
      };
    }

    case ActionCode.TEMPORAL_DEBT_PENALTY: {
      if (offset + 5 > buffer.length) {
        throw new Error('Buffer too short for TEMPORAL_DEBT_PENALTY');
      }
      const playerId = decodePlayerId(buffer[offset + 1], ctx);
      const tokens = buffer[offset + 2];
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset + offset + 3,
        2
      );
      const points = view.getUint16(0, true);
      return {
        action: { type: 'TEMPORAL_DEBT_PENALTY', playerId, tokens, points },
        bytesRead: 5,
      };
    }

    default:
      throw new Error(`Unknown action opcode: 0x${opcode.toString(16)}`);
  }
}

/**
 * Decode multiple actions from a buffer.
 * Format: [count: 4 bytes LE] [action1] [action2] ...
 */
export function decodeActions(
  buffer: Uint8Array,
  ctx: DecodeContext
): GameAction[] {
  if (buffer.length < 4) {
    throw new Error('Buffer too short for action count');
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const count = view.getUint32(0, true);

  if (count === 0) {
    return [];
  }

  const actions: GameAction[] = [];
  let offset = 4;

  for (let i = 0; i < count; i++) {
    const { action, bytesRead } = decodeAction(buffer, offset, ctx);
    actions.push(action);
    offset += bytesRead;
  }

  return actions;
}
