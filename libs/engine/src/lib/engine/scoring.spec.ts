import { describe, expect, it } from 'vitest';

import { handPenaltyPoints, scoreRound } from './scoring.js';
import { endBlockedRound } from './round-resolution.js';
import { makeGame, makeRound, T } from './test-helpers.js';
import {
  createRoundStateFromDeal,
  dealRoundFromShuffled,
} from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';

describe('handPenaltyPoints', () => {
  it('sums pip values for tiles in hand', () => {
    expect(
      handPenaltyPoints(
        [
          { low: 6, high: 6 },
          { low: 3, high: 4 },
        ],
        false,
        2
      )
    ).toBe(19);
  });

  it('doubles 12-12 when salamander applies', () => {
    expect(
      handPenaltyPoints([{ low: 12, high: 12 }], true, 2)
    ).toBe(24);
  });
});

describe('scoreRound', () => {
  it('penalizes every captain when the sector ended blocked', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], {
        roundNumber: 13,
        hands: { a: [T(2, 3)], b: [T(4, 5)] },
      })
    );
    const state = makeGame(round, { completedRounds: 12 });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('complete');
    expect(result.state.captains.find((c) => c.id === 'a')?.penaltyScore).toBe(5);
    expect(result.state.captains.find((c) => c.id === 'b')?.penaltyScore).toBe(9);
  });

  it('rejects scoring a round that is still in play', () => {
    const round = makeRound(['a', 'b'], { phase: 'playing' });
    const result = scoreRound(makeGame(round), round);
    expect(result.ok).toBe(false);
  });

  it('rejects scoring an ended round with no winner and no blocked flag', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: null,
      roundBlocked: false,
    });
    const result = scoreRound(makeGame(round), round);
    expect(result.ok).toBe(false);
  });

  it('ends a short penalty campaign after the configured round count', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], {
        roundNumber: 5,
        spacedockValue: 8,
        hands: { a: [T(2, 3)], b: [T(4, 5)] },
      })
    );
    const state = makeGame(round, { completedRounds: 4, campaignRounds: 5 });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('complete');
    expect(result.state.completedRounds).toBe(5);
    expect(result.state.round?.roundNumber).toBe(5);
  });

  it('advances to the next campaign round with a fresh deal', () => {
    const deal = dealRoundFromShuffled({
      roundNumber: 1,
      captains: [
        { id: 'a', displayName: 'A', penaltyScore: 0 },
        { id: 'b', displayName: 'B', penaltyScore: 0 },
      ],
      turnOrder: ['a', 'b'],
      shuffledCoordinates: generateCoordinateSet(12),
    });
    const round = {
      ...createRoundStateFromDeal(deal),
      phase: 'ended' as const,
      roundWinnerId: 'a',
      hands: { ...deal.hands, a: [] },
    };
    const state = makeGame(round);

    const result = scoreRound(state, round, () => 0.25);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round?.roundNumber).toBe(2);
    expect(result.state.round?.spacedockValue).toBe(11);
    expect(result.state.completedRounds).toBe(1);
    expect(result.state.captains.find((c) => c.id === 'b')?.penaltyScore).toBeGreaterThan(
      0
    );
  });

  it('deals ten Uncharted Sectors for eight captains', () => {
    const captainIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
    const captains = captainIds.map((id) => ({
      id,
      displayName: id,
      penaltyScore: 0,
    }));
    const deal = dealRoundFromShuffled({
      roundNumber: 3,
      captains,
      turnOrder: [...captainIds],
      shuffledCoordinates: shuffleCoordinates(generateCoordinateSet(12), () => 0.42),
    });

    expect(deal.unchartedSectors).toHaveLength(10);
    const dealtTiles = [
      ...deal.unchartedSectors,
      ...Object.values(deal.hands).flat(),
    ];
    expect(dealtTiles).toHaveLength(90);
  });
});
