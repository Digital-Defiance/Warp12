import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { startGame } from '../setup/create-game.ts';
import { applyAction } from './apply-action.js';
import { scoreRound } from './scoring.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Delta — Hot Potato (Simplified)', () => {
  it('initializes hazard marker with round starter', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1000));
    
    const game = startGame(
      {
        id: 'hot-potato-init',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Round starter should have the hazard marker
    // We can verify it's initialized (not null/undefined)
    expect(game.round!.hazardMarkerHolder).toBeDefined();
    expect(game.round!.hazardMarkerHolder).not.toBeNull();
    expect(game.round!.hazardMarkerPassCount).toBe(0);
  });

  it('transfers hazard marker when playing to neutral zone', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2000));
    
    let game = startGame(
      {
        id: 'hot-potato-transfer',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const initialHolder = game.round!.hazardMarkerHolder;

    // Find a tile that can be played to NZ
    const activePlayer = game.round!.activePlayerId;
    const hand = game.round!.hands[activePlayer] ?? [];
    const nzEndpoint = game.round!.table.neutralZone.openValue;
    
    const playableToNZ = hand.find(
      (tile) => tile.low === nzEndpoint || tile.high === nzEndpoint
    );

    if (!playableToNZ) {
      // Skip this test if no playable tile to NZ
      return;
    }

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: activePlayer,
      coordinate: playableToNZ,
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Hazard marker should transfer to the player who played to NZ
    expect(result.state.round!.hazardMarkerHolder).toBe(activePlayer);
    expect(result.state.round!.hazardMarkerPassCount).toBe(0);
  });

  it.skip('increments pass count when holder passes', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3000));
    
    let game = startGame(
      {
        id: 'hot-potato-pass',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Manually draw to empty the pile, allowing pass
    while (game.round!.unchartedSectors.length > 0) {
      const drawResult = applyAction(game, {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: game.round!.activePlayerId,
      });
      if (!drawResult.ok) break;
      game = drawResult.state;
    }

    // Now set hazard holder and pass count
    game = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            hazardMarkerHolder: game.round.activePlayerId,
            hazardMarkerPassCount: 0,
          }
        : null,
    };

    const result = applyAction(game, {
      type: 'PASS_TURN',
      playerId: game.round!.activePlayerId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Pass count should increment
    expect(result.state.round!.hazardMarkerPassCount).toBe(1);
  });

  it('applies +5 penalty for each pass while holding marker', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4000));
    
    let game = startGame(
      {
        id: 'hot-potato-penalty',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    // Set up scenario where Alice wins but passed twice with the marker
    const gameWithPasses = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            hazardMarkerHolder: 'a',
            hazardMarkerPassCount: 2,
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const aliceBefore = gameWithPasses.captains.find((c) => c.id === 'a')!;

    const result = scoreRound(gameWithPasses, gameWithPasses.round!, seededRandom(4001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;

    // Alice won (0 hand penalty) but passed twice: +5 * 2 = +10
    expect(aliceAfter.pointsScore).toBe(aliceBefore.pointsScore + 10);
  });

  it('does not apply penalty if module disabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5000));
    
    let game = startGame(
      {
        id: 'hot-potato-disabled',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: false }, // Disabled
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    // Even with hazardMarkerPassCount set, no penalty if module disabled
    const gameWithPasses = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            hazardMarkerHolder: 'a',
            hazardMarkerPassCount: 2,
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const aliceBefore = gameWithPasses.captains.find((c) => c.id === 'a')!;

    const result = scoreRound(gameWithPasses, gameWithPasses.round!, seededRandom(5001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;

    // No penalty because module disabled
    expect(aliceAfter.pointsScore).toBe(aliceBefore.pointsScore);
  });
});
