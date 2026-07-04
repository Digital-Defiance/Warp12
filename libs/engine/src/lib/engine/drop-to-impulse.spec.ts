import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { resolveHouseRules } from '../types/house-rules.js';

const impulseRules = resolveHouseRules({ dropToImpulseCall: true });

function impulseGame(round: ReturnType<typeof makeRound>) {
  return makeGame(round, { houseRules: impulseRules });
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

describe('drop to impulse house rule', () => {
  it('marks pending after charting down to one coordinate', () => {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: {
        a: [T(12, 5), T(5, 3)],
        b: [],
      },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 6), 0, 12)],
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCallPending).toBe('a');
    expect(result.state.round?.activePlayerId).toBe('a');
    expect(result.state.round?.hands.a).toHaveLength(1);
  });

  it('declares and ends the turn', () => {
    const round = passableForPlayer('a', {
      activePlayerId: 'a',
      hands: { a: [T(3, 4)], b: [] },
      dropToImpulseCallPending: 'a',
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'DROP_TO_IMPULSE',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCallPending).toBeNull();
    expect(result.state.round?.dropToImpulseCatchable).toBeNull();
    expect(result.state.round?.activePlayerId).toBe('b');
    expect(result.state.round?.hands.a).toHaveLength(1);
  });

  it('allows charting the last coordinate while at impulse without announcing', () => {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCallPending: 'a',
      hands: { a: [T(3, 4)], b: [] },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 3)],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(3, 4),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.dropToImpulseCallPending).toBeNull();
    expect(result.state.round?.hands.a).toHaveLength(0);
  });

  it('allows passing helm without declaring even when shields are up', () => {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCallPending: 'a',
      hands: { a: [T(3, 4)], b: [] },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 12)],
            distressBeacon: { active: false },
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, { type: 'PASS_TURN', playerId: 'a' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCatchable).toBe('a');
    expect(result.state.round?.activePlayerId).toBe('b');
  });

  it('opens a catch window when the captain passes without declaring', () => {
    const round = passableForPlayer('a', {
      activePlayerId: 'a',
      hands: { a: [T(3, 4)], b: [] },
      dropToImpulseCallPending: 'a',
    });
    const state = impulseGame(round);

    const result = applyAction(state, { type: 'PASS_TURN', playerId: 'a' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCallPending).toBeNull();
    expect(result.state.round?.dropToImpulseCatchable).toBe('a');
    expect(result.state.round?.activePlayerId).toBe('b');
  });

  it('lets an opponent catch and penalize with one draw', () => {
    const tile = T(0, 1);
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      hands: { a: [T(3, 4)], b: [] },
      dropToImpulseCatchable: 'a',
      unchartedSectors: [tile],
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'CATCH_DROP_TO_IMPULSE',
      challengerId: 'b',
      targetPlayerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCatchable).toBeNull();
    expect(result.state.round?.hands.a).toEqual([T(3, 4), tile]);
    expect(result.state.round?.unchartedSectors).toHaveLength(0);
    expect(result.state.round?.returnedToWarp).toBe(true);
  });

  it('draws two tiles when the house rule sets a 2-tile catch penalty', () => {
    const tiles = [T(0, 1), T(1, 2), T(2, 3)];
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'b',
      hands: { a: [T(3, 4)], b: [] },
      dropToImpulseCatchable: 'a',
      unchartedSectors: tiles,
    });
    const state = makeGame(round, {
      houseRules: resolveHouseRules({
        dropToImpulseCall: true,
        dropToImpulseCatchPenalty: 2,
      }),
    });

    const result = applyAction(state, {
      type: 'CATCH_DROP_TO_IMPULSE',
      challengerId: 'b',
      targetPlayerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.hands.a).toEqual([
      T(3, 4),
      T(0, 1),
      T(1, 2),
    ]);
    expect(result.state.round?.unchartedSectors).toEqual([T(2, 3)]);
  });

  it('closes the catch window after the next helm pass', () => {
    const round = passableForPlayer('b', {
      activePlayerId: 'b',
      hands: { a: [T(3, 4)], b: [] },
      dropToImpulseCatchable: 'a',
    });
    const state = impulseGame(round);

    const result = applyAction(state, { type: 'PASS_TURN', playerId: 'b' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCatchable).toBeNull();
    expect(result.state.round?.activePlayerId).toBe('a');
  });

  it('returns to warp when stuck at impulse and must draw', () => {
    const tile = T(0, 1);
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCallPending: 'a',
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [tile],
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 12)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCallPending).toBeNull();
    expect(result.state.round?.dropToImpulseCatchable).toBeNull();
    expect(result.state.round?.hands.a).toEqual([T(3, 4), tile]);
    expect(result.state.round?.returnedToWarp).toBe(true);
  });

  it('signals return to warp after ANNOUNCING drop to impulse then drawing (no flags left)', () => {
    // Regression: DROP_TO_IMPULSE clears dropToImpulseCallPending and sets no
    // catchable, so an announced captain who later draws has no impulse flag.
    // The return-to-warp signal must still fire — it keys off the hand growing
    // from one, not the flags.
    const tile = T(0, 1);
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCallPending: null,
      dropToImpulseCatchable: null,
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [tile],
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 12)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.returnedToWarp).toBe(true);
  });

  it('clears the return-to-warp signal on the next action', () => {
    // Draw a tile that IS playable (contains 12, the open end) so the turn stays
    // with 'a' via mandatoryPlay; charting it is a clean, valid follow-up action.
    const drawn = T(12, 0);
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCallPending: 'a',
      hands: { a: [T(3, 4)], b: [T(6, 6)] },
      unchartedSectors: [drawn],
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 12)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    const drew = applyAction(impulseGame(round), {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    expect(drew.state.round?.returnedToWarp).toBe(true);

    // The next action resets the transient signal.
    const charted = applyAction(drew.state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: drawn,
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(charted.ok).toBe(true);
    if (!charted.ok) return;
    expect(charted.state.round?.returnedToWarp).toBe(false);
  });

  it('returns to warp when catchable captain draws because they cannot play', () => {
    const tile = T(0, 1);
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      dropToImpulseCatchable: 'a',
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [tile],
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 3), 0, 12)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    const state = impulseGame(round);

    const result = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCatchable).toBeNull();
    expect(result.state.round?.hands.a).toEqual([T(3, 4), tile]);
  });

  it('does nothing when the house rule is off', () => {
    const base = makeRound(['a', 'b'], { activePlayerId: 'a', spacedockValue: 12 });
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: {
        a: [T(12, 5), T(5, 3)],
        b: [],
      },
      table: {
        ...base.table,
        spacedock: { value: 12, placedBy: 'a' },
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            ...base.table.warpTrails.a,
            tiles: [placed(T(12, 6), 0, 12)],
          },
        },
      },
    });
    const state = makeGame(round);

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.round?.dropToImpulseCallPending).toBeNull();
  });
});
