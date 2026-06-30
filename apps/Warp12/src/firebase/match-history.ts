import type { MatchHistoryEntry, RatedObjective } from './stats-schema.js';

export type { MatchHistoryEntry };

export const MAX_MATCH_HISTORY = 60;

export function appendMatchHistory(
  current: readonly MatchHistoryEntry[] | undefined,
  entry: MatchHistoryEntry
): MatchHistoryEntry[] {
  return [entry, ...(current ?? [])].slice(0, MAX_MATCH_HISTORY);
}

export function recentDecisionTrend(
  history: readonly MatchHistoryEntry[] | undefined,
  limit = 12
): readonly { label: string; value: number }[] {
  if (!history?.length) {
    return [];
  }
  return history
    .filter((entry) => entry.decisionPct !== undefined)
    .slice(0, limit)
    .reverse()
    .map((entry, index) => ({
      label: `${index + 1}`,
      value: entry.decisionPct!,
    }));
}

export function recentEloTrend(
  history: readonly MatchHistoryEntry[] | undefined,
  objective: RatedObjective,
  limit = 12
): readonly { label: string; value: number }[] {
  if (!history?.length) {
    return [];
  }
  return history
    .filter(
      (entry) =>
        entry.objective === objective &&
        entry.eloAfter !== undefined &&
        !entry.advisorUsed
    )
    .slice(0, limit)
    .reverse()
    .map((entry, index) => ({
      label: `${index + 1}`,
      value: entry.eloAfter!,
    }));
}
