import { describe, expect, it } from 'vitest';

import {
  handPoints,
  scoreRound,
  salamanderPenaltyAction,
  longestTrailBonusActions,
  temporalDebtPenaltyActions,
  computeRoundPointDeltas,
  summarizeRoundOutcome,
} from './scoring.js';
import { endBlockedRound } from './round-resolution.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
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

  it('doubles 18-18 to 72 when salamander applies on Warp 18 (maxPip must be passed)', () => {
    // Default maxPip is 12 — 18-18 is NOT the highest double under that default,
    // so it would incorrectly score as plain 36. Callers must pass maxPip=18.
    expect(handPoints([{ low: 18, high: 18 }], true, 2)).toBe(36);
    expect(handPoints([{ low: 18, high: 18 }], true, 2, 50, 18)).toBe(72);
    expect(handPoints([{ low: 18, high: 18 }], true, 1, 50, 18)).toBe(36);
    expect(handPoints([{ low: 18, high: 18 }], false, 2, 50, 18)).toBe(36);
  });

  it('doubles 9-9 / 15-15 for their Warp factors', () => {
    expect(handPoints([{ low: 9, high: 9 }], true, 2, 50, 9)).toBe(36);
    expect(handPoints([{ low: 15, high: 15 }], true, 2, 50, 15)).toBe(60);
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
      continuumEffects: {
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
        continuum: true,
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

  it('keeps the penalty on the holder when they are already the campaign leader', () => {
    // If we waived the holder's tile without transferring, Salamander vanishes.
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 13,
      phase: 'ended',
      roundWinnerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: { a: [], b: [T(12, 12), T(1, 2)], c: [T(4, 3)] },
    });
    const state = makeGame(round, {
      completedRounds: 12,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 90 }, // winner — excluded from swap target
        { id: 'b', displayName: 'B', pointsScore: 80 }, // holder = leader among remainder
        { id: 'c', displayName: 'C', pointsScore: 10 },
      ],
      modules: resolveModules({
        continuum: true,
        salamanderPenalty: true,
      }),
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const points = (id: string) =>
      result.state.captains.find((c) => c.id === id)?.pointsScore;

    expect(points('a')).toBe(90);
    // Holder keeps full Salamander (48) + 1-2 (3)
    expect(points('b')).toBe(80 + 48 + 3);
    expect(points('c')).toBe(10 + 7);
  });

  it('moves Warp 18 Salamander (72) to the leader under Continuum swap', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 19,
      spacedockValue: 0,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: {
        a: [],
        b: [T(18, 18), T(1, 2)],
        c: [T(3, 4)],
      },
    });
    const state = makeGame(round, {
      maxPip: 18,
      campaignRounds: 19,
      completedRounds: 18,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 10 },
        { id: 'c', displayName: 'C', pointsScore: 40 },
      ],
      modules: resolveModules({ continuum: true, salamanderPenalty: true }),
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const points = (id: string) =>
      result.state.captains.find((c) => c.id === id)?.pointsScore;

    expect(points('a')).toBe(0);
    expect(points('b')).toBe(10 + 3); // 1-2 only; 18-18 waived
    expect(points('c')).toBe(40 + 7 + 72); // 3-4 + full Salamander
  });
});

describe('scoreRound Module Beta on Warp 18', () => {
  it('penalizes a held 18-18 as 72 when game.maxPip is 18', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 19,
      spacedockValue: 0,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: {
        a: [],
        // 18-18 Salamander (72) + 5-9 (14) = 86
        b: [T(18, 18), T(5, 9)],
      },
    });
    // Last campaign round so scoreRound does not try to deal a W18 next set.
    const state = makeGame(round, {
      maxPip: 18,
      campaignRounds: 19,
      completedRounds: 18,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
      modules: resolveModules({ salamanderPenalty: true }),
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.captains.find((c) => c.id === 'a')?.pointsScore).toBe(0);
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(86);
  });

  it('does not treat 18-18 as Salamander when maxPip is missing (defaults to 12)', () => {
    // Regression guard: forgetting maxPip on GameState silently under-scores W18.
    const round = makeRound(['a', 'b'], {
      roundNumber: 13,
      spacedockValue: 0,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(18, 18)] },
    });
    const state = makeGame(round, {
      // maxPip omitted → scoreRound falls back to 12
      campaignRounds: 13,
      completedRounds: 12,
      modules: resolveModules({ salamanderPenalty: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 18-18 is not highest double under maxPip 12 → plain 36, not 72
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(36);
  });
});

