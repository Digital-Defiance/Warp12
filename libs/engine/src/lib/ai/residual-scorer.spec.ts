import { describe, expect, it } from 'vitest';

import { createInitialTable } from '../table/table-state.js';
import { normalizeCoordinate as N } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import { buildWarpContext } from './context.js';
import { encodeClass1StarFeatures } from './feature-encoder.js';
import type { WarpAiObservation } from './observation.js';
import {
  createTsResidualScorer,
  createZeroClass1StarModelWeights,
  forwardClass1StarModel,
} from './residual-scorer.js';

function makeObs(): WarpAiObservation {
  const round: RoundState = {
    roundNumber: 1,
    spacedockValue: 12,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: ['a', 'b'],
    table: createInitialTable(['a', 'b'], 12, 'a'),
    unchartedSectors: [N(3, 5)],
    hands: { a: [N(6, 6)], b: [N(1, 1), N(8, 10)] },
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
  };

  return {
    round,
    playerId: 'a',
    modules: DEFAULT_MODULES,
    houseRules: DEFAULT_HOUSE_RULES,
    objective: 'points',
    campaignRounds: 1,
    captains: [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
    ],
  };
}

describe('Class I* residual scorer', () => {
  it('returns zero residual from a zero-initialized model', () => {
    const weights = createZeroClass1StarModelWeights();
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const features = encodeClass1StarFeatures(ctx, { kind: 'draw' });

    expect(forwardClass1StarModel(features, weights)).toBe(0);
  });

  it('scores candidate batches', () => {
    const scorer = createTsResidualScorer(createZeroClass1StarModelWeights());
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const residuals = scorer.scoreCandidates(ctx, [
      { kind: 'draw' },
      { kind: 'pass-turn' },
    ]);

    expect(residuals).toEqual([0, 0]);
    expect(scorer.alpha).toBe(1);
  });

  it('propagates a non-zero output layer bias', () => {
    const weights = createZeroClass1StarModelWeights([4, 4]);
    const biased = {
      ...weights,
      layers: weights.layers.map((layer, index) =>
        index === weights.layers.length - 1
          ? { ...layer, bias: [0.42] }
          : layer
      ),
    };

    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const features = encodeClass1StarFeatures(ctx, { kind: 'draw' });

    expect(forwardClass1StarModel(features, biased)).toBeCloseTo(0.42);
    expect(weights.layers[weights.layers.length - 1].outSize).toBe(1);
  });
});
