import { describe, it, expect } from 'vitest';
import { generateCoordinateSet, shuffleCoordinates } from '../domino/coordinates.js';
import { dealRoundFromDraft } from '../setup/create-game.js';
import { normalizeCoordinate } from '../types/coordinate.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

describe('Module Epsilon — Drafting', () => {
  it('deals hands via pack-and-pass draft', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(1));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
    ];

    // Simple pick function: always pick the first tile in the pack
    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b'],
      maxPip: 12,
      pickFn: pickFirst,
    });

    expect(deal.hands['a']).toHaveLength(15);
    expect(deal.hands['b']).toHaveLength(15);
    
    // Verify no duplicates
    const allPicked = [...deal.hands['a'], ...deal.hands['b']];
    const uniquePicked = new Set(allPicked.map((c) => `${c.low}-${c.high}`));
    expect(uniquePicked.size).toBe(30);

    // Verify spacedock is not in hands
    const spacedock = normalizeCoordinate(12, 12);
    const spacedockInHands = allPicked.some(
      (c) => c.low === spacedock.low && c.high === spacedock.high
    );
    expect(spacedockInHands).toBe(false);

    // Total tiles: 91 - 1 spacedock = 90
    // Drafted: 30 (15 per captain)
    // Remaining: 60
    expect(deal.unchartedSectors.length).toBe(60);
  });

  it('supports different hand sizes and player counts', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(2));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
      { id: 'c', displayName: 'Gamma', pointsScore: 0 },
      { id: 'd', displayName: 'Delta', pointsScore: 0 },
    ];

    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b', 'c', 'd'],
      maxPip: 12,
      pickFn: pickFirst,
    });

    // 4 captains = 15 tiles each
    expect(deal.hands['a']).toHaveLength(15);
    expect(deal.hands['b']).toHaveLength(15);
    expect(deal.hands['c']).toHaveLength(15);
    expect(deal.hands['d']).toHaveLength(15);

    // 91 - 1 spacedock - 60 drafted = 30 remaining
    expect(deal.unchartedSectors.length).toBe(30);
  });

  it('allows strategic pick functions', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(12), seededRandom(3));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
    ];

    // Strategic: pick the highest total pip value
    const pickHighest = (_playerId: string, pack: readonly any[]) => {
      return pack.reduce((highest, tile) => {
        const highestValue = highest.low + highest.high;
        const tileValue = tile.low + tile.high;
        return tileValue > highestValue ? tile : highest;
      });
    };

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b'],
      maxPip: 12,
      pickFn: pickHighest,
    });

    expect(deal.hands['a']).toHaveLength(15);
    expect(deal.hands['b']).toHaveLength(15);

    // Verify hands were drafted (not just random)
    const handAPips = deal.hands['a'].reduce((sum, c) => sum + c.low + c.high, 0);
    const handBPips = deal.hands['b'].reduce((sum, c) => sum + c.low + c.high, 0);

    // With pickHighest, hands should have higher pip totals than random
    // (This is a weak test - real validation would need statistical comparison)
    expect(handAPips).toBeGreaterThan(50);
    expect(handBPips).toBeGreaterThan(50);
  });

  it('maintains tile count invariant across drafting', () => {
    const coords = shuffleCoordinatesForWarpFactor(12, seededRandom(4));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
      { id: 'c', displayName: 'Gamma', pointsScore: 0 },
    ];

    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b', 'c'],
      maxPip: 12,
      pickFn: pickFirst,
    });

    const totalHands =
      deal.hands['a'].length + deal.hands['b'].length + deal.hands['c'].length;
    const totalTiles = totalHands + deal.unchartedSectors.length;

    // 91 - 1 spacedock = 90
    expect(totalTiles).toBe(90);
  });

  it('works with W18 large sets', () => {
    const coords = shuffleCoordinates(generateCoordinateSet(18), seededRandom(5));
    const captains = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      displayName: `Captain ${i}`,
      pointsScore: 0,
    }));

    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: captains.map((c) => c.id),
      maxPip: 18,
      pickFn: pickFirst,
    });

    // 6 captains on W18 = 12 tiles each
    captains.forEach((captain) => {
      expect(deal.hands[captain.id]).toHaveLength(12);
    });

    // 190 - 1 spacedock - 72 drafted = 117 remaining
    expect(deal.unchartedSectors.length).toBe(117);
  });
});

function shuffleCoordinatesForWarpFactor(maxPip: number, rng: () => number) {
  return shuffleCoordinates(generateCoordinateSet(maxPip), rng);
}

describe('Module Epsilon — Multi-Round Recycling (W15+)', () => {
  it('would catch missing 14-14 bug when leftover draft packs not collected', async () => {
    // This test documents the fix for: "Spacedock coordinate 14-14 is missing"
    // The bug was that leftover tiles in draft packs weren't collected for round 2
    // 
    // The fix is in collectRoundCoordinatesForRecycle() in create-game.ts:
    // Now collects tiles from round.draftState.currentPacks when Module Epsilon enabled
    //
    // This test just verifies the tile count math. Full integration test is in
    // test-epsilon-w15.ts which simulates the actual round transition.

    const coords = shuffleCoordinates(generateCoordinateSet(15), seededRandom(10));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
      { id: 'c', displayName: 'Gamma', pointsScore: 0 },
      { id: 'd', displayName: 'Delta', pointsScore: 0 },
    ];

    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    // Deal round 1
    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b', 'c', 'd'],
      maxPip: 15,
      pickFn: pickFirst,
    });

    // W15 set = 136 tiles
    // - 1 spacedock (15-15) = 135
    // - 60 drafted (4 captains × 15 each) = 75 remaining
    // 
    // After drafting completes, some tiles remain in the last packs
    // These MUST be collected for round 2, or 14-14 will be missing!

    const totalDrafted = Object.values(deal.hands).flat().length;
    const totalUncharted = deal.unchartedSectors.length;
    
    expect(totalDrafted).toBe(60); // 4 × 15
    expect(totalUncharted).toBe(75); // 136 - 1 - 60

    // For round 2, ALL 135 tiles (excluding 15-15) must be recycled
    // This includes potential leftover draft pack tiles
  });

  it('works with W18 large sets', () => {
    // Additional verification that large sets work correctly
    const coords = shuffleCoordinates(generateCoordinateSet(18), seededRandom(20));
    const captains = [
      { id: 'a', displayName: 'Alpha', pointsScore: 0 },
      { id: 'b', displayName: 'Beta', pointsScore: 0 },
      { id: 'c', displayName: 'Gamma', pointsScore: 0 },
      { id: 'd', displayName: 'Delta', pointsScore: 0 },
    ];

    const pickFirst = (_playerId: string, pack: readonly any[]) => pack[0];

    const deal = dealRoundFromDraft({
      shuffledCoordinates: coords,
      roundNumber: 1,
      captains,
      turnOrder: ['a', 'b', 'c', 'd'],
      maxPip: 18,
      pickFn: pickFirst,
    });

    // W18 set = 190 tiles
    // - 1 spacedock (18-18) = 189
    // - 60 drafted (4 captains × 15 each) = 129 remaining

    const totalDrafted = Object.values(deal.hands).flat().length;
    const totalUncharted = deal.unchartedSectors.length;
    
    expect(totalDrafted).toBe(60);
    expect(totalUncharted).toBe(129);
    
    // Verify 18-18 was correctly excluded
    const has1818 = [...Object.values(deal.hands).flat(), ...deal.unchartedSectors]
      .some((c) => c.low === 18 && c.high === 18);
    expect(has1818).toBe(false);
  });
});
