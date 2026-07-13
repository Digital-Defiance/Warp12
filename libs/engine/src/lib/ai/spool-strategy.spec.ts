import { describe, it, expect } from 'vitest';
import { estimateSpoolValue, shouldConsiderSpool } from './spool-strategy.js';
import type { WarpAiObservation } from './observation.js';
import { startGame } from '../setup/create-game.js';
import { observe } from './observation.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Delta — AI Spool Strategy', () => {
  it('rejects spool with small hand in Points campaign', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1000));
    const game = startGame(
      {
        id: 'spool-strategy-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
        objective: 'points',
      },
      { shuffledCoordinates: coords }
    );

    const obs = observe(game, 'a')!;
    
    // Simulate small hand (manually reduce)
    const smallHandObs: WarpAiObservation = {
      ...obs,
      round: {
        ...obs.round,
        hands: {
          ...obs.round.hands,
          a: obs.round.hands['a']?.slice(0, 2) ?? [],
        },
      },
    };

    const value = estimateSpoolValue(smallHandObs, 'a');
    expect(value).toBeLessThan(0); // Should be negative
  });

  it('favors spool when behind in trail length', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2000));
    const game = startGame(
      {
        id: 'spool-behind-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
        objective: 'points',
      },
      { shuffledCoordinates: coords }
    );

    const obs = observe(game, 'a')!;
    
    // Simulate Alice behind in trail length
    const behindObs: WarpAiObservation = {
      ...obs,
      round: {
        ...obs.round,
        table: {
          ...obs.round.table,
          warpTrails: {
            a: {
              ...obs.round.table.warpTrails['a'],
              tiles: [], // Alice has no trail
            },
            b: {
              ...obs.round.table.warpTrails['b'],
              tiles: [
                { coordinate: { low: 11, high: 12 }, index: 0, openValue: 11 },
                { coordinate: { low: 9, high: 11 }, index: 1, openValue: 9 },
                { coordinate: { low: 7, high: 9 }, index: 2, openValue: 7 },
                { coordinate: { low: 5, high: 7 }, index: 3, openValue: 5 },
                { coordinate: { low: 3, high: 5 }, index: 4, openValue: 3 },
              ], // Bob has 5 tiles
            },
          },
        },
      },
    };

    const value = estimateSpoolValue(behindObs, 'a');
    expect(value).toBeGreaterThan(0); // Should be positive (incentive to catch up)
  });

  it('strongly rejects spooling on opponent trail', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3000));
    const game = startGame(
      {
        id: 'spool-opponent-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const obs = observe(game, 'a')!;
    
    const value = estimateSpoolValue(obs, 'b'); // Spool on Bob's trail
    expect(value).toBeLessThan(-100); // Very negative (Fleet Embargo violation)
  });

  it('gates spool consideration with shouldConsiderSpool', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4000));
    const game = startGame(
      {
        id: 'spool-gate-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const obs = observe(game, 'a')!;
    
    // Normal case: should consider
    expect(shouldConsiderSpool(obs)).toBe(true);
    
    // Module disabled
    const noModuleObs: WarpAiObservation = {
      ...obs,
      modules: {
        ...obs.modules,
        warpDriveSpool: { enabled: false },
      },
    };
    expect(shouldConsiderSpool(noModuleObs)).toBe(false);
    
    // Empty uncharted
    const noUnchartedObs: WarpAiObservation = {
      ...obs,
      round: {
        ...obs.round,
        unchartedSectors: [],
      },
    };
    expect(shouldConsiderSpool(noUnchartedObs)).toBe(false);
  });
});
