import { describe, expect, it } from 'vitest';
import type { AdvisorMoveReview, AdvisorReport } from 'warp12-engine';

import { formatAdvisorReport } from './advisor-report-format.js';

const names = { a: 'Armstrong' };

function chartReview(): AdvisorMoveReview {
  return {
    turnIndex: 0,
    playerId: 'a',
    played: {
      kind: 'chart',
      move: {
        coordinate: { low: 5, high: 7 },
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    },
    strength: 'reasonable',
    reasons: ['Charts on your own warp trail — shields stay up.'],
    advisorPick: null,
    advisorReasons: [],
    playedScore: 10,
    bestScore: 10,
    candidateCount: 3,
  };
}

describe('formatAdvisorReport module context', () => {
  it('renders active modules and an inverted-round strategy note', () => {
    const report: AdvisorReport = {
      objective: 'points',
      reviews: [chartReview()],
      moduleContext: {
        roundNumber: 2,
        inverted: true,
        moduleLabels: [
          'Module Kappa · Temporal Inversion',
          'Module Theta · Longest Trail',
        ],
        notes: [
          'Round 2 is INVERTED — highest hand wins. Hold heavy tiles, draw to build your hand, and do not go out.',
        ],
      },
    };

    const lines = formatAdvisorReport(report, names);
    expect(
      lines.some((line) =>
        line.startsWith(
          'Modules · Module Kappa · Temporal Inversion, Module Theta · Longest Trail'
        )
      )
    ).toBe(true);
    expect(lines.some((line) => line.includes('⚠') && line.includes('INVERTED'))).toBe(
      true
    );
  });

  it('omits the module line when no modules are active', () => {
    const report: AdvisorReport = {
      objective: 'points',
      reviews: [chartReview()],
      moduleContext: {
        roundNumber: 1,
        inverted: false,
        moduleLabels: [],
        notes: [],
      },
    };

    const lines = formatAdvisorReport(report, names);
    expect(lines.some((line) => line.startsWith('Modules ·'))).toBe(false);
  });
});