describe('salamanderPenaltyAction', () => {
  it('attributes a held 18-18 to the holder for Warp 18', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(18, 18), T(1, 2)] },
    });
    const state = makeGame(round, {
      maxPip: 18,
      modules: resolveModules({ salamanderPenalty: true }),
    });

    expect(salamanderPenaltyAction(state, round)).toEqual({
      type: 'SALAMANDER_PENALTY',
      holderId: 'b',
      scoredOnId: 'b',
      points: 72,
    });
  });

  it('routes Continuum swap to the campaign leader', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 3,
      phase: 'ended',
      roundWinnerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: { a: [], b: [T(12, 12)], c: [T(1, 1)] },
    });
    const state = makeGame(round, {
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 10 },
        { id: 'b', displayName: 'B', pointsScore: 20 },
        { id: 'c', displayName: 'C', pointsScore: 100 },
      ],
      modules: resolveModules({
        continuum: true,
        salamanderPenalty: true,
      }),
    });

    expect(salamanderPenaltyAction(state, round)).toEqual({
      type: 'SALAMANDER_PENALTY',
      holderId: 'b',
      scoredOnId: 'c',
      points: 48,
    });
  });

  it('excludes the round winner when choosing the swap target', () => {
    // Winner can be campaign #1; swap still targets highest among the rest.
    const round = makeRound(['you', 'smith', 'chen'], {
      roundNumber: 2,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'smith',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: {
        you: [T(18, 18), T(7, 10)],
        smith: [],
        chen: [T(1, 2)],
      },
    });
    const state = makeGame(round, {
      maxPip: 18,
      captains: [
        { id: 'you', displayName: 'Armstrong', pointsScore: 67 },
        { id: 'smith', displayName: 'Smith', pointsScore: 68 },
        { id: 'chen', displayName: 'Chen', pointsScore: 11 },
      ],
      modules: resolveModules({ continuum: true, salamanderPenalty: true }),
    });

    // Smith (68) won → excluded; you (67) is holder and leader among remainder.
    expect(salamanderPenaltyAction(state, round)).toEqual({
      type: 'SALAMANDER_PENALTY',
      holderId: 'you',
      scoredOnId: 'you',
      points: 72,
    });
  });

  it('leaves scoredOn on the holder when they are already the swap target', () => {
    const round = makeRound(['a', 'b', 'c'], {
      roundNumber: 3,
      phase: 'ended',
      roundWinnerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: { a: [], b: [T(12, 12)], c: [T(1, 1)] },
    });
    const state = makeGame(round, {
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 100 },
        { id: 'b', displayName: 'B', pointsScore: 50 },
        { id: 'c', displayName: 'C', pointsScore: 10 },
      ],
      modules: resolveModules({ continuum: true, salamanderPenalty: true }),
    });

    expect(salamanderPenaltyAction(state, round)).toEqual({
      type: 'SALAMANDER_PENALTY',
      holderId: 'b',
      scoredOnId: 'b',
      points: 48,
    });
  });

  it('returns null when nobody holds the highest double (tile was charted)', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      maxPip: 18,
      phase: 'ended',
      roundWinnerId: 'a',
      continuumEffects: {
        reverseTurnOrder: false,
        temporalInversion: false,
        openAllTrails: false,
        suppressNextFracture: false,
        skipNextTurnFor: [],
        peekedSector: null,
        salamanderSwap: true,
        allStopEcho: false,
      },
      hands: { a: [], b: [T(3, 5)] },
    });
    expect(
      salamanderPenaltyAction(
        makeGame(round, {
          maxPip: 18,
          modules: resolveModules({ continuum: true, salamanderPenalty: true }),
        }),
        round
      )
    ).toBeNull();
  });

  it('returns null when Module Beta is off or round 1', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 1,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(12, 12)] },
    });
    expect(
      salamanderPenaltyAction(
        makeGame(round, {
          modules: resolveModules({ salamanderPenalty: true }),
        }),
        round
      )
    ).toBeNull();
    expect(
      salamanderPenaltyAction(
        makeGame(round, {
          modules: resolveModules({ salamanderPenalty: false }),
        }),
        { ...round, roundNumber: 2 }
      )
    ).toBeNull();
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

