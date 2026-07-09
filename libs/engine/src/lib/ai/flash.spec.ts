import { describe, expect, it } from 'vitest';

import { normalizeCoordinate } from '../types/coordinate.js';
import { resolveModules } from '../types/modules.js';

import { getAvailableFlashEffects } from '../types/continuum.js';

import { chooseQFlashEffect, chooseQGambleKeepIndex } from './flash.js';
import {
  makeRound,
  modulesWithQ,
  N,
  obsFor,
  tableWithOwnTrail,
  TEST_CAPTAINS,
} from './test-fixtures.js';

const constantRng = (value: number) => () => value;

describe('chooseFlashEffect', () => {
  it('prefers salamander-swap when the invoker holds 12-12', () => {
    const round = makeRound({
      spacedockValue: 0,
      continuumPendingInvoker: 'a',
      hands: { a: [N(12, 12), N(0, 1)], b: [], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });

    const effect = chooseQFlashEffect(
      obsFor(round, modulesWithQ(), 'points', 'a'),
      TEST_CAPTAINS,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('salamander-swap');
  });

  it('prefers skip-lowest-points when another captain leads the campaign', () => {
    const round = makeRound({
      spacedockValue: 0,
      continuumPendingInvoker: 'a',
      hands: { a: [N(0, 1)], b: [N(2, 3)], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 40 },
      { id: 'b', displayName: 'Beta', pointsScore: 5 },
      { id: 'c', displayName: 'Charlie', pointsScore: 12 },
    ];

    const effect = chooseQFlashEffect(
      { ...obsFor(round, modulesWithQ(), 'points', 'a'), captains },
      captains,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('skip-lowest-points');
  });

  it('prefers continuum-wager when the pile is deep and the hand is large', () => {
    const round = makeRound({
      spacedockValue: 0,
      continuumPendingInvoker: 'a',
      unchartedSectors: [N(1, 2), N(3, 4), N(5, 6)],
      hands: {
        a: [N(0, 1), N(2, 3), N(4, 5), N(6, 7), N(8, 9)],
        b: [],
        c: [],
      },
      turnOrder: ['a', 'b', 'c'],
    });

    const effect = chooseQFlashEffect(
      obsFor(round, modulesWithQ(), 'points', 'a'),
      TEST_CAPTAINS,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('continuum-wager');
  });

  it('always picks an effect from the available catalog', () => {
    const round = makeRound({
      spacedockValue: 0,
      continuumPendingInvoker: 'a',
      hands: { a: [N(0, 1)], b: [], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });
    const modules = resolveModules({ continuum: true, salamanderPenalty: false });

    const available = getAvailableFlashEffects(
      round,
      modules,
      TEST_CAPTAINS
    );
    const effect = chooseQFlashEffect(
      obsFor(round, modules, 'points', 'a'),
      TEST_CAPTAINS,
      { rng: constantRng(0) }
    );

    expect(available.length).toBeGreaterThan(0);
    expect(available).toContain(effect);
  });
});

describe('chooseQGambleKeepIndex', () => {
  it('keeps the heavier coordinate', () => {
    const round = makeRound({
      continuumWagerPending: {
        playerId: 'a',
        options: [N(2, 3), N(10, 11)],
      },
    });

    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'points', 'a'))
    ).toBe(1);
  });

  it('breaks pip ties with the injected rng', () => {
    const round = makeRound({
      continuumWagerPending: {
        playerId: 'a',
        options: [normalizeCoordinate(4, 5), normalizeCoordinate(5, 4)],
      },
    });

    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'points', 'a'), {
        rng: constantRng(0.1),
      })
    ).toBe(0);
    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'points', 'a'), {
        rng: constantRng(0.9),
      })
    ).toBe(1);
  });

  it('in go-out mode keeps the tile with more immediate chart options', () => {
    const round = makeRound({
      continuumWagerPending: {
        playerId: 'a',
        options: [N(1, 2), N(5, 12)],
      },
      table: tableWithOwnTrail('a', N(5, 12), 5),
    });

    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'go-out', 'a'), {
        rng: constantRng(0),
      })
    ).toBe(1);
  });
});
