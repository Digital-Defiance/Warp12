import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { createInitialTable } from '../table/table-state.js';
import type { SubspaceFractureScope } from '../types/subspace-fracture-scope.js';
import { resolveModules } from '../types/modules.js';

function chartDouble(
  scope: SubspaceFractureScope,
  setup: {
    playerId: string;
    route: import('../types/actions.js').ChartRoute;
    tablePatch: Partial<
      ReturnType<typeof createInitialTable> & {
        neutralZone: { tiles: ReturnType<typeof placed>[] };
      }
    >;
  }
) {
  const turnOrder = ['a', 'b'] as const;
  const state = makeGame(
    makeRound([...turnOrder], {
      activePlayerId: setup.playerId,
      hands: {
        a: setup.playerId === 'a' ? [T(5, 5)] : [],
        b: setup.playerId === 'b' ? [T(5, 5)] : [],
      },
      table: {
        ...createInitialTable([...turnOrder], 12, 'a'),
        ...setup.tablePatch,
        subspaceFracture: null,
        redAlert: null,
      },
    }),
    {
      modules: resolveModules({
        subspaceFracture: true,
        subspaceFractureScope: scope,
      }),
    }
  );

  return applyAction(state, {
    type: 'CHART_COORDINATE',
    playerId: setup.playerId,
    coordinate: T(5, 5),
    route: setup.route,
  });
}

describe('subspace fracture scope', () => {
  it('own-trail opens fracture only on the charting captain warp trail', () => {
    const ownTrail = chartDouble('own-trail', {
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [placed(T(5, 12), 0, 5)],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
      },
    });
    expect(ownTrail.ok).toBe(true);
    if (!ownTrail.ok) {
      return;
    }
    expect(ownTrail.state.round?.table.subspaceFracture?.active).toBe(true);
    expect(ownTrail.state.round?.table.subspaceFracture?.trailCaptainId).toBe(
      'a'
    );

    const opponentTrail = chartDouble('own-trail', {
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'b' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(5, 12), 0, 5)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    expect(opponentTrail.ok).toBe(true);
    if (!opponentTrail.ok) {
      return;
    }
    expect(opponentTrail.state.round?.table.subspaceFracture).toBeNull();
    expect(opponentTrail.state.round?.table.redAlert?.active).toBe(true);

    const neutralZone = chartDouble('own-trail', {
      playerId: 'a',
      route: { kind: 'neutral-zone' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [placed(T(5, 12), 0, 5)] },
      },
    });
    expect(neutralZone.ok).toBe(true);
    if (!neutralZone.ok) {
      return;
    }
    expect(neutralZone.state.round?.table.subspaceFracture).toBeNull();
    expect(neutralZone.state.round?.table.redAlert?.active).toBe(true);
  });

  it('all-captains opens fracture on any warp trail double', () => {
    const opponentTrail = chartDouble('all-captains', {
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'b' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [placed(T(5, 12), 0, 5)],
            distressBeacon: { active: true },
          },
        },
      },
    });
    expect(opponentTrail.ok).toBe(true);
    if (!opponentTrail.ok) {
      return;
    }
    expect(opponentTrail.state.round?.table.subspaceFracture?.active).toBe(
      true
    );
    expect(opponentTrail.state.round?.table.subspaceFracture?.trailCaptainId).toBe(
      'b'
    );

    const neutralZone = chartDouble('all-captains', {
      playerId: 'a',
      route: { kind: 'neutral-zone' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [placed(T(5, 12), 0, 5)] },
      },
    });
    expect(neutralZone.ok).toBe(true);
    if (!neutralZone.ok) {
      return;
    }
    expect(neutralZone.state.round?.table.subspaceFracture).toBeNull();
  });

  it('all-doubles opens fracture on warp trails and the neutral zone', () => {
    const neutralZone = chartDouble('all-doubles', {
      playerId: 'a',
      route: { kind: 'neutral-zone' },
      tablePatch: {
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [placed(T(5, 12), 0, 5)] },
      },
    });
    expect(neutralZone.ok).toBe(true);
    if (!neutralZone.ok) {
      return;
    }
    expect(neutralZone.state.round?.table.subspaceFracture?.active).toBe(true);
    expect(neutralZone.state.round?.table.subspaceFracture?.neutralZone).toBe(
      true
    );
  });
});
