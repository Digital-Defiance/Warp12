import { describe, expect, it } from 'vitest';

import {
  advisorReplaySeed,
  hashStringSeed,
  mulberry32,
} from './advisor-replay-rng.js';

describe('advisor-replay-rng', () => {
  it('hashes strings deterministically', () => {
    expect(hashStringSeed('local-42')).toBe(hashStringSeed('local-42'));
    expect(hashStringSeed('local-42')).not.toBe(hashStringSeed('local-43'));
  });

  it('derives stable per-turn replay seeds', () => {
    expect(advisorReplaySeed(100, 0, 'a')).toBe(advisorReplaySeed(100, 0, 'a'));
    expect(advisorReplaySeed(100, 0, 'a')).not.toBe(advisorReplaySeed(100, 1, 'a'));
    expect(advisorReplaySeed(100, 0, 'a')).not.toBe(advisorReplaySeed(100, 0, 'b'));
  });

  it('mulberry32 is deterministic for a seed', () => {
    const rngA = mulberry32(4242);
    const rngB = mulberry32(4242);
    expect(rngA()).toBe(rngB());
    expect(rngA()).toBe(rngB());
  });
});
