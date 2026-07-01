import { describe, expect, it } from 'vitest';

import { normalizeCoordinate } from '../types/coordinate.js';
import { generateCoordinateSet } from '../domino/coordinates.js';
import type { GameState, RoundState } from '../types/game-state.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import { createInitialTable } from '../table/table-state.js';
import { assignHiddenHands, passesBeliefConstraints } from './belief-constraints.js';
import { benchFleetAdmiralVsCommander } from './bench-fleet-admiral.js';
import { resolveFleetAdmiralPlayLookahead } from './fleet-admiral.js';

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

function baseState(round: RoundState): GameState {
  return {
    id: 'belief-test',
    phase: 'active',
    captains: [
      { id: 'a', displayName: 'A', pointsScore: 0 },
      { id: 'b', displayName: 'B', pointsScore: 0 },
    ],
    round,
    completedRounds: 0,
    modules: DEFAULT_MODULES,
    houseRules: DEFAULT_HOUSE_RULES,
    objective: 'points',
    campaignRounds: 13,
  };
}

describe('belief-constraints', () => {
  it('pins mandatory-play tiles into the active hand', () => {
    const round: RoundState = {
      roundNumber: 1,
      spacedockValue: 12,
      phase: 'playing',
      activePlayerId: 'a',
      turnOrder: ['a', 'b'],
      table: createInitialTable(['a', 'b'], 12, 'a'),
      unchartedSectors: [normalizeCoordinate(0, 1)],
      hands: { a: [normalizeCoordinate(5, 5)], b: [normalizeCoordinate(3, 4)] },
      allStopRequired: false,
      allStopDeclared: false,
      roundWinnerId: null,
      qPendingInvoker: null,
      qEffects: null,
      qGamblePending: null,
      mandatoryPlay: {
        playerId: 'a',
        coordinate: normalizeCoordinate(5, 5),
      },
      pendingRoundWin: null,
      roundBlocked: false,
      roundStarterOpening: null,
    };

    const badHands = {
      a: [normalizeCoordinate(1, 1)],
      b: [normalizeCoordinate(3, 4)],
    };
    expect(passesBeliefConstraints(baseState(round), badHands)).toBe(false);

    const pool = generateCoordinateSet(12).filter(
      (coordinate) =>
        coordinate.low !== 5 ||
        coordinate.high !== 5 ||
        coordinate.low !== 1 ||
        coordinate.high !== 1
    );
    const assigned = assignHiddenHands(
      baseState(round),
      'a',
      pool,
      mulberry32(1),
      true
    );
    expect(assigned?.a.some((c) => c.low === 5 && c.high === 5)).toBe(true);
  });
});

describe('benchFleetAdmiralVsCommander', () => {
  it('runs a short points heads-up match', () => {
    const result = benchFleetAdmiralVsCommander({
      games: 4,
      seed: 3,
      objective: 'points',
      playerCount: 2,
      fleetLookahead: {
        depth: 2,
        determinizations: 2,
        maxBranch: 4,
        useBeliefConstraints: true,
      },
    });

    expect(result.completed).toBeGreaterThan(0);
    expect(result.fleetLookahead).toEqual(
      expect.objectContaining({ useBeliefConstraints: true })
    );
    expect(resolveFleetAdmiralPlayLookahead('points', 2, 'bench').searchEngine).toBe(
      'expectimax'
    );
  });
});
