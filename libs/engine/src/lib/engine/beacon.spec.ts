import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canRaiseShieldsByCharting,
  canRaiseShieldsManually,
  hasEstablishedWarpTrail,
} from './beacon.js';
import { getLegalMoves } from './legal-moves.js';
import {
  createLobbyState,
  dealRoundFromShuffled,
  createRoundStateFromDeal,
} from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import { resolveHouseRules } from '../types/house-rules.js';

const captains = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
];

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function roundWithHands(
  hands: Record<string, ReturnType<typeof normalizeCoordinate>[]>,
  extras: Record<string, unknown> = {}
) {
  const deal = dealRoundFromShuffled({
    shuffledCoordinates: shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(9)
    ),
    roundNumber: 1,
    captains: captains.map((captain) => ({ ...captain, pointsScore: 0 })),
    turnOrder: captains.map((captain) => captain.id),
  });

  return {
    ...createLobbyState({ id: 'beacon', captains }),
    phase: 'active' as const,
    round: {
      ...createRoundStateFromDeal(deal),
      activePlayerId: 'a',
      hands: {
        ...deal.hands,
        ...hands,
      },
      ...extras,
    },
  };
}

describe('distress beacon helpers', () => {
  it('detects an established warp trail', () => {
    const state = roundWithHands(
      { a: [normalizeCoordinate(1, 2)], b: [] },
      {
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                {
                  coordinate: normalizeCoordinate(6, 6),
                  index: 0,
                  openValue: 6,
                },
              ],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
          spacedock: { value: 6, placedBy: 'a' },
        },
        spacedockValue: 6,
      }
    );

    const round = state.round!;
    expect(hasEstablishedWarpTrail(round, 'a')).toBe(true);
    expect(hasEstablishedWarpTrail(round, 'b')).toBe(false);
  });

  it('does not allow voluntary beacon deploy while legal charts remain', () => {
    const state = roundWithHands(
      {
        a: [normalizeCoordinate(6, 7), normalizeCoordinate(1, 2)],
        b: [],
      },
      {
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                {
                  coordinate: normalizeCoordinate(6, 6),
                  index: 0,
                  openValue: 6,
                },
              ],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
          spacedock: { value: 6, placedBy: 'a' },
        },
        spacedockValue: 6,
      }
    );

    const round = state.round!;
    expect(getLegalMoves(round, 'a').length).toBeGreaterThan(0);
    expect(canDeployDistressBeacon(round, 'a')).toBe(false);
  });

  it('deploys the beacon and ends the turn when the drawn tile is unplayable and tiles remain', () => {
    const state = roundWithHands({ a: [normalizeCoordinate(1, 2)], b: [] }, {
      table: {
        warpTrails: {
          a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
        spacedock: { value: 6, placedBy: 'a' },
      },
      spacedockValue: 6,
      unchartedSectors: [normalizeCoordinate(3, 4), normalizeCoordinate(5, 7)],
    });

    const draw = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });

    expect(draw.ok).toBe(true);
    if (draw.ok) {
      // Standard Mexican Train: one failed draw drops shields (marker down),
      // even though Uncharted Sectors still holds tiles.
      expect(draw.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
      expect(draw.state.round?.activePlayerId).toBe('b');
    }
  });

  it('deploys a beacon when the drawn tile is unplayable and the pile is empty', () => {
    const state = roundWithHands({ a: [normalizeCoordinate(1, 2)], b: [] }, {
      table: {
        warpTrails: {
          a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
        spacedock: { value: 6, placedBy: 'a' },
      },
      spacedockValue: 6,
      unchartedSectors: [normalizeCoordinate(3, 4)],
    });

    const draw = applyAction(state, {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });

    expect(draw.ok).toBe(true);
    if (draw.ok) {
      expect(draw.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
        true
      );
    }
  });

  it('requires drawing before deploying when stuck and the pile is not empty', () => {
    const state = roundWithHands({ a: [normalizeCoordinate(1, 2)], b: [] }, {
      table: {
        warpTrails: {
          a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
        spacedock: { value: 6, placedBy: 'a' },
      },
      spacedockValue: 6,
      unchartedSectors: [normalizeCoordinate(3, 4)],
    });

    const round = state.round!;
    expect(getLegalMoves(round, 'a')).toHaveLength(0);
    expect(canDeployDistressBeacon(round, 'a')).toBe(false);

    const deploy = applyAction(state, {
      type: 'DEPLOY_DISTRESS_BEACON',
      playerId: 'a',
    });
    expect(deploy).toEqual({ ok: false, violation: 'MUST_DRAW_FIRST' });
  });

  it('does not offer another draw after already drawing while unable to chart', () => {
    const state = roundWithHands({ a: [normalizeCoordinate(1, 2)], b: [] }, {
      drewThisTurn: true,
      table: {
        warpTrails: {
          a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
          b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
        spacedock: { value: 6, placedBy: 'a' },
      },
      spacedockValue: 6,
      unchartedSectors: [normalizeCoordinate(3, 4)],
    });

    expect(canDrawFromUncharted(state.round!, 'a')).toBe(false);
  });

  it('raises shields by charting on your own warp trail', () => {
    let state = roundWithHands(
      {
        a: [normalizeCoordinate(6, 7)],
        b: [],
      },
      {
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                {
                  coordinate: normalizeCoordinate(6, 6),
                  index: 0,
                  openValue: 6,
                },
              ],
              distressBeacon: { active: true },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
          spacedock: { value: 6, placedBy: 'a' },
        },
        spacedockValue: 6,
      }
    );

    const round = state.round!;
    expect(canRaiseShieldsByCharting(round, 'a')).toBe(true);

    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: normalizeCoordinate(6, 7),
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(chart.ok).toBe(true);
    if (chart.ok) {
      expect(
        chart.state.round?.table.warpTrails.a.distressBeacon.active
      ).toBe(false);
    }
  });

  it('blocks passing red alert while a cover move exists', () => {
    const state = roundWithHands(
      { a: [normalizeCoordinate(6, 7)], b: [] },
      {
        table: {
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                {
                  coordinate: normalizeCoordinate(6, 6),
                  index: 0,
                  openValue: 6,
                },
              ],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: {
            active: true,
            anchor: {
              coordinate: normalizeCoordinate(6, 6),
              index: 0,
              openValue: 6,
            },
            responsiblePlayerId: 'a',
            trailPlayerId: 'a',
          },
          spacedock: { value: 6, placedBy: 'a' },
        },
        spacedockValue: 6,
        unchartedSectors: [],
      }
    );

    expect(canPassRedAlert(state.round!, 'a')).toBe(false);
    expect(
      applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' })
    ).toEqual({ ok: false, violation: 'RED_ALERT_COVER_AVAILABLE' });
  });

  it('allows passing red alert without drawing or beacon when house rule is on', () => {
    const state = {
      ...roundWithHands(
        { a: [normalizeCoordinate(1, 2)], b: [] },
        {
          table: {
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [
                  {
                    coordinate: normalizeCoordinate(6, 6),
                    index: 0,
                    openValue: 6,
                  },
                ],
                distressBeacon: { active: false },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: { tiles: [] },
            subspaceFracture: null,
            redAlert: {
              active: true,
              anchor: {
                coordinate: normalizeCoordinate(6, 6),
                index: 0,
                openValue: 6,
              },
              responsiblePlayerId: 'a',
              trailPlayerId: 'a',
            },
            spacedock: { value: 6, placedBy: 'a' },
          },
          spacedockValue: 6,
          unchartedSectors: [normalizeCoordinate(3, 4)],
        }
      ),
      houseRules: resolveHouseRules({ passRedAlertWithoutDraw: true }),
    };

    expect(
      canPassRedAlert(state.round!, 'a', { houseRules: state.houseRules })
    ).toBe(true);

    const pass = applyAction(state, { type: 'PASS_RED_ALERT', playerId: 'a' });
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    expect(pass.state.round?.table.redAlert?.responsiblePlayerId).toBe('b');
    expect(pass.state.round?.table.warpTrails.a.distressBeacon.active).toBe(
      false
    );
    expect(pass.state.round?.activePlayerId).toBe('b');
  });

  it('allows raising shields when manual shield control is enabled', () => {
    const state = {
      ...roundWithHands(
        { a: [normalizeCoordinate(6, 7)], b: [] },
        {
          table: {
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [
                  {
                    coordinate: normalizeCoordinate(6, 6),
                    index: 0,
                    openValue: 6,
                  },
                ],
                distressBeacon: { active: true, chartedOwnTrailSinceDown: true },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: { tiles: [] },
            subspaceFracture: null,
            redAlert: null,
            spacedock: { value: 6, placedBy: 'a' },
          },
          spacedockValue: 6,
        }
      ),
      houseRules: resolveHouseRules({ manualShieldControl: true }),
    };

    expect(
      canRaiseShieldsManually(state.round!, 'a', state.houseRules)
    ).toBe(true);
    expect(
      canRaiseShieldsByCharting(state.round!, 'a', state.houseRules)
    ).toBe(false);

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

  it('blocks raising shields before the own trail is started', () => {
    const state = {
      ...roundWithHands(
        { a: [normalizeCoordinate(6, 7)], b: [] },
        {
          table: {
            warpTrails: {
              a: {
                playerId: 'a',
                tiles: [],
                distressBeacon: { active: true },
              },
              b: {
                playerId: 'b',
                tiles: [],
                distressBeacon: { active: false },
              },
            },
            neutralZone: { tiles: [] },
            subspaceFracture: null,
            redAlert: null,
            spacedock: { value: 6, placedBy: 'a' },
          },
          spacedockValue: 6,
        }
      ),
      houseRules: resolveHouseRules({ manualShieldControl: true }),
    };

    expect(
      canRaiseShieldsManually(state.round!, 'a', state.houseRules)
    ).toBe(false);
  });
});
