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

  it('blocks charting the last coordinate while announce is pending', () => {
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

    expect(result.ok).toBe(false);
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
