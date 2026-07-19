import { describe, expect, it } from 'vitest';
import {
  runRandomGame,
  type RandomGameOptions,
} from './random-play-harness.js';

/**
 * Integration: go-out sector with all forked modules enabled should complete
 * without engine deadlocks (random legal play).
 */
describe('Go-out modules integration (random play)', () => {
  const base: Omit<RandomGameOptions, 'seed'> & { seed?: number } = {
    seed: 42,
    captainCount: 3,
    objective: 'go-out',
    modules: {
      continuum: true,
      salamanderPenalty: true,
      warpDriveSpool: true,
      longestTrail: true,
      temporalDebt: true,
      temporalInversion: true,
      doubleDown: true,
    },
  };

  it('completes a go-out sector with forked modules (seed 42)', () => {
    const result = runRandomGame({ ...base, seed: 42 });
    expect(result.deadlock).toBe(false);
    expect(result.violations).toEqual([]);
    expect(result.completed || result.finalState.round?.phase === 'ended').toBe(
      true
    );
  });

  it('completes across several seeds', () => {
    for (const seed of [1, 7, 99, 1234]) {
      const result = runRandomGame({ ...base, seed });
      expect(result.deadlock, `seed ${seed}`).toBe(false);
      expect(result.violations, `seed ${seed}`).toEqual([]);
    }
  });
});
