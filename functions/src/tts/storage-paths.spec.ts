import { describe, expect, it } from 'vitest';

import {
  TTS_CACHE_MATCHES_PREFIX,
  matchIdFromObjectName,
  parseTtsMatchId,
  ttsMatchPrefix,
  ttsObjectPath,
} from './storage-paths.js';

describe('tts storage-paths', () => {
  it('builds per-match object paths', () => {
    expect(ttsMatchPrefix('online-ABCD')).toBe(
      `${TTS_CACHE_MATCHES_PREFIX}online-ABCD/`
    );
    expect(ttsObjectPath('online-ABCD', 'abc'.padEnd(64, '0'))).toBe(
      `${TTS_CACHE_MATCHES_PREFIX}online-ABCD/${'abc'.padEnd(64, '0')}.mp3`
    );
  });

  it('parses matchId from object names', () => {
    expect(
      matchIdFromObjectName(
        `${TTS_CACHE_MATCHES_PREFIX}local-game1/deadbeef.mp3`
      )
    ).toBe('local-game1');
    expect(matchIdFromObjectName('tts-cache/orphan.mp3')).toBeNull();
  });

  it('rejects invalid match ids', () => {
    expect(() => parseTtsMatchId('../evil')).toThrow();
    expect(() => parseTtsMatchId('')).toThrow();
    expect(parseTtsMatchId('online-X1')).toBe('online-X1');
  });
});
