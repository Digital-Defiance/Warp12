import { describe, expect, it } from 'vitest';
import { applyAction } from './apply-action.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { resolveModules } from '../types/modules.js';
import { personalTrailLength } from './trail-momentum.js';

describe('Module Beta — Salamander Surge (Go-out)', () => {
  it('forces each opponent to draw 1 when maxPip-maxPip is charted', () => {
    const salamander = T(12, 12);
    const round = makeRound(['a', 'b', 'c'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      unchartedSectors: [T(1, 2), T(3, 4), T(5, 6)],
      hands: {
        a: [salamander],
        b: [T(2, 3)],
        c: [T(4, 5)],
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ salamanderPenalty: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
        { id: 'c', displayName: 'C', pointsScore: 0 },
      ],
    });

    const handB = state.round!.hands.b!.length;
    const handC = state.round!.hands.c!.length;

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: salamander,
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round!.hands.b!.length).toBe(handB + 1);
    expect(result.state.round!.hands.c!.length).toBe(handC + 1);
  });
});

describe('Module Delta — Go-out hazard pass', () => {
  it('draws from Uncharted on pass while holding the marker (no pass-count)', () => {
    const baseTable = makeRound(['a', 'b'], { spacedockValue: 12 }).table;
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [], b: [] },
      unchartedSectors: [T(1, 1), T(2, 2), T(3, 3)],
      hazardMarkerHolder: 'a',
      hazardMarkerPassCount: 0,
      drewThisTurn: true,
      table: {
        ...baseTable,
        warpTrails: {
          ...baseTable.warpTrails,
          a: {
            ...baseTable.warpTrails.a!,
            tiles: [placed(T(12, 8), 0, 8)],
            distressBeacon: { active: true },
          },
        },
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ warpDriveSpool: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = applyAction(state, {
      type: 'PASS_TURN',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round!.hazardMarkerPassCount ?? 0).toBe(0);
    expect(result.state.round!.hands.a!.length).toBe(2);
  });
});

describe('Module Theta — Trail Momentum (Go-out)', () => {
  function trailOfFour(baseTable: ReturnType<typeof makeRound>['table']) {
    return {
      ...baseTable.warpTrails.a!,
      tiles: [
        placed(T(12, 8), 0, 8),
        placed(T(8, 3), 1, 3),
        placed(T(3, 5), 2, 5),
        placed(T(5, 1), 3, 1),
      ],
      distressBeacon: { active: false },
    };
  }

  it('grants an immediate extra turn when personal trail first reaches 5', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const tile = T(1, 6);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [tile, T(9, 9)], b: [T(2, 2)] },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: trailOfFour(base.table),
        },
      },
    });

    expect(personalTrailLength(round, 'a')).toBe(4);

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ longestTrail: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: tile,
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(personalTrailLength(result.state.round!, 'a')).toBe(5);
    expect(result.state.trailMomentumClaimedBy).toBe('a');
    // Extra turn: helm stays with a (consumed reactivation).
    expect(result.state.round!.activePlayerId).toBe('a');
    expect(result.state.round!.trailMomentumExtraTurnFor ?? null).toBe(null);
  });

  it('is claimable only once per sector', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const first = T(1, 6);
    const second = T(6, 2);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [first, second, T(9, 9)], b: [T(2, 2)] },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: trailOfFour(base.table),
        },
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ longestTrail: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const hitFive = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: first,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(hitFive.ok).toBe(true);
    if (!hitFive.ok) return;
    expect(hitFive.state.round!.activePlayerId).toBe('a');

    const sixth = applyAction(hitFive.state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: second,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(sixth.ok).toBe(true);
    if (!sixth.ok) return;

    expect(personalTrailLength(sixth.state.round!, 'a')).toBe(6);
    expect(sixth.state.trailMomentumClaimedBy).toBe('a');
    // Second chart advances helm — no second extra turn.
    expect(sixth.state.round!.activePlayerId).toBe('b');
  });

  it('does not grant extra turn under points objective', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const tile = T(1, 6);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [tile, T(9, 9)], b: [T(2, 2)] },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: trailOfFour(base.table),
        },
      },
    });

    const state = makeGame(round, {
      objective: 'points',
      modules: resolveModules({ longestTrail: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: tile,
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.trailMomentumClaimedBy ?? null).toBe(null);
    expect(result.state.round!.activePlayerId).toBe('b');
  });
});

