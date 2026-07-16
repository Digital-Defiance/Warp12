import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { canDeployDistressBeacon, canDrawFromUncharted } from './beacon.js';
import { getLegalMoves } from './legal-moves.js';
import { allCaptainsHaveStartedTrails, canChartOnOpponentTrail } from './house-rules.js';
import { formSquadrons } from './squadrons.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
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
    it('allows the opener to play on any legal route for both tiles (default)', () => {
      const round = starterRound({
        hands: { a: [T(12, 5), T(12, 6)], b: [] },
      });

      // Should allow both own trail and neutral zone
      expect(
        getLegalMoves(round, 'a', deluxeTwo).some(
          (m) => m.route.kind === 'neutral-zone'
        )
      ).toBe(true);
      expect(
        getLegalMoves(round, 'a', deluxeTwo).some(
          (m) =>
            m.route.kind === 'warp-trail' &&
            m.route.playerId === 'a' &&
            m.coordinate.low === 5
        )
      ).toBe(true);
    });

    it('restricts the opener to own trail when roundStarterOwnTrailOnly is enabled', () => {
      const deluxeTwoOwnTrail = resolveHouseRules({ 
        roundStarterPlaysTwo: true,
        roundStarterOwnTrailOnly: true
      });
      
      const round = starterRound({
        hands: { a: [T(12, 5)], b: [] },
      });

      // Should NOT allow neutral zone when restricted
      expect(
        getLegalMoves(round, 'a', deluxeTwoOwnTrail).some(
          (m) => m.route.kind === 'neutral-zone'
        )
      ).toBe(false);
      
      // Should allow own trail
      expect(
        getLegalMoves(round, 'a', deluxeTwoOwnTrail).some(
          (m) =>
            m.route.kind === 'warp-trail' &&
            m.route.playerId === 'a' &&
            m.coordinate.low === 5
        )
      ).toBe(true);
    });

    it('holds the turn for a second chart on any legal route then advances', () => {
      let state = makeGame(
        starterRound({
          hands: { a: [T(12, 5), T(5, 6), T(1, 2)], b: [] },
        }),
        { houseRules: deluxeTwo }
      );

      // First tile on own trail
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

      // Second tile also on own trail
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

    it('allows both tiles to be played on neutral zone', () => {
      let state = makeGame(
        starterRound({
          hands: { a: [T(12, 5), T(5, 8), T(1, 2)], b: [] },
        }),
        { houseRules: deluxeTwo }
      );

      // First tile on neutral zone
      const first = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(12, 5),
        route: { kind: 'neutral-zone' },
      });
      expect(first.ok).toBe(true);
      expect(first.state.round?.activePlayerId).toBe('a');
      expect(first.state.round?.roundStarterOpening).toEqual({ playerId: 'a' });
      expect(first.state.round?.table.neutralZone.tiles).toHaveLength(1);

      // Second tile also on neutral zone
      const second = applyAction(first.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(5, 8),
        route: { kind: 'neutral-zone' },
      });
      expect(second.ok).toBe(true);
      expect(second.state.round?.activePlayerId).toBe('b');
      expect(second.state.round?.roundStarterOpening).toBeNull();
      expect(second.state.round?.table.neutralZone.tiles).toHaveLength(2);
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
        roundStarterOpeningResolved: true,
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

    it('allows only one chart per turn after the opening double-chart', () => {
      let state = makeGame(
        starterRound({
          hands: {
            a: [T(12, 5), T(5, 6), T(6, 7), T(1, 2)],
            b: [T(12, 3), T(3, 4)],
          },
        }),
        { houseRules: deluxeTwo }
      );

      // Opening: two charts in a row
      const first = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(12, 5),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(first.ok).toBe(true);
      expect(first.state.round?.activePlayerId).toBe('a');
      expect(first.state.round?.roundStarterOpeningResolved).toBe(false);

      const second = applyAction(first.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(5, 6),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(second.ok).toBe(true);
      expect(second.state.round?.activePlayerId).toBe('b');
      expect(second.state.round?.roundStarterOpeningResolved).toBe(true);
      expect(second.state.round?.roundStarterOpening).toBeNull();

      // B plays one and passes helm back
      const bPlay = applyAction(second.state, {
        type: 'CHART_COORDINATE',
        playerId: 'b',
        coordinate: T(12, 3),
        route: { kind: 'warp-trail', playerId: 'b' },
      });
      expect(bPlay.ok).toBe(true);
      expect(bPlay.state.round?.activePlayerId).toBe('a');

      // Later turn for the starter: one chart, then helm advances
      const later = applyAction(bPlay.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(later.ok).toBe(true);
      expect(later.state.round?.activePlayerId).toBe('b');
      expect(later.state.round?.roundStarterOpening).toBeNull();
      expect(later.state.round?.roundStarterOpeningResolved).toBe(true);
      expect(later.state.round?.table.warpTrails.a.tiles).toHaveLength(3);
    });
  });

  describe('manual shield control', () => {
    const manual = resolveHouseRules({ manualShieldControl: true });

    it('allows voluntary shields down while legal charts remain', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [
                { coordinate: T(6, 6), index: 0, openValue: 6 },
              ],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const deploy = applyAction(state, {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'a',
      });
      expect(deploy.ok).toBe(true);
      if (!deploy.ok) return;
      expect(deploy.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
      expect(deploy.state.round?.activePlayerId).toBe('a');
    });

    it('allows voluntary shields down before the own trail is started (open any time)', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      expect(canDeployDistressBeacon(state.round!, 'a', { houseRules: manual })).toBe(
        true
      );
      const deploy = applyAction(state, {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'a',
      });
      expect(deploy.ok).toBe(true);
      if (!deploy.ok) return;
      expect(deploy.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
    });

    it('voluntary open does not skip the mandatory draw when stuck', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 12,
        hands: { a: [T(1, 2)], b: [] },
        unchartedSectors: [T(3, 4)],
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [],
              distressBeacon: { active: false },
            },
          },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      // Opening early is legal, but keeps the turn open — you still owe a draw.
      const deploy = applyAction(state, {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'a',
      });
      expect(deploy.ok).toBe(true);
      if (!deploy.ok) return;
      expect(deploy.state.round?.activePlayerId).toBe('a');

      // Cannot pass without drawing; the mandatory draw is still enforced.
      const pass = applyAction(deploy.state, { type: 'PASS_TURN', playerId: 'a' });
      expect(pass).toEqual({ ok: false, violation: 'PASS_NOT_ALLOWED' });
      expect(canDrawFromUncharted(deploy.state.round!, 'a', manual)).toBe(true);
    });

    it('blocks a second routine chart on the same turn', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7), T(7, 8)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;

      const again = applyAction(chart.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(7, 8),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(again).toEqual({ ok: false, violation: 'TURN_CHART_LIMIT' });
    });

    it('allows voluntary shields down on a later turn without charting first', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const deploy = applyAction(state, {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'a',
      });
      expect(deploy.ok).toBe(true);
      if (!deploy.ok) return;
      expect(deploy.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
      expect(deploy.state.round?.activePlayerId).toBe('a');
    });

    it('lets you pass (not draw) after charting — your play is done', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        playedThisTurn: true,
        // Remaining tile cannot be charted, but that must NOT force a draw:
        // the captain already made their play this turn.
        hands: { a: [T(1, 2)], b: [] },
        unchartedSectors: [T(0, 1)],
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [
                { coordinate: T(6, 6), index: 0, openValue: 6 },
                { coordinate: T(6, 7), index: 1, openValue: 7 },
              ],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      // A second routine chart is blocked (already played), but that does not
      // mean the captain is "stuck" — Draw must NOT be offered.
      expect(getLegalMoves(state.round!, 'a', manual)).toHaveLength(0);
      expect(canDrawFromUncharted(state.round!, 'a', manual)).toBe(false);

      // Pass ends the turn and advances helm.
      const pass = applyAction(state, { type: 'PASS_TURN', playerId: 'a' });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.activePlayerId).toBe('b');
    });

    it('advances helm on pass after a bare chart (regression: turn was stuck)', () => {
      // Reproduces the reported bug: open the round with a single chart on your
      // own trail under manual shield control, then Pass — helm must advance,
      // Draw must be unavailable, and Pass must be legal.
      const round = makeRound(['you', 'lovell', 'earhart', 'yeager'], {
        activePlayerId: 'you',
        spacedockValue: 12,
        hands: {
          you: [T(1, 5), T(5, 10), T(9, 12)],
          lovell: [],
          earhart: [],
          yeager: [],
        },
        unchartedSectors: [T(0, 1), T(2, 2)],
        table: {
          ...makeRound(['you', 'lovell', 'earhart', 'yeager']).table,
          spacedock: { value: 12, placedBy: 'you' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'you',
        coordinate: T(9, 12),
        route: { kind: 'warp-trail', playerId: 'you' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;
      // Manual shield control keeps helm with you after the chart…
      expect(chart.state.round?.activePlayerId).toBe('you');
      expect(chart.state.round?.playedThisTurn).toBe(true);
      // …but Draw is not offered and Pass is legal.
      expect(canDrawFromUncharted(chart.state.round!, 'you', manual)).toBe(false);

      const pass = applyAction(chart.state, {
        type: 'PASS_TURN',
        playerId: 'you',
      });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.activePlayerId).toBe('lovell');
    });

    it('keeps the turn open after a chart so shields can be toggled before passing', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7), T(7, 8)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;
      expect(chart.state.round?.activePlayerId).toBe('a');
      expect(chart.state.round?.playedThisTurn).toBe(true);
      expect(
        canDeployDistressBeacon(chart.state.round!, 'a', { houseRules: manual })
      ).toBe(true);

      const pass = applyAction(chart.state, { type: 'PASS_TURN', playerId: 'a' });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.activePlayerId).toBe('b');
    });

    it('does not auto-raise shields when charting your own trail', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [
                { coordinate: T(6, 6), index: 0, openValue: 6 },
              ],
              distressBeacon: { active: true },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;
      expect(chart.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
    });

    it('allows raising shields on a later turn once the own trail was serviced since opening', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7)], b: [] },
        playedThisTurn: false,
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [
                { coordinate: T(6, 6), index: 0, openValue: 6 },
                { coordinate: T(6, 7), index: 1, openValue: 7 },
              ],
              // Serviced own trail after opening on a prior turn.
              distressBeacon: { active: true, chartedOwnTrailSinceDown: true },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const raised = applyAction(state, {
        type: 'RAISE_SHIELDS',
        playerId: 'a',
      });
      expect(raised.ok).toBe(true);
      if (!raised.ok) return;
      expect(raised.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        false
      );
      expect(raised.state.round?.activePlayerId).toBe('a');
    });

    it('blocks raising shields until the own trail is serviced since opening', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        // Filler tile so charting the 6-7 does not empty the hand (go out).
        hands: { a: [T(6, 7), T(2, 3)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              // Beacon down, but not serviced since it dropped.
              distressBeacon: { active: true, chartedOwnTrailSinceDown: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const raised = applyAction(state, {
        type: 'RAISE_SHIELDS',
        playerId: 'a',
      });
      expect(raised).toEqual({ ok: false, violation: 'RAISE_SHIELDS_NOT_ALLOWED' });

      // Charting the own trail earns back the right to raise.
      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;
      expect(
        chart.state.round?.table.warpTrails.a.distressBeacon.active
      ).toBe(true);
      const nowRaise = applyAction(chart.state, {
        type: 'RAISE_SHIELDS',
        playerId: 'a',
      });
      expect(nowRaise.ok).toBe(true);
    });

    it('allows only one shield change per turn', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7), T(7, 8)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              distressBeacon: { active: false },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const open = applyAction(state, {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'a',
      });
      expect(open.ok).toBe(true);
      if (!open.ok) return;
      expect(open.state.round?.shieldChangedThisTurn).toBe(true);

      // A second shield change this turn is blocked (would be close after open).
      // Chart the own trail so the close gate would otherwise be satisfied.
      const chart = applyAction(open.state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;
      const secondChange = applyAction(chart.state, {
        type: 'RAISE_SHIELDS',
        playerId: 'a',
      });
      expect(secondChange).toEqual({
        ok: false,
        violation: 'RAISE_SHIELDS_NOT_ALLOWED',
      });
    });

    it('forces the turn to end when a stuck draw drops the marker', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 12,
        hands: { a: [T(1, 2)], b: [] },
        unchartedSectors: [T(3, 4)],
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [],
              distressBeacon: { active: false },
            },
          },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const draw = applyAction(state, {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'a',
      });
      expect(draw.ok).toBe(true);
      if (!draw.ok) return;
      // Forced marker after a failed draw ends the turn even under manual control.
      expect(draw.state.round?.table.warpTrails.a.distressBeacon.active).toBe(true);
      expect(draw.state.round?.activePlayerId).toBe('b');
    });

    it('supports chart, optional shield change, then pass on the same turn', () => {
      const round = makeRound(['a', 'b'], {
        activePlayerId: 'a',
        spacedockValue: 6,
        hands: { a: [T(6, 7), T(7, 8)], b: [] },
        table: {
          ...makeRound(['a', 'b']).table,
          warpTrails: {
            ...makeRound(['a', 'b']).table.warpTrails,
            a: {
              ...makeRound(['a', 'b']).table.warpTrails.a,
              tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
              distressBeacon: { active: true },
            },
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
      });
      const state = makeGame(round, { houseRules: manual });

      const chart = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(6, 7),
        route: { kind: 'warp-trail', playerId: 'a' },
      });
      expect(chart.ok).toBe(true);
      if (!chart.ok) return;

      const raised = applyAction(chart.state, {
        type: 'RAISE_SHIELDS',
        playerId: 'a',
      });
      expect(raised.ok).toBe(true);
      if (!raised.ok) return;
      expect(raised.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        false
      );

      const pass = applyAction(raised.state, { type: 'PASS_TURN', playerId: 'a' });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.activePlayerId).toBe('b');
    });
  });

  describe('pass red alert without draw', () => {
    const passRule = resolveHouseRules({ passRedAlertWithoutDraw: true });
    const standard = resolveHouseRules();

    function redAlertState(houseRules = passRule) {
      return makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          spacedockValue: 6,
          hands: { a: [T(1, 2)], b: [] },
          unchartedSectors: [T(3, 4)],
          table: {
            ...makeRound(['a', 'b']).table,
            warpTrails: {
              ...makeRound(['a', 'b']).table.warpTrails,
              a: {
                ...makeRound(['a', 'b']).table.warpTrails.a,
                tiles: [{ coordinate: T(6, 6), index: 0, openValue: 6 }],
                distressBeacon: { active: false },
              },
            },
            redAlert: {
              active: true,
              anchor: { coordinate: T(6, 6), index: 0, openValue: 6 },
              responsiblePlayerId: 'a',
              trailPlayerId: 'a',
            },
            spacedock: { value: 6, placedBy: 'a' },
          },
        }),
        { houseRules }
      );
    }

    it('allows passing without drawing or deploying when the house rule is on', () => {
      const pass = applyAction(redAlertState(), {
        type: 'PASS_RED_ALERT',
        playerId: 'a',
      });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        false
      );
      expect(pass.state.round?.table.redAlert?.responsiblePlayerId).toBe('b');
    });

    it('still requires drawing first under standard rules when tiles remain', () => {
      const pass = applyAction(redAlertState(standard), {
        type: 'PASS_RED_ALERT',
        playerId: 'a',
      });
      expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
    });

    it('marks the alert as passed after the creator uses the free pass', () => {
      const pass = applyAction(redAlertState(), {
        type: 'PASS_RED_ALERT',
        playerId: 'a',
      });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.state.round?.table.redAlert?.passed).toBe(true);
    });

    it('does not grant the free pass once the alert has already passed', () => {
      // Alert already handed to 'b' (passed phase); 'b' holds no cover and
      // tiles remain, so standard rules force a draw even with the house rule.
      const base = redAlertState();
      const round = base.round!;
      const passedState = {
        ...base,
        round: {
          ...round,
          activePlayerId: 'b',
          hands: { a: [], b: [T(1, 2)] },
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

      const pass = applyAction(passedState, {
        type: 'PASS_RED_ALERT',
        playerId: 'b',
      });
      expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
    });

    it('does not grant the free pass to the creator once it cycles back', () => {
      const base = redAlertState();
      const round = base.round!;
      const cycledBack = {
        ...base,
        round: {
          ...round,
          activePlayerId: 'a',
          hands: { a: [T(1, 2)], b: [] },
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

      const pass = applyAction(cycledBack, {
        type: 'PASS_RED_ALERT',
        playerId: 'a',
      });
      expect(pass).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
    });
  });

  describe('all stop ceremony', () => {
    it('auto-declares All Stop on a Neutral Zone win when ceremony is enabled', () => {
      const state = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(4, 12)], b: [T(1, 2)] },
          table: {
            ...makeRound(['a', 'b']).table,
            neutralZone: {
              tiles: [{ coordinate: T(5, 12), index: 0, openValue: 12 }],
            },
          },
        }),
        { houseRules: resolveHouseRules({ allStopCeremony: true }) }
      );

      const win = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(4, 12),
        route: { kind: 'neutral-zone' },
      });
      expect(win.ok).toBe(true);
      if (!win.ok) return;
      expect(win.state.round?.allStopDeclared).toBe(true);
      expect(win.state.round?.phase).toBe('ended');
    });

    it('ends silently when ceremony is disabled', () => {
      const state = makeGame(
        makeRound(['a', 'b'], {
          activePlayerId: 'a',
          hands: { a: [T(4, 12)], b: [T(1, 2)] },
          table: {
            ...makeRound(['a', 'b']).table,
            neutralZone: {
              tiles: [{ coordinate: T(5, 12), index: 0, openValue: 12 }],
            },
          },
        }),
        { houseRules: resolveHouseRules({ allStopCeremony: false }) }
      );

      const win = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: T(4, 12),
        route: { kind: 'neutral-zone' },
      });
      expect(win.ok).toBe(true);
      if (!win.ok) return;
      expect(win.state.round?.allStopDeclared).toBe(false);
      expect(win.state.round?.phase).toBe('ended');
    });
  });
});

