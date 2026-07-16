import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { createInitialTable } from '../table/table-state.js';
import { resolveHouseRules } from '../types/house-rules.js';
import { resolveModules } from '../types/modules.js';

function tile(low: number, high: number) {
  return normalizeCoordinate(low, high);
}

function baseRound(overrides: Partial<RoundState> = {}): RoundState {
  return {
    roundNumber: 1,
    spacedockValue: 12,
    phase: 'playing',
    activePlayerId: 'earhart',
    turnOrder: ['you', 'lovell', 'earhart', 'yeager'],
    hands: {
      you: [],
      lovell: [],
      earhart: [tile(6, 6)],
      yeager: [],
    },
    unchartedSectors: [],
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    continuumPendingInvoker: null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    roundStarterOpeningResolved: false,
    table: {
      spacedock: { value: 12, placedBy: 'you' },
      warpTrails: {
        you: {
          playerId: 'you',
          tiles: [
            {
              coordinate: tile(6, 7),
              index: 0,
              openValue: 6,
            },
          ],
          distressBeacon: { active: true },
        },
        lovell: {
          playerId: 'lovell',
          tiles: [],
          distressBeacon: { active: false },
        },
        earhart: {
          playerId: 'earhart',
          tiles: [],
          distressBeacon: { active: false },
        },
        yeager: {
          playerId: 'yeager',
          tiles: [],
          distressBeacon: { active: false },
        },
      },
      neutralZone: { tiles: [] },
      subspaceFracture: null,
      redAlert: null,
    },
    ...overrides,
  };
}

function game(round: RoundState): GameState {
  return {
    id: 'test',
    phase: 'active',
    objective: 'go-out',
    completedRounds: 0,
    captains: [
      { id: 'you', displayName: 'Armstrong', pointsScore: 0 },
      { id: 'lovell', displayName: 'Lovell', pointsScore: 0 },
      { id: 'earhart', displayName: 'Earhart', pointsScore: 0 },
      { id: 'yeager', displayName: 'Yeager', pointsScore: 0 },
    ],
    modules: {
      continuum: { enabled: false, activeFlash: null },
      salamanderPenalty: { enabled: false },
      subspaceFracture: { enabled: false, scope: 'own-trail' },
    },
    houseRules: resolveHouseRules(),
    campaignRounds: 13,
    round,
  };
}

describe('Red Alert on any legal double', () => {
  it('opens Red Alert when charting a double on an open opponent trail', () => {
    const state = game(baseRound());

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert?.active).toBe(true);
    expect(result.state.round?.table.redAlert?.responsiblePlayerId).toBe(
      'earhart'
    );
    expect(result.state.round?.table.redAlert?.trailPlayerId).toBe('you');
    expect(result.state.round?.activePlayerId).toBe('earhart');
    expect(result.state.round?.table.warpTrails.you.tiles.at(-1)?.coordinate).toEqual(
      tile(6, 6)
    );
  });

  it('does not end the round when the last tile is an unsatisfied double', () => {
    const state = game(
      baseRound({
        activePlayerId: 'earhart',
        hands: {
          you: [],
          lovell: [],
          earhart: [tile(6, 6)],
          yeager: [],
        },
      })
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.roundWinnerId).toBeNull();
    expect(result.state.round?.phase).toBe('playing');
    expect(result.state.round?.table.redAlert?.active).toBe(true);
    expect(result.state.round?.activePlayerId).toBe('earhart');
  });

  it('requires the responsible captain to cover before other routes unlock', () => {
    let state = game(
      baseRound({
        hands: {
          you: [tile(6, 5)],
          lovell: [],
          earhart: [tile(6, 6), tile(6, 5)],
          yeager: [],
        },
      })
    );

    const playDouble = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });
    expect(playDouble.ok).toBe(true);
    if (!playDouble.ok) {
      return;
    }
    state = playDouble.state;

    expect(getLegalMoves(state.round!, 'earhart')).toEqual([
      {
        coordinate: tile(6, 5),
        route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
      },
    ]);
    expect(getLegalMoves(state.round!, 'yeager')).toEqual([]);

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 5),
      route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
    });
    expect(cover.ok).toBe(true);
    if (!cover.ok) {
      return;
    }

    expect(cover.state.round?.table.redAlert).toBeNull();
    expect(cover.state.round?.hands.earhart).toHaveLength(0);
    expect(cover.state.round?.roundWinnerId).toBe('earhart');
  });

  it('opens Red Alert for doubles charted on the Neutral Zone', () => {
    const state = game(
      baseRound({
        activePlayerId: 'earhart',
        hands: {
          you: [],
          lovell: [],
          earhart: [tile(4, 4)],
          yeager: [],
        },
        table: {
          ...baseRound().table,
          neutralZone: {
            tiles: [
              {
                coordinate: tile(4, 12),
                index: 0,
                openValue: 4,
              },
            ],
          },
        },
      })
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(4, 4),
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert?.neutralZone).toBe(true);
    expect(result.state.round?.activePlayerId).toBe('earhart');
  });

  it('does not clear an opponent Distress Beacon when covering their double', () => {
    let state = game(
      baseRound({
        hands: {
          you: [],
          lovell: [],
          earhart: [tile(6, 6), tile(6, 5)],
          yeager: [],
        },
      })
    );

    const playDouble = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });
    expect(playDouble.ok).toBe(true);
    if (!playDouble.ok) return;
    state = playDouble.state;
    expect(state.round?.table.warpTrails.you.distressBeacon.active).toBe(true);

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'earhart',
      coordinate: tile(6, 5),
      route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
    });
    expect(cover.ok).toBe(true);
    if (!cover.ok) return;

    expect(cover.state.round?.table.warpTrails.you.distressBeacon.active).toBe(
      true
    );
    expect(cover.state.round?.table.redAlert).toBeNull();
  });
});

