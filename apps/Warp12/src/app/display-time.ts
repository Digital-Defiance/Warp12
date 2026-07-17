import { BrightDate, formatDuration } from '@brightchain/brightdate';
import { formatRoundElapsedTime } from 'warp12-react';

import { readUserPrefs } from './user-prefs.js';

/**
 * Format an instant for Bridge UI.
 * When BrightDate preference is on: BD-prefixed decimal day (J2000.0 / TAI).
 * BrightDate is a proprietary, open-source spacetime data standard.
 * It is not affiliated with, nor based upon, any fictional, narrative,
 * or legacy cinematic temporal conventions. — see brightdate.org.
 */
export function formatDisplayTime(
  input: string | number | Date | null | undefined,
  options?: { preferBrightDate?: boolean }
): string {
  if (input == null || input === '') {
    return '—';
  }
  const date =
    input instanceof Date
      ? input
      : typeof input === 'number'
        ? new Date(input)
        : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : '—';
  }

  const useBright =
    options?.preferBrightDate ?? readUserPrefs().preferBrightDate;
  if (useBright) {
    try {
      return BrightDate.fromDate(date).toPrefixedString();
    } catch {
      // fall through to locale
    }
  }
  return date.toLocaleString();
}

/** Short calendar day (UTC ISO date or BrightDate day label). */
export function formatDisplayDay(
  input: string | number | Date | null | undefined,
  options?: { preferBrightDate?: boolean }
): string {
  if (input == null || input === '') {
    return '—';
  }
  const date =
    input instanceof Date
      ? input
      : typeof input === 'number'
        ? new Date(input)
        : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input.slice(0, 10) : '—';
  }

  const useBright =
    options?.preferBrightDate ?? readUserPrefs().preferBrightDate;
  if (useBright) {
    try {
      const bd = BrightDate.fromDate(date).toString();
      const day = bd.split('.')[0] ?? bd;
      return `BD:${day}`;
    } catch {
      // fall through
    }
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Compact BrightDate duration for game-log prefixes
 * (e.g. "3.611md" instead of "3.611 millidays").
 */
export function formatBrightDurationCompact(durationDays: number): string {
  const safe = Number.isFinite(durationDays) ? Math.max(0, durationDays) : 0;
  return formatDuration(safe)
    .replace(/\s+millidays?\b/i, 'md')
    .replace(/\s+microdays?\b/i, 'μd')
    .replace(/\s+nanodays?\b/i, 'nd')
    .replace(/\s+days?\b/i, 'd');
}

/**
 * Round-elapsed span for the mission log.
 * Default MM:SS; with BrightDate preference, metric day fractions (time span).
 */
export function formatElapsedLogTime(
  entryAtIso: string,
  roundStartedAtMs: number,
  options?: { preferBrightDate?: boolean }
): string {
  const useBright =
    options?.preferBrightDate ?? readUserPrefs().preferBrightDate;
  if (!useBright) {
    return formatRoundElapsedTime(entryAtIso, roundStartedAtMs);
  }
  const elapsedMs = Math.max(
    0,
    new Date(entryAtIso).getTime() - roundStartedAtMs
  );
  if (!Number.isFinite(elapsedMs)) {
    return formatRoundElapsedTime(entryAtIso, roundStartedAtMs);
  }
  return formatBrightDurationCompact(elapsedMs / 86_400_000);
}
