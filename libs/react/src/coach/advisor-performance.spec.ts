import { describe, expect, it } from 'vitest';

import { summarizeAdvisorPerformance } from './advisor-performance.js';
import type { AdvisorMoveReview } from 'warp12-engine';

function review(strength: AdvisorMoveReview['strength']): AdvisorMoveReview {
  return {
    turnIndex: 0,
    playerId: 'you',
    played: { kind: 'draw' },
    strength,
    reasons: [],
    advisorPick: null,
    advisorReasons: [],
    playedScore: 0,
    bestScore: 0,
    candidateCount: 2,
  };
}

describe('summarizeAdvisorPerformance', () => {
  it('grades a clean match highly', () => {
    const summary = summarizeAdvisorPerformance([
      review('strong'),
      review('reasonable'),
      review('strong'),
    ]);
    expect(summary?.letterGrade).toMatch(/^A/);
    expect(summary?.scorePct).toBeGreaterThanOrEqual(85);
    expect(summary?.blunder).toBe(0);
  });

  it('penalizes blunders in the grade', () => {
    const summary = summarizeAdvisorPerformance([
      review('strong'),
      review('blunder'),
      review('blunder'),
    ]);
    expect(summary?.blunder).toBe(2);
    expect(summary?.scorePct).toBeLessThan(70);
  });

  it('returns null when there are no reviews', () => {
    expect(summarizeAdvisorPerformance([])).toBeNull();
  });
});
