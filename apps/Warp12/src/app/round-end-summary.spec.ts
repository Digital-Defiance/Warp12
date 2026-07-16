import { describe, expect, it } from 'vitest';
import { resolveModules } from 'warp12-engine';

import { roundEndHeadline, roundEndTitle } from './round-end-summary.js';
import {
  makeGame,
  makeRound,
  T,
} from '../../../../libs/engine/src/lib/engine/test-helpers.js';
import { endBlockedRound } from '../../../../libs/engine/src/lib/engine/round-resolution.js';

const names = { a: 'Ada', b: 'Bell' };
const twoCaptains = [
  { id: 'a', displayName: 'Ada', pointsScore: 0 },
  { id: 'b', displayName: 'Bell', pointsScore: 0 },
];

describe('round-end summary copy', () => {
  it('reads as a win when the captain who went out also wins', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 1,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const game = makeGame(round, { captains: twoCaptains });

    expect(roundEndTitle(game, round, names)).toBe('Ada wins the round');
    expect(roundEndHeadline(game, round, names)).toBe(
      'Ada charts the final coordinate.'
    );
  });

  it('reframes an inverted round as a backfire, not a win', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const game = makeGame(round, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });

    expect(roundEndTitle(game, round, names)).toBe('Ada goes out — inverted round');
    expect(roundEndHeadline(game, round, names)).toBe(
      'Inverted round — going out backfires on Ada. Bell takes the round by holding the most.'
    );
  });

  it('does not invert an odd round even with Kappa enabled', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 3,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const game = makeGame(round, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });

    expect(roundEndTitle(game, round, names)).toBe('Ada wins the round');
  });

  it('shows a blocked-sector headline when nobody goes out', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], {
        roundNumber: 2,
        hands: { a: [T(0, 0)], b: [T(4, 5)] },
      })
    );
    const game = makeGame(round, { captains: twoCaptains });

    expect(roundEndTitle(game, round, names)).toBe('Sector blocked');
    expect(roundEndHeadline(game, round, names)).toBe(
      'Round 2 blocked — no legal charts remain.'
    );
  });
});
