/**
 * Spoken-as pronunciation alias for TTS / commentator speech.
 * Display call signs stay as `displayName`; speech may substitute this string.
 * Plain text only — no SSML / markup.
 */

export const SPEAK_AS_MAX_LEN = 48;
export const SPEAK_AS_STORAGE_KEY = 'warp12-captain-speak-as';

/** Allowed: letters, marks, digits, spaces, hyphen, apostrophe, period. */
const SPEAK_AS_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'\u2019-]*$/u;

export function sanitizeSpeakAs(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > SPEAK_AS_MAX_LEN) {
    return null;
  }
  if (!SPEAK_AS_RE.test(trimmed)) {
    return null;
  }
  // Reject angle brackets / markup leftovers even if regex somehow widened.
  if (/[<>{}[\]\\/]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isValidSpeakAs(raw: string | null | undefined): boolean {
  if (raw == null || raw.trim() === '') {
    return true;
  }
  return sanitizeSpeakAs(raw) !== null;
}

export function readSpeakAsLocal(): string | null {
  try {
    const raw = localStorage.getItem(SPEAK_AS_STORAGE_KEY);
    return sanitizeSpeakAs(raw);
  } catch {
    return null;
  }
}

export function writeSpeakAsLocal(value: string | null): void {
  try {
    const next = sanitizeSpeakAs(value);
    if (next) {
      localStorage.setItem(SPEAK_AS_STORAGE_KEY, next);
    } else {
      localStorage.removeItem(SPEAK_AS_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function resolveSpeakAs(
  cloud: string | null | undefined
): string | null {
  const fromCloud = sanitizeSpeakAs(cloud);
  if (fromCloud) {
    return fromCloud;
  }
  return readSpeakAsLocal();
}

/**
 * Build the name map used for TTS / spoken commentary.
 * When useSpeakAs is false, always use display names (match-level disable).
 */
export function resolveTtsNameMap(
  displayNames: Readonly<Record<string, string>>,
  speakAsByCaptain: Readonly<Record<string, string | null | undefined>>,
  useSpeakAs = true
): Record<string, string> {
  const out: Record<string, string> = { ...displayNames };
  if (!useSpeakAs) {
    return out;
  }
  for (const [id, display] of Object.entries(displayNames)) {
    const alias = sanitizeSpeakAs(speakAsByCaptain[id]);
    if (alias) {
      out[id] = alias;
    } else {
      out[id] = display;
    }
  }
  return out;
}
