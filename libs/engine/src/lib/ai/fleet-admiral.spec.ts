import { describe, expect, it } from 'vitest';

import {
  resolveClass1StarPlayLookahead,
  resolveFleetAdmiralExpectimaxLookahead,
  resolveFleetAdmiralIsmctsLookahead,
  resolveFleetAdmiralPlayLookahead,
} from './fleet-admiral.js';

describe('resolveFleetAdmiralPlayLookahead', () => {
  it('uses expectimax for 2p points (bench)', () => {
    expect(resolveFleetAdmiralPlayLookahead('points', 2, 'bench')).toEqual(
      expect.objectContaining({
        searchEngine: 'expectimax',
        depth: 4,
        determinizations: 16,
      })
    );
  });

  it('uses expectimax for 2p go-out (bench)', () => {
    expect(resolveFleetAdmiralPlayLookahead('go-out', 2, 'bench')).toEqual(
      expect.objectContaining({
        searchEngine: 'expectimax',
        depth: 3,
        determinizations: 12,
      })
    );
  });

  it('uses ISMCTS for 4p go-out (bench)', () => {
    expect(resolveFleetAdmiralPlayLookahead('go-out', 4, 'bench')).toEqual(
      expect.objectContaining({
        searchEngine: 'ismcts',
        timeBudgetMs: 300,
        ismctsMaxIterations: 2_000,
      })
    );
  });

  it('uses expectimax for 2p points (interactive / app)', () => {
    expect(resolveClass1StarPlayLookahead('points', 2)).toEqual(
      expect.objectContaining({
        searchEngine: 'expectimax',
        depth: 4,
        determinizations: 12,
      })
    );
  });

  it('uses ISMCTS for 4p points (interactive / app)', () => {
    expect(resolveClass1StarPlayLookahead('points', 4)).toEqual(
      expect.objectContaining({
        searchEngine: 'ismcts',
        timeBudgetMs: 250,
        ismctsMaxIterations: 800,
      })
    );
  });

  it('keeps explicit ISMCTS preset for A/B benches', () => {
    expect(resolveFleetAdmiralIsmctsLookahead('points', 2).searchEngine).toBe(
      'ismcts'
    );
  });

  it('keeps explicit expectimax preset for A/B benches', () => {
    expect(
      resolveFleetAdmiralExpectimaxLookahead('points', 2).searchEngine
    ).toBe('expectimax');
  });
});
