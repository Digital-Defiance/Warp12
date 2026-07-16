import { describe, expect, it } from 'vitest';
import type { GameState } from 'warp12-engine';

import {
  deriveCampaignPointsHistory,
  type CampaignRoundSnapshot,
} from './campaign-points-history.js';

/**
 * Minimal GameState stand-in — `deriveCampaignPointsHistory` only reads
 * `captains[].id` and `captains[].pointsScore`.
 */
function gameWith(points: Record<string, number>): GameState {
  return {
    captains: Object.entries(points).map(([id, pointsScore]) => ({
      id,
      displayName: id,
      pointsScore,
    })),
  } as unknown as GameState;
}

function snapshot(
  roundNumber: number,
  points: Record<string, number>
): CampaignRoundSnapshot {
  return { roundNumber, roundStartState: gameWith(points) };
}

describe('deriveCampaignPointsHistory', () => {
  it('derives per-round deltas from cumulative round-start scores', () => {
    // Cumulative pointsScore at the start of each round; final closes round 3.
    const snapshots = [
      snapshot(1, { a: 0, b: 0 }),
      snapshot(2, { a: 5, b: 12 }),
      snapshot(3, { a: 5, b: 20 }),
    ];
    const finalGame = gameWith({ a: 18, b: 20 });

    const history = deriveCampaignPointsHistory(snapshots, finalGame);

    expect(history).toEqual([
      { roundNumber: 1, deltas: { a: 5, b: 12 } },
      { roundNumber: 2, deltas: { a: 0, b: 8 } },
      { roundNumber: 3, deltas: { a: 13, b: 0 } },
    ]);
  });

  it('per-round deltas sum to the final cumulative total', () => {
    const snapshots = [
      snapshot(1, { a: 0, b: 0, c: 0 }),
      snapshot(2, { a: 7, b: 3, c: 10 }),
      snapshot(3, { a: 9, b: 15, c: 10 }),
    ];
    const finalGame = gameWith({ a: 20, b: 15, c: 25 });

    const history = deriveCampaignPointsHistory(snapshots, finalGame);

    for (const captain of finalGame.captains) {
      const summed = history.reduce(
        (total, round) => total + (round.deltas[captain.id] ?? 0),
        0
      );
      expect(summed).toBe(captain.pointsScore);
    }
  });

  it('sorts out-of-order snapshots by round number', () => {
    const snapshots = [
      snapshot(3, { a: 5 }),
      snapshot(1, { a: 0 }),
      snapshot(2, { a: 2 }),
    ];
    const finalGame = gameWith({ a: 9 });

    const history = deriveCampaignPointsHistory(snapshots, finalGame);

    expect(history.map((round) => round.roundNumber)).toEqual([1, 2, 3]);
    expect(history).toEqual([
      { roundNumber: 1, deltas: { a: 2 } },
      { roundNumber: 2, deltas: { a: 3 } },
      { roundNumber: 3, deltas: { a: 4 } },
    ]);
  });

  it('handles a single round (final closes it directly)', () => {
    const history = deriveCampaignPointsHistory(
      [snapshot(1, { a: 0, b: 0 })],
      gameWith({ a: 6, b: 11 })
    );

    expect(history).toEqual([{ roundNumber: 1, deltas: { a: 6, b: 11 } }]);
  });

  it('returns an empty history when there are no snapshots', () => {
    expect(deriveCampaignPointsHistory([], gameWith({ a: 3 }))).toEqual([]);
  });

  it('scopes deltas to captains present in the final game', () => {
    // A captain missing from a snapshot is treated as 0 at that point.
    const snapshots = [
      snapshot(1, { a: 0 }),
      snapshot(2, { a: 4, b: 4 }),
    ];
    const finalGame = gameWith({ a: 10, b: 9 });

    const history = deriveCampaignPointsHistory(snapshots, finalGame);

    expect(history).toEqual([
      { roundNumber: 1, deltas: { a: 4, b: 4 } },
      { roundNumber: 2, deltas: { a: 6, b: 5 } },
    ]);
  });
});
