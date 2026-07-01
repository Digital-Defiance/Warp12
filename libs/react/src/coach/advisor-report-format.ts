import type {
  AdvisorMoveReview,
  AdvisorMoveStrength,
  AdvisorReport,
} from 'warp12-engine';

import { formatCoachSuggestion } from './warp-coach.js';

const STRENGTH_LABEL: Record<AdvisorMoveStrength, string> = {
  strong: 'Strong',
  reasonable: 'Solid',
  weak: 'Suboptimal',
  blunder: 'Likely blunder',
};

export interface FormatAdvisorReportOptions {
  /** Label for AI opponents at the table (e.g. Class I*). */
  readonly opponentLabel?: string;
}

function advisorReportHeader(
  report: AdvisorReport,
  options?: FormatAdvisorReportOptions
): string[] {
  const objectiveLine =
    report.objective === 'go-out'
      ? 'Advisor report — go-out race'
      : 'Advisor report — points scoring';

  const lines = [
    objectiveLine,
    'Advisor engine: ISMCTS deep search (explainable heuristics for move reasons).',
    'Ratings compare each played move to other legal lines at that moment.',
  ];

  if (options?.opponentLabel) {
    lines.push(`Table opponents: ${options.opponentLabel}.`);
  }

  return lines;
}

export function formatAdvisorMoveReview(
  review: AdvisorMoveReview,
  names: Readonly<Record<string, string>>
): string[] {
  const captain = names[review.playerId] ?? review.playerId;
  const move = formatCoachSuggestion(review.played, names);
  const lines: string[] = [
    `${review.turnIndex + 1}. ${captain} · ${move} · ${STRENGTH_LABEL[review.strength]}`,
  ];

  if (review.strength === 'blunder') {
    if (review.advisorPick) {
      lines.push(
        `   Advisor would play: ${formatCoachSuggestion(review.advisorPick, names)}`
      );
      for (const reason of review.advisorReasons) {
        lines.push(`   → ${reason}`);
      }
    } else {
      lines.push('   No clear advisor alternative — move scored well below other lines.');
    }
    return lines;
  }

  if (review.reasons.length === 0) {
    lines.push('   Reasonable tempo — no dominant heuristic signal.');
  } else {
    for (const reason of review.reasons) {
      lines.push(`   → ${reason}`);
    }
  }

  if (
    review.advisorPick &&
    (review.strength === 'weak' || review.strength === 'reasonable')
  ) {
    lines.push(
      `   Advisor alternative: ${formatCoachSuggestion(review.advisorPick, names)}`
    );
  }

  return lines;
}

export function formatAdvisorReport(
  report: AdvisorReport,
  names: Readonly<Record<string, string>>,
  options?: FormatAdvisorReportOptions
): string[] {
  if (report.reviews.length === 0) {
    return ['No captain moves to review this round.'];
  }

  return [
    ...advisorReportHeader(report, options),
    '',
    ...report.reviews.flatMap((review) => formatAdvisorMoveReview(review, names)),
  ];
}

export function advisorReportPlainText(
  report: AdvisorReport,
  names: Readonly<Record<string, string>>,
  options?: FormatAdvisorReportOptions
): string {
  return formatAdvisorReport(report, names, options).join('\n');
}