describe('longestTrailBonusActions', () => {
  it('emits one annotation per tied longest trail with Module Theta on', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      phase: 'ended',
      roundWinnerId: 'b',
      hands: { a: [T(1, 2)], b: [] },
      table: {
        ...base.table,
        warpTrails: {
          a: {
            tiles: [
              placed(T(12, 8), 0, 8),
              placed(T(8, 5), 1, 5),
              placed(T(5, 3), 2, 3),
            ],
            distressBeacon: { active: false },
          },
          b: {
            tiles: [placed(T(12, 10), 0, 10)],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const state = makeGame(round, {
      modules: resolveModules({ longestTrail: true, longestTrailBonus: -3 }),
    });

    expect(longestTrailBonusActions(state, round)).toEqual([
      {
        type: 'LONGEST_TRAIL_BONUS',
        playerId: 'a',
        trailLength: 3,
        points: -3,
      },
    ]);
  });

  it('returns nothing when Module Theta is off', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(1, 2)] },
    });
    const state = makeGame(round, {
      modules: resolveModules({ longestTrail: false }),
    });
    expect(longestTrailBonusActions(state, round)).toEqual([]);
  });
});

describe('temporalDebtPenaltyActions', () => {
  it('emits one annotation per captain with tokens when Module Eta is on', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(1, 2)] },
      debtTokens: { a: 8, b: 10 },
    });
    const state = makeGame(round, {
      modules: resolveModules({ temporalDebt: true, temporalDebtCost: 2 }),
    });
    expect(temporalDebtPenaltyActions(state, round)).toEqual([
      {
        type: 'TEMPORAL_DEBT_PENALTY',
        playerId: 'a',
        tokens: 8,
        points: 16,
      },
      {
        type: 'TEMPORAL_DEBT_PENALTY',
        playerId: 'b',
        tokens: 10,
        points: 20,
      },
    ]);
  });

  it('returns nothing when Module Eta is off', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(1, 2)] },
      debtTokens: { a: 3, b: 0 },
    });
    const state = makeGame(round, {
      modules: resolveModules({ temporalDebt: false }),
    });
    expect(temporalDebtPenaltyActions(state, round)).toEqual([]);
  });
});

describe('computeRoundPointDeltas', () => {
  it('includes Temporal Debt on go-out winners and hand holders', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 6)] },
      debtTokens: { a: 8, b: 10 },
    });
    const state = makeGame(round, {
      captains: [
        { id: 'a', displayName: 'Alpha', pointsScore: 0 },
        { id: 'b', displayName: 'Beta', pointsScore: 0 },
      ],
      modules: resolveModules({ temporalDebt: true, temporalDebtCost: 2 }),
    });
    expect(computeRoundPointDeltas(state, round)).toEqual([
      { playerId: 'a', points: 16 },
      { playerId: 'b', points: 11 + 20 },
    ]);
  });
});

