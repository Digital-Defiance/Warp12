import { describe, expect, it } from 'vitest';
import { dealRoundFromShuffled, createRoundStateFromDeal, createCaptain } from '../setup/create-game.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { encodeRoundState, encodeGameState } from './encode-state.js';
import { decodeRoundState, decodeGameState } from './decode-state.js';
import type { GameState } from '../types/game-state.js';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('decode-state', () => {
  it('round-trips a round state through encode/decode', () => {
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
    const original = createRoundStateFromDeal(deal);

    const encodeCtx = { maxPip: 12 };
    const encoded = encodeRoundState(original, encodeCtx);

    const decodeCtx = { maxPip: 12, playerIds: turnOrder };
    const decoded = decodeRoundState(encoded, decodeCtx);

    // Verify key properties
    expect(decoded.roundNumber).toBe(original.roundNumber);
    expect(decoded.spacedockValue).toBe(original.spacedockValue);
    expect(decoded.turnOrder).toEqual(original.turnOrder);
    expect(decoded.activePlayerId).toBe(original.activePlayerId);
    
    // Verify hands
    for (const playerId of turnOrder) {
      expect(decoded.hands[playerId]).toEqual(original.hands[playerId]);
    }

    // Verify table structure exists
    expect(decoded.table.spacedock.value).toBe(original.table.spacedock.value);
    expect(decoded.table.spacedock.placedBy).toBe(original.table.spacedock.placedBy);
  });

  it('round-trips a full game state through encode/decode', () => {
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
    
    const original: GameState = {
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

    const encodeCtx = { maxPip: 12 };
    const encoded = encodeGameState(original, encodeCtx);

    const decodeCtx = { maxPip: 12, playerIds: turnOrder };
    const decoded = decodeGameState(encoded, decodeCtx, captains);

    // Verify game-level properties
    expect(decoded.objective).toBe(original.objective);
    expect(decoded.maxPip).toBe(original.maxPip);
    expect(decoded.captains.length).toBe(original.captains.length);
    
    // Verify round
    expect(decoded.round).not.toBeNull();
    expect(decoded.round?.roundNumber).toBe(original.round?.roundNumber);
    expect(decoded.round?.spacedockValue).toBe(original.round?.spacedockValue);
  });

  it('handles 2-player games correctly', () => {
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
    const original = createRoundStateFromDeal(deal);

    const encodeCtx = { maxPip: 12 };
    const encoded = encodeRoundState(original, encodeCtx);

    const decodeCtx = { maxPip: 12, playerIds: turnOrder };
    const decoded = decodeRoundState(encoded, decodeCtx);

    expect(decoded.turnOrder.length).toBe(2);
    expect(decoded.hands['p0']).toBeDefined();
    expect(decoded.hands['p1']).toBeDefined();
  });
});
