import { describe, expect, it } from 'vitest';

import { handPoints, scoreRound } from './scoring.js';
import { endBlockedRound } from './round-resolution.js';
import { makeGame, makeRound, T } from './test-helpers.js';
import { resolveHouseRules } from '../types/house-rules.js';
import { resolveModules } from '../types/modules.js';
import {
  createRoundStateFromDeal,
  dealRoundFromShuffled,
} from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';

describe('handPoints', () => {
  it('sums pip values for tiles in hand', () => {
    expect(
      handPoints(
        [
          { low: 6, high: 6 },
          { low: 3, high: 4 },
        ],
        false,
        2
      )
    ).toBe(19);
  });

  it('doubles 12-12 to 48 when salamander applies (round 2+)', () => {
    // Base pips are 24 (both ends); Salamander doubles the held 12-12 to 48.
    expect(handPoints([{ low: 12, high: 12 }], true, 2)).toBe(48);
    // Round 1 never applies (12-12 is Spacedock), so it scores base pips.
    expect(handPoints([{ low: 12, high: 12 }], true, 1)).toBe(24);
    // Salamander off → base pips regardless of round.
    expect(handPoints([{ low: 12, high: 12 }], false, 2)).toBe(24);
  });

  it('scores a double-blank by the doubleZeroScore option', () => {
    // Default (unspecified) is the tournament-standard 50.
    expect(handPoints([{ low: 0, high: 0 }], false, 2)).toBe(50);
    expect(handPoints([{ low: 0, high: 0 }], false, 2, 50)).toBe(50);
    expect(handPoints([{ low: 0, high: 0 }], false, 2, 25)).toBe(25);
    expect(handPoints([{ low: 0, high: 0 }], false, 2, 0)).toBe(0);
    // A blank on a non-double tile still scores its pips (0 side + other).
    expect(handPoints([{ low: 0, high: 5 }], false, 2, 50)).toBe(5);
  });
});

describe('scoreRound double-blank scoring', () => {
  function gameWith(doubleZeroScore: 0 | 25 | 50) {
    // Final round so scoreRound completes the campaign (no next-round deal).
    return makeGame(
      makeRound(['a', 'b'], {
        roundNumber: 13,
        phase: 'ended',
        roundWinnerId: 'a',
        hands: { a: [], b: [T(0, 0)] },
      }),
      { houseRules: resolveHouseRules({ doubleZeroScore }), completedRounds: 12 }
    );
  }

  it('applies the double-blank value in a blocked round too', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], {
        roundNumber: 13,
        hands: { a: [T(0, 0)], b: [T(4, 5)] },
      })
    );
    const state = makeGame(round, {
      completedRounds: 12,
      houseRules: resolveHouseRules({ doubleZeroScore: 25 }),
    });
    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Blocked round: everyone scores; the 0-0 holder pays the configured value.
    expect(result.state.captains.find((c) => c.id === 'a')?.pointsScore).toBe(25);
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(9);
  });

  it('adds the configured double-blank value to the losing captain', () => {
    const g50 = gameWith(50);
    const at50 = scoreRound(g50, g50.round!);
    expect(at50.ok).toBe(true);
    if (!at50.ok) return;
    expect(at50.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(50);

    const g0 = gameWith(0);
    const at0 = scoreRound(g0, g0.round!);
    expect(at0.ok).toBe(true);
    if (!at0.ok) return;
    expect(at0.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(0);

    const g25 = gameWith(25);
    const at25 = scoreRound(g25, g25.round!);
    expect(at25.ok).toBe(true);
    if (!at25.ok) return;
    expect(at25.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(25);
  });
});

describe('scoreRound salamander swap', () => {
  it('moves the full 48-point 12-12 penalty to the leader; holder pays 0 for it', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 13,
      phase: 'ended',
      roundWinnerId: 'a',
      qEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: { a: [], b: [T(12, 12)], c: [T(4, 3)] },
    });
    const state = makeGame(round, {
      completedRounds: 12,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
        { id: 'c', displayName: 'C', pointsScore: 100 }, // leader → swap target
      ],
      modules: resolveModules({
        qContinuum: true,
        salamanderPenalty: true,
        subspaceFracture: false,
      }),
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const points = (id: string) =>
      result.state.captains.find((c) => c.id === id)?.pointsScore;

    expect(points('a')).toBe(0); // winner
    expect(points('b')).toBe(0); // 12-12 holder pays nothing for that tile
    expect(points('c')).toBe(100 + 7 + 48); // leader: own 4-3 (7) + full 48
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
    expect(result.state.captains.find((c) => c.id === 'a')?.pointsScore).toBe(5);
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(9);
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
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
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
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBeGreaterThan(
      0
    );
  });

  it('deals ten Uncharted Sectors for eight captains', () => {
    const captainIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
    const captains = captainIds.map((id) => ({
      id,
      displayName: id,
      pointsScore: 0,
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
