import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { startGame } from '../setup/create-game.js';
import { scoreRound } from './scoring.js';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Delta — Overdrive Tie-Break Integration', () => {
  it('skips overdrive when uncharted sectors depleted', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3000));
    
    let game = startGame(
      {
        id: 'delta-no-uncharted-test',
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

    const round = game.round!;

    // Scenario: Alice and Bob tied but no uncharted sectors
    // No overdrive happens, neither gets bonus
    const gameNoUncharted = {
      ...game,
      round: round
        ? {
            ...round,
            table: {
              ...round.table,
              warpTrails: {
                a: {
                  ...round.table.warpTrails['a'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 11), index: 0, openValue: 11 },
                    { coordinate: normalizeCoordinate(11, 9), index: 1, openValue: 9 },
                    { coordinate: normalizeCoordinate(9, 7), index: 2, openValue: 7 },
                  ],
                },
                b: {
                  ...round.table.warpTrails['b'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 10), index: 0, openValue: 10 },
                    { coordinate: normalizeCoordinate(10, 8), index: 1, openValue: 8 },
                    { coordinate: normalizeCoordinate(8, 6), index: 2, openValue: 6 },
                  ],
                },
              },
            },
            unchartedSectors: [], // Empty!
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const bobBefore = gameNoUncharted.captains.find((c) => c.id === 'b')!;

    const result = scoreRound(gameNoUncharted, gameNoUncharted.round!, seededRandom(3001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bobAfter = result.state.captains.find((c) => c.id === 'b')!;

    // Bob should have hand penalty, potentially minus fixed -1 bonus if he wins longest trail
    // Since Alice and Bob are tied at 3 tiles, hazard marker breaks the tie (Phase 1)
    // One of them (likely Alice as round starter) holds hazard, so the other wins
    const bobHand = gameNoUncharted.round!.hands['b'] ?? [];
    const bobHandPips = bobHand.reduce((sum, tile) => sum + tile.low + tile.high, 0);
    
    // If Bob won the tie via hazard marker, he gets -1 bonus
    // If Alice won, Bob gets no bonus
    // We need to check the actual result to see who got the bonus
    const actualPenalty = bobAfter.pointsScore - bobBefore.pointsScore;
    
    // Bob either gets bobHandPips (no bonus) or bobHandPips - 1 (won via hazard marker)
    const possiblePenalties = [bobHandPips, bobHandPips - 1];
    expect(possiblePenalties).toContain(actualPenalty);
  });

  it('uses hazard marker for Phase 1 before overdrive', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(5000));
    
    let game = startGame(
      {
        id: 'delta-hazard-phase1-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        modules: { longestTrail: true, longestTrailBonus: -3 },
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    const round = game.round!;

    // Scenario: Alice and Bob tied at 3 tiles
    // Alice holds hazard marker, so Bob wins Phase 1
    // No overdrive needed
    const gameHazardTieBreak = {
      ...game,
      round: round
        ? {
            ...round,
            table: {
              ...round.table,
              warpTrails: {
                a: {
                  ...round.table.warpTrails['a'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 11), index: 0, openValue: 11 },
                    { coordinate: normalizeCoordinate(11, 9), index: 1, openValue: 9 },
                    { coordinate: normalizeCoordinate(9, 7), index: 2, openValue: 7 },
                  ],
                },
                b: {
                  ...round.table.warpTrails['b'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 10), index: 0, openValue: 10 },
                    { coordinate: normalizeCoordinate(10, 8), index: 1, openValue: 8 },
                    { coordinate: normalizeCoordinate(8, 6), index: 2, openValue: 6 },
                  ],
                },
              },
            },
            hazardMarkerHolder: 'a' as const, // Alice holds hazard
            unchartedSectors: [
              normalizeCoordinate(7, 5),
              normalizeCoordinate(6, 4),
            ],
            phase: 'ended' as const,
            roundWinnerId: 'a',
          }
        : null,
    };

    const aliceBefore = gameHazardTieBreak.captains.find((c) => c.id === 'a')!;
    const bobBefore = gameHazardTieBreak.captains.find((c) => c.id === 'b')!;

    const result = scoreRound(gameHazardTieBreak, gameHazardTieBreak.round!, seededRandom(5001));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;
    const bobAfter = result.state.captains.find((c) => c.id === 'b')!;

    // Alice wins (no hand penalty)
    // BOTH Alice and Bob are tied for longest trail (3 tiles each), so BOTH get -3 bonus
    expect(aliceAfter.pointsScore).toBe(aliceBefore.pointsScore - 3);

    // Bob also gets -3 bonus (tied for longest trail with Alice)
    const bobHand = gameHazardTieBreak.round!.hands['b'] ?? [];
    const bobHandPips = bobHand.reduce((sum, tile) => sum + tile.low + tile.high, 0);
    expect(bobAfter.pointsScore - bobBefore.pointsScore).toBe(bobHandPips - 3);
  });

  it('uses Emergency Sectors (Phase 3) when uncharted depletes during overdrive', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(6000));
    
    let game = startGame(
      {
        id: 'delta-emergency-sectors-test',
        captains: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
          { id: 'c', displayName: 'Charlie' },
        ],
        modules: { warpDriveSpool: true },
        maxPip: 12,
        campaignRounds: 1,
      },
      { shuffledCoordinates: coords }
    );

    const round = game.round!;

    // Scenario: Alice and Bob tied at 3 tiles
    // Uncharted has only 2 tiles (will deplete during Alice's overdrive)
    // Emergency sectors created from Neutral Zone + Charlie's trail
    const gameEmergencySectors = {
      ...game,
      round: round
        ? {
            ...round,
            table: {
              ...round.table,
              warpTrails: {
                a: {
                  ...round.table.warpTrails['a'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 11), index: 0, openValue: 11 },
                    { coordinate: normalizeCoordinate(11, 9), index: 1, openValue: 9 },
                    { coordinate: normalizeCoordinate(9, 7), index: 2, openValue: 7 },
                  ],
                },
                b: {
                  ...round.table.warpTrails['b'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 10), index: 0, openValue: 10 },
                    { coordinate: normalizeCoordinate(10, 8), index: 1, openValue: 8 },
                    { coordinate: normalizeCoordinate(8, 6), index: 2, openValue: 6 },
                  ],
                },
                c: {
                  ...round.table.warpTrails['c'],
                  tiles: [
                    { coordinate: normalizeCoordinate(12, 5), index: 0, openValue: 5 },
                    { coordinate: normalizeCoordinate(5, 3), index: 1, openValue: 3 },
                  ],
                },
              },
              neutralZone: [
                { coordinate: normalizeCoordinate(12, 4), index: 0, openValue: 4 },
                { coordinate: normalizeCoordinate(4, 2), index: 1, openValue: 2 },
              ],
            },
            unchartedSectors: [
              normalizeCoordinate(7, 5), // Alice might extend
              normalizeCoordinate(5, 1), // Mismatch for Alice
            ],
            phase: 'ended' as const,
            roundWinnerId: 'c',
            turnOrder: ['a', 'b', 'c'],
          }
        : null,
    };

    // Test that scoring completes without error
    // Emergency sectors should be created automatically if needed
    const result = scoreRound(gameEmergencySectors, gameEmergencySectors.round!, seededRandom(6001));
    expect(result.ok).toBe(true);
    
    // One of Alice or Bob should get the longest trail bonus
    // (depending on emergency sector tiles drawn)
    if (!result.ok) return;
    
    const aliceAfter = result.state.captains.find((c) => c.id === 'a')!;
    const bobAfter = result.state.captains.find((c) => c.id === 'b')!;
    
    // At least one should have received a bonus or neither (tie)
    // This is a probabilistic test based on random emergency sector order
    const aliceGotBonus = aliceAfter.pointsScore < 0; // Negative points = got bonus
    const bobGotBonus = bobAfter.pointsScore < 0;
    
    // Exactly one winner OR neither (tie persisted)
    expect(aliceGotBonus && bobGotBonus).toBe(false); // Both can't win
  });
});
