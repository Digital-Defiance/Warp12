import { describe, expect, it } from 'vitest';

import {
  opponentTeiForObjective,
  isProvisionalRating,
} from './stats-openskill.js';
import { toStoredRating } from './rating-types.js';

describe('stats-rating (OpenSkill)', () => {
  it('returns AI anchor rating for opponent display', () => {
    // Commander anchors from calibration
    const commanderPoints = opponentTeiForObjective('points', 'commander');
    const commanderGoOut = opponentTeiForObjective('go-out', 'commander');
    
    expect(commanderPoints).toBeGreaterThan(0);
    expect(commanderGoOut).toBeGreaterThan(0);
  });

  it('flags high sigma ratings as provisional', () => {
    const provisional = toStoredRating({ mu: 25, sigma: 8.33, matches: 1 });
    const established = toStoredRating({ mu: 32, sigma: 1.2, matches: 50 });
    
    expect(isProvisionalRating(provisional)).toBe(true);
    expect(isProvisionalRating(established)).toBe(false);
  });
});
