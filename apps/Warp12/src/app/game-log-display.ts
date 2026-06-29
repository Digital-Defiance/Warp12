/** Split a formatted log line into elapsed timestamp and message body. */
export function splitGameLogLine(
  line: string
): { timestamp: string; body: string } | null {
  const match = /^(\d{2}:\d{2}) - (.*)$/s.exec(line);
  if (!match) {
    return null;
  }
  return { timestamp: match[1]!, body: match[2]! };
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

export interface ColoredTextSegment {
  readonly text: string;
  readonly color?: string;
}

/** Split log body text into plain and captain-colored segments. */
export function splitBodyByNames(
  body: string,
  names: readonly NameColorEntry[]
): ColoredTextSegment[] {
  if (names.length === 0 || body.length === 0) {
    return [{ text: body }];
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
      parts.push({ text: body.slice(cursor) });
      break;
    }

    if (match.index > cursor) {
      parts.push({ text: body.slice(cursor, match.index) });
    }

    parts.push({ text: match.entry.label, color: match.entry.color });
    cursor = match.index + match.entry.label.length;
  }

  return parts;
}
