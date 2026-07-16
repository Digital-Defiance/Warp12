import { describe, expect, it } from 'vitest';

import { createInitialTable } from '../table/table-state.js';
import { normalizeCoordinate as N } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import {
  createClass1StarPlayer,
  getClass1StarSkillProfile,
} from './class1-star.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { observe } from './observation.js';
import { createTsResidualScorer, createZeroClass1StarModelWeights } from './residual-scorer.js';
import { resolveWarpLookahead } from './skill.js';
import { warpAiActionKey } from './from-game-action.js';

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

function makeRound(over: Partial<RoundState> = {}): RoundState {
  const spacedockValue = over.spacedockValue ?? 12;
  return {
    roundNumber: 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: ['a', 'b'],
    table: createInitialTable(['a', 'b'], spacedockValue, 'a'),
    unchartedSectors: [N(3, 5), N(7, 9), N(1, 8)],
    hands: {
      a: [N(6, 6), N(2, 4), N(5, 5)],
      b: [N(1, 1), N(8, 10)],
    },
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    continuumPendingInvoker: null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    roundStarterOpeningResolved: false,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    ...over,
  };
}

describe('Class I* player', () => {
  it('uses commander skill profile by default', () => {
    const profile = getClass1StarSkillProfile('go-out', 2);
    const commander = getClass1StarSkillProfile('go-out', 2);

    expect(profile.weights).toEqual(commander.weights);
    expect(profile.blunderRate).toBe(commander.blunderRate);
  });

  it('matches commander picks when the residual model is zero-initialized', () => {
    const rng = mulberry32(42);
    const objective = 'go-out' as const;
    const playerCount = 2;
    const skill = getClass1StarSkillProfile(objective, playerCount);
    const lookahead = resolveWarpLookahead('commander', objective, playerCount);
    const residualScorer = createTsResidualScorer(createZeroClass1StarModelWeights());

    const commander = createWarpAiPlayer({
      skill,
      objective,
      lookahead,
      rng,
    });
    const class1Star = createClass1StarPlayer({
      objective,
      playerCount,
      residualScorer,
      rng,
    });

    const round = makeRound();
    const state = {
      id: 'test',
      phase: 'active' as const,
      captains: [
        { id: 'a', displayName: 'Alpha', pointsScore: 0 },
        { id: 'b', displayName: 'Beta', pointsScore: 0 },
      ],
      round,
      completedRounds: 0,
      modules: DEFAULT_MODULES,
      houseRules: DEFAULT_HOUSE_RULES,
      objective,
      campaignRounds: 1,
    };

    const obs = observe(state, 'a');
    expect(obs).not.toBeNull();
    if (!obs) return;

    const commanderAction = commander.decide(obs);
    const class1StarAction = class1Star.decide(obs);

    expect(warpAiActionKey(class1StarAction)).toBe(warpAiActionKey(commanderAction));
  });
});
