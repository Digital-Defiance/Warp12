/**
 * Binary coordinate encoding (binary-v2).
 * Coordinate index = low * (maxPip + 1) + high, stored as little-endian u16.
 *
 * Warp 12: max index 168; Warp 15: 255; Warp 18: 360. Two bytes cover all
 * exhibition sets with headroom (maxPip ≤ 255 → index ≤ 65535).
 */

import type { Coordinate } from '../types/coordinate.js';

/** Encoded coordinate width in the binary-v2 wire format. */
export const COORDINATE_ENCODED_BYTES = 2 as const;

/**
 * Encode a coordinate to a compact index.
 * @param maxPip Maximum pip value (9 / 12 / 15 / 18, …)
 */
export function encodeCoordinate(coord: Coordinate, maxPip: number): number {
  if (coord.low < 0 || coord.low > maxPip) {
    throw new Error(`Coordinate low out of range: ${coord.low}`);
  }
  if (coord.high < 0 || coord.high > maxPip) {
    throw new Error(`Coordinate high out of range: ${coord.high}`);
  }
  if (coord.low > coord.high) {
    throw new Error(`Coordinate not normalized: ${coord.low}-${coord.high}`);
  }

  const encoded = coord.low * (maxPip + 1) + coord.high;
  if (encoded > 0xffff) {
    throw new Error(
      `Coordinate encoding exceeds 2 bytes: ${encoded} (maxPip=${maxPip})`
    );
  }
  return encoded;
}

/**
 * Decode a coordinate from its compact index.
 */
export function decodeCoordinate(encoded: number, maxPip: number): Coordinate {
  if (!Number.isInteger(encoded) || encoded < 0 || encoded > 0xffff) {
    throw new Error(`Encoded coordinate out of range: ${encoded}`);
  }

  const divisor = maxPip + 1;
  const low = Math.floor(encoded / divisor);
  const high = encoded % divisor;

  if (low > maxPip || high > maxPip) {
    throw new Error(
      `Decoded coordinate out of range: ${low}-${high} (maxPip=${maxPip})`
    );
  }
  if (low > high) {
    throw new Error(`Decoded coordinate not normalized: ${low}-${high}`);
  }

  return { low, high };
}

/** Write a coordinate as little-endian u16; returns bytes written (2). */
export function writeCoordinate(
  buffer: Uint8Array,
  offset: number,
  coord: Coordinate,
  maxPip: number
): typeof COORDINATE_ENCODED_BYTES {
  const encoded = encodeCoordinate(coord, maxPip);
  buffer[offset] = encoded & 0xff;
  buffer[offset + 1] = (encoded >> 8) & 0xff;
  return COORDINATE_ENCODED_BYTES;
}

/** Read a little-endian u16 coordinate; returns coordinate + bytes consumed. */
export function readCoordinate(
  buffer: Uint8Array,
  offset: number,
  maxPip: number
): { coordinate: Coordinate; bytesRead: typeof COORDINATE_ENCODED_BYTES } {
  if (offset + COORDINATE_ENCODED_BYTES > buffer.length) {
    throw new Error('Buffer too short for coordinate');
  }
  const encoded = buffer[offset] | (buffer[offset + 1] << 8);
  return {
    coordinate: decodeCoordinate(encoded, maxPip),
    bytesRead: COORDINATE_ENCODED_BYTES,
  };
}

/**
 * Get the maximum coordinate index for a given maxPip.
 */
export function getMaxEncodedValue(maxPip: number): number {
  return maxPip * (maxPip + 1) + maxPip;
}

/**
 * @deprecated binary-v2 always uses 2 bytes. Prefer {@link canEncodeInTwoBytes}.
 */
export function canEncodeInOneByte(maxPip: number): boolean {
  return getMaxEncodedValue(maxPip) <= 255;
}

/** Whether maxPip's tile index fits in a little-endian u16 (binary-v2). */
export function canEncodeInTwoBytes(maxPip: number): boolean {
  return getMaxEncodedValue(maxPip) <= 0xffff;
}
