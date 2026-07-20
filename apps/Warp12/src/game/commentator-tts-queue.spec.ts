import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCommentatorTtsQueue,
  isTtsRateLimitError,
  mergeCommentatorSpeechInputs,
  ttsRetryDelayMs,
} from './commentator-tts-queue.js';

describe('commentator-tts-queue', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects rate-limit / quota errors', () => {
    expect(
      isTtsRateLimitError({ code: 'resource-exhausted', message: 'quota' })
    ).toBe(true);
    expect(
      isTtsRateLimitError({
        code: 'functions/unavailable',
        message: 'ElevenLabs TTS failed: Status code: 429',
      })
    ).toBe(true);
    expect(isTtsRateLimitError(new Error('Status code: 429'))).toBe(true);
    expect(isTtsRateLimitError(new Error('bad voice'))).toBe(false);
  });

  it('caps retry delay growth', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(ttsRetryDelayMs(0, 1000, 5000)).toBe(1000);
    expect(ttsRetryDelayMs(10, 1000, 5000)).toBe(5000);
  });

  it('merges multiple inputs into an entries batch', () => {
    expect(
      mergeCommentatorSpeechInputs([
        {
          entry: { kind: 'A' },
          names: { a: 'A' },
          matchId: 'm',
          roundStartedAtMs: 1,
        },
        {
          entry: { kind: 'B' },
          names: { a: 'A' },
          matchId: 'm',
          roundStartedAtMs: 1,
        },
      ])
    ).toEqual({
      names: { a: 'A' },
      pronouns: undefined,
      roundStartedAtMs: 1,
      matchId: 'm',
      sectorCode: undefined,
      entry: { kind: 'A' },
      entries: [{ kind: 'A' }, { kind: 'B' }],
      cacheOnly: false,
    });
  });

  it('plays cache hits individually and merges only uncached misses', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const played: string[] = [];
    const queue = createCommentatorTtsQueue({
      coalesceMs: 1,
      maxMerge: 3,
      synthesize: async (input) => {
        calls.push(input);
        if (input.cacheOnly === true) {
          const kind = (input.entry as { kind: string }).kind;
          if (kind === 'cached') {
            return { cacheHit: true, audioBase64: 'cached-audio', speechText: kind };
          }
          return { cacheHit: false, audioBase64: '', speechText: kind };
        }
        if (Array.isArray(input.entries)) {
          const kinds = (input.entries as { kind: string }[])
            .map((e) => e.kind)
            .join('+');
          return { cacheHit: false, audioBase64: `merged:${kinds}`, speechText: kinds };
        }
        const kind = (input.entry as { kind: string }).kind;
        return { cacheHit: false, audioBase64: `solo:${kind}`, speechText: kind };
      },
      play: async (result) => {
        played.push(result.audioBase64);
      },
    });

    queue.offer({ entry: { kind: 'cached' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    queue.offer({ entry: { kind: 'miss1' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    queue.offer({ entry: { kind: 'miss2' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(played).toEqual(['cached-audio', 'merged:miss1+miss2']);
    expect(calls.some((c) => c.cacheOnly === true)).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.cacheOnly === false &&
          Array.isArray(c.entries) &&
          (c.entries as unknown[]).length === 2
      )
    ).toBe(true);
  });

  it('retries rate limits then plays', async () => {
    let calls = 0;
    const played: string[] = [];
    const queue = createCommentatorTtsQueue({
      coalesceMs: 1,
      maxRetries: 3,
      baseDelayMs: 5,
      maxDelayMs: 5,
      synthesize: async (input) => {
        if (input.cacheOnly === true) {
          return { cacheHit: false, audioBase64: '' };
        }
        calls += 1;
        if (calls < 3) {
          throw { code: 'resource-exhausted', message: '429' };
        }
        return { cacheHit: false, audioBase64: 'ok', speechText: 'ok' };
      },
      play: async (result) => {
        played.push(result.audioBase64);
      },
    });

    queue.offer({ entry: { kind: 'line' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(calls).toBe(3);
    expect(played).toEqual(['ok']);
  });

  it('keeps later pending jobs after an in-flight clip', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const played: string[] = [];

    const queue = createCommentatorTtsQueue({
      coalesceMs: 1,
      synthesize: async (input) => {
        if (input.cacheOnly === true) {
          return { cacheHit: false, audioBase64: '' };
        }
        const kind = (input.entry as { kind: string }).kind;
        if (kind === 'old') {
          await firstGate;
        }
        return { cacheHit: false, audioBase64: kind, speechText: kind };
      },
      play: async (result) => {
        played.push(result.audioBase64);
      },
    });

    queue.offer({ entry: { kind: 'old' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    queue.offer({ entry: { kind: 'new' }, names: {}, matchId: 'm', roundStartedAtMs: 0 });
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(played).toEqual(['old', 'new']);
  });
});
