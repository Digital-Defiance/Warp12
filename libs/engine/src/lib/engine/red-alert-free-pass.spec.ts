import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { canPassRedAlert } from './beacon.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import type { GameState } from '../types/game-state.js';
import { resolveHouseRules } from '../types/house-rules.js';

/**
 * "Pass Red Alert without draw or beacon" (mayhem) is a *creator-only* break:
 * the captain who charts the double may pass it on immediately without drawing
 * or deploying a beacon, but only during Yellow alert (before it passes).
 * Once responsibility has moved, everyone — including the original captain when
 * it cycles back — must satisfy it under standard rules.
 *
 * These tests drive the real charting flow end to end so the `passed` flag is
 * set by the engine, not hand-authored state.
 */
describe('Red Alert free pass (creator-only, Yellow alert)', () => {
  const freePassRules = resolveHouseRules({ passRedAlertWithoutDraw: true });
  const standardRules = resolveHouseRules();

  /**
   * `a` has already started their own warp trail (open end 6) and holds the
   * 6-6 double plus a tile that cannot cover it. `b` and `c` hold no sixes, so
   * once the double is charted nobody can cover from hand.
   */
  function gameWhereCreatorChartsDouble(
    houseRules = freePassRules
  ): GameState {
    const round = makeRound(['a', 'b', 'c'], {
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: {
        a: [T(6, 6), T(1, 2)],
        b: [T(3, 5)],
        c: [T(4, 5)],
      },
      unchartedSectors: [T(0, 1), T(2, 3)],
    });

    return makeGame(
      {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            a: {
              ...round.table.warpTrails.a,
              tiles: [placed(T(0, 6), 0, 6)],
              distressBeacon: { active: false },
            },
          },
        },
      },
      { houseRules }
    );
  }

  function chartTheDouble(game: GameState): GameState {
    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(6, 6),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected chart to succeed');
    return result.state;
  }

  it('opens the alert in Yellow alert (passed is not set)', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const redAlert = afterChart.round?.table.redAlert;
    expect(redAlert?.active).toBe(true);
    expect(redAlert?.responsiblePlayerId).toBe('a');
    expect(redAlert?.passed ?? false).toBe(false);
  });

  it('lets the creator pass without drawing or deploying a beacon', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const beforeUncharted = afterChart.round!.unchartedSectors.length;

    expect(canPassRedAlert(afterChart.round!, 'a', { houseRules: freePassRules })).toBe(
      true
    );

    const passed = applyAction(afterChart, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;

    const round = passed.state.round!;
    // No draw, no beacon.
    expect(round.unchartedSectors.length).toBe(beforeUncharted);
    expect(round.table.warpTrails.a.distressBeacon.active).toBe(false);
    // Responsibility handed on, and the alert is now flagged as passed.
    expect(round.table.redAlert?.responsiblePlayerId).toBe('b');
    expect(round.table.redAlert?.passed).toBe(true);
  });

  it('forces the next captain to draw first once the alert has passed', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const afterPass = applyAction(afterChart, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(afterPass.ok).toBe(true);
    if (!afterPass.ok) return;

    const bRound = afterPass.state.round!;
    expect(bRound.activePlayerId).toBe('b');
    // b cannot cover and tiles remain, so the free pass no longer applies.
    expect(canPassRedAlert(bRound, 'b', { houseRules: freePassRules })).toBe(false);

    const bTriesToPass = applyAction(afterPass.state, {
      type: 'PASS_RED_ALERT',
      playerId: 'b',
    });
    expect(bTriesToPass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
  });

  it('deploys the beacon when the next captain draws and still cannot cover', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const afterPass = applyAction(afterChart, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(afterPass.ok).toBe(true);
    if (!afterPass.ok) return;

    const bDraws = applyAction(afterPass.state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'b',
    });
    expect(bDraws.ok).toBe(true);
    if (!bDraws.ok) return;

    const round = bDraws.state.round!;
    // b drew a non-six, could not cover, so standard rules deploy the beacon
    // and move responsibility onward. The alert stays flagged as passed.
    expect(round.table.warpTrails.b.distressBeacon.active).toBe(true);
    expect(round.table.redAlert?.passed).toBe(true);
    expect(round.table.redAlert?.responsiblePlayerId).not.toBe('b');
  });

  it('does not grant the free pass to the creator once it cycles back', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const round = afterChart.round!;
    const cycledBack: GameState = {
      ...afterChart,
      round: {
        ...round,
        activePlayerId: 'a',
        table: {
          ...round.table,
          redAlert: {
            ...round.table.redAlert!,
            responsiblePlayerId: 'a',
            passed: true,
          },
        },
      },
    };

    expect(canPassRedAlert(cycledBack.round!, 'a', { houseRules: freePassRules })).toBe(
      false
    );
    const pass = applyAction(cycledBack, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
  });

  it('honors the empty-pile pass for a passed alert (standard, no beacon skip)', () => {
    const afterChart = chartTheDouble(gameWhereCreatorChartsDouble());
    const round = afterChart.round!;
    // Passed alert, b responsible, but Uncharted Sectors are empty.
    const emptyPile: GameState = {
      ...afterChart,
      round: {
        ...round,
        activePlayerId: 'b',
        unchartedSectors: [],
        table: {
          ...round.table,
          redAlert: {
            ...round.table.redAlert!,
            responsiblePlayerId: 'b',
            passed: true,
          },
        },
      },
    };

    // With an empty pile, passing is legal, but the beacon must deploy.
    expect(canPassRedAlert(emptyPile.round!, 'b', { houseRules: freePassRules })).toBe(
      true
    );
    const pass = applyAction(emptyPile, {
      type: 'PASS_RED_ALERT',
      playerId: 'b',
    });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    expect(pass.state.round?.table.warpTrails.b.distressBeacon.active).toBe(true);
  });

  it('still forces a draw for the creator when the house rule is off', () => {
    const afterChart = chartTheDouble(
      gameWhereCreatorChartsDouble(standardRules)
    );
    expect(
      canPassRedAlert(afterChart.round!, 'a', { houseRules: standardRules })
    ).toBe(false);
    const pass = applyAction(afterChart, {
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
  });

  it('sets passed when the creator deploys a beacon via the standard path', () => {
    // House rule off: creator draws, cannot cover, then the auto-pass after the
    // draw deploys the beacon and flags the alert as passed.
    const afterChart = chartTheDouble(
      gameWhereCreatorChartsDouble(standardRules)
    );
    const draw = applyAction(afterChart, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    const round = draw.state.round!;
    expect(round.table.warpTrails.a.distressBeacon.active).toBe(true);
    expect(round.table.redAlert?.passed).toBe(true);
  });
});
