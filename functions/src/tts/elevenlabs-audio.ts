/**
 * Drain ElevenLabs TTS audio and recover from stale dictionary locators.
 */

export async function audioStreamToBuffer(
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
): Promise<Buffer> {
  if (
    typeof (stream as ReadableStream<Uint8Array>).getReader === 'function'
  ) {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export function isPronunciationDictionaryNotFound(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (/pronunciation_dictionary_not_found/i.test(message)) {
    return true;
  }
  const body = (err as { body?: unknown } | null)?.body;
  if (!body || typeof body !== 'object') {
    return false;
  }
  const detail = (body as { detail?: unknown }).detail;
  if (!detail || typeof detail !== 'object') {
    return false;
  }
  const code = (detail as { code?: unknown }).code;
  return code === 'pronunciation_dictionary_not_found';
}

export function isElevenLabsRateLimited(err: unknown): boolean {
  const status =
    typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : typeof (err as { status?: unknown })?.status === 'number'
        ? (err as { status: number }).status
        : null;
  if (status === 429) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|rate.?limit/i.test(message);
}

export function elevenLabsErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'ElevenLabs TTS failed.';
  }
  // SDK messages often include a truncated JSON body — keep it short for callables.
  const compact = err.message.replace(/\s+/g, ' ').trim();
  return compact.length > 280 ? `${compact.slice(0, 277)}…` : compact;
}
