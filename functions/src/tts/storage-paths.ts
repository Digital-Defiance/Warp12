/**
 * Firebase Storage layout for commentator TTS:
 *   tts-cache/matches/{matchId}/{contentHash}.mp3
 *
 * Custom object metadata tags: matchId, sectorCode, voiceId, modelId, lineHash.
 */

export const TTS_CACHE_PREFIX = 'tts-cache/';
export const TTS_CACHE_MATCHES_PREFIX = `${TTS_CACHE_PREFIX}matches/`;

const MATCH_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function isValidTtsMatchId(value: string): boolean {
  return MATCH_ID_RE.test(value);
}

/** Sanitize / validate match folder id. Throws on invalid. */
export function parseTtsMatchId(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('matchId is required (per-match cache folder).');
  }
  const matchId = raw.trim();
  if (!isValidTtsMatchId(matchId)) {
    throw new Error(
      'matchId must be 1–64 chars: letters, digits, . _ - (start alphanumeric).'
    );
  }
  return matchId;
}

export function optionalSectorCodeTag(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw new Error('sectorCode must be a string when provided.');
  }
  const trimmed = raw.trim().slice(0, 32);
  if (!trimmed) {
    return undefined;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,31}$/.test(trimmed)) {
    throw new Error('sectorCode tag has invalid characters.');
  }
  return trimmed;
}

export function ttsMatchPrefix(matchId: string): string {
  return `${TTS_CACHE_MATCHES_PREFIX}${matchId}/`;
}

export function ttsObjectPath(matchId: string, contentHash: string): string {
  return `${ttsMatchPrefix(matchId)}${contentHash}.mp3`;
}

/** Extract matchId from `tts-cache/matches/{matchId}/…` paths. */
export function matchIdFromObjectName(name: string): string | null {
  if (!name.startsWith(TTS_CACHE_MATCHES_PREFIX)) {
    return null;
  }
  const rest = name.slice(TTS_CACHE_MATCHES_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) {
    return null;
  }
  const matchId = rest.slice(0, slash);
  return isValidTtsMatchId(matchId) ? matchId : null;
}
