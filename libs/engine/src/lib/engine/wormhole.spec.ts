import { describe, it, expect } from 'vitest';
import {  createLobbyState, dealRoundFromShuffled, createRoundStateFromDeal } from '../setup/create-game.js';
import { applyAction } from './apply-action.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import type { GameState } from '../types/game-state.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const captains = [
  { id: 'alice', displayName: 'Alice' },
  { id: 'bob', displayName: 'Bob' },
];

function testState(wormholes = true): GameState {
  const deal = dealRoundFromShuffled({
    shuffledCoordinates: shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(42)
    ),
    roundNumber: 1,
    captains: captains.map((c) => ({ ...c, pointsScore: 0 })),
    turnOrder: ['alice', 'bob'],
  });

  return {
    ...createLobbyState({ id: 'wormhole-test', captains, modules: { wormholes } }),
    phase: 'active' as const,
    round: {
      ...createRoundStateFromDeal(deal),
      activePlayerId: 'alice',
    },
  };
}

describe('Module Lambda: Wormholes', () => {
  it('swaps captain trail with neutral zone when double played on NZ', () => {
    let state = testState(true);
    const round = state.round!;

    // Set up alice with a trail and a double for NZ
    state = {
      ...state,
      round: {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            alice: {
              tiles: [
                { coordinate: normalizeCoordinate(12, 5), index: 0, connectingValue: 12 },
              ],
              distressBeacon: { active: false, chartedOwnTrailSinceDown: false },
            },
          },
        },
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(12, 12)], // double with 12 to match spacedock
        },
      },
    };

    const trailBefore = state.round!.table.warpTrails.alice!.tiles;
    expect(trailBefore.length).toBe(1);
    expect(trailBefore[0]?.coordinate).toEqual(normalizeCoordinate(12, 5));

    // Alice plays double on NZ (triggers wormhole)
    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(12, 12),
      route: { kind: 'neutral-zone' },
    });
    if (!result.ok) {
      console.log('Failed with violation:', result.violation);
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // Verify swap occurred
    const trailAfter = state.round!.table.warpTrails.alice!.tiles;
    const nzAfter = state.round!.table.neutralZone.tiles;

    // Alice now has the double (was on NZ)
    expect(trailAfter.length).toBe(1);
    expect(trailAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 12));

    // NZ now has alice's old trail
    expect(nzAfter.length).toBe(1);
    expect(nzAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 5));
  });

  it('triggers red alert on newly acquired trail after swap', () => {
    let state = testState(true);
    const round = state.round!;

    state = {
      ...state,
      round: {
        ...round,
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(12, 12)],
        },
      },
    };

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(12, 12),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // Red alert should be active on alice's trail
    expect(state.round!.table.redAlert).toBeTruthy();
    expect(state.round!.table.redAlert?.active).toBe(true);
    expect(state.round!.table.redAlert?.trailPlayerId).toBe('alice');
  });

  it('destroys distress beacon during wormhole transit', () => {
    let state = testState(true);
    const round = state.round!;

    // Alice has trail with active beacon
    state = {
      ...state,
      round: {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            alice: {
              tiles: [
                { coordinate: normalizeCoordinate(12, 5), index: 0, connectingValue: 12 },
              ],
              distressBeacon: { active: true, chartedOwnTrailSinceDown: false },
            },
          },
        },
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(12, 12)], // double matching spacedock
        },
      },
    };

    // Verify beacon is active before
    expect(state.round!.table.warpTrails.alice?.distressBeacon.active).toBe(true);

    // Wormhole
    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(12, 12),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // Beacon destroyed
    expect(state.round!.table.warpTrails.alice?.distressBeacon.active).toBe(false);
  });

  it('does not trigger wormhole when module disabled', () => {
    let state = testState(false); // wormholes disabled
    const round = state.round!;

    state = {
      ...state,
      round: {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            alice: {
              tiles: [
                { coordinate: normalizeCoordinate(12, 5), index: 0, connectingValue: 12 },
              ],
              distressBeacon: { active: false, chartedOwnTrailSinceDown: false },
            },
          },
        },
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(12, 12)], // double matching spacedock
        },
      },
    };

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(12, 12),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // No swap - alice's trail unchanged
    const trailAfter = state.round!.table.warpTrails.alice!.tiles;
    const nzAfter = state.round!.table.neutralZone.tiles;

    expect(trailAfter.length).toBe(1);
    expect(trailAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 5));
    expect(nzAfter.length).toBe(1);
    expect(nzAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 12));
  });

  it('only triggers wormhole on doubles, not regular tiles', () => {
    let state = testState(true);
    const round = state.round!;

    state = {
      ...state,
      round: {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            alice: {
              tiles: [
                { coordinate: normalizeCoordinate(12, 5), index: 0, connectingValue: 12 },
              ],
              distressBeacon: { active: false, chartedOwnTrailSinceDown: false },
            },
          },
        },
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(12, 11)], // NOT a double
        },
      },
    };

    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(12, 11),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // No swap
    const trailAfter = state.round!.table.warpTrails.alice!.tiles;
    const nzAfter = state.round!.table.neutralZone.tiles;

    expect(trailAfter.length).toBe(1);
    expect(trailAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 5));
    expect(nzAfter.length).toBe(1);
    expect(nzAfter[0]?.coordinate).toEqual(normalizeCoordinate(12, 11));
  });

  it('hostile takeover - stealing built neutral zone', () => {
    let state = testState(true);
    const round = state.round!;

    // NZ has a nice long trail built
    state = {
      ...state,
      round: {
        ...round,
        table: {
          ...round.table,
          neutralZone: {
            tiles: [
              { coordinate: normalizeCoordinate(12, 11), index: 0, connectingValue: 12, openValue: 11 },
              { coordinate: normalizeCoordinate(11, 10), index: 1, connectingValue: 11, openValue: 10 },
              { coordinate: normalizeCoordinate(10, 9), index: 2, connectingValue: 10, openValue: 9 },
            ],
          },
        },
        hands: {
          ...round.hands,
          alice: [normalizeCoordinate(9, 9)], // double to steal
        },
      },
    };

    const nzBefore = state.round!.table.neutralZone.tiles;
    expect(nzBefore.length).toBe(3);

    // Alice steals it
    const result = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'alice',
      coordinate: normalizeCoordinate(9, 9),
      route: { kind: 'neutral-zone' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    // Alice now owns the long trail (plus her double)
    const aliceTrail = state.round!.table.warpTrails.alice!.tiles;
    // After wormhole: alice gets NZ (3 tiles) + the double she played (1) = 4 tiles
    expect(aliceTrail.length).toBe(4);

    // NZ is now empty (alice had no trail before)
    const nzAfter = state.round!.table.neutralZone.tiles;
    expect(nzAfter.length).toBe(0);
  });
});
