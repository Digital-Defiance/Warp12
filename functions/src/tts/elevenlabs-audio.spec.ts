import { describe, expect, it } from 'vitest';

import {
  audioStreamToBuffer,
  elevenLabsErrorMessage,
  isElevenLabsRateLimited,
  isPronunciationDictionaryNotFound,
} from './elevenlabs-audio.js';

describe('elevenlabs-audio', () => {
  it('detects pronunciation dictionary 404s', () => {
    expect(
      isPronunciationDictionaryNotFound(
        new Error(
          'Status code: 404 Body: {"detail":{"code":"pronunciation_dictionary_not_found"}}'
        )
      )
    ).toBe(true);

    expect(
      isPronunciationDictionaryNotFound({
        message: 'Status code: 404',
        body: {
          detail: {
            code: 'pronunciation_dictionary_not_found',
            message: 'missing',
          },
        },
      })
    ).toBe(true);

    expect(isPronunciationDictionaryNotFound(new Error('quota'))).toBe(false);
  });

  it('detects ElevenLabs rate limits', () => {
    expect(isElevenLabsRateLimited({ statusCode: 429 })).toBe(true);
    expect(isElevenLabsRateLimited(new Error('Status code: 429'))).toBe(true);
    expect(isElevenLabsRateLimited(new Error('other'))).toBe(false);
  });

  it('drains web streams and async iterables', async () => {
    const web = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    expect([...(await audioStreamToBuffer(web))]).toEqual([1, 2, 3]);

    async function* gen() {
      yield new Uint8Array([4, 5]);
      yield new Uint8Array([6]);
    }
    expect([...(await audioStreamToBuffer(gen()))]).toEqual([4, 5, 6]);
  });

  it('compacts ElevenLabs error messages', () => {
    const long = `Status code: 404\nBody: ${'x'.repeat(400)}`;
    const msg = elevenLabsErrorMessage(new Error(long));
    expect(msg.length).toBeLessThanOrEqual(280);
    expect(msg.startsWith('Status code: 404')).toBe(true);
  });
});
