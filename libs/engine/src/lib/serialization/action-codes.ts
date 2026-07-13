/**
 * Binary action encoding constants.
 * Each action type maps to a single byte opcode.
 */

import type { ChartRoute } from '../types/actions.js';

/** Action type opcodes (1 byte each). */
export enum ActionCode {
  CHART_COORDINATE = 0x01,
  DRAW_FROM_UNCHARTED = 0x02,
  SENSOR_SWEEP = 0x03,
  SPOOL_WARP_DRIVE = 0x04,
  PASS_RED_ALERT = 0x05,
  PASS_TURN = 0x06,
  DEPLOY_DISTRESS_BEACON = 0x07,
  ALL_STOP = 0x08,
  DROP_TO_IMPULSE = 0x09,
  CATCH_DROP_TO_IMPULSE = 0x0a,
  RAISE_SHIELDS = 0x0b,
  INVOKE_CONTINUUM_FLASH = 0x0c,
  RESOLVE_CONTINUUM_WAGER = 0x0d,
  PICK_FROM_PACK = 0x0e,
  END_ROUND = 0x0f,
}

/** Route kind encoding (2 bits in route byte). */
export enum RouteKind {
  WARP_TRAIL = 0b00,
  NEUTRAL_ZONE = 0b01,
  FRACTURE_STABILIZER = 0b10,
  RED_ALERT_COVER = 0b11,
}

/** Flash effect codes for continuum. */
export enum FlashCode {
  REVERSE_TURN_ORDER = 0x00,
  SKIP_LOWEST_POINTS = 0x01,
  PEEK_UNCHARTED = 0x02,
  TEMPORAL_INVERSION = 0x03,
  DISTRESS_AMPLIFICATION = 0x04,
  FRACTURE_IMMUNITY = 0x05,
  SALAMANDER_SWAP = 0x06,
  ALL_STOP_ECHO = 0x07,
  CONTINUUM_WAGER = 0x08,
}

/**
 * Route byte encoding:
 * Bits 7-6: RouteKind (00=trail, 01=neutral, 10=stabilizer, 11=alert)
 * Bits 5-0: Player ID (for warp-trail) or flags
 */
export function encodeRoute(route: {
  kind: 'warp-trail' | 'neutral-zone' | 'fracture-stabilizer' | 'red-alert-cover';
  playerId?: string;
  trailPlayerId?: string;
  neutralZone?: boolean;
}): number {
  let byte = 0;

  switch (route.kind) {
    case 'warp-trail': {
      byte = (RouteKind.WARP_TRAIL << 6) | parsePlayerIndex(route.playerId!);
      break;
    }
    case 'neutral-zone': {
      byte = RouteKind.NEUTRAL_ZONE << 6;
      break;
    }
    case 'fracture-stabilizer': {
      byte = RouteKind.FRACTURE_STABILIZER << 6;
      break;
    }
    case 'red-alert-cover': {
      byte = RouteKind.RED_ALERT_COVER << 6;
      if (route.trailPlayerId) {
        byte |= parsePlayerIndex(route.trailPlayerId);
      } else if (route.neutralZone) {
        byte |= 0x3f; // Special marker for neutral zone
      }
      break;
    }
  }

  return byte;
}

export function decodeRoute(
  byte: number,
  playerIds: readonly string[]
): ChartRoute {
  const kindBits = (byte >> 6) & 0b11;
  const payload = byte & 0x3f;

  switch (kindBits) {
    case RouteKind.WARP_TRAIL:
      return { kind: 'warp-trail', playerId: playerIds[payload] };
    case RouteKind.NEUTRAL_ZONE:
      return { kind: 'neutral-zone' };
    case RouteKind.FRACTURE_STABILIZER:
      return { kind: 'fracture-stabilizer' };
    case RouteKind.RED_ALERT_COVER:
      if (payload === 0x3f) {
        return { kind: 'red-alert-cover', neutralZone: true as const };
      }
      return { kind: 'red-alert-cover', trailPlayerId: playerIds[payload] };
    default:
      throw new Error(`Invalid route kind: ${kindBits}`);
  }
}

/** Extract player index from player ID (e.g., "player-0" → 0). */
function parsePlayerIndex(playerId: string): number {
  const match = /(\d+)$/.exec(playerId);
  if (!match) {
    throw new Error(`Cannot parse player index from: ${playerId}`);
  }
  const index = Number.parseInt(match[1], 10);
  if (index < 0 || index > 63) {
    throw new Error(`Player index out of range: ${index}`);
  }
  return index;
}

export function encodeFlashEffect(effect: string): number {
  switch (effect) {
    case 'reverse-turn-order':
      return FlashCode.REVERSE_TURN_ORDER;
    case 'skip-lowest-points':
      return FlashCode.SKIP_LOWEST_POINTS;
    case 'peek-uncharted':
      return FlashCode.PEEK_UNCHARTED;
    case 'temporal-inversion':
      return FlashCode.TEMPORAL_INVERSION;
    case 'distress-amplification':
      return FlashCode.DISTRESS_AMPLIFICATION;
    case 'fracture-immunity':
      return FlashCode.FRACTURE_IMMUNITY;
    case 'salamander-swap':
      return FlashCode.SALAMANDER_SWAP;
    case 'all-stop-echo':
      return FlashCode.ALL_STOP_ECHO;
    case 'continuum-wager':
      return FlashCode.CONTINUUM_WAGER;
    default:
      throw new Error(`Unknown flash effect: ${effect}`);
  }
}

export function decodeFlashEffect(code: number): string {
  switch (code) {
    case FlashCode.REVERSE_TURN_ORDER:
      return 'reverse-turn-order';
    case FlashCode.SKIP_LOWEST_POINTS:
      return 'skip-lowest-points';
    case FlashCode.PEEK_UNCHARTED:
      return 'peek-uncharted';
    case FlashCode.TEMPORAL_INVERSION:
      return 'temporal-inversion';
    case FlashCode.DISTRESS_AMPLIFICATION:
      return 'distress-amplification';
    case FlashCode.FRACTURE_IMMUNITY:
      return 'fracture-immunity';
    case FlashCode.SALAMANDER_SWAP:
      return 'salamander-swap';
    case FlashCode.ALL_STOP_ECHO:
      return 'all-stop-echo';
    case FlashCode.CONTINUUM_WAGER:
      return 'continuum-wager';
    default:
      throw new Error(`Unknown flash code: ${code}`);
  }
}
