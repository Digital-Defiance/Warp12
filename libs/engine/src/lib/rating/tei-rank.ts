/**
 * Federation commission ranks — presentation flavor derived from TEI grades.
 *
 * Not a separate rating. Same ordinal path as Academy bands:
 * letter order P < I < C < V < E, then score ascending.
 * Elite (E) bands use the same score thresholds as Veteran (V).
 *
 * @see docs/TEI-RANK-LADDER-PROPOSAL.md
 */

import type { TeiDisplay, TeiGrade } from './tei-grade.js';

export type TeiRankId =
  | 'cadet'
  | 'ensign'
  | 'lieutenant-jg'
  | 'lieutenant'
  | 'lieutenant-commander'
  | 'commander'
  | 'commodore'
  | 'rear-admiral'
  | 'vice-admiral'
  | 'admiral'
  | 'fleet-admiral';

export interface TeiRank {
  readonly id: TeiRankId;
  /** Full name for RULES / tooltips */
  readonly name: string;
  /** Compact HUD label */
  readonly short: string;
  /**
   * Inclusive lower bound as TEI letter+score.
   * Elite letter is treated like Veteran for banding (same score).
   */
  readonly from: { readonly grade: TeiGrade; readonly score: number };
}

/** Letter order for TEI path comparison (lower = earlier career). */
const LETTER_ORDER: Record<TeiGrade, number> = {
  P: 0,
  I: 1,
  C: 2,
  V: 3,
  E: 4,
};

/**
 * Rank ladder — ordered ascending.
 * Boundaries match the locked proposal (Cadet → Fleet Admiral).
 */
export const TEI_RANKS: readonly TeiRank[] = [
  {
    id: 'cadet',
    name: 'Cadet',
    short: 'Cdt.',
    from: { grade: 'P', score: 0 },
  },
  {
    id: 'ensign',
    name: 'Ensign',
    short: 'Ens.',
    from: { grade: 'P', score: 25 },
  },
  {
    id: 'lieutenant-jg',
    name: 'Lieutenant Junior Grade',
    short: 'Lt. JG',
    from: { grade: 'I', score: 25 },
  },
  {
    id: 'lieutenant',
    name: 'Lieutenant',
    short: 'Lt.',
    from: { grade: 'I', score: 40 },
  },
  {
    id: 'lieutenant-commander',
    name: 'Lieutenant Commander',
    short: 'Lt. Cmdr.',
    from: { grade: 'C', score: 45 },
  },
  {
    id: 'commander',
    name: 'Commander',
    short: 'Cmdr.',
    from: { grade: 'C', score: 55 },
  },
  {
    id: 'commodore',
    name: 'Commodore',
    short: 'Cdore.',
    from: { grade: 'V', score: 63 },
  },
  {
    id: 'rear-admiral',
    name: 'Rear Admiral',
    short: 'R. Adm.',
    from: { grade: 'V', score: 70 },
  },
  {
    id: 'vice-admiral',
    name: 'Vice Admiral',
    short: 'V. Adm.',
    from: { grade: 'V', score: 80 },
  },
  {
    id: 'admiral',
    name: 'Admiral',
    short: 'Adm.',
    from: { grade: 'V', score: 90 },
  },
  {
    id: 'fleet-admiral',
    name: 'Fleet Admiral',
    short: 'F. Adm.',
    from: { grade: 'V', score: 99 },
  },
] as const;

/**
 * Compare two TEI displays on the career path.
 * Positive = a is higher; uses P<I<C<V<E then score.
 */
export function compareTeiDisplay(
  a: Pick<TeiDisplay, 'grade' | 'score'>,
  b: Pick<TeiDisplay, 'grade' | 'score'>
): number {
  const letterDelta = LETTER_ORDER[a.grade] - LETTER_ORDER[b.grade];
  if (letterDelta !== 0) {
    return letterDelta;
  }
  return a.score - b.score;
}

/**
 * Banding key: Elite uses Veteran thresholds at the same score
 * so E73 sits with high admiralty, not a parallel ladder.
 */
function bandingKey(
  tei: Pick<TeiDisplay, 'grade' | 'score'>
): { grade: TeiGrade; score: number } {
  if (tei.grade === 'E') {
    return { grade: 'V', score: tei.score };
  }
  return { grade: tei.grade, score: tei.score };
}

/**
 * Map a TEI grade string parts to federation commission rank.
 */
export function getTeiRank(
  tei: Pick<TeiDisplay, 'grade' | 'score'>
): TeiRank {
  const key = bandingKey(tei);
  let current: TeiRank = TEI_RANKS[0]!;
  for (const rank of TEI_RANKS) {
    if (compareTeiDisplay(key, rank.from) >= 0) {
      current = rank;
    } else {
      break;
    }
  }
  return current;
}

/** Rear Admiral and above — Flag Officer prestige territory. */
export function isFlagOfficerRank(rank: TeiRank | TeiRankId): boolean {
  const id = typeof rank === 'string' ? rank : rank.id;
  return (
    id === 'rear-admiral' ||
    id === 'vice-admiral' ||
    id === 'admiral' ||
    id === 'fleet-admiral'
  );
}

const TEI_FORMAT_RE = /^([EPICV])(\d{1,2})$/;

/** Parse `V67` / `P00` style strings into grade+score, or null. */
export function parseTeiFormatted(
  formatted: string
): { grade: TeiGrade; score: number } | null {
  const match = TEI_FORMAT_RE.exec(formatted.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const grade = match[1] as TeiGrade;
  const score = Number(match[2]);
  if (!Number.isInteger(score) || score < 0 || score > 99) {
    return null;
  }
  return { grade, score };
}

export function getTeiRankFromFormatted(formatted: string): TeiRank | null {
  const parsed = parseTeiFormatted(formatted);
  return parsed ? getTeiRank(parsed) : null;
}
