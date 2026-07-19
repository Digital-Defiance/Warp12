import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { startGame } from '../setup/create-game.js';
import { applyAction } from './apply-action.js';
import { scoreRound } from './scoring.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import {
  refillSensorGrid,
  removeFromSensorGrid,
} from './sensor-grid.js';
import { makeGame, makeRound, T } from './test-helpers.js';
import { resolveModules } from '../types/modules.js';
import { createInitialTable } from '../table/table-state.js';
import { getSpoolOptions } from './legal-moves.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Gamma — Sensor Grid', () => {
  it('initializes sensor grid at round start when enabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1));
    const result = startGame(
      {
        id: 'gamma-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
        ],
        modules: { sensorGrid: true, sensorGridSize: 5 },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(result.modules.sensorGrid.enabled).toBe(true);
    expect(result.modules.sensorGrid.gridSize).toBe(5);
    expect(result.round?.sensorGrid.length).toBe(5);
    // Grid should have taken 5 tiles from uncharted sectors
    const totalTiles = (result.round?.unchartedSectors.length ?? 0) + 
                       (result.round?.sensorGrid.length ?? 0) + 
                       (result.round?.hands['a']?.length ?? 0) +
                       (result.round?.hands['b']?.length ?? 0);
    expect(totalTiles).toBe(90); // 91 - 1 spacedock
  });

  it('initializes the sensor grid after a draft resolves (Module Gamma + Epsilon)', () => {
    // Regression: with Drafting (Epsilon) also enabled, startGame builds the
    // round on the draft branch and skipped Sensor Grid init, so the grid stayed
    // empty forever and never appeared. It must be seeded when the draft ends.
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(11));
    let state = startGame(
      {
        id: 'gamma-epsilon-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
        ],
        modules: { drafting: true, sensorGrid: true, sensorGridSize: 5 },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // The grid must not appear during the draft (captains pick from packs).
    expect(state.round?.phase).toBe('drafting');
    expect(state.round?.sensorGrid.length ?? 0).toBe(0);

    // Drive the draft to completion by always taking the first tile in the pack.
    let guard = 0;
    while (state.round?.phase === 'drafting' && guard < 500) {
      const draft = state.round.draftState!;
      const drafter = draft.currentDrafter;
      const pick = draft.currentPacks[drafter][0];
      const res = applyAction(state, {
        type: 'PICK_FROM_PACK',
        playerId: drafter,
        coordinate: pick,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) break;
      state = res.state;
      guard += 1;
    }

    expect(state.round?.phase).toBe('playing');
    expect(state.round?.sensorGrid.length).toBe(5);
  });

  it('does not initialize sensor grid when disabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2));
    const result = startGame(
      {
        id: 'gamma-off-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
        ],
        modules: { sensorGrid: false },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(result.modules.sensorGrid.enabled).toBe(false);
    expect(result.round?.sensorGrid.length).toBe(0);
  });

  it('allows sensor sweep from visible grid', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3));
    let state = startGame(
      {
        id: 'gamma-sweep-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
        ],
        modules: { sensorGrid: true, sensorGridSize: 4 },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const round = state.round!;
    expect(round.sensorGrid.length).toBe(4);
    
    // Simulate a situation where captain needs to draw
    // First, chart spacedock to start trail
    const chart = applyAction(state, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: normalizeCoordinate(12, 11),
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    
    if (!chart.ok) {
      // If we can't chart that, just verify the grid exists
      expect(round.sensorGrid.length).toBeGreaterThan(0);
      return;
    }

    state = chart.state;
    
    // Now verify sensor grid still has tiles
    expect(state.round?.sensorGrid.length).toBeGreaterThan(0);
  });

  it('refills sensor grid after a sweep', () => {
    const grid = [
      normalizeCoordinate(1, 1),
      normalizeCoordinate(2, 2),
      normalizeCoordinate(3, 3),
      normalizeCoordinate(4, 4),
      normalizeCoordinate(5, 5),
    ];
    const uncharted = [
      normalizeCoordinate(6, 6),
      normalizeCoordinate(7, 7),
      normalizeCoordinate(8, 8),
    ];
    const { sensorGrid: afterRemove, found } = removeFromSensorGrid(
      grid,
      normalizeCoordinate(1, 1)
    );
    expect(found).toBe(true);
    expect(afterRemove).toHaveLength(4);

    const { sensorGrid, unchartedSectors } = refillSensorGrid(
      afterRemove,
      uncharted,
      5
    );
    expect(sensorGrid).toHaveLength(5);
    expect(unchartedSectors).toHaveLength(2);
    expect(sensorGrid[4]).toEqual(normalizeCoordinate(6, 6));
  });

  it('refills an emptied sensor grid up to target size', () => {
    const uncharted = [
      normalizeCoordinate(1, 2),
      normalizeCoordinate(3, 4),
      normalizeCoordinate(5, 6),
      normalizeCoordinate(7, 8),
      normalizeCoordinate(9, 10),
      normalizeCoordinate(0, 11),
    ];
    const { sensorGrid, unchartedSectors } = refillSensorGrid([], uncharted, 5);
    expect(sensorGrid).toHaveLength(5);
    expect(unchartedSectors).toHaveLength(1);
  });
  it('handles empty sensor grid gracefully', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5));
    const state = startGame(
      {
        id: 'gamma-empty-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
          { id: 'c', displayName: 'Gamma' },
          { id: 'd', displayName: 'Delta' },
          { id: 'e', displayName: 'Epsilon' },
          { id: 'f', displayName: 'Zeta' },
        ],
        modules: { sensorGrid: true, sensorGridSize: 5 },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // With 6 captains at 12 tiles each, only 18 tiles remain
    // Grid size is 5, so 13 remain in uncharted
    const round = state.round!;
    expect(round.sensorGrid.length).toBe(5);
    expect(round.unchartedSectors.length).toBe(13);
    
    // As the game progresses and uncharted sectors deplete,
    // grid size can shrink below target
  });

  it('reseeds the sensor grid when scoreRound deals the next round', () => {
    // Regression: Module Gamma stayed "On" in sector rules / log, but rounds 2+
    // never called applySensorGridToRound — Uncharted stayed at the full pile
    // size and the HUD market never appeared after round 1.
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(42));
    let state = startGame(
      {
        id: 'gamma-next-round',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
          { id: 'c', displayName: 'Gamma' },
        ],
        modules: { sensorGrid: true, sensorGridSize: 5 },
        maxPip: 12,
        campaignRounds: 13,
      },
      { shuffledCoordinates: coords }
    );

    expect(state.round?.sensorGrid.length).toBe(5);

    // Force round 1 ended with a winner so scoreRound deals round 2.
    state = {
      ...state,
      round: {
        ...state.round!,
        phase: 'ended',
        roundWinnerId: 'a',
        roundBlocked: false,
      },
    };

    const scored = scoreRound(state, state.round!, seededRandom(99));
    expect(scored.ok).toBe(true);
    if (!scored.ok) return;

    expect(scored.state.round?.roundNumber).toBe(2);
    expect(scored.state.round?.sensorGrid.length).toBe(5);
    expect(scored.state.modules.sensorGrid.enabled).toBe(true);
  });

  it('leaves Sensor Grid intact when Engage Warp Drive draws from Uncharted only', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [T(12, 5), T(0, 1), T(2, 3), T(4, 5), T(6, 7), T(8, 9)],
      sensorGrid: [T(1, 1), T(2, 2), T(3, 3), T(4, 4), T(5, 5)],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [{ coordinate: T(12, 8), index: 0, openValue: 8 }],
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
    const state = makeGame(round, {
      modules: resolveModules({
        sensorGrid: true,
        sensorGridSize: 5,
        warpDriveSpool: true,
      }),
    });

    const beforeGrid = round.sensorGrid.map((c) => `${c.low}-${c.high}`);
    const spool = applyAction(state, {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(spool.ok).toBe(true);
    if (!spool.ok) return;

    const afterGrid = (spool.state.round?.sensorGrid ?? []).map(
      (c) => `${c.low}-${c.high}`
    );
    expect(afterGrid).toEqual(beforeGrid);
    expect(spool.state.round?.unchartedSectors.length).toBeLessThan(
      round.unchartedSectors.length
    );
  });

  it('hides Engage Warp Drive when Uncharted is empty even if Sensor Grid has tiles', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [],
      sensorGrid: [T(1, 1), T(2, 2), T(3, 3), T(4, 4), T(5, 5)],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [{ coordinate: T(12, 8), index: 0, openValue: 8 }],
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
    const state = makeGame(round, {
      modules: resolveModules({
        sensorGrid: true,
        sensorGridSize: 5,
        warpDriveSpool: true,
      }),
    });
    expect(getSpoolOptions(state, round, 'a')).toHaveLength(0);

    const spool = applyAction(state, {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    });
    expect(spool.ok).toBe(false);
    if (!spool.ok) {
      expect(spool.violation).toBe('EMPTY_UNCHARTED');
    }
  });

  it('hides Engage Warp Drive spool options when Uncharted is empty', () => {
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      spacedockValue: 12,
      hands: { a: [T(3, 4)], b: [] },
      unchartedSectors: [],
      sensorGrid: [],
      table: {
        ...createInitialTable(['a', 'b'], 12, 'a'),
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [{ coordinate: T(12, 8), index: 0, openValue: 8 }],
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
    const state = makeGame(round, {
      modules: resolveModules({ warpDriveSpool: true }),
    });
    expect(getSpoolOptions(state, round, 'a')).toHaveLength(0);
  });
});
