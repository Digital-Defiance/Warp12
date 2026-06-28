import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';

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
    treatyDeclarationRequired: false,
    treatyDeclared: false,
    roundWinnerId: null,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
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
      subspaceFracture: { enabled: false },
    },
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