describe('longestTrailBonusActions floor', () => {
  it('floors the round total at 0 when bonus would go negative', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12 });
    // a goes out (0 hand) but also has longest trail — stay at 0, not −3.
    // b has only 2 pips without longest trail.
    const short = makeRound(['a', 'b'], {
      spacedockValue: 12,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(0, 2)] },
      table: {
        ...base.table,
        warpTrails: {
          a: {
            tiles: [
              placed(T(12, 8), 0, 8),
              placed(T(8, 5), 1, 5),
            ],
            distressBeacon: { active: false },
          },
          b: {
            tiles: [placed(T(12, 10), 0, 10)],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const withFloor = makeGame(short, {
      campaignRounds: 1,
      modules: resolveModules({ longestTrail: true }),
    });

    const aOnly = scoreRound(withFloor, short, () => 0.5);
    expect(aOnly.ok).toBe(true);
    if (!aOnly.ok) return;
    expect(aOnly.state.captains.find((c) => c.id === 'a')!.pointsScore).toBe(0);
    expect(aOnly.state.captains.find((c) => c.id === 'b')!.pointsScore).toBe(2);

    // Give b the longer trail so −3 would make 2−3 = −1 without a floor.
    const bLong = makeRound(['a', 'b'], {
      ...short,
      table: {
        ...short.table,
        warpTrails: {
          a: {
            tiles: [placed(T(12, 8), 0, 8)],
            distressBeacon: { active: false },
          },
          b: {
            tiles: [
              placed(T(12, 10), 0, 10),
              placed(T(10, 4), 1, 4),
              placed(T(4, 1), 2, 1),
            ],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const floored = scoreRound(
      makeGame(bLong, {
        campaignRounds: 1,
        modules: resolveModules({ longestTrail: true }),
      }),
      bLong,
      () => 0.5
    );
    expect(floored.ok).toBe(true);
    if (!floored.ok) return;
    expect(floored.state.captains.find((c) => c.id === 'b')!.pointsScore).toBe(0);
  });
});

describe('normal round score floor (points campaign)', () => {
  /** Round-delta for a captain after scoreRound (campaignRounds: 1). */
  function roundDelta(before: number, after: number): number {
    return after - before;
  }

  it('only Theta injects a negative term — floor keeps normals ≥ 0', () => {
    // Sources reviewed: hand ≥0, salamander ≥0, hazard ≥0, debt ≥0, Theta −3.
    // Kappa inverted rounds intentionally go negative and are excluded from the floor.
    const base = makeRound(['a', 'b'], { spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      phase: 'ended',
      roundWinnerId: 'a',
      hazardMarkerHolder: 'a',
      hazardMarkerPassCount: 1, // +5 hazard, then −3 trail
      debtTokens: { a: 1, b: 0 }, // +2 debt on a
      hands: { a: [], b: [T(0, 1)] },
      table: {
        ...base.table,
        warpTrails: {
          a: {
            tiles: [
              placed(T(12, 8), 0, 8),
              placed(T(8, 5), 1, 5),
            ],
            distressBeacon: { active: false },
          },
          b: {
            tiles: [placed(T(12, 10), 0, 10)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    const state = makeGame(round, {
      campaignRounds: 1,
      modules: resolveModules({
        longestTrail: true,
        warpDriveSpool: true,
        temporalDebt: true,
        temporalDebtCost: 2,
      }),
    });

    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const captain of result.state.captains) {
      expect(captain.pointsScore).toBeGreaterThanOrEqual(0);
    }

    // a: go-out 0 + hazard +5 + trail −3 + debt +2 = 4
    expect(
      roundDelta(0, result.state.captains.find((c) => c.id === 'a')!.pointsScore)
    ).toBe(4);
  });

  it('Temporal Inversion even rounds keep intentional negative deltas', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const state = makeGame(round, {
      campaignRounds: 1,
      modules: resolveModules({ temporalInversion: true }),
    });

    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Non-winner keeps tiles → negative delta under Kappa
    expect(result.state.captains.find((c) => c.id === 'b')!.pointsScore).toBeLessThan(
      0
    );
  });
});

describe('summarizeRoundOutcome', () => {
  const twoCaptains = [
    { id: 'a', displayName: 'Alpha', pointsScore: 0 },
    { id: 'b', displayName: 'Beta', pointsScore: 0 },
  ];

  it('awards the round to whoever went out on a normal round', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 1,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const state = makeGame(round, { captains: twoCaptains });

    const outcome = summarizeRoundOutcome(state, round);
    expect(outcome.blocked).toBe(false);
    expect(outcome.inverted).toBe(false);
    expect(outcome.wentOutId).toBe('a');
    expect(outcome.roundWinnerIds).toEqual(['a']);
  });

  it('splits went-out from the trophy on an inverted (even) round', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const state = makeGame(round, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });

    const outcome = summarizeRoundOutcome(state, round);
    expect(outcome.inverted).toBe(true);
    // Going out is catastrophic under inversion...
    expect(outcome.wentOutId).toBe('a');
    // ...so the captain who held the most wins the round.
    expect(outcome.roundWinnerIds).toEqual(['b']);
  });

  it('does not invert an odd round even with Kappa enabled', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 3,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const state = makeGame(round, {
      captains: twoCaptains,
      modules: resolveModules({ temporalInversion: true }),
    });

    const outcome = summarizeRoundOutcome(state, round);
    expect(outcome.inverted).toBe(false);
    expect(outcome.roundWinnerIds).toEqual(['a']);
  });

  it('never inverts under the go-out objective', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 2,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(5, 5)] },
    });
    const state = makeGame(round, {
      captains: twoCaptains,
      objective: 'go-out',
      modules: resolveModules({ temporalInversion: true }),
    });

    const outcome = summarizeRoundOutcome(state, round);
    expect(outcome.inverted).toBe(false);
    expect(outcome.wentOutId).toBe('a');
    expect(outcome.roundWinnerIds).toEqual(['a']);
  });

  it('reports a blocked round with no winner', () => {
    const round = endBlockedRound(
      makeRound(['a', 'b'], {
        roundNumber: 2,
        hands: { a: [T(0, 0)], b: [T(4, 5)] },
      })
    );
    const state = makeGame(round, { captains: twoCaptains });

    const outcome = summarizeRoundOutcome(state, round);
    expect(outcome.blocked).toBe(true);
    expect(outcome.wentOutId).toBeNull();
    expect(outcome.roundWinnerIds).toEqual([]);
  });
});
