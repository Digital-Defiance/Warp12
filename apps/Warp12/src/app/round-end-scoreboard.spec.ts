import { describe, expect, it } from 'vitest';
import type { GameState, RoundState } from 'warp12-engine';

import {
  buildRoundEndScoreRows,
  sortRoundEndScoreRows,
} from './round-end-scoreboard.js';
import {
  makeGame,
  makeRound,
  T,
} from '../../../../libs/engine/src/lib/engine/test-helpers.js';

function endedRound(
  turnOrder: string[],
  hands: RoundState['hands'],
  winnerId: string
): RoundState {
  return makeRound(turnOrder, {
    phase: 'ended',
    roundWinnerId: winnerId,
    hands,
    activePlayerId: winnerId,
  });
}

describe('buildRoundEndScoreRows', () => {
  it('lists AI seats even when their hands are empty on this client', () => {
    // Online non-host / race: human hand mirrored, AI hands not yet subscribed.
    const round = endedRound(
      ['you', 'ai:lovell'],
      {
        you: [],
        'ai:lovell': [],
      },
      'you'
    );
    const game = makeGame(round, {
      objective: 'points',
      captains: [
        { id: 'you', displayName: 'Armstrong', pointsScore: 10 },
        { id: 'ai:lovell', displayName: 'Lovell', pointsScore: 20 },
      ],
    }) as GameState;

    const rows = buildRoundEndScoreRows(game, round, {
      handCounts: { you: 0, 'ai:lovell': 4 },
    });
    expect(rows.map((row) => row.id)).toEqual(['you', 'ai:lovell']);
    expect(rows.find((row) => row.id === 'ai:lovell')).toMatchObject({
      pointsPending: true,
    });
  });

  it('still shows AI points when their hand is present', () => {
    const round = endedRound(
      ['you', 'ai:lovell'],
      {
        you: [],
        'ai:lovell': [T(5, 6), T(3, 3)],
      },
      'you'
    );
    const game = makeGame(round, {
      objective: 'points',
      captains: [
        { id: 'you', displayName: 'Armstrong', pointsScore: 10 },
        { id: 'ai:lovell', displayName: 'Lovell', pointsScore: 20 },
      ],
    }) as GameState;

    const rows = buildRoundEndScoreRows(game, round);
    const ai = rows.find((row) => row.id === 'ai:lovell');
    expect(ai).toBeDefined();
    expect(ai!.points).toBeGreaterThan(0);
  });

  it('pins round winners first when sorting', () => {
    const sorted = sortRoundEndScoreRows(
      [
        { id: 'a', name: 'A', points: 5 },
        { id: 'b', name: 'B', points: 12 },
        { id: 'c', name: 'C', points: 0 },
      ],
      new Set(['c'])
    );
    expect(sorted.map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });
});
