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
    activePlayerId: 'troi',
    turnOrder: ['you', 'riker', 'troi', 'worf'],
    hands: {
      you: [],
      riker: [],
      troi: [tile(6, 6)],
      worf: [],
    },
    unchartedSectors: [],
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
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
        riker: {
          playerId: 'riker',
          tiles: [],
          distressBeacon: { active: false },
        },
        troi: {
          playerId: 'troi',
          tiles: [],
          distressBeacon: { active: false },
        },
        worf: {
          playerId: 'worf',
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
      { id: 'you', displayName: 'Picard', penaltyScore: 0 },
      { id: 'riker', displayName: 'Riker', penaltyScore: 0 },
      { id: 'troi', displayName: 'Troi', penaltyScore: 0 },
      { id: 'worf', displayName: 'Worf', penaltyScore: 0 },
    ],
    modules: {
      qContinuum: { enabled: false, activeFlash: null },
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
      playerId: 'troi',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert?.active).toBe(true);
    expect(result.state.round?.table.redAlert?.responsiblePlayerId).toBe(
      'troi'
    );
    expect(result.state.round?.table.redAlert?.trailPlayerId).toBe('you');
    expect(result.state.round?.activePlayerId).toBe('troi');
    expect(result.state.round?.table.warpTrails.you.tiles.at(-1)?.coordinate).toEqual(
      tile(6, 6)
    );
  });

  it('does not end the round when the last tile is an unsatisfied double', () => {
    const state = game(
      baseRound({
        activePlayerId: 'troi',
        hands: {
          you: [],
          riker: [],
          troi: [tile(6, 6)],
          worf: [],
        },
      })
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'troi',
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
    expect(result.state.round?.activePlayerId).toBe('troi');
  });

  it('requires the responsible captain to cover before other routes unlock', () => {
    let state = game(
      baseRound({
        hands: {
          you: [tile(6, 5)],
          riker: [],
          troi: [tile(6, 6), tile(6, 5)],
          worf: [],
        },
      })
    );

    const playDouble = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'troi',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });
    expect(playDouble.ok).toBe(true);
    if (!playDouble.ok) {
      return;
    }
    state = playDouble.state;

    expect(getLegalMoves(state.round!, 'troi')).toEqual([
      {
        coordinate: tile(6, 5),
        route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
      },
    ]);
    expect(getLegalMoves(state.round!, 'worf')).toEqual([]);

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'troi',
      coordinate: tile(6, 5),
      route: { kind: 'red-alert-cover', trailPlayerId: 'you' },
    });
    expect(cover.ok).toBe(true);
    if (!cover.ok) {
      return;
    }

    expect(cover.state.round?.table.redAlert).toBeNull();
    expect(cover.state.round?.hands.troi).toHaveLength(0);
    expect(cover.state.round?.roundWinnerId).toBe('troi');
  });

  it('opens Red Alert for doubles charted on the Neutral Zone', () => {
    const state = game(
      baseRound({
        activePlayerId: 'troi',
        hands: {
          you: [],
          riker: [],
          troi: [tile(4, 4)],
          worf: [],
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
      playerId: 'troi',
      coordinate: tile(4, 4),
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert?.neutralZone).toBe(true);
    expect(result.state.round?.activePlayerId).toBe('troi');
  });

  it('does not clear an opponent Distress Beacon when covering their double', () => {
    let state = game(
      baseRound({
        hands: {
          you: [],
          riker: [],
          troi: [tile(6, 6), tile(6, 5)],
          worf: [],
        },
      })
    );

    const playDouble = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'troi',
      coordinate: tile(6, 6),
      route: { kind: 'warp-trail', playerId: 'you' },
    });
    expect(playDouble.ok).toBe(true);
    if (!playDouble.ok) return;
    state = playDouble.state;
    expect(state.round?.table.warpTrails.you.distressBeacon.active).toBe(true);

    const cover = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'troi',
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
      captains: [{ id: 'laforge', displayName: 'La Forge', penaltyScore: 0 }],
      objective: 'go-out',
      campaignRounds: 13,
      modules: { salamanderPenalty: { enabled: true }, qContinuum: { enabled: false, activeFlash: null }, subspaceFracture: { enabled: true, scope: 'own-trail' } },
      houseRules: resolveHouseRules(),
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'playing',
        activePlayerId: 'laforge',
        turnOrder: ['laforge'],
        hands: {
          laforge: [tile(2, 9)],
        },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        qPendingInvoker: null,
        qEffects: null,
        qGamblePending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        table: {
          spacedock: { value: 12, placedBy: 'laforge' },
          warpTrails: {
            laforge: {
              playerId: 'laforge',
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
            responsiblePlayerId: 'laforge',
            trailPlayerId: 'laforge',
          },
        },
      },
    };

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'laforge',
      coordinate: tile(2, 9),
      route: { kind: 'fracture-stabilizer' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.subspaceFracture?.active).toBe(false);
    expect(result.state.round?.table.subspaceFracture?.stabilizers).toHaveLength(0);
    expect(result.state.round?.table.warpTrails.laforge.tiles).toHaveLength(5);
    expect(result.state.round?.table.redAlert).toBeNull();
    expect(getLegalMoves(result.state.round!, 'laforge')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: { kind: 'red-alert-cover' } }),
      ])
    );
  });

  it('does not allow a separate red-alert cover after the fracture is satisfied', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const resolved = makeGame(
      makeRound(['laforge', 'uhura'], {
        activePlayerId: 'uhura',
        hands: { laforge: [], uhura: [T(8, 9)] },
        table: {
          ...createInitialTable(['laforge', 'uhura'], 12, 'laforge'),
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: false },
            },
            uhura: {
              playerId: 'uhura',
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
      playerId: 'uhura',
      coordinate: T(8, 9),
      route: { kind: 'red-alert-cover', trailPlayerId: 'laforge' },
    });

    expect(cover).toEqual({ ok: false, violation: 'INVALID_ROUTE' });
  });

  it('clears red alert when a passed captain places the third stabilizer', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const state = makeGame(
      makeRound(['laforge', 'uhura'], {
        activePlayerId: 'uhura',
        hands: { laforge: [], uhura: [T(2, 9)] },
        table: {
          ...createInitialTable(['laforge', 'uhura'], 12, 'laforge'),
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: true },
            },
            uhura: {
              playerId: 'uhura',
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
            responsiblePlayerId: 'uhura',
            trailPlayerId: 'laforge',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'uhura',
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
    expect(result.state.round?.table.warpTrails.laforge.tiles).toHaveLength(5);
  });

  it('advances turn after the third stabilizer when red alert is cleared', () => {
    const anchor = placed(T(9, 9), 1, 9);
    const state = makeGame(
      makeRound(['laforge', 'uhura'], {
        activePlayerId: 'laforge',
        hands: { laforge: [T(2, 9), T(0, 1)], uhura: [] },
        table: {
          ...createInitialTable(['laforge', 'uhura'], 12, 'laforge'),
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [placed(T(9, 12), 0, 9), anchor],
              distressBeacon: { active: false },
            },
            uhura: {
              playerId: 'uhura',
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
            responsiblePlayerId: 'laforge',
            trailPlayerId: 'laforge',
          },
        },
      }),
      { modules: resolveModules({ subspaceFracture: true }) }
    );

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'laforge',
      coordinate: T(2, 9),
      route: { kind: 'fracture-stabilizer' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.round?.table.redAlert).toBeNull();
    expect(result.state.round?.activePlayerId).toBe('uhura');
  });
});
