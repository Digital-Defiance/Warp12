import { describe, expect, it } from 'vitest';

import { startGame } from '../setup/create-game.js';
import { makeRound, N, obsFor } from './test-fixtures.js';
import {
  ADVISOR_CONCEPT_IDS,
  computeAdvisorStateConcepts,
  explainAdvisorConcepts,
} from './advisor-concepts.js';
import { buildWarpContext } from './context.js';
import { createAdvisorPlayer } from './create-advisor-player.js';
import { createZeroAdvisorModelWeights } from './advisor-net.js';

describe('advisor concepts', () => {
  it('emits a fixed-width concept vector with stable ids', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(3, 3)], b: [N(1, 1)] } });
    const obs = obsFor(round);
    const ctx = buildWarpContext(obs, () => 0.5);
    const concepts = computeAdvisorStateConcepts(ctx);
    expect(concepts.length).toBe(ADVISOR_CONCEPT_IDS.length);
    expect(concepts[0]).toBe(1);
    const reasons = explainAdvisorConcepts(concepts);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('marks go-out objective on go-out games', () => {
    const round = makeRound({
      hands: { a: [N(5, 12)], b: [N(1, 1)] },
    });
    const obs = obsFor(round, undefined, 'go-out');
    const ctx = buildWarpContext(obs, () => 0.5);
    const concepts = computeAdvisorStateConcepts(ctx);
    expect(concepts[1]).toBe(1);
  });
});

describe('createAdvisorPlayer', () => {
  it('returns a legal advisor decision from zero weights', () => {
    const round = makeRound({ hands: { a: [N(5, 12)], b: [N(1, 1)] } });
    const obs = obsFor(round);
    const player = createAdvisorPlayer({
      weights: createZeroAdvisorModelWeights(),
    });
    const decision = player.decide(obs);
    expect(decision).not.toBeNull();
    expect(decision?.reasons.length).toBeGreaterThan(0);
  });
});
