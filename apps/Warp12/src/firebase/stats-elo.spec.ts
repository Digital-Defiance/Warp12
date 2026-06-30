import { describe, expect, it } from 'vitest';

import {
  AI_OPPONENT_ELO,
  DEFAULT_UNASSISTED_ELO,
  expectedEloScore,
  updateUnassistedElo,
} from './stats-elo.js';

describe('stats-elo', () => {
  it('expects even matchups near 0.5', () => {
    expect(expectedEloScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it('raises rating after beating a higher-rated opponent', () => {
    const next = updateUnassistedElo(
      DEFAULT_UNASSISTED_ELO,
      AI_OPPONENT_ELO.advanced,
      1,
      32
    );
    expect(next).toBeGreaterThan(DEFAULT_UNASSISTED_ELO);
  });

  it('lowers rating after losing to a lower-rated opponent', () => {
    const next = updateUnassistedElo(
      DEFAULT_UNASSISTED_ELO,
      AI_OPPONENT_ELO.beginner,
      0,
      32
    );
    expect(next).toBeLessThan(DEFAULT_UNASSISTED_ELO);
  });
});
