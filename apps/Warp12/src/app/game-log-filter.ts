import {
  formatCommentatorLogLines,
  formatGameLogLine,
  type GameLogEntry,
  type GameLogFormatOptions,
} from 'warp12-react';

import type { GameLogScope } from './log-visibility-prefs.js';
import type { LogVisibilityMode } from './table-viewport.js';

const STRUCTURAL_KINDS: ReadonlySet<GameLogEntry['kind']> = new Set([
  'ROUND_STARTED',
  'ROUND_RATINGS',
  'MODULE_LOADOUT',
  'END_ROUND',
  'SALAMANDER_PENALTY',
  'LONGEST_TRAIL_BONUS',
  'TEMPORAL_DEBT_PENALTY',
  'DEV_CONSOLE',
  'SECTOR_PAUSED',
  'SECTOR_RESUMED',
]);

export interface FilterGameLogLinesOptions {
  readonly mode: LogVisibilityMode | GameLogScope;
  readonly entries: readonly GameLogEntry[];
  /** Pre-formatted fleet lines (used when mode is `all`). */
  readonly allLines?: readonly string[];
  readonly names: Readonly<Record<string, string>>;
  readonly formatOptions: GameLogFormatOptions;
  readonly humanCaptainId?: string;
  /**
   * Optional hand-size hint for SPOOL privacy on the viewer's own spool lines.
   */
  readonly ownHandSizeForEntry?: (
    entry: GameLogEntry
  ) => number | undefined;
}

/** Shared filter for ticker, dialog, and stream overlay. */
export function filterGameLogLines(
  options: FilterGameLogLinesOptions
): string[] {
  const {
    mode,
    entries,
    allLines,
    names,
    formatOptions,
    humanCaptainId,
    ownHandSizeForEntry,
  } = options;

  if (mode === 'off') {
    return [];
  }

  if (mode === 'all') {
    if (allLines) {
      return [...allLines];
    }
    return entries
      .map((entry) =>
        formatGameLogLine(
          entry,
          names,
          formatOptions,
          humanCaptainId,
          ownHandSizeForEntry?.(entry)
        )
      )
      .filter((line) => line.length > 0);
  }

  if (mode === 'commentator') {
    return formatCommentatorLogLines(entries, names, formatOptions);
  }

  // Yourself / captain-only
  return entries
    .filter(
      (entry) =>
        STRUCTURAL_KINDS.has(entry.kind) ||
        (humanCaptainId != null && entry.captainId === humanCaptainId)
    )
    .map((entry) =>
      formatGameLogLine(
        entry,
        names,
        formatOptions,
        humanCaptainId,
        ownHandSizeForEntry?.(entry)
      )
    )
    .filter((line) => line.length > 0);
}

/** Keep the most recent N lines for on-screen stream feeds. */
export function takeRecentLogLines(
  lines: readonly string[],
  maxLines: number
): string[] {
  if (maxLines <= 0 || lines.length <= maxLines) {
    return [...lines];
  }
  return lines.slice(-maxLines);
}

export const COMMENTATOR_TICKER_MAX_LINES = 5;
export const COMMENTATOR_OVERLAY_MAX_LINES = 8;
