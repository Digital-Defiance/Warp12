import { describe, expect, it } from 'vitest';

import { createInitialTable } from '../table/table-state.js';
import { normalizeCoordinate as N } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import {
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_TILE_COUNT,
} from './class1-star-constants.js';
import { buildWarpContext } from './context.js';
import { encodeClass1StarFeatures } from './feature-encoder.js';
import type { WarpAiObservation } from './observation.js';

function makeObs(over: Partial<WarpAiObservation['round']> = {}): WarpAiObservation {
  const spacedockValue = over.spacedockValue ?? 12;
  const round: RoundState = {
    roundNumber: 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: ['a', 'b'],
    table: createInitialTable(['a', 'b'], spacedockValue, 'a'),
    unchartedSectors: [N(3, 5), N(7, 9)],
    hands: {
      a: [N(6, 6), N(2, 4)],
      b: [N(1, 1), N(8, 10), N(0, 12)],
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

  return {
    round,
    playerId: 'a',
    modules: DEFAULT_MODULES,
    houseRules: DEFAULT_HOUSE_RULES,
    objective: 'go-out',
    campaignRounds: 1,
    captains: [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
    ],
  };
}

describe('encodeClass1StarFeatures', () => {
  it('writes a fixed-width vector', () => {
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const features = encodeClass1StarFeatures(ctx, { kind: 'draw' });

    expect(features).toBeInstanceOf(Float32Array);
    expect(features.length).toBe(CLASS1_STAR_FEATURE_DIM);
  });

  it('is deterministic for the same observation and action', () => {
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const action = {
      kind: 'chart' as const,
      move: {
        coordinate: N(6, 6),
        route: { kind: 'warp-trail' as const, playerId: 'a' },
      },
    };

    const first = encodeClass1StarFeatures(ctx, action);
    const second = encodeClass1StarFeatures(ctx, action);

    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('marks hand and table tiles in separate masks', () => {
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const features = encodeClass1StarFeatures(ctx, { kind: 'draw' });

    const handOffset = 13;
    const tableOffset = 13 + CLASS1_STAR_TILE_COUNT;
    const handOnes = features
      .slice(handOffset, handOffset + CLASS1_STAR_TILE_COUNT)
      .filter((value) => value === 1).length;
    const tableOnes = features
      .slice(tableOffset, tableOffset + CLASS1_STAR_TILE_COUNT)
      .filter((value) => value === 1).length;

    expect(handOnes).toBe(2);
    expect(tableOnes).toBe(1);
  });

  it('encodes chart actions differently from draw', () => {
    const obs = makeObs();
    const ctx = buildWarpContext(obs, () => 0.5);
    const draw = encodeClass1StarFeatures(ctx, { kind: 'draw' });
    const chart = encodeClass1StarFeatures(ctx, {
      kind: 'chart',
      move: {
        coordinate: N(6, 6),
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    });

    expect(Array.from(draw)).not.toEqual(Array.from(chart));
  });
});
