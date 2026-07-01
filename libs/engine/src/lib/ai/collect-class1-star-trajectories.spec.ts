import { describe, expect, it } from 'vitest';

import { benchClass1StarVsCommander } from './bench-class1-star.js';
import {
  collectClass1StarTrajectories,
  formatClass1StarTrajectoryJsonl,
} from './collect-class1-star-trajectories.js';
import { CLASS1_STAR_FEATURE_DIM } from './class1-star-constants.js';
import {
  createTsResidualScorer,
  createZeroClass1StarModelWeights,
} from './residual-scorer.js';

describe('Class I* trajectory collection', () => {
  it('collects labeled rows from completed Commander games', () => {
    const rows = collectClass1StarTrajectories({
      games: 4,
      seed: 1,
      objective: 'go-out',
      playerCount: 2,
      exportAllCandidates: true,
      includeContrast: false,
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.features).toHaveLength(CLASS1_STAR_FEATURE_DIM);
      expect(typeof row.heuristicScore).toBe('number');
      expect(Number.isFinite(row.heuristicScore)).toBe(true);
      expect(row.label === 1 || row.label === -1).toBe(true);
      expect(row.decisionId).toMatch(/^\d+:\d+$/);
      expect(row.gameIndex).toBeGreaterThanOrEqual(0);
    }
    const chosen = rows.filter((row) => row.chosen);
    expect(chosen.length).toBeGreaterThan(0);
  });

  it('formats JSONL lines', () => {
    const rows = collectClass1StarTrajectories({
      games: 1,
      seed: 2,
      includeContrast: false,
    });
    const jsonl = formatClass1StarTrajectoryJsonl(rows);
    const lines = jsonl.trim().split('\n');
    expect(lines.length).toBe(rows.length);
    expect(JSON.parse(lines[0]).features.length).toBe(CLASS1_STAR_FEATURE_DIM);
  });

  it('collects RL rows with commanderPick labels from Class I* seat', () => {
    const scorer = createTsResidualScorer(createZeroClass1StarModelWeights());
    const rows = collectClass1StarTrajectories({
      games: 3,
      seed: 11,
      objective: 'points',
      playerCount: 2,
      exportAllCandidates: true,
      collectMode: 'rl',
      residualScorer: scorer,
      class1StarSeatId: 'a',
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.actor).toBe('class1Star');
      expect(typeof row.commanderPick).toBe('boolean');
    }
    const withCommanderPick = rows.filter((row) => row.commanderPick);
    expect(withCommanderPick.length).toBeGreaterThan(0);
  });
});

describe('benchClass1StarVsCommander', () => {
  it('runs head-to-head with zero residual near parity', () => {
    const scorer = createTsResidualScorer(createZeroClass1StarModelWeights());
    const result = benchClass1StarVsCommander({
      games: 12,
      seed: 3,
      objective: 'go-out',
      playerCount: 2,
      residualScorer: scorer,
    });

    expect(result.completed).toBeGreaterThan(0);
    expect(result.class1StarWinRate).not.toBeNull();
  });
});
