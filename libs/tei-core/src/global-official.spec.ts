import { describe, expect, it } from 'vitest';

import {
  globalOfficialCharterId,
  globalOfficialSlug,
  normalizeSeasonKey,
  parseGlobalOfficialFleetSize,
} from './global-official.js';

describe('globalOfficialCharterId', () => {
  it('keeps legacy ids for 4p', () => {
    expect(globalOfficialCharterId(4)).toBe('global-official');
    expect(globalOfficialSlug(4)).toBe('global-official');
  });

  it('uses per-fleet slugs for other sizes', () => {
    expect(globalOfficialCharterId(6)).toBe('global-official-6p');
    expect(globalOfficialSlug(8)).toBe('global-official-8p');
  });

  it('parses charter ids and slugs', () => {
    expect(parseGlobalOfficialFleetSize('global-official-6p')).toBe(6);
    expect(parseGlobalOfficialFleetSize('global-official')).toBe(4);
  });
});

describe('normalizeSeasonKey', () => {
  it('slugifies season labels', () => {
    expect(normalizeSeasonKey('2026 Fall')).toBe('2026-fall');
  });
});
