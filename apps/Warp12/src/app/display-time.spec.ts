import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  formatBrightDurationCompact,
  formatDisplayDay,
  formatDisplayTime,
  formatElapsedLogTime,
} from './display-time.js';
import { writeUserPrefs } from './user-prefs.js';

describe('display-time', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('formats locale time by default', () => {
    const iso = '2026-07-16T12:00:00.000Z';
    expect(formatDisplayTime(iso, { preferBrightDate: false })).toContain('2026');
  });

  it('formats BrightDate when preferred (no BD: prefix)', () => {
    const iso = '2026-07-16T12:00:00.000Z';
    const out = formatDisplayTime(iso, { preferBrightDate: true });
    expect(out.startsWith('BD:')).toBe(false);
    expect(out).toMatch(/^\d+\.\d+$/);
  });

  it('formats BrightDate day label without BD: prefix', () => {
    const out = formatDisplayDay('2026-07-16T12:00:00.000Z', {
      preferBrightDate: true,
    });
    expect(out).toMatch(/^\d+$/);
  });

  it('reads preference from user prefs', () => {
    writeUserPrefs({ preferBrightDate: true });
    const out = formatDisplayTime('2026-07-16T12:00:00.000Z');
    expect(out.startsWith('BD:')).toBe(false);
    expect(out).toMatch(/^\d+\.\d+$/);
  });

  it('formats game-log elapsed time as a BrightDate decimal span', () => {
    const startedAt = Date.parse('2026-07-16T12:00:00.000Z');
    expect(
      formatElapsedLogTime('2026-07-16T12:05:12.000Z', startedAt, {
        preferBrightDate: true,
      })
    ).toBe('3.611md');
    expect(formatBrightDurationCompact(1 / 86_400)).toBe('11.574μd');
  });

  it('keeps MM:SS elapsed time when BrightDate is off', () => {
    const startedAt = Date.parse('2026-07-16T12:00:00.000Z');
    expect(
      formatElapsedLogTime('2026-07-16T12:05:12.000Z', startedAt, {
        preferBrightDate: false,
      })
    ).toBe('05:12');
  });
});