describe('house rules — Module Zeta squads', () => {
  const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);

  it('canChartOnOpponentTrail treats a squadmate\'s shared trail as own (no direct id match needed)', () => {
    const round = makeRound(['a', 'b', 'c', 'd'], { squadrons });
    // c is squadmates with a (shared trail keyed 'a'). Before the fix this
    // compared trailCaptainId ('a') === actingPlayerId ('c') directly and
    // always returned false for a non-owner squadmate.
    expect(
      canChartOnOpponentTrail(round, 'c', 'a', resolveHouseRules({ requireOwnTrailFirst: true }))
    ).toBe(true);
    // Genuinely opposing squad's trail still requires the house-rule check.
    expect(
      canChartOnOpponentTrail(round, 'c', 'b', resolveHouseRules({ requireOwnTrailFirst: true }))
    ).toBe(false);
  });

  it('allCaptainsHaveStartedTrails recognizes a squad trail as started for every member sharing it', () => {
    const base = makeRound(['a', 'b', 'c', 'd'], { squadrons });
    // Only squad-1's trailKey ('a') has tiles — squad-2 ('b') has none yet.
    const oneSquadStarted = {
      ...base,
      table: {
        ...base.table,
        warpTrails: {
          ...base.table.warpTrails,
          a: {
            playerId: 'a',
            tiles: [placed(T(6, 3), 0, 3)],
            distressBeacon: { active: false },
          },
        },
      },
    };
    // Before the fix, iterating turnOrder and indexing warpTrails[captainId]
    // directly meant 'c' (non-owner squadmate) always read 0 tiles even
    // though squad-1's shared trail has tiles — so this could never become
    // true once any squad had 2+ members, regardless of actual board state.
    expect(allCaptainsHaveStartedTrails(oneSquadStarted)).toBe(false); // squad-2 hasn't started

    const bothSquadsStarted = {
      ...oneSquadStarted,
      table: {
        ...oneSquadStarted.table,
        warpTrails: {
          ...oneSquadStarted.table.warpTrails,
          b: {
            playerId: 'b',
            tiles: [placed(T(6, 4), 0, 4)],
            distressBeacon: { active: false },
          },
        },
      },
    };
    // Every member of both squads now reads "started" via their shared trail.
    expect(allCaptainsHaveStartedTrails(bothSquadsStarted)).toBe(true);
  });
});
