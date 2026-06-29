import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { createInitialTable } from '../table/table-state.js';
import { resolveModules } from '../types/modules.js';
import { isNavigationHaltedByFracture } from '../types/anomalies.js';

const modules = resolveModules({
  subspaceFracture: true,
  subspaceFractureScope: 'all-doubles',
});

function resolvedLaForgeFracture() {
  const anchor = placed(T(3, 3), 1, 3);
  return {
    active: false,
    anchor,
    stabilizers: [
      placed(T(3, 6), 0, 3),
      placed(T(0, 3), 1, 3),
      placed(T(3, 5), 2, 3),
    ],
    requiredValue: 3,
    trailCaptainId: 'laforge',
  };
}

describe('subspace fracture lifecycle', () => {
  it('opens a fresh fracture with zero stabilizers after a previous fracture resolved', () => {
    const state = makeGame(
      makeRound(['crusher', 'worf'], {
        activePlayerId: 'crusher',
        hands: { crusher: [T(11, 11)], worf: [] },
        table: {
          ...createInitialTable(['crusher', 'worf'], 12, 'crusher'),
          neutralZone: { tiles: [placed(T(11, 12), 0, 11)] },
          subspaceFracture: resolvedLaForgeFracture(),
          redAlert: null,
        },
      }),
      { modules }
    );

    const opened = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'crusher',
      coordinate: T(11, 11),
      route: { kind: 'neutral-zone' },
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const fracture = opened.state.round?.table.subspaceFracture;
    expect(fracture?.active).toBe(true);
    expect(fracture?.neutralZone).toBe(true);
    expect(fracture?.stabilizers).toHaveLength(0);
    expect(fracture?.requiredValue).toBe(11);
    expect(
      isNavigationHaltedByFracture(
        fracture ?? null,
        opened.state.round?.table.redAlert ?? null
      )
    ).toBe(true);
  });

  it('preserves resolved stabilizer tiles when a new fracture opens', () => {
    const anchor = placed(T(5, 5), 0, 5);
    const round = makeRound(['a', 'b'], {
      hands: { a: [T(11, 11)], b: [] },
      unchartedSectors: [],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        neutralZone: { tiles: [placed(T(11, 12), 0, 11)] },
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [anchor],
            distressBeacon: { active: false },
          },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        subspaceFracture: {
          active: false,
          anchor,
          stabilizers: [
            placed(T(5, 3), 0, 5),
            placed(T(0, 5), 1, 5),
            placed(T(5, 1), 2, 5),
          ],
          requiredValue: 5,
          trailCaptainId: 'a',
        },
      },
    });

    const beforeTiles =
      round.unchartedSectors.length +
      (round.hands.a?.length ?? 0) +
      round.table.warpTrails.a.tiles.length +
      round.table.neutralZone.tiles.length +
      (round.table.subspaceFracture?.stabilizers.length ?? 0) +
      1;

    const state = makeGame(round, { modules });
    const opened = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(11, 11),
      route: { kind: 'neutral-zone' },
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const after = opened.state.round!;
    const afterTiles =
      after.unchartedSectors.length +
      (after.hands.a?.length ?? 0) +
      after.table.warpTrails.a.tiles.length +
      after.table.neutralZone.tiles.length +
      (after.table.subspaceFracture?.stabilizers.length ?? 0) +
      1;

    expect(afterTiles).toBe(beforeTiles);
    expect(after.table.warpTrails.a.tiles).toHaveLength(4);
    expect(after.table.subspaceFracture?.stabilizers).toHaveLength(0);
  });

  it('rejects red-alert cover while a neutral zone fracture is open', () => {
    let state = makeGame(
      makeRound(['crusher', 'worf'], {
        activePlayerId: 'crusher',
        hands: { crusher: [T(11, 11), T(3, 11)], worf: [] },
        table: {
          ...createInitialTable(['crusher', 'worf'], 12, 'crusher'),
          neutralZone: { tiles: [placed(T(11, 12), 0, 11)] },
          subspaceFracture: null,
          redAlert: null,
        },
      }),
      { modules }
    );

    const opened = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'crusher',
      coordinate: T(11, 11),
      route: { kind: 'neutral-zone' },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }
    state = opened.state;

    const moves = getLegalMoves(state.round!, 'crusher');
    expect(moves.every((move) => move.route.kind === 'fracture-stabilizer')).toBe(
      true
    );
    expect(moves.some((move) => move.route.kind === 'red-alert-cover')).toBe(
      false
    );

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'crusher',
      coordinate: T(3, 11),
      route: { kind: 'red-alert-cover', neutralZone: true },
    });
    expect(cover).toEqual({ ok: false, violation: 'FRACTURE_REQUIRES_STABILIZER' });
  });

  it('blocks cover on corrupt fracture state inherited from a resolved fracture', () => {
    const anchor = placed(T(11, 11), 1, 11);
    const corrupt = makeGame(
      makeRound(['crusher', 'worf'], {
        activePlayerId: 'crusher',
        hands: { crusher: [T(3, 11)], worf: [] },
        table: {
          ...createInitialTable(['crusher', 'worf'], 12, 'crusher'),
          neutralZone: {
            tiles: [placed(T(11, 12), 0, 11), anchor],
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: resolvedLaForgeFracture().stabilizers,
            requiredValue: 11,
            neutralZone: true,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'crusher',
            trailPlayerId: '',
            neutralZone: true,
          },
        },
      }),
      { modules }
    );

    expect(
      isNavigationHaltedByFracture(
        corrupt.round!.table.subspaceFracture,
        corrupt.round!.table.redAlert
      )
    ).toBe(true);

    const cover = applyAction(corrupt, {
      type: 'CHART_COORDINATE',
      playerId: 'crusher',
      coordinate: T(3, 11),
      route: { kind: 'red-alert-cover', neutralZone: true },
    });
    expect(cover).toEqual({ ok: false, violation: 'FRACTURE_REQUIRES_STABILIZER' });
  });

  it('allows red-alert cover on a later double when the previous fracture is fully resolved', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [T(1, 10)], b: [] },
        table: {
          ...createInitialTable(['a', 'b'], 12, 'a'),
          neutralZone: {
            tiles: [placed(T(1, 12), 0, 1), placed(T(1, 1), 1, 1)],
          },
          subspaceFracture: resolvedLaForgeFracture(),
          redAlert: {
            active: true,
            anchor: placed(T(1, 1), 1, 1),
            responsiblePlayerId: 'a',
            trailPlayerId: '',
            neutralZone: true,
          },
        },
      }),
      {
        modules: resolveModules({
          subspaceFracture: true,
          subspaceFractureScope: 'own-trail',
        }),
      }
    );

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(1, 10),
      route: { kind: 'red-alert-cover', neutralZone: true },
    });

    expect(cover.ok).toBe(true);
    if (!cover.ok) {
      return;
    }
    expect(cover.state.round?.table.redAlert).toBeNull();
  });
});
