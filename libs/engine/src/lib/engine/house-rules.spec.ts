import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { makeGame, makeRound, T } from './test-helpers.js';
import { resolveHouseRules } from '../types/house-rules.js';

const deluxeTwo = resolveHouseRules({ roundStarterPlaysTwo: true });

function starterRound(
  over: Parameters<typeof makeRound>[1] = {}
) {
  const spacedockValue = over.spacedockValue ?? 12;
  const base = makeRound(['a', 'b'], { spacedockValue, activePlayerId: 'a' });
  return makeRound(['a', 'b'], {
    spacedockValue,
    activePlayerId: 'a',
    ...over,
    table: {
      ...base.table,
      spacedock: { value: spacedockValue, placedBy: 'a' },
      ...(over.table ?? {}),
    },
  });
}

describe('house rules', () => {
  it('require own trail first blocks opponent trails until established', () => {
    const deluxe = resolveHouseRules({ requireOwnTrailFirst: true });
    const standard = resolveHouseRules();

    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: {
        a: [T(5, 6)],
        b: [],
      },
      table: {
        ...makeRound(['a', 'b']).table,
        warpTrails: {
          ...makeRound(['a', 'b']).table.warpTrails,
          b: {
            ...makeRound(['a', 'b']).table.warpTrails.b,
            distressBeacon: { active: true },
            tiles: [
              {
                coordinate: T(12, 5),
                index: 0,
                openValue: 5,
              },
            ],
          },
        },
      },
    });

    expect(
      getLegalMoves(round, 'a', standard).some(
        (m) => m.route.kind === 'warp-trail' && m.route.playerId === 'b'
      )
    ).toBe(true);
    expect(
      getLegalMoves(round, 'a', deluxe).some(
        (m) => m.route.kind === 'warp-trail' && m.route.playerId === 'b'
      )
    ).toBe(false);

    const withOwnTrail = {
      ...round,
      table: {
        ...round.table,
        warpTrails: {
          ...round.table.warpTrails,
          a: {
            ...round.table.warpTrails.a,
            tiles: [
              {
                coordinate: T(12, 7),
                index: 0,
                openValue: 7,
              },
            ],
          },
        },
      },
    };

    expect(
      getLegalMoves(withOwnTrail, 'a', deluxe).some(
        (m) => m.route.kind === 'warp-trail' && m.route.playerId === 'b'
      )
    ).toBe(true);
  });

  it('neutral zone after all trails started blocks NZ until every captain has a tile', () => {
    const deluxe = resolveHouseRules({ neutralZoneAfterAllTrails: true });

    const base = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: {
        a: [T(12, 5)],
        b: [],
      },
      table: {
        ...makeRound(['a', 'b']).table,
        warpTrails: {
          ...makeRound(['a', 'b']).table.warpTrails,
          a: {
            ...makeRound(['a', 'b']).table.warpTrails.a,
            tiles: [
              {
                coordinate: T(12, 5),
                index: 0,
                openValue: 5,
              },
            ],
          },
        },
      },
    });

    expect(
      getLegalMoves(base, 'a', deluxe).some((m) => m.route.kind === 'neutral-zone')
    ).toBe(false);

    const allStarted = {
      ...base,
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          b: {
            ...base.table.warpTrails.b,
            tiles: [
              {
                coordinate: T(12, 6),
                index: 0,
                openValue: 6,
              },
            ],
          },
        },
      },
    };

    expect(
      getLegalMoves(allStarted, 'a', deluxe).some(
        (m) => m.route.kind === 'neutral-zone'
      )
    ).toBe(true);
  });

  it('beacon clears on any play removes marker when charting opponent trail', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        spacedockValue: 12,
        activePlayerId: 'a',
        hands: {
          a: [T(5, 6)],
          b: [],
        },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              distressBeacon: { active: true },
              tiles: [
                {
                  coordinate: T(12, 7),
                  index: 0,
                  openValue: 7,
                },
              ],
            },
            b: {
              ...makeRound(['a', 'b']).table.warpTrails.b,
              distressBeacon: { active: true },
              tiles: [
                {
                  coordinate: T(12, 6),
                  index: 0,
                  openValue: 6,
                },
              ],
            },
          },
        },
      }),
      { houseRules: resolveHouseRules({ beaconClearsOnAnyPlay: true }) }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(5, 6),
      route: { kind: 'warp-trail', playerId: 'b' },
    });

    expect(result.ok).toBe(true);
    expect(result.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );
  });

  describe('round starter plays two', () => {
    it('restricts the opener to their own trail before both tiles are played', () => {
      const round = starterRound({
        hands: { a: [T(12, 5)], b: [] },
      });

      expect(
        getLegalMoves(round, 'a', deluxeTwo).some(
          (m) => m.route.kind === 'neutral-zone'
        )
      ).toBe(false);
      expect(
        getLegalMoves(round, 'a', deluxeTwo).some(
          (m) =>
            m.route.kind === 'warp-trail' &&
            m.route.playerId === 'a' &&
            m.coordinate.low === 5
        )
      ).toBe(true);
    });

    it('holds the turn for a second own-trail chart then advances', () => {
      let state = makeGame(
        starterRound({
          hands: { a: [T(12, 5), T(5, 6), T(1, 2)], b: [] },
        }),
        { houseRules: deluxeTwo }
      );

      const first = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(12, 5),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(first.ok).toBe(true);
      expect(first.state.round?.activePlayerId).toBe('a');
      expect(first.state.round?.roundStarterOpening).toEqual({ playerId: 'a' });
      expect(first.state.round?.table.warpTrails.a.tiles).toHaveLength(1);

      const second = applyAction(first.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(5, 6),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(second.ok).toBe(true);
      expect(second.state.round?.activePlayerId).toBe('b');
      expect(second.state.round?.roundStarterOpening).toBeNull();
      expect(second.state.round?.table.warpTrails.a.tiles).toHaveLength(2);
    });

    it('deploys a beacon when the second own-trail chart is impossible', () => {
      const state = makeGame(
        starterRound({
          hands: { a: [T(12, 5)], b: [] },
        }),
        { houseRules: deluxeTwo }
      );

      const result = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(12, 5),
        route: { kind: 'warp-trail', playerId: 'a' },
      });

      expect(result.ok).toBe(true);
      expect(result.state.round?.activePlayerId).toBe('b');
      expect(result.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
      expect(result.state.round?.roundStarterOpening).toBeNull();
    });

    it('treats a Red Alert cover as the second opening chart', () => {
      let state = makeGame(
        starterRound({
          spacedockValue: 6,
          hands: { a: [T(6, 6), T(3, 6), T(1, 2)], b: [] },
        }),
        { houseRules: deluxeTwo }
      );

      const first = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 6),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(first.ok).toBe(true);
      expect(first.state.round?.activePlayerId).toBe('a');
      expect(first.state.round?.table.redAlert?.active).toBe(true);

      const cover = applyAction(first.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(3, 6),
        route: { kind: 'red-alert-cover', trailPlayerId: 'a' },
      });
      expect(cover.ok).toBe(true);
      expect(cover.state.round?.activePlayerId).toBe('b');
      expect(cover.state.round?.table.redAlert).toBeNull();
      expect(cover.state.round?.table.warpTrails.a.tiles).toHaveLength(2);
    });

    it('does not force a second opening chart on a later turn', () => {
      const round = starterRound({
        activePlayerId: 'a',
        hands: { a: [T(5, 6)], b: [] },
        table: {
          warpTrails: {
            ...starterRound().table.warpTrails,
            a: {
              ...starterRound().table.warpTrails.a,
              distressBeacon: { active: true },
              tiles: [
                {
                  coordinate: T(12, 5),
                  index: 0,
                  openValue: 5,
                },
              ],
            },
          },
        },
      });

      expect(getLegalMoves(round, 'a', deluxeTwo)).toEqual([
        {
          coordinate: T(5, 6),
          route: { kind: 'warp-trail', playerId: 'a' },
        },
      ]);
    });
  });
});
