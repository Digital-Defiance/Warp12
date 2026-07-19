import { WARP_PIP_COLORS } from 'warp12-theme';

/** Split a formatted log line into elapsed timestamp and message body. */
export function splitGameLogLine(
  line: string
): { timestamp: string; body: string } | null {
  const sep = ' - ';
  const idx = line.indexOf(sep);
  if (idx <= 0) {
    return null;
  }
  return {
    timestamp: line.slice(0, idx),
    body: line.slice(idx + sep.length),
  };
}

export const CAPTAIN_LOG_COLORS = [
  '#7dd3fc',
  '#fbbf24',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#4ade80',
  '#fcd34d',
] as const;

export interface NameColorEntry {
  readonly label: string;
  readonly color: string;
}

export function captainLogColor(
  captainId: string,
  order: readonly string[]
): string {
  const index = order.indexOf(captainId);
  const paletteIndex =
    index >= 0 ? index % CAPTAIN_LOG_COLORS.length : 0;
  return CAPTAIN_LOG_COLORS[paletteIndex]!;
}

/** Display names and colors for highlighting names inside log message bodies. */
export function buildCaptainNameColors(
  names: Readonly<Record<string, string>>,
  order: readonly string[]
): NameColorEntry[] {
  const ids = order.length > 0 ? order : Object.keys(names);
  return ids
    .filter((id) => names[id])
    .map((id) => ({
      label: names[id]!,
      color: captainLogColor(id, ids),
    }));
}

export interface CoordinateLogToken {
  readonly left: number;
  readonly right: number;
  readonly separator: ':' | '-';
  /** True when the match included the `Double ` prefix (doubles use `N-N`). */
  readonly doubleLabel: boolean;
}

export interface ColoredTextSegment {
  readonly text: string;
  readonly color?: string;
  readonly tei?: {
    readonly grade: 'E' | 'V' | 'C' | 'I' | 'P';
    readonly score: string;
    readonly reference: boolean;
  };
  readonly coordinate?: CoordinateLogToken;
}

/** Readable stand-in when the tile pip is transparent (blank / 0). */
const BLANK_PIP_LOG_COLOR = '#94a3b8';

/** CSS color for a pip value in log text (matches tile pip palette). */
export function logPipTextColor(pip: number): string {
  const color = WARP_PIP_COLORS[pip]?.color;
  if (!color || color === 'transparent') {
    return BLANK_PIP_LOG_COLOR;
  }
  return color;
}

function isPipValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 18;
}

/** TEI tokens in ratings lines: `I40` or `ref I40` (AI OpenSkill anchors). */
const TEI_TOKEN_RE = /\b(?:(ref)\s+)?([EVCIP])(\d{1,2})\b/g;

/**
 * Navigational coordinates in log copy:
 * - non-doubles: `12:7`
 * - doubles: `Double 5-5`
 */
const COORD_TOKEN_RE =
  /\b(?:(Double)\s+(\d{1,2})-(\d{1,2})|(\d{1,2}):(\d{1,2}))\b/g;

/** Split plain text into TEI cells and surrounding copy. */
export function splitTeiTokens(text: string): ColoredTextSegment[] {
  if (!text) {
    return [];
  }
  const parts: ColoredTextSegment[] = [];
  let cursor = 0;
  TEI_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TEI_TOKEN_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index) });
    }
    const reference = match[1] === 'ref';
    const grade = match[2] as 'E' | 'V' | 'C' | 'I' | 'P';
    const score = match[3]!;
    parts.push({
      text: match[0],
      tei: { grade, score, reference },
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }
  return parts.length > 0 ? parts : [{ text }];
}

/** Split plain text into pip-colored coordinate cells and surrounding copy. */
export function splitCoordinateTokens(text: string): ColoredTextSegment[] {
  if (!text) {
    return [];
  }
  const parts: ColoredTextSegment[] = [];
  let cursor = 0;
  COORD_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COORD_TOKEN_RE.exec(text)) !== null) {
    const doubleLabel = match[1] === 'Double';
    const left = Number(doubleLabel ? match[2] : match[4]);
    const right = Number(doubleLabel ? match[3] : match[5]);
    if (!isPipValue(left) || !isPipValue(right)) {
      continue;
    }
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index) });
    }
    parts.push({
      text: match[0],
      coordinate: {
        left,
        right,
        separator: doubleLabel ? '-' : ':',
        doubleLabel,
      },
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }
  return parts.length > 0 ? parts : [{ text }];
}

/** TEI cells first, then coordinate cells on remaining plain spans. */
export function decorateLogText(text: string): ColoredTextSegment[] {
  const decorated: ColoredTextSegment[] = [];
  for (const segment of splitTeiTokens(text)) {
    if (segment.tei || segment.color || segment.coordinate) {
      decorated.push(segment);
      continue;
    }
    decorated.push(...splitCoordinateTokens(segment.text));
  }
  return decorated;
}

/** Split log body text into plain and captain-colored segments. */
export function splitBodyByNames(
  body: string,
  names: readonly NameColorEntry[]
): ColoredTextSegment[] {
  if (names.length === 0 || body.length === 0) {
    return decorateLogText(body);
  }

  const sorted = [...names].sort((a, b) => b.label.length - a.label.length);
  const parts: ColoredTextSegment[] = [];
  let cursor = 0;

  while (cursor < body.length) {
    let match: { index: number; entry: NameColorEntry } | null = null;

    for (const entry of sorted) {
      const index = body.indexOf(entry.label, cursor);
      if (index === -1) {
        continue;
      }
      if (
        !match ||
        index < match.index ||
        (index === match.index && entry.label.length > match.entry.label.length)
      ) {
        match = { index, entry };
      }
    }

    if (!match) {
      parts.push(...decorateLogText(body.slice(cursor)));
      break;
    }

    if (match.index > cursor) {
      parts.push(...decorateLogText(body.slice(cursor, match.index)));
    }

    parts.push({ text: match.entry.label, color: match.entry.color });
    cursor = match.index + match.entry.label.length;
  }

  return parts;
}
