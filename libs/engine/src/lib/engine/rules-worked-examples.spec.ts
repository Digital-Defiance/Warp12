import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import {
  canDrawFromUncharted,
  canPassRedAlert,
} from './beacon.js';
import { getLegalMoves } from './legal-moves.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { resolveHouseRules } from '../types/house-rules.js';

const standardRules = resolveHouseRules({});
const impulseRules = resolveHouseRules({ dropToImpulseCall: true });

function redAlertOnOwnTrail(
  playerId: 'a' | 'b',
  over: Partial<ReturnType<typeof makeRound>> = {}
) {
  const base = makeRound(['a', 'b'], over);
  return makeRound(['a', 'b'], {
    activePlayerId: playerId,
    spacedockValue: 12,
    ...over,
    table: {
      ...base.table,
      spacedock: { value: 12, placedBy: 'a' },
      ...(over.table ?? {}),
      warpTrails: {
        ...base.table.warpTrails,
        [playerId]: {
          ...base.table.warpTrails[playerId],
          tiles: [placed(T(6, 6), 0, 6)],
          distressBeacon: { active: false },
          ...(over.table?.warpTrails?.[playerId] ?? {}),
        },
      },
      redAlert: {
        active: true,
        anchor: placed(T(6, 6), 0, 6),
        responsiblePlayerId: playerId,
        trailPlayerId: playerId,
        passed: over.table?.redAlert?.passed,
      },
    },
  });
}

function passableForPlayer(
  playerId: 'a' | 'b',
  over: Partial<ReturnType<typeof makeRound>> = {}
) {
  const base = makeRound(['a', 'b'], over);
  return makeRound(['a', 'b'], {
    unchartedSectors: [],
    ...over,
    table: {
      ...base.table,
      ...(over.table ?? {}),
      warpTrails: {
        ...base.table.warpTrails,
        [playerId]: {
          ...base.table.warpTrails[playerId],
          distressBeacon: { active: true },
          ...(over.table?.warpTrails?.[playerId] ?? {}),
        },
      },
    },
  });
}

/**
 * Mirrors RULES.md Section IV — pass Red Alert after already drawing once
 * (one draw per turn; pile may still have tiles).
 */
describe('RULES.md — Red Alert pass after already drawing', () => {
  it('requires a draw before passing when Red Alert is blocking and the pile is not empty', () => {
    const round = redAlertOnOwnTrail('a', {
      hands: { a: [T(1, 2), T(5, 7)], b: [] },
      unchartedSectors: [T(0, 1), T(8, 9)],
      drewThisTurn: false,
    });
    const state = makeGame(round, { houseRules: standardRules });

    expect(getLegalMoves(round, 'a', standardRules)).toHaveLength(0);
    expect(canPassRedAlert(round, 'a', { houseRules: standardRules })).toBe(false);

    const pass = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' });
    expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
  });

  it('allows pass Red Alert after one draw without drawing again', () => {
    const pile = [T(8, 9)];
    const round = redAlertOnOwnTrail('a', {
      hands: { a: [T(1, 2), T(5, 7), T(0, 1)], b: [] },
      unchartedSectors: pile,
      drewThisTurn: true,
    });
    const state = makeGame(round, { houseRules: standardRules });
    const afterDraw = state.round!;

    expect(getLegalMoves(afterDraw, 'a', standardRules)).toHaveLength(0);
    expect(canDrawFromUncharted(afterDraw, 'a', standardRules)).toBe(false);
    expect(canPassRedAlert(afterDraw, 'a', { houseRules: standardRules })).toBe(
      true
    );

    const pass = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;

    expect(pass.state.round?.unchartedSectors).toEqual(pile);
    expect(pass.state.round?.table.redAlert?.responsiblePlayerId).toBe('b');
    expect(pass.state.round?.table.warpTrails.a.distressBeacon.active).toBe(true);
    expect(pass.state.round?.activePlayerId).toBe('b');
  });

  it('passes Red Alert without a second draw after charting an uncoverable double on the same turn', () => {
    const pile = [T(8, 9)];
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      drewThisTurn: true,
      hands: { a: [T(1, 2), T(0, 1)], b: [] },
      unchartedSectors: pile,
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        neutralZone: { tiles: [placed(T(3, 3), 0, 3)] },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 4), 0, 4)],
            distressBeacon: { active: false },
          },
        },
        redAlert: {
          active: true,
          anchor: placed(T(3, 3), 0, 3),
          responsiblePlayerId: 'a',
          neutralZone: true,
        },
      },
    });
    const state = makeGame(round, { houseRules: standardRules });

    expect(canDrawFromUncharted(state.round!, 'a', standardRules)).toBe(false);
    expect(canPassRedAlert(state.round!, 'a', { houseRules: standardRules })).toBe(
      true
    );

    const pass = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    expect(pass.state.round?.unchartedSectors).toEqual(pile);
    expect(pass.state.round?.table.redAlert?.responsiblePlayerId).toBe('b');
  });
});

