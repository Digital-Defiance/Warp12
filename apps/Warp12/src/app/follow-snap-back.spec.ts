import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS,
  easeInOutCubic,
  interpolatePan,
  pulseStartDelayMs,
  sanitizeAutoFollowReturnDelayMs,
} from './follow-snap-back.js';

describe('follow-snap-back', () => {
  it('eases from 0→1 with flat ends', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });

  it('interpolates pan with easing', () => {
    const mid = interpolatePan({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5);
    expect(mid.x).toBeCloseTo(50, 5);
    expect(mid.y).toBeCloseTo(25, 5);
  });

  it('sanitizes return delay ms', () => {
    expect(sanitizeAutoFollowReturnDelayMs(undefined)).toBe(
      DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS
    );
    expect(sanitizeAutoFollowReturnDelayMs(-1)).toBe(
      DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS
    );
    expect(sanitizeAutoFollowReturnDelayMs(100)).toBe(300);
    expect(sanitizeAutoFollowReturnDelayMs(1500)).toBe(1500);
    expect(sanitizeAutoFollowReturnDelayMs('2500')).toBe(2500);
    expect(sanitizeAutoFollowReturnDelayMs(99_999)).toBe(30_000);
  });

  it('schedules pulse near the end of the dwell', () => {
    expect(pulseStartDelayMs(2000)).toBe(1600);
    expect(pulseStartDelayMs(200)).toBe(0);
  });
});
