import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { scoreRound } from './scoring.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { createInitialTable } from '../table/table-state.js';

describe('Continuum Flash scope and winning 0-0', () => {
  it('does not trigger Continuum Flash when 0-0 is charted on the Neutral Zone', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 0,
        hands: { a: [T(0, 0)], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 0, 'a'),
          spacedock: { value: 0, placedBy: 'a' },
          neutralZone: { tiles: [] },
        },
      }),
      {
        modules: {
          continuum: { enabled: true, activeFlash: null },
          salamanderPenalty: { enabled: false },
          subspaceFracture: { enabled: false, scope: 'own-trail' },
        },
      }
    );

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(0, 0),
      route: { kind: 'neutral-zone' },
    });

    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.round?.continuumPendingInvoker).toBeNull();
    expect(chart.state.round?.roundWinnerId).toBeNull();
    expect(chart.state.round?.table.redAlert?.active).toBe(true);
    expect(chart.state.round?.phase).toBe('playing');
  });

  it('defers a winning 0-0 on an own trail until Continuum Flash resolves', () => {
    let state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 0,
        hands: { a: [T(0, 0)], b: [T(1, 2)] },
        table: {
          ...createInitialTable(['a', 'b'], 0, 'a'),
          spacedock: { value: 0, placedBy: 'a' },
        },
      }),
      {
        modules: {
          continuum: { enabled: true, activeFlash: null },
          salamanderPenalty: { enabled: false },
          subspaceFracture: { enabled: false, scope: 'own-trail' },
        },
      }
    );

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(0, 0),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;

    expect(chart.state.round?.continuumPendingInvoker).toBe('a');
    expect(chart.state.round?.pendingRoundWin).toEqual({
      playerId: 'a',
      routeKind: 'warp-trail',
    });
    expect(chart.state.round?.roundWinnerId).toBeNull();
    expect(chart.state.round?.phase).toBe('playing');

    state = chart.state;
    const flash = applyAction(state, {
      type: 'INVOKE_CONTINUUM_FLASH',
      playerId: 'a',
      effect: 'reverse-turn-order',
    });
    expect(flash.ok).toBe(true);
    if (!flash.ok) return;

    expect(flash.state.round?.roundWinnerId).toBe('a');
    expect(flash.state.round?.phase).toBe('ended');
    expect(flash.state.round?.pendingRoundWin).toBeNull();
  });

  it('does not trigger Continuum Flash when 0-0 is charted on an opponent open trail', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'b',
        hands: { a: [], b: [T(0, 0), T(0, 1)] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [placed(T(12, 0), 0, 0)],
              distressBeacon: { active: true },
            },
            b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
          },
        },
      }),
      {
        modules: {
          continuum: { enabled: true, activeFlash: null },
          salamanderPenalty: { enabled: false },
          subspaceFracture: { enabled: false, scope: 'own-trail' },
        },
      }
    );

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'b',
      coordinate: T(0, 0),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(chart.ok).toBe(true);
    if (!chart.ok) return;
    expect(chart.state.round?.continuumPendingInvoker).toBeNull();
  });
});

describe('scoreRound blocked vs domino wins', () => {
  it('exempts the domino winner from pip points', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 13,
      phase: 'ended',
      roundWinnerId: 'a',
      hands: { a: [], b: [T(2, 3)] },
    });
    const state = makeGame(round, { completedRounds: 12 });

    const result = scoreRound(state, round);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.captains.find((c) => c.id === 'a')?.pointsScore).toBe(0);
    expect(result.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(5);
  });

  it('rejects END_ROUND when winnerId does not match a domino win', () => {
    const round = makeRound(['a', 'b'], {
      phase: 'ended',
      roundWinnerId: 'a',
    });
    const state = makeGame(round);
    const result = applyAction(state, { type: 'END_ROUND', winnerId: 'b' });
    expect(result.ok).toBe(false);
  });
});