/**
 * Mirrors RULES.md Section V — Drop to Impulse knock: charting down to one
 * tile does not allow a silent last-coordinate play on the same turn.
 */
describe('RULES.md — Drop to Impulse knock', () => {
  function trailOpenOnTwelve() {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    return {
      ...base.table,
      spacedock: { value: 12, placedBy: 'a' },
      warpTrails: {
        ...base.table.warpTrails,
        a: {
          ...base.table.warpTrails.a,
          tiles: [placed(T(12, 6), 0, 12)],
          distressBeacon: { active: false },
        },
      },
    };
  }

  it('blocks a silent go-out on the same turn you reach impulse', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(5, 12), T(5, 7)], b: [] },
      unchartedSectors: [T(0, 1)],
      table: trailOpenOnTwelve(),
    });
    let state = makeGame(round, { houseRules: impulseRules });

    const firstPlay = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(firstPlay.ok).toBe(true);
    if (!firstPlay.ok) return;

    state = firstPlay.state;
    expect(state.round?.phase).toBe('playing');
    expect(state.round?.dropToImpulseCallPending).toBe('a');
    expect(state.round?.hands.a).toEqual([T(5, 7)]);
    expect(getLegalMoves(state.round!, 'a', impulseRules)).toHaveLength(0);

    const silentGoOut = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 7),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(silentGoOut).toEqual({
      ok: false,
      violation: 'DROP_TO_IMPULSE_CHART_BLOCKED',
    });
  });

  it('allows go-out on a later turn after announcing Drop to Impulse', () => {
    const table = trailOpenOnTwelve();
    const round = passableForPlayer('a', {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(5, 12), T(5, 7)], b: [] },
      unchartedSectors: [T(0, 1)],
      table: {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          b: {
            ...table.warpTrails.b,
            distressBeacon: { active: true },
          },
        },
      },
    });
    let state = makeGame(round, { houseRules: impulseRules });

    const firstPlay = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(firstPlay.ok).toBe(true);
    if (!firstPlay.ok) return;
    state = firstPlay.state;

    const announce = applyAction(state, {
      type: 'DROP_TO_IMPULSE',
      playerId: 'a',
    });
    expect(announce.ok).toBe(true);
    if (!announce.ok) return;
    state = announce.state;
    expect(state.round?.dropToImpulseCallPending).toBeNull();
    expect(state.round?.hands.a).toEqual([T(5, 7)]);
    expect(state.round?.activePlayerId).toBe('b');

    const bDraw = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'b',
    });
    expect(bDraw.ok).toBe(true);
    if (!bDraw.ok) return;
    state = bDraw.state;
    expect(state.round?.activePlayerId).toBe('a');

    const goOut = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 7),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(goOut.ok).toBe(true);
    if (!goOut.ok) return;
    expect(goOut.state.round?.hands.a).toHaveLength(0);
    expect(goOut.state.round?.phase).toBe('ended');
    expect(goOut.state.round?.roundWinnerId).toBe('a');
  });

  it('opens a catch window when passing at impulse without announcing', () => {
    const round = passableForPlayer('a', {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(5, 12), T(5, 7)], b: [] },
      unchartedSectors: [T(0, 1)],
      table: trailOpenOnTwelve(),
    });
    let state = makeGame(round, { houseRules: impulseRules });

    const firstPlay = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 12),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(firstPlay.ok).toBe(true);
    if (!firstPlay.ok) return;
    state = firstPlay.state;

    const forget = applyAction(state, { type: 'PASS_TURN', playerId: 'a' });
    expect(forget.ok).toBe(true);
    if (!forget.ok) return;
    expect(forget.state.round?.dropToImpulseCatchable).toBe('a');
    expect(forget.state.round?.activePlayerId).toBe('b');
    expect(forget.state.round?.hands.a).toEqual([T(5, 7)]);
  });
});
