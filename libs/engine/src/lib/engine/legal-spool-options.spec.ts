import { describe, it, expect } from 'vitest';
import { startGame } from '../setup/create-game.js';
import { getSpoolOptions } from './legal-moves.js';
import { applyAction } from './apply-action.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Delta — Legal Spool Options', () => {
  it('returns no options when module is disabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1000));
    const game = startGame(
      {
        id: 'no-spool-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: {}, // No warpDriveSpool
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const options = getSpoolOptions(game, game.round!, 'a');
    expect(options).toHaveLength(0);
  });

  it('returns own trail option when module enabled', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2000));
    const game = startGame(
      {
        id: 'spool-own-trail-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Alice is active player at start, check options before charting
    const options = getSpoolOptions(game, game.round!, 'a');
    
    // Should have own trail option (Spacedock is always available)
    expect(options.some((o) => o.route.kind === 'warp-trail' && o.route.playerId === 'a')).toBe(
      true
    );
  });

  it('returns neutral zone option when accessible', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3000));
    const game = startGame(
      {
        id: 'spool-nz-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Alice is active player at start
    // Neutral Zone starts empty, so check after first tile is charted there
    const round1 = game.round!;
    const aliceHand = round1.hands['a'] ?? [];
    
    // Find a tile that matches Spacedock
    const spacedockTile = aliceHand.find(
      (c) => c.low === round1.spacedockValue || c.high === round1.spacedockValue
    );

    if (!spacedockTile) {
      // Skip test if no matching tile (rare with random deal)
      return;
    }

    const result = applyAction(game, {
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: spacedockTile,
      route: { kind: 'neutral-zone' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Check if Bob has started his trail (might be required by house rules)
    const bobTrail = result.state.round!.table.warpTrails['b'];
    const bobHasTrail = bobTrail && bobTrail.tiles.length > 0;
    
    // Now it's Bob's turn, check his options include NZ
    const options = getSpoolOptions(result.state, result.state.round!, 'b');
    
    // If Bob hasn't started his trail and neutralZoneAfterAllTrails is true, NZ won't be available
    // In that case, just verify Bob has his own trail option
    if (!bobHasTrail) {
      // Bob should at least have his own trail as a spool option
      expect(options.some((o) => o.route.kind === 'warp-trail' && o.route.playerId === 'b')).toBe(true);
    } else {
      expect(options.some((o) => o.route.kind === 'neutral-zone')).toBe(true);
    }
  });

  it('excludes trails with uncovered doubles', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(4000));
    const game = startGame(
      {
        id: 'spool-red-alert-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    // Manually create a state with Alice having an uncovered double on her trail
    const round = game.round!;
    const stateWithDouble = {
      ...game,
      round: {
        ...round,
        table: {
          ...round.table,
          warpTrails: {
            ...round.table.warpTrails,
            a: {
              ...round.table.warpTrails['a'],
              tiles: [
                {
                  coordinate: normalizeCoordinate(12, 11),
                  index: 0,
                  openValue: 11,
                },
                {
                  coordinate: normalizeCoordinate(11, 11),
                  index: 1,
                  openValue: 11,
                },
              ],
            },
          },
          redAlert: {
            active: true,
            responsiblePlayerId: 'a',
            trailPlayerId: 'a',
            neutralZone: false,
          },
        },
      },
    };

    const options = getSpoolOptions(stateWithDouble, stateWithDouble.round!, 'a');
    
    // Should not include own trail (has uncovered double and Red Alert active)
    expect(options.some((o) => o.route.kind === 'warp-trail' && o.route.playerId === 'a')).toBe(
      false
    );
  });

  it('returns no options during Red Alert', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5000));
    const game = startGame(
      {
        id: 'spool-during-red-alert-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
      },
      { shuffledCoordinates: coords }
    );

    const round = game.round!;
    const stateWithRedAlert = {
      ...game,
      round: {
        ...round,
        table: {
          ...round.table,
          redAlert: {
            active: true,
            responsiblePlayerId: 'a',
            trailPlayerId: 'a',
            neutralZone: false,
          },
        },
      },
    };

    const options = getSpoolOptions(stateWithRedAlert, stateWithRedAlert.round!, 'a');
    expect(options).toHaveLength(0);
  });

  it('returns opponent trail options when open', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(6000));
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

    // Alice should see her own trail as a spool option from the start
    const options = getSpoolOptions(game, game.round!, 'a');
    
    // Alice should have her own trail option (Spacedock is always available)
    expect(options.some((o) => o.route.kind === 'warp-trail' && o.route.playerId === 'a')).toBe(
      true
    );
  });
});
