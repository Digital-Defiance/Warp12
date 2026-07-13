import { describe, it, expect } from 'vitest';
import {
  canEncodeInOneByte,
  decodeCoordinate,
  encodeCoordinate,
  getMaxEncodedValue,
} from './encode-coordinate.js';

describe('Coordinate Encoding', () => {
  describe('Warp 12 (maxPip=12)', () => {
    const maxPip = 12;

    it('encodes 0-0 (Spacedock)', () => {
      const coord = { low: 0, high: 0 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(0);
    });

    it('encodes 0-12', () => {
      const coord = { low: 0, high: 12 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(12); // 0 * 13 + 12
    });

    it('encodes 12-12', () => {
      const coord = { low: 12, high: 12 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(168); // 12 * 13 + 12
    });

    it('encodes 6-6', () => {
      const coord = { low: 6, high: 6 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(84); // 6 * 13 + 6
    });

    it('encodes 3-7', () => {
      const coord = { low: 3, high: 7 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(46); // 3 * 13 + 7
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          const encoded = encodeCoordinate(coord, maxPip);
          const decoded = decodeCoordinate(encoded, maxPip);
          expect(decoded).toEqual(coord);
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

    it('fits in one byte', () => {
      expect(canEncodeInOneByte(maxPip)).toBe(true);
      expect(getMaxEncodedValue(maxPip)).toBe(168);
      expect(getMaxEncodedValue(maxPip)).toBeLessThanOrEqual(255);
    });
  });

  describe('Warp 9 (maxPip=9)', () => {
    const maxPip = 9;

    it('encodes 0-0', () => {
      const coord = { low: 0, high: 0 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(0);
    });

    it('encodes 9-9', () => {
      const coord = { low: 9, high: 9 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(99); // 9 * 10 + 9
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          const encoded = encodeCoordinate(coord, maxPip);
          const decoded = decodeCoordinate(encoded, maxPip);
          expect(decoded).toEqual(coord);
        }
      }
    });

    it('fits in one byte', () => {
      expect(canEncodeInOneByte(maxPip)).toBe(true);
      expect(getMaxEncodedValue(maxPip)).toBe(99);
    });
  });

  describe('Warp 15 (maxPip=15)', () => {
    const maxPip = 15;

    it('encodes 0-0', () => {
      const coord = { low: 0, high: 0 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(0);
    });

    it('encodes 15-15', () => {
      const coord = { low: 15, high: 15 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(255); // 15 * 16 + 15 (exactly fits!)
    });

    it('round-trips all valid coordinates', () => {
      for (let low = 0; low <= maxPip; low++) {
        for (let high = low; high <= maxPip; high++) {
          const coord = { low, high };
          const encoded = encodeCoordinate(coord, maxPip);
          const decoded = decodeCoordinate(encoded, maxPip);
          expect(decoded).toEqual(coord);
        }
      }
    });

    it('fits in one byte (exactly)', () => {
      expect(canEncodeInOneByte(maxPip)).toBe(true);
      expect(getMaxEncodedValue(maxPip)).toBe(255);
    });
  });

  describe('Warp 18 (maxPip=18)', () => {
    const maxPip = 18;

    it('encodes 0-0', () => {
      const coord = { low: 0, high: 0 };
      const encoded = encodeCoordinate(coord, maxPip);
      expect(encoded).toBe(0);
    });

    it('rejects 18-18 (exceeds 1 byte)', () => {
      const coord = { low: 18, high: 18 };
      expect(() => encodeCoordinate(coord, maxPip)).toThrow(
        'Coordinate encoding exceeds 1 byte'
      );
    });

    it('does not fit in one byte', () => {
      expect(canEncodeInOneByte(maxPip)).toBe(false);
      expect(getMaxEncodedValue(maxPip)).toBe(360); // Exceeds 255
    });
  });

  describe('Decoding validation', () => {
    it('rejects out-of-range byte', () => {
      expect(() => decodeCoordinate(-1, 12)).toThrow('Byte out of range');
      expect(() => decodeCoordinate(256, 12)).toThrow('Byte out of range');
    });

    it('rejects invalid encoding for given maxPip', () => {
      // For maxPip=9, max encoding is 99. Try decoding 100:
      expect(() => decodeCoordinate(100, 9)).toThrow(
        'Decoded coordinate out of range'
      );
    });
  });
});
