import { describe, expect, it } from 'vitest';

import { normalizeCoordinate } from '../types/coordinate.js';
import { resolveModules } from '../types/modules.js';

import { getAvailableQFlashEffects } from '../types/q-continuum.js';

import { chooseQFlashEffect, chooseQGambleKeepIndex } from './q-flash.js';
import {
  makeRound,
  modulesWithQ,
  N,
  obsFor,
  TEST_CAPTAINS,
} from './test-fixtures.js';

const constantRng = (value: number) => () => value;

describe('chooseQFlashEffect', () => {
  it('prefers salamander-swap when the invoker holds 12-12', () => {
    const round = makeRound({
      spacedockValue: 0,
      qPendingInvoker: 'a',
      hands: { a: [N(12, 12), N(0, 1)], b: [], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });

    const effect = chooseQFlashEffect(
      obsFor(round, modulesWithQ(), 'penalty', 'a'),
      TEST_CAPTAINS,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('salamander-swap');
  });

  it('prefers skip-lowest-penalty when another captain leads the campaign', () => {
    const round = makeRound({
      spacedockValue: 0,
      qPendingInvoker: 'a',
      hands: { a: [N(0, 1)], b: [N(2, 3)], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });
    const captains = [
      { id: 'a', displayName: 'Alpha', penaltyScore: 40 },
      { id: 'b', displayName: 'Beta', penaltyScore: 5 },
      { id: 'c', displayName: 'Charlie', penaltyScore: 12 },
    ];

    const effect = chooseQFlashEffect(
      { ...obsFor(round, modulesWithQ(), 'penalty', 'a'), captains },
      captains,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('skip-lowest-penalty');
  });

  it('prefers q-gamble when the pile is deep and the hand is large', () => {
    const round = makeRound({
      spacedockValue: 0,
      qPendingInvoker: 'a',
      unchartedSectors: [N(1, 2), N(3, 4), N(5, 6)],
      hands: {
        a: [N(0, 1), N(2, 3), N(4, 5), N(6, 7), N(8, 9)],
        b: [],
        c: [],
      },
      turnOrder: ['a', 'b', 'c'],
    });

    const effect = chooseQFlashEffect(
      obsFor(round, modulesWithQ(), 'penalty', 'a'),
      TEST_CAPTAINS,
      { rng: constantRng(0) }
    );

    expect(effect).toBe('q-gamble');
  });

  it('always picks an effect from the available catalog', () => {
    const round = makeRound({
      spacedockValue: 0,
      qPendingInvoker: 'a',
      hands: { a: [N(0, 1)], b: [], c: [] },
      turnOrder: ['a', 'b', 'c'],
    });
    const modules = resolveModules({ qContinuum: true, salamanderPenalty: false });

    const available = getAvailableQFlashEffects(
      round,
      modules,
      TEST_CAPTAINS
    );
    const effect = chooseQFlashEffect(
      obsFor(round, modules, 'penalty', 'a'),
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
      qGamblePending: {
        playerId: 'a',
        options: [N(2, 3), N(10, 11)],
      },
    });

    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'penalty', 'a'))
    ).toBe(1);
  });

  it('breaks pip ties with the injected rng', () => {
    const round = makeRound({
      qGamblePending: {
        playerId: 'a',
        options: [normalizeCoordinate(4, 5), normalizeCoordinate(5, 4)],
      },
    });

    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'penalty', 'a'), {
        rng: constantRng(0.1),
      })
    ).toBe(0);
    expect(
      chooseQGambleKeepIndex(obsFor(round, undefined, 'penalty', 'a'), {
        rng: constantRng(0.9),
      })
    ).toBe(1);
  });
});
