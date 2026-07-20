import { createHash } from 'node:crypto';

import type { GameLogEntry, PronounForms } from 'warp12-engine';

import {
  optionalSectorCodeTag,
  parseTtsMatchId,
} from './storage-paths.js';

const MAX_ENTRY_JSON_BYTES = 8_192;
const MAX_NAME_ENTRIES = 24;
const MAX_NAME_LEN = 48;
const MAX_LINE_LEN = 280;
/** Joined speech for a small uncached batch (still one ElevenLabs convert). */
const MAX_BATCH_SPEECH_LEN = 720;
const MAX_BATCH_ENTRIES = 4;

const GAME_LOG_KINDS = new Set<string>([
  'CHART_COORDINATE',
  'DRAW_FROM_UNCHARTED',
  'DESPERATION_DIG',
  'SENSOR_SWEEP',
  'SPOOL_WARP_DRIVE',
  'PASS_RED_ALERT',
  'PASS_TURN',
  'DEPLOY_DISTRESS_BEACON',
  'ALL_STOP',
  'DROP_TO_IMPULSE',
  'CATCH_DROP_TO_IMPULSE',
  'RAISE_SHIELDS',
  'INVOKE_CONTINUUM_FLASH',
  'RESOLVE_CONTINUUM_WAGER',
  'RESOLVE_HAND_EXCHANGE',
  'END_ROUND',
  'SALAMANDER_PENALTY',
  'LONGEST_TRAIL_BONUS',
  'TEMPORAL_DEBT_PENALTY',
  'ROUND_STARTED',
  'ROUND_RATINGS',
  'MODULE_LOADOUT',
  'DEV_CONSOLE',
  'SECTOR_PAUSED',
  'SECTOR_RESUMED',
]);

export interface SynthesizeCommentatorSpeechRequest {
  /** Primary / first entry (always set). */
  readonly entry: GameLogEntry;
  /** Optional batch for one convert (uncached merge). Includes `entry` as [0]. */
  readonly entries: readonly GameLogEntry[];
  readonly names: Readonly<Record<string, string>>;
  readonly pronouns?: Readonly<Record<string, PronounForms>>;
  readonly roundStartedAtMs: number;
  /** Per-match Storage folder id (`tts-cache/matches/{matchId}/`). */
  readonly matchId: string;
  /** Optional display tag (sector invite code, etc.). */
  readonly sectorCode?: string;
  /**
   * When true, only probe Storage — never call ElevenLabs.
   * Misses return `cacheHit: false` with empty audio.
   */
  readonly cacheOnly: boolean;
}

export function ttsCacheKey(
  voiceId: string,
  modelId: string,
  speechText: string,
  pronunciationDictionaryId = '',
  pronunciationDictionaryVersionId = ''
): string {
  // Dictionary version must participate so lexicon bumps do not reuse stale audio.
  return createHash('sha256')
    .update(
      `${voiceId}|${modelId}|${pronunciationDictionaryId}|${pronunciationDictionaryVersionId}|${speechText}`,
      'utf8'
    )
    .digest('hex');
}

/** Spoken pip words so TTS does not treat `1:12` as a clock time. */
const PIP_WORDS: Readonly<Record<number, string>> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
  17: 'seventeen',
  18: 'eighteen',
};

/**
 * Rewrite `N:M` tile notation (Warp pips 0–18) into words.
 * Display copy keeps colons; speech must not — ElevenLabs reads `1:12` as a time.
 */
export function speakCoordinateColons(text: string): string {
  return text.replace(/\b([0-9]|1[0-8]):([0-9]|1[0-8])\b/g, (_match, a, b) => {
    const left = Number(a);
    const right = Number(b);
    return `${PIP_WORDS[left] ?? a} ${PIP_WORDS[right] ?? b}`;
  });
}

/** Drop MM:SS stamp and rewrite tile colons for natural spoken delivery. */
export function speechTextFromCommentatorLine(line: string): string {
  const idx = line.indexOf(' - ');
  const body = (idx >= 0 ? line.slice(idx + 3) : line).trim();
  return speakCoordinateColons(body);
}

export function joinCommentatorSpeechTexts(
  parts: readonly string[]
): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('. ');
}