describe('Module Eta — Desperation Dig (Go-out)', () => {
  it('draws until a playable tile and charts it with forced-open beacon', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [T(9, 9)], b: [T(2, 2)] },
      unchartedSectors: [T(0, 1), T(12, 7), T(3, 4)],
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a!,
            tiles: [placed(T(12, 8), 0, 8)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    // Open is 8; first dig tile 0-1 unplayable; second 12-7 unplayable on open 8;
    // need a playable: use T(8, 4) as second draw.
    const round2 = {
      ...round,
      unchartedSectors: [T(0, 1), T(8, 4), T(3, 4)],
    };

    const state = makeGame(round2, {
      objective: 'go-out',
      modules: resolveModules({ temporalDebt: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = applyAction(state, {
      type: 'DESPERATION_DIG',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const trail = result.state.round!.table.warpTrails.a!;
    expect(trail.tiles.length).toBe(2);
    expect(trail.distressBeacon.active).toBe(true);
    expect(trail.distressBeacon.forcedOpenRemaining).toBeGreaterThan(0);
    // Unplayable 0-1 stayed in hand; 8-4 was charted.
    expect(result.state.round!.hands.a!.some((c) => c.low === 0 && c.high === 1)).toBe(
      true
    );
  });

  it('passes with full beacon cost when dig finds nothing', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [T(9, 9)], b: [T(2, 2)] },
      unchartedSectors: [T(0, 1), T(2, 3)],
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a!,
            tiles: [placed(T(12, 8), 0, 8)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ temporalDebt: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const result = applyAction(state, {
      type: 'DESPERATION_DIG',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round!.activePlayerId).toBe('b');
    expect(result.state.round!.table.warpTrails.a!.distressBeacon.active).toBe(true);
    expect(
      result.state.round!.table.warpTrails.a!.distressBeacon.forcedOpenRemaining
    ).toBe(1); // started at 2, dig turn-end ticked once
    expect(result.state.round!.hands.a!.length).toBe(3); // 9-9 + 2 digs
  });
});

describe('Module Kappa — Hand Exchange (Go-out)', () => {
  it('steals from unique fewest into unique most, then give-back resolves', () => {
    const base = makeRound(['a', 'b', 'c'], { spacedockValue: 12, activePlayerId: 'a' });
    const double = T(5, 5);
    const round = makeRound(['a', 'b', 'c'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: {
        a: [double, T(1, 2), T(2, 3)],
        b: [T(3, 4), T(6, 7), T(8, 9)],
        c: [T(0, 1)],
      },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a!,
            tiles: [placed(T(12, 5), 0, 5)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ temporalInversion: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
        { id: 'c', displayName: 'C', pointsScore: 0 },
      ],
    });

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: double,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    expect(chart.state.handExchangeResolved).toBe(true);
    const pending = chart.state.round!.handExchangePending;
    expect(pending).toBeTruthy();
    expect(pending!.largerPlayerId).toBe('b');
    expect(pending!.smallerPlayerId).toBe('c');
    expect(chart.state.round!.hands.c!.length).toBe(0);
    expect(chart.state.round!.hands.b!.length).toBe(4);

    const give = applyAction(chart.state, {
      type: 'RESOLVE_HAND_EXCHANGE',
      playerId: 'b',
      coordinate: pending!.takenCoordinate,
    });
    expect(give.ok).toBe(true);
    if (!give.ok) return;
    expect(give.state.round!.handExchangePending ?? null).toBe(null);
    expect(give.state.round!.hands.c!.length).toBe(1);
    expect(give.state.round!.hands.b!.length).toBe(3);
  });

  it('skips on tie for most and marks resolved', () => {
    const base = makeRound(['a', 'b', 'c'], { spacedockValue: 12, activePlayerId: 'a' });
    const double = T(5, 5);
    const round = makeRound(['a', 'b', 'c'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: {
        a: [double],
        b: [T(1, 2), T(3, 4)],
        c: [T(6, 7), T(8, 9)],
      },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a!,
            tiles: [placed(T(12, 5), 0, 5)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ temporalInversion: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
        { id: 'c', displayName: 'C', pointsScore: 0 },
      ],
    });

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: double,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.handExchangeResolved).toBe(true);
    expect(chart.state.round!.handExchangePending ?? null).toBe(null);
  });

  it('does not run under points objective', () => {
    const base = makeRound(['a', 'b'], { spacedockValue: 12, activePlayerId: 'a' });
    const double = T(5, 5);
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: { a: [double, T(1, 2), T(3, 4)], b: [T(0, 1)] },
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a!,
            tiles: [placed(T(12, 5), 0, 5)],
            distressBeacon: { active: false },
          },
        },
      },
    });

    const state = makeGame(round, {
      objective: 'points',
      modules: resolveModules({ temporalInversion: true }),
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0 },
      ],
    });

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: double,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.handExchangeResolved ?? false).toBe(false);
    expect(chart.state.round!.handExchangePending ?? null).toBe(null);
  });
});
