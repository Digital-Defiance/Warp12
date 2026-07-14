import { describe, expect, it } from 'vitest';
import { dealRoundFromShuffled, createRoundStateFromDeal, createCaptain } from '../setup/create-game.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { encodeRoundState, encodeGameState } from './encode-state.js';
import type { GameState } from '../types/game-state.js';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('encode-state', () => {
  it('encodes a round state to ~300 bytes', () => {
    // Create a simple 4-player game
    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(42));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
      createCaptain('p2', 'Carol'),
      createCaptain('p3', 'Dave'),
    ];
    const turnOrder = ['p0', 'p1', 'p2', 'p3'];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder,
    });
    const round = createRoundStateFromDeal(deal);

    const ctx = { maxPip: 12 };
    const encoded = encodeRoundState(round, ctx);

    // Should be compact
    expect(encoded.length).toBeLessThan(500);
    expect(encoded.length).toBeGreaterThan(50);
    
    // Should have version byte
    expect(encoded[0]).toBe(0x02);
    
    // Should encode player count
    expect(encoded[1]).toBe(4);
  });

  it('encodes a full game state including campaign metadata', () => {
    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(100));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
      createCaptain('p2', 'Carol'),
    ];
    const turnOrder = ['p0', 'p1', 'p2'];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder,
    });
    const round = createRoundStateFromDeal(deal);
    
    const game: GameState = {
      id: 'test',
      phase: 'active',
      objective: 'go-out',
      maxPip: 12,
      captains,
      completedRounds: 0,
      campaignRounds: 10,
      modules: {
        subspaceFracture: { enabled: false },
        continuum: { enabled: false },
        sensorGrid: { enabled: false },
        warpDriveSpool: { enabled: false },
        drafting: { enabled: false },
        dropToImpulse: { enabled: false },
        temporalDebt: { enabled: false },
      },
      houseRules: {
        openingDoubleRequired: false,
        largeFleetHandSize: 10,
      },
      round,
    };

    const ctx = { maxPip: 12 };
    const encoded = encodeGameState(game, ctx);

    // Should be compact
    expect(encoded.length).toBeLessThan(600);
    
    // Should have game state version
    expect(encoded[0]).toBe(0x02);
    
    // Should encode objective
    expect(encoded[1]).toBe(1); // go-out
  });

  it('encodes different sized hands correctly', () => {
    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(200));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
    ];
    const turnOrder = ['p0', 'p1'];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder,
    });
    const round = createRoundStateFromDeal(deal);

    const ctx = { maxPip: 12 };
    const encoded = encodeRoundState(round, ctx);

    // Should handle 2-player game
    expect(encoded[1]).toBe(2);
    expect(encoded.length).toBeGreaterThan(0);
  });
});