function parseEntry(raw: unknown): GameLogEntry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('entry is required.');
  }
  const entryObj = raw as Record<string, unknown>;
  if ('text' in entryObj || 'speech' in entryObj || 'line' in entryObj) {
    throw new Error('entry must not include free-form speech fields.');
  }

  const encoded = JSON.stringify(raw);
  if (encoded.length > MAX_ENTRY_JSON_BYTES) {
    throw new Error('entry payload is too large.');
  }

  const kind = entryObj.kind;
  if (typeof kind !== 'string' || !GAME_LOG_KINDS.has(kind)) {
    throw new Error('entry.kind is invalid.');
  }
  // Structural rows (ROUND_STARTED, MODULE_LOADOUT, …) intentionally use ''.
  if (
    entryObj.captainId !== undefined &&
    typeof entryObj.captainId !== 'string'
  ) {
    throw new Error('entry.captainId must be a string when present.');
  }
  if (typeof entryObj.at !== 'string' || !entryObj.at.trim()) {
    throw new Error('entry.at is required.');
  }
  if (!Array.isArray(entryObj.effects)) {
    throw new Error('entry.effects must be an array.');
  }

  return {
    ...(raw as GameLogEntry),
    captainId:
      typeof entryObj.captainId === 'string' ? entryObj.captainId : '',
  };
}

/**
 * Validate structured match payload. Rejects free-form `text` and oversized blobs.
 */
export function parseSynthesizeRequest(
  raw: unknown
): SynthesizeCommentatorSpeechRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Request body must be an object.');
  }
  const data = raw as Record<string, unknown>;

  if ('text' in data || 'speech' in data || 'line' in data) {
    throw new Error(
      'Free-form speech text is not allowed — send a GameLogEntry only.'
    );
  }

  const cacheOnly = data.cacheOnly === true;

  let entries: GameLogEntry[];
  if (data.entries !== undefined) {
    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      throw new Error('entries must be a non-empty array when provided.');
    }
    if (data.entries.length > MAX_BATCH_ENTRIES) {
      throw new Error(`entries is capped at ${MAX_BATCH_ENTRIES}.`);
    }
    entries = data.entries.map((item) => parseEntry(item));
  } else {
    entries = [parseEntry(data.entry)];
  }

  if (cacheOnly && entries.length !== 1) {
    throw new Error('cacheOnly probes accept exactly one entry.');
  }

  const roundStartedAtMs = data.roundStartedAtMs;
  if (
    typeof roundStartedAtMs !== 'number' ||
    !Number.isFinite(roundStartedAtMs) ||
    roundStartedAtMs < 0
  ) {
    throw new Error('roundStartedAtMs must be a non-negative number.');
  }

  const names = parseNameMap(data.names);
  const pronouns = parsePronounMap(data.pronouns);
  const matchId = parseTtsMatchId(data.matchId);
  const sectorCode = optionalSectorCodeTag(data.sectorCode);

  return {
    entry: entries[0]!,
    entries,
    names,
    pronouns,
    roundStartedAtMs,
    matchId,
    sectorCode,
    cacheOnly,
  };
}

export function maxSpeechLenForEntryCount(count: number): number {
  return count > 1 ? MAX_BATCH_SPEECH_LEN : MAX_LINE_LEN;
}

function parseNameMap(
  raw: unknown
): Readonly<Record<string, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('names map is required.');
  }
  const out: Record<string, string> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_NAME_ENTRIES) {
    throw new Error('names map is too large.');
  }
  for (const [id, name] of entries) {
    if (typeof name !== 'string') {
      throw new Error('names values must be strings.');
    }
    const trimmed = name.trim().slice(0, MAX_NAME_LEN);
    if (!id.trim() || !trimmed) {
      continue;
    }
    out[id] = trimmed;
  }
  return out;
}

function parsePronounMap(
  raw: unknown
): Readonly<Record<string, PronounForms>> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pronouns must be an object when provided.');
  }
  const out: Record<string, PronounForms> = {};
  for (const [id, forms] of Object.entries(raw as Record<string, unknown>)) {
    if (!forms || typeof forms !== 'object' || Array.isArray(forms)) {
      throw new Error('pronouns entries must be objects.');
    }
    const f = forms as Record<string, unknown>;
    if (
      typeof f.subject !== 'string' ||
      typeof f.object !== 'string' ||
      typeof f.possessive !== 'string'
    ) {
      throw new Error('pronouns forms require subject/object/possessive.');
    }
    out[id] = {
      subject: f.subject.slice(0, 24),
      object: f.object.slice(0, 24),
      possessive: f.possessive.slice(0, 24),
      possessiveIndependent:
        typeof f.possessiveIndependent === 'string'
          ? f.possessiveIndependent.slice(0, 24)
          : f.possessive.slice(0, 24),
      plural: f.plural === true,
    };
  }
  return out;
}

export function assertSpeechLineAcceptable(
  line: string,
  maxLen = MAX_LINE_LEN
): void {
  if (!line.trim()) {
    throw new Error('Entry is not a commentator highlight.');
  }
  if (line.length > maxLen) {
    throw new Error('Commentator line exceeds length limit.');
  }
}
