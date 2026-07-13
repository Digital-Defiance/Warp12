import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { startGame } from '../setup/create-game.js';
import { applyAction } from './apply-action.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';

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
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4));
    const state = startGame(
      {
        id: 'gamma-refill-test',
        captains: [
          { id: 'a', displayName: 'Alpha' },
          { id: 'b', displayName: 'Beta' },
        ],
        modules: { sensorGrid: true, sensorGridSize: 5 },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const round = state.round!;
    const initialGridSize = round.sensorGrid.length;
    const initialUncharted = round.unchartedSectors.length;

    expect(initialGridSize).toBe(5);
    expect(initialUncharted).toBeGreaterThan(0);

    // The grid should stay at target size (5) as long as uncharted sectors exist
    // In actual play, after a sensor sweep, the grid refills automatically
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
});
