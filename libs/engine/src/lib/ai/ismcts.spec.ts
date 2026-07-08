import { describe, expect, it } from 'vitest';

import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { ismctsSearchActionValues } from './ismcts.js';
import { createWarpSearchModel, observationToState } from './search-model.js';
import { warpAiActionKey } from './from-game-action.js';
import type { WarpAiAction } from './actions.js';
import type { GameState } from '../types/game-state.js';
import { makeRound, N, obsFor } from './test-fixtures.js';
import type { WarpAiObservation } from './observation.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGame(seed: number) {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    mulberry32(seed)
  );
  return startGame(
    {
      id: 'ismcts-test',
      captains: [
        { id: 'a', displayName: 'Alpha' },
        { id: 'b', displayName: 'Beta' },
        { id: 'c', displayName: 'Gamma' },
        { id: 'd', displayName: 'Delta' },
      ],
    },
    { shuffledCoordinates: shuffled }
  );
}

describe('ismctsSearchActionValues', () => {
  it('returns scored legal actions within time budget', () => {
    const round = makeRound({ hands: { a: [N(5, 12)], b: [N(1, 1)] } });
    const model = createWarpSearchModel('go-out');
    const scored = ismctsSearchActionValues<GameState, WarpAiAction>(
      observationToState(obsFor(round)),
      model,
      {
        perspective: 'a',
        rng: mulberry32(7),
        timeBudgetMs: 80,
        maxIterations: 200,
        maxBranch: 6,
      },
      warpAiActionKey
    );

    expect(scored.length).toBeGreaterThan(0);
    expect(scored.some((entry) => entry.visits > 0)).toBe(true);
    expect(scored[0]?.action.kind).toBe('chart');
  });

  it('runs on a full simulated position without throwing', () => {
    const state = buildGame(11);
    const round = state.round!;
    const obs: WarpAiObservation = {
      round,
      playerId: round.activePlayerId,
      modules: state.modules,
      houseRules: state.houseRules!,
      objective: state.objective,
      campaignRounds: state.campaignRounds,
      captains: state.captains,
    };
    const model = createWarpSearchModel(state.objective);

    expect(() =>
      ismctsSearchActionValues<GameState, WarpAiAction>(
        observationToState(obs),
        model,
        {
          perspective: round.activePlayerId,
          rng: mulberry32(3),
          timeBudgetMs: 50,
          maxIterations: 100,
        },
        warpAiActionKey
      )
    ).not.toThrow();
  });
});
