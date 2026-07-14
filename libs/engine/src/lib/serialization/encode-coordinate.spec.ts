import { describe, it, expect } from 'vitest';
import {
  canEncodeInOneByte,
  canEncodeInTwoBytes,
  decodeCoordinate,
  encodeCoordinate,
  getMaxEncodedValue,
  readCoordinate,
  writeCoordinate,
  COORDINATE_ENCODED_BYTES,
} from './encode-coordinate.js';

describe('Coordinate Encoding (binary-v2, u16 LE)', () => {
  describe('Warp 12 (maxPip=12)', () => {
    const maxPip = 12;

    it('encodes 0-0 (Spacedock)', () => {
      expect(encodeCoordinate({ low: 0, high: 0 }, maxPip)).toBe(0);
    });

    it('encodes 0-12', () => {
      expect(encodeCoordinate({ low: 0, high: 12 }, maxPip)).toBe(12);
    });

    it('encodes 12-12', () => {
      expect(encodeCoordinate({ low: 12, high: 12 }, maxPip)).toBe(168);
    });

    it('encodes 6-6', () => {
      expect(encodeCoordinate({ low: 6, high: 6 }, maxPip)).toBe(84);
    });

    it('encodes 3-7', () => {
      expect(encodeCoordinate({ low: 3, high: 7 }, maxPip)).toBe(46);
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          expect(decodeCoordinate(encodeCoordinate(coord, maxPip), maxPip)).toEqual(
            coord
          );
        }
      }
    });

    it('rejects non-normalized coordinates', () => {
      expect(() => encodeCoordinate({ low: 7, high: 3 }, maxPip)).toThrow(
        'Coordinate not normalized'
      );
    });

    it('rejects out-of-range low', () => {
      expect(() => encodeCoordinate({ low: -1, high: 5 }, maxPip)).toThrow(
        'Coordinate low out of range'
      );
      expect(() => encodeCoordinate({ low: 13, high: 13 }, maxPip)).toThrow(
        'Coordinate low out of range'
      );
    });

    it('rejects out-of-range high', () => {
      expect(() => encodeCoordinate({ low: 0, high: 13 }, maxPip)).toThrow(
        'Coordinate high out of range'
      );
    });

    it('fits historically in one byte and in two bytes', () => {
      expect(canEncodeInOneByte(maxPip)).toBe(true);
      expect(canEncodeInTwoBytes(maxPip)).toBe(true);
      expect(getMaxEncodedValue(maxPip)).toBe(168);
    });
  });

  describe('Warp 9 (maxPip=9)', () => {
    const maxPip = 9;

    it('encodes 9-9', () => {
      expect(encodeCoordinate({ low: 9, high: 9 }, maxPip)).toBe(99);
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          expect(decodeCoordinate(encodeCoordinate(coord, maxPip), maxPip)).toEqual(
            coord
          );
        }
      }
    });
  });

  describe('Warp 15 (maxPip=15)', () => {
    const maxPip = 15;

    it('encodes 15-15 at the old 1-byte ceiling', () => {
      expect(encodeCoordinate({ low: 15, high: 15 }, maxPip)).toBe(255);
      expect(canEncodeInOneByte(maxPip)).toBe(true);
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          expect(decodeCoordinate(encodeCoordinate(coord, maxPip), maxPip)).toEqual(
            coord
          );
        }
      }
    });
  });

  describe('Warp 18 (maxPip=18)', () => {
    const maxPip = 18;

    it('encodes 18-18 (360) in two bytes', () => {
      expect(encodeCoordinate({ low: 18, high: 18 }, maxPip)).toBe(360);
      expect(canEncodeInOneByte(maxPip)).toBe(false);
      expect(canEncodeInTwoBytes(maxPip)).toBe(true);
      expect(getMaxEncodedValue(maxPip)).toBe(360);
    });

    it('round-trips 18-18 via write/read helpers', () => {
      const buf = new Uint8Array(COORDINATE_ENCODED_BYTES);
      expect(writeCoordinate(buf, 0, { low: 18, high: 18 }, maxPip)).toBe(2);
      expect(buf[0]).toBe(360 & 0xff);
      expect(buf[1]).toBe(360 >> 8);
      expect(readCoordinate(buf, 0, maxPip)).toEqual({
        coordinate: { low: 18, high: 18 },
        bytesRead: 2,
      });
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          expect(decodeCoordinate(encodeCoordinate(coord, maxPip), maxPip)).toEqual(
            coord
          );
        }
      }
    });
  });

  describe('Decoding validation', () => {
    it('rejects out-of-range encoded values', () => {
      expect(() => decodeCoordinate(-1, 12)).toThrow('Encoded coordinate out of range');
      expect(() => decodeCoordinate(0x10000, 12)).toThrow(
        'Encoded coordinate out of range'
      );
    });

    it('rejects invalid encoding for given maxPip', () => {
      expect(() => decodeCoordinate(100, 9)).toThrow('Decoded coordinate out of range');
    });
  });
});
