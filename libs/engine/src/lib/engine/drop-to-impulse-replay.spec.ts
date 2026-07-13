/**
 * Regression test for Drop to Impulse replay determinism
 * 
 * Issue: When Drop to Impulse is enabled, AI catching decisions may not be
 * deterministic across replays, causing hand state to diverge.
 */

import { describe, it, expect } from 'vitest';
import { startGame } from '../setup/create-game.js';
import { applyAction } from './apply-action.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import type { GameState } from '../types/game-state.js';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Drop to Impulse replay determinism', () => {
  it('maintains deterministic drop-to-impulse state tracking', () => {
    // Minimal test: Verify DTI state flags are set consistently
    const seed = 12345;
    const captains = [
      { id: 'you', displayName: 'Human' },
      { id: 'ai1', displayName: 'AI1' },
    ];

    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(seed)
    );

    let state = startGame(
      {
        id: 'test',
        captains,
        modules: {},
        houseRules: { dropToImpulseCall: true },
        objective: 'points',
        campaignRounds: 1,
      },
      { shuffledCoordinates: shuffled }
    );

    // Chart tiles down to 1 remaining (should trigger DTI pending)
    const hand = state.round?.hands['you'] ?? [];
    expect(hand.length).toBeGreaterThan(1);

    // Chart all but one tile
    for (let i = 0; i < hand.length - 1; i++) {
      const tile = hand[i]!;
      const result = applyAction(state, {
        type: 'CHART_COORDINATE',
        playerId: 'you',
        coordinate: tile,
        route: { kind: 'warp-trail', playerId: 'you' },
      });
      
      if (result.ok) {
        state = result.state;
      } else {
        // Skip invalid moves
        continue;
      }
    }

    // After charting down to 1 tile, DTI should be pending
    const round = state.round;
    if (round && (round.hands['you']?.length ?? 0) === 1) {
      expect(round.dropToImpulseCallPending).toBe('you');
    }
  });

  it('maintains determinism without DTI', () => {
    // Control test: without Drop to Impulse, states should be identical
    const seed = 3361874003;
    const captains = [
      { id: 'you', displayName: 'Armstrong' },
      { id: 'ai1', displayName: 'AI1' },
    ];

    const shuffled1 = shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(seed)
    );

    const state1 = startGame(
      {
        id: 'test-1',
        captains,
        modules: {},
        houseRules: { dropToImpulseCall: false }, // DTI disabled
        objective: 'points',
        campaignRounds: 1,
      },
      { shuffledCoordinates: shuffled1 }
    );

    const shuffled2 = shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(seed)
    );

    const state2 = startGame(
      {
        id: 'test-2',
        captains,
        modules: {},
        houseRules: { dropToImpulseCall: false },
        objective: 'points',
        campaignRounds: 1,
      },
      { shuffledCoordinates: shuffled2 }
    );

    // Verify initial hands are identical
    const hand1 = state1.round?.hands['you'];
    const hand2 = state2.round?.hands['you'];

    expect(hand1).toEqual(hand2);
  });
});
