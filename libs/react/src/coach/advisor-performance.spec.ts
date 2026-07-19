import { describe, expect, it } from 'vitest';

import {
  coachingMessageForTeiDelta,
  summarizeAdvisorPerformance,
} from './advisor-performance.js';
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

describe('coachingMessageForTeiDelta', () => {
  it('blames the advisor only when advisorUsed is true', () => {
    expect(
      coachingMessageForTeiDelta(null, false, true, { advisorUsed: true })
    ).toMatch(/advisor was used/i);
  });

  it('does not blame the advisor for a casual unrated sector', () => {
    expect(
      coachingMessageForTeiDelta(null, false, true, { advisorUsed: false })
    ).toBeNull();
    expect(coachingMessageForTeiDelta(null, false, false)).toBeNull();
  });

  it('describes TEI movement on rated matches', () => {
    expect(coachingMessageForTeiDelta(12, true, true)).toMatch(/TEI up \+12/);
    expect(coachingMessageForTeiDelta(-5, true, false)).toMatch(/TEI down -5/);
    expect(coachingMessageForTeiDelta(0, true, true)).toMatch(/unchanged/i);
  });
});
