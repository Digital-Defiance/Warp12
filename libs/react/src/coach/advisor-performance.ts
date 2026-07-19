import type {
  AdvisorMoveReview,
  AdvisorMoveStrength,
} from 'warp12-engine';

const STRENGTH_POINTS: Record<AdvisorMoveStrength, number> = {
  strong: 3,
  reasonable: 2,
  weak: 1,
  blunder: 0,
};

export interface AdvisorPerformanceSummary {
  readonly moveCount: number;
  readonly strong: number;
  readonly reasonable: number;
  readonly weak: number;
  readonly blunder: number;
  /** 0–100 weighted quality score. */
  readonly scorePct: number;
  readonly letterGrade: string;
  readonly headline: string;
  readonly coachingNote: string;
}

function letterGrade(scorePct: number): string {
  if (scorePct >= 95) return 'A+';
  if (scorePct >= 90) return 'A';
  if (scorePct >= 85) return 'A−';
  if (scorePct >= 80) return 'B+';
  if (scorePct >= 75) return 'B';
  if (scorePct >= 70) return 'B−';
  if (scorePct >= 65) return 'C+';
  if (scorePct >= 60) return 'C';
  if (scorePct >= 55) return 'C−';
  if (scorePct >= 50) return 'D';
  return 'F';
}

function coachingNote(
  scorePct: number,
  blunders: number,
  moveCount: number
): string {
  if (moveCount === 0) {
    return 'No charting moves to review this match.';
  }
  if (blunders === 0 && scorePct >= 85) {
    return 'Clean match — your lines tracked the advisor well. Keep pushing tempo.';
  }
  if (blunders >= 2) {
    return `${blunders} likely blunder${blunders === 1 ? '' : 's'} — open the advisor report and compare those turns to the suggested line.`;
  }
  if (scorePct >= 75) {
    return 'Solid decision-making. Tighten suboptimal turns to climb your TEI.';
  }
  return 'Several lines left value on the table — review weak spots in the advisor report.';
}

/** Aggregate move reviews into a single coaching grade (player moves only). */
export function summarizeAdvisorPerformance(
  reviews: readonly AdvisorMoveReview[]
): AdvisorPerformanceSummary | null {
  if (reviews.length === 0) {
    return null;
  }

  const counts = {
    strong: 0,
    reasonable: 0,
    weak: 0,
    blunder: 0,
  };
  let points = 0;

  for (const review of reviews) {
    counts[review.strength] += 1;
    points += STRENGTH_POINTS[review.strength];
  }

  const maxPoints = reviews.length * STRENGTH_POINTS.strong;
  const scorePct = Math.round((points / maxPoints) * 100);
  const grade = letterGrade(scorePct);

  const headline =
    counts.blunder === 0
      ? `${grade} · ${scorePct}% decision quality (${reviews.length} move${reviews.length === 1 ? '' : 's'})`
      : `${grade} · ${scorePct}% with ${counts.blunder} blunder${counts.blunder === 1 ? '' : 's'}`;

  return {
    moveCount: reviews.length,
    ...counts,
    scorePct,
    letterGrade: grade,
    headline,
    coachingNote: coachingNote(scorePct, counts.blunder, reviews.length),
  };
}

export function formatTeiDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta}`;
  }
  return `${delta}`;
}

export function coachingMessageForTeiDelta(
  delta: number | null,
  rated: boolean,
  won: boolean,
  options?: { readonly advisorUsed?: boolean }
): string | null {
  if (!rated) {
    // Only blame the advisor when it was actually engaged. Casual / unrated
    // sectors use matchReportNotice (or stay silent) — never this copy.
    if (options?.advisorUsed) {
      return 'Advisor was used — this match did not affect your TEI.';
    }
    return null;
  }
  if (delta === null) {
    return null;
  }
  if (delta > 0) {
    return won
      ? `TEI up ${formatTeiDelta(delta)} — keep winning unassisted to climb.`
      : `TEI up ${formatTeiDelta(delta)} despite the loss — tough opponent.`;
  }
  if (delta < 0) {
    return won
      ? `TEI down ${formatTeiDelta(delta)} — you won, but the result was below expectation.`
      : `TEI down ${formatTeiDelta(delta)} — rematch at this tier when ready.`;
  }
  return 'TEI unchanged — result matched expectation.';
}
