import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { advanceToNextPlayer } from './continuum.js';
import { scoreRound } from './scoring.js';
import {
  createLobbyState,
  dealRoundFromShuffled,
  createRoundStateFromDeal,
  startGame,
} from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import { resolveModules } from '../types/modules.js';
import { getAvailableFlashEffects } from '../types/continuum.js';

const captains = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
  { id: 'c', displayName: 'Charlie' },
];

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function gameWithQContinuum(seed = 42) {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    seededRandom(seed)
  );
  return startGame(
    {
      id: 'q-test',
      captains,
      modules: { continuum: true, salamanderPenalty: true },
    },
    { shuffledCoordinates: shuffled }
  );
}

import { makeRound } from './test-helpers.js';

describe('skip-lowest-points', () => {
  it('consumes the skip when helm passes over the sidelined captain', () => {
    const round = makeRound(['a', 'b', 'c'], {
      activePlayerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: ['b'],
        peekedSector: null,
        salamanderSwap: false,
        allStopEcho: false,
      },
    });

    const { nextId, continuumEffects } = advanceToNextPlayer(round, 'a');
    expect(nextId).toBe('c');
    expect(continuumEffects?.skipNextTurnFor).toEqual([]);
  });

  it('includes a sidelined captain on the next helm pass after their skip is consumed', () => {
    const round = makeRound(['a', 'b', 'c', 'd'], {
      activePlayerId: 'd',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: ['a'],
        peekedSector: null,
        salamanderSwap: false,
        allStopEcho: false,
      },
    });

    const passedOver = advanceToNextPlayer(round, 'd');
    expect(passedOver.nextId).toBe('b');
    expect(passedOver.continuumEffects?.skipNextTurnFor).toEqual([]);

    const afterSkip = advanceToNextPlayer(
      { ...round, continuumEffects: passedOver.continuumEffects },
      'd'
    );
    expect(afterSkip.nextId).toBe('a');
  });
});

describe('getAvailableFlashEffects', () => {
  it('omits continuum-wager when fewer than two tiles remain in the pile', () => {
    const round = makeRound(['a', 'b', 'c'], {
      unchartedSectors: [normalizeCoordinate(1, 2)],
    });
    const modules = resolveModules({ continuum: true, salamanderPenalty: true });
    const available = getAvailableFlashEffects(round, modules, captains);
    expect(available).not.toContain('continuum-wager');
  });

  it('includes continuum-wager when at least two tiles remain in the pile', () => {
    const round = makeRound(['a', 'b', 'c'], {
      unchartedSectors: [normalizeCoordinate(1, 2), normalizeCoordinate(3, 4)],
    });
    const modules = resolveModules({ continuum: true, salamanderPenalty: true });
    const available = getAvailableFlashEffects(round, modules, captains);
    expect(available).toContain('continuum-wager');
  });
});

describe('Q-Continuum', () => {
  it('requires a Continuum Flash after charting 0-0', () => {
    let state = gameWithQContinuum();
    const round = state.round!;

    state = {
      ...state,
      round: {
        ...round,
        spacedockValue: 0,
        activePlayerId: 'a',
        hands: {
          ...round.hands,
          a: [normalizeCoordinate(0, 0), normalizeCoordinate(0, 1)],
        },
        table: {
          ...round.table,
          spacedock: { value: 0, placedBy: 'a' },
        },
      },
    };

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: normalizeCoordinate(0, 0),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(chart.ok).toBe(true);
    if (chart.ok) {
      expect(chart.state.round?.continuumPendingInvoker).toBe('a');
      expect(chart.state.round?.activePlayerId).toBe('a');
    }
  });

  it('applies reverse turn order for the rest of the round', () => {
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffleCoordinates(
        generateCoordinateSet(12),
        seededRandom(1)
      ),
      roundNumber: 1,
      captains: captains.map((captain) => ({ ...captain, pointsScore: 0 })),
      turnOrder: captains.map((captain) => captain.id),
    });

    let state = {
      ...createLobbyState({
        id: 'q',
        captains,
        modules: { continuum: true },
      }),
      phase: 'active' as const,
      round: {
        ...createRoundStateFromDeal(deal),
        continuumPendingInvoker: 'a',
      },
      modules: resolveModules({ continuum: true }),
    };

    const flash = applyAction(state, {
      type: 'INVOKE_CONTINUUM_FLASH',
      playerId: 'a',
      effect: 'reverse-turn-order',
    });

    expect(flash.ok).toBe(true);
    if (!flash.ok) return;

    state = flash.state;
    expect(state.modules.continuum.activeFlash?.effect.kind).toBe(
      'reverse-turn-order'
    );
    expect(state.round?.continuumEffects?.reverseTurnOrder).toBe(true);
    expect(state.round?.activePlayerId).toBe('c');
  });

  it('clears active Continuum Flash when the round scores', () => {
    const state = startGame(
      {
        id: 'q-test',
        captains,
        modules: { continuum: true },
        objective: 'go-out',
      },
      {
        shuffledCoordinates: shuffleCoordinates(
          generateCoordinateSet(12),
          seededRandom(99)
        ),
      }
    );
    const round = {
      ...state.round!,
      phase: 'ended' as const,
      roundWinnerId: 'a',
      hands: { a: [], b: [normalizeCoordinate(1, 2)], c: [normalizeCoordinate(3, 4)] },
    };

    const withFlash = {
      ...state,
      modules: {
        ...state.modules,
        qContinuum: {
          ...state.modules.continuum,
          activeFlash: {
            invokedBy: 'b',
            effect: { kind: 'reverse-turn-order' as const },
          },
        },
      },
      round,
    };

    const result = scoreRound(withFlash, round);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.modules.continuum.activeFlash).toBeNull();
      expect(result.state.round?.continuumEffects).toBeNull();
    }
  });
});
