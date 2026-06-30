import { describe, expect, it } from 'vitest';

import {
  AI_OPPONENT_TEI_PENALTY,
  DEFAULT_UNASSISTED_TEI,
  expectedEloScore,
  updateUnassistedTei,
} from './stats-elo.js';

describe('stats-elo', () => {
  it('expects even matchups near 0.5', () => {
    expect(expectedEloScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });

  it('raises TEI after beating a higher-rated opponent', () => {
    const next = updateUnassistedTei(
      DEFAULT_UNASSISTED_TEI,
      AI_OPPONENT_TEI_PENALTY.commander,
      1,
      32
    );
    expect(next).toBeGreaterThan(DEFAULT_UNASSISTED_TEI);
  });

  it('lowers TEI after losing to a lower-rated opponent', () => {
    const next = updateUnassistedTei(
      DEFAULT_UNASSISTED_TEI,
      AI_OPPONENT_TEI_PENALTY.ensign,
      0,
      32
    );
    expect(next).toBeLessThan(DEFAULT_UNASSISTED_TEI);
  });
});
