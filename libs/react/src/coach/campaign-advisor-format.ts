import type { AdvisorReport } from 'warp12-engine';

import { formatAdvisorReport } from './advisor-report-format.js';

export interface CampaignRoundReport {
  readonly roundNumber: number;
  readonly report: AdvisorReport;
}

export function formatCampaignAdvisorReport(
  rounds: readonly CampaignRoundReport[],
  names: Readonly<Record<string, string>>,
  options?: { includeAllCaptains?: boolean }
): string[] {
  if (rounds.length === 0) {
    return ['No advisor data for this match.'];
  }

  const scope = options?.includeAllCaptains
    ? 'All captains'
    : 'Your moves only';

  const lines: string[] = [
    `Campaign advisor report — ${scope}`,
    '',
  ];

  for (const round of rounds) {
    lines.push(`--- Round ${round.roundNumber} ---`);
    lines.push(...formatAdvisorReport(round.report, names));
    lines.push('');
  }

  return lines;
}

export function campaignAdvisorPlainText(
  rounds: readonly CampaignRoundReport[],
  names: Readonly<Record<string, string>>,
  options?: { includeAllCaptains?: boolean }
): string {
  return formatCampaignAdvisorReport(rounds, names, options).join('\n');
}
