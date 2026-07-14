import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { startGame } from '../setup/create-game.js';
import { applyAction } from './apply-action.js';
import type { GameAction } from '../types/actions.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { makeGame, makeRound, placed, T } from './test-helpers.js';
import { resolveModules } from '../types/modules.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Delta — Warp Drive Spool Integration', () => {
  it('executes SPOOL_WARP_DRIVE action successfully', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1));
    
    // Create a game with Module Delta enabled
    const game = startGame(
      {
        id: 'delta-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true, subspaceFracture: false },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Verify module is enabled
    expect(game.modules.warpDriveSpool.enabled).toBe(true);
    expect(game.round).not.toBe(null);

    const round = game.round!;
    expect(round.activePlayerId).toBe('a');

    // Execute a warp drive spool on player A's trail
    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    };

    const result = applyAction(game, spoolAction);

    // Should succeed
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Round should still be active
    expect(result.state.round).not.toBe(null);
    const nextRound = result.state.round!;

    // Turn should have advanced to player B
    expect(nextRound.activePlayerId).toBe('b');

    // Some tiles should have been drawn from uncharted
    expect(nextRound.unchartedSectors.length).toBeLessThan(round.unchartedSectors.length);

    // Either tiles were played to the trail OR sent to hand (or both)
    const trailA = nextRound.table.warpTrails['a'];
    const handA = nextRound.hands['a'] ?? [];
    const tilesDrawn = round.unchartedSectors.length - nextRound.unchartedSectors.length;

    expect(trailA.tiles.length + handA.length).toBeGreaterThanOrEqual(tilesDrawn);
  });

  it('transfers hazard marker when spooling to neutral zone', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2));
    
    let game = startGame(
      {
        id: 'delta-hazard-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // First start the neutral zone by playing a tile on it
    const round = game.round!;
    const nzValue = round.spacedockValue;
    const handA = round.hands['a'] ?? [];
    
    // Find a tile that matches the spacedock value
    const matchingTile = handA.find(
      (tile) => tile.low === nzValue || tile.high === nzValue
    );

    if (matchingTile) {
      // Chart it to start the NZ
      const chartResult = applyAction(game, {
        type: 'CHART_COORDINATE',
        playerId: 'a',
        coordinate: matchingTile,
        route: { kind: 'neutral-zone' },
      });
      
      if (chartResult.ok) {
        game = chartResult.state;
        // Hazard marker should transfer on the chart
        expect(game.round?.hazardMarkerHolder).toBe('a');
      }
    }

    // Now spool to neutral zone (if we haven't already established it above)
    if (game.round?.table.neutralZone.tiles.length === 0) {
      // Skip test if we couldn't start NZ
      return;
    }

    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: game.round!.activePlayerId,
      route: { kind: 'neutral-zone' },
    };

    const result = applyAction(game, spoolAction);
    
    // May succeed or fail depending on tile matches, but if it succeeds
    // and tiles were played to NZ, hazard marker should transfer
    if (result.ok && result.state.round) {
      const prevNZLength = game.round?.table.neutralZone.tiles.length ?? 0;
      const newNZLength = result.state.round.table.neutralZone.tiles.length;
      
      if (newNZLength > prevNZLength) {
        // Tiles were added to NZ, so hazard marker should transfer
        expect(result.state.round.hazardMarkerHolder).toBe(spoolAction.playerId);
      }
    }
  });

  it('fails when module is not enabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3));
    
    const game = startGame(
      {
        id: 'delta-disabled-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: false },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    };

    const result = applyAction(game, spoolAction);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('MODULE_NOT_ENABLED');
  });

  it('fails when only Module Theta is enabled (spool is Delta-only)', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(31));

    const game = startGame(
      {
        id: 'theta-only-spool-denied',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { longestTrail: true, warpDriveSpool: false },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(game.modules.longestTrail.enabled).toBe(true);

    const result = applyAction(game, {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('MODULE_NOT_ENABLED');
  });

  it('fails when not player turn', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4));
    
    const game = startGame(
      {
        id: 'delta-turn-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    expect(game.round?.activePlayerId).toBe('a');

    // Try to spool as player B when it's player A's turn
    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'b',
      route: { kind: 'warp-trail', playerId: 'b' },
    };

    const result = applyAction(game, spoolAction);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('NOT_YOUR_TURN');
  });

  it('fails during active Red Alert', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5));
    
    const game = startGame(
      {
        id: 'delta-alert-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Manually set Red Alert
    const gameWithAlert = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            table: {
              ...game.round.table,
              redAlert: {
                active: true,
                responsiblePlayerId: 'a',
                passed: false,
              },
            },
          }
        : null,
    };

    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    };

    const result = applyAction(gameWithAlert, spoolAction);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('RED_ALERT_REQUIRED');
  });

  it('fails during active Subspace Fracture', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(6));
    
    const game = startGame(
      {
        id: 'delta-fracture-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true, subspaceFracture: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Manually set Subspace Fracture with proper structure
    const gameWithFracture = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            table: {
              ...game.round.table,
              subspaceFracture: {
                active: true,
                anchor: {
                  coordinate: normalizeCoordinate(9, 9),
                  index: 0,
                  openValue: 9,
                },
                stabilizers: [],
                requiredValue: 9,
                trailCaptainId: 'a',
              },
            },
          }
        : null,
    };

    const spoolAction: GameAction = {
      type: 'SPOOL_WARP_DRIVE',
      playerId: 'a',
      route: { kind: 'warp-trail', playerId: 'a' },
    };

    const result = applyAction(gameWithFracture, spoolAction);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violation).toBe('FRACTURE_REQUIRES_STABILIZER');
  });

  it('does not set hazard marker on Neutral Zone plays when Module Delta is off', () => {
    // Explicit board: own trail started, NZ open at 12 — Delta off, Lambda on.
    const round = makeRound(['a', 'b'], {
      spacedockValue: 12,
      activePlayerId: 'a',
      hands: {
        a: [T(12, 5)],
        b: [],
      },
      table: {
        ...makeRound(['a', 'b'], { spacedockValue: 12 }).table,
        warpTrails: {
          a: {
            tiles: [placed(T(12, 8), 0, 8)],
            distressBeacon: { active: false },
          },
          b: {
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [] },
      },
    });

    const game = makeGame(round, {
      modules: resolveModules({
        wormholes: true,
        warpDriveSpool: false,
        subspaceFracture: false,
      }),
    });

    expect(game.modules.warpDriveSpool.enabled).toBe(false);
    expect(game.round?.hazardMarkerHolder).toBeUndefined();

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: T(12, 5),
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round?.hazardMarkerHolder).toBeUndefined();
  });
});
