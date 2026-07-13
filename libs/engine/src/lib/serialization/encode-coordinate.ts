/**
 * Binary coordinate encoding.
 * Coordinate = low * (maxPip + 1) + high
 * 
 * For Warp 12 (maxPip=12): 0-12 values per pip = 13×13 = 169 possible coordinates
 * Fits in 1 byte (0-255), supports up to Warp 19 (20×20 = 400 would need 2 bytes)
 */

import type { Coordinate } from '../types/coordinate.js';

/**
 * Encode a coordinate to a single byte.
 * @param maxPip Maximum pip value (12 for Warp 12, 15 for Warp 15, etc.)
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
  if (encoded > 255) {
    throw new Error(`Coordinate encoding exceeds 1 byte: ${encoded} (maxPip=${maxPip})`);
  }
  return encoded;
}

/**
 * Decode a coordinate from a single byte.
 * @param maxPip Maximum pip value (12 for Warp 12, 15 for Warp 15, etc.)
 */
export function decodeCoordinate(byte: number, maxPip: number): Coordinate {
  if (byte < 0 || byte > 255) {
    throw new Error(`Byte out of range: ${byte}`);
  }

  const divisor = maxPip + 1;
  const low = Math.floor(byte / divisor);
  const high = byte % divisor;

  if (low > maxPip || high > maxPip) {
    throw new Error(`Decoded coordinate out of range: ${low}-${high} (maxPip=${maxPip})`);
  }
  if (low > high) {
    throw new Error(`Decoded coordinate not normalized: ${low}-${high}`);
  }

  return { low, high };
}

/**
 * Get the maximum coordinate value for a given maxPip.
 * Used to validate encoding fits in available space.
 */
export function getMaxEncodedValue(maxPip: number): number {
  return maxPip * (maxPip + 1) + maxPip;
}

/**
 * Check if maxPip can be encoded in a single byte.
 */
export function canEncodeInOneByte(maxPip: number): boolean {
  return getMaxEncodedValue(maxPip) <= 255;
}
