import { describe, expect, it } from 'vitest';

import { TTS_CACHE_MATCHES_PREFIX, TTS_CACHE_PREFIX } from './cache-admin.js';

describe('tts cache admin constants', () => {
  it('nests matches under the Storage prefix', () => {
    expect(TTS_CACHE_PREFIX).toBe('tts-cache/');
    expect(TTS_CACHE_MATCHES_PREFIX).toBe('tts-cache/matches/');
  });
});