describe('subspace fracture and red alert', () => {
  it('clears red alert when the third stabilizer satisfies the fracture double', () => {
    const anchor = {
      coordinate: tile(9, 9),
      index: 1,
      openValue: 9,
    };
    const state: GameState = {
      id: 'fracture-red-alert',
      phase: 'active',
      captains: [{ id: 'glenn', displayName: 'La Forge', pointsScore: 0 }],
      objective: 'go-out',
      campaignRounds: 13,
      modules: { salamanderPenalty: { enabled: true }, continuum: { enabled: false, activeFlash: null }, subspaceFracture: { enabled: true, scope: 'own-trail' } },
      houseRules: resolveHouseRules(),
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'playing',
        activePlayerId: 'glenn',
        turnOrder: ['glenn'],
        hands: {
          glenn: [tile(2, 9)],
        },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        roundStarterOpeningResolved: false,
        table: {
          spacedock: { value: 12, placedBy: 'glenn' },
          warpTrails: {
            glenn: {
              playerId: 'glenn',
              tiles: [
                {
                  coordinate: tile(9, 12),
                  index: 0,
                  openValue: 9,
                },
                anchor,
              ],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [
              {
                coordinate: tile(4, 9),
                index: 0,
                openValue: 4,
              },
              {
                coordinate: tile(1, 9),
                index: 1,
                openValue: 1,
              },
            ],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'glenn',
            trailPlayerId: 'glenn',
          },
        },
      },
    };

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'glenn',
      coordinate: tile(2, 9),
      route: { kind: 'fracture-stabilizer' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.subspaceFracture?.active).toBe(false);
    expect(result.state.round?.table.subspaceFracture?.stabilizers).toHaveLength(0);
    expect(result.state.round?.table.warpTrails.glenn.tiles).toHaveLength(5);
    expect(result.state.round?.table.redAlert).toBeNull();
    expect(getLegalMoves(result.state.round!, 'glenn')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: { kind: 'red-alert-cover' } }),
      ])
    );
  });

  it('does not allow a separate red-alert cover after the fracture is satisfied', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const resolved = makeGame(
      makeRound(['glenn', 'collins'], {
        activePlayerId: 'collins',
        hands: { glenn: [], collins: [T(8, 9)] },
        table: {
          ...createInitialTable(['glenn', 'collins'], 12, 'glenn'),
          warpTrails: {
            glenn: {
              playerId: 'glenn',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: false },
            },
            collins: {
              playerId: 'collins',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          subspaceFracture: {
            active: false,
            anchor,
            stabilizers: [
              placed(T(4, 9), 0, 9),
              placed(T(1, 9), 1, 9),
              placed(T(2, 9), 2, 9),
            ],
            requiredValue: 9,
          },
          redAlert: null,
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const cover = applyAction(resolved, {
      type: 'CHART_COORDINATE',
      playerId: 'collins',
      coordinate: T(8, 9),
      route: { kind: 'red-alert-cover', trailPlayerId: 'glenn' },
    });

    expect(cover).toEqual({ ok: false, violation: 'INVALID_ROUTE' });
  });

  it('clears red alert when a passed captain places the third stabilizer', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const state = makeGame(
      makeRound(['glenn', 'collins'], {
        activePlayerId: 'collins',
        hands: { glenn: [], collins: [T(2, 9)] },
        table: {
          ...createInitialTable(['glenn', 'collins'], 12, 'glenn'),
          warpTrails: {
            glenn: {
              playerId: 'glenn',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: true },
            },
            collins: {
              playerId: 'collins',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [placed(T(4, 9), 0, 9), placed(T(1, 9), 1, 9)],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'collins',
            trailPlayerId: 'glenn',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'collins',
      coordinate: T(2, 9),
      route: { kind: 'fracture-stabilizer' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert).toBeNull();
    expect(result.state.round?.table.subspaceFracture?.active).toBe(false);
    expect(result.state.round?.table.subspaceFracture?.stabilizers).toHaveLength(0);
    expect(result.state.round?.table.warpTrails.glenn.tiles).toHaveLength(5);
  });

  it('advances turn after the third stabilizer when red alert is cleared', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const state = makeGame(
      makeRound(['glenn', 'collins'], {
        activePlayerId: 'glenn',
        hands: { glenn: [T(2, 9), T(0, 1)], collins: [] },
        table: {
          ...createInitialTable(['glenn', 'collins'], 12, 'glenn'),
          warpTrails: {
            glenn: {
              playerId: 'glenn',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: false },
            },
            collins: {
              playerId: 'collins',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [placed(T(4, 9), 0, 9), placed(T(1, 9), 1, 9)],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'glenn',
            trailPlayerId: 'glenn',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'glenn',
      coordinate: T(2, 9),
      route: { kind: 'fracture-stabilizer' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert).toBeNull();
    expect(result.state.round?.activePlayerId).toBe('collins');
  });
});
