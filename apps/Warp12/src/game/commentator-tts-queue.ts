/**
 * Serial commentator TTS for Starter-tier ElevenLabs limits.
 *
 * - One convert / play at a time
 * - Pending highlights accumulate (FIFO) while audio plays
 * - Cache probes first; hits play as individual clips (reuse Storage keys)
 * - Only consecutive cache misses are merged into one generate call
 * - 429 / resource-exhausted retries with backoff
 */

export interface CommentatorTtsJob {
  readonly id: number;
  readonly input: Record<string, unknown>;
}

export interface CommentatorTtsResult {
  readonly cacheHit: boolean;
  readonly audioBase64: string;
  readonly speechText?: string;
}

export interface CommentatorTtsQueueOptions {
  readonly synthesize: (
    input: Record<string, unknown>
  ) => Promise<CommentatorTtsResult>;
  readonly play: (result: CommentatorTtsResult) => Promise<void>;
  /** Delay before starting work so rapid highlights can batch. */
  readonly coalesceMs?: number;
  /** Max highlights waiting behind the current clip. */
  readonly maxPending?: number;
  /** Max uncached lines merged into one ElevenLabs convert. */
  readonly maxMerge?: number;
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly isRetryable?: (err: unknown) => boolean;
  readonly onError?: (err: unknown, job?: CommentatorTtsJob) => void;
}

export function isTtsRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    const asText = String(err);
    return /\b429\b|too many requests|rate.?limit/i.test(asText);
  }
  const code =
    typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code.toLowerCase()
      : '';
  if (
    code === 'resource-exhausted' ||
    code === 'functions/resource-exhausted' ||
    code.endsWith('/resource-exhausted')
  ) {
    return true;
  }
  const message =
    err instanceof Error
      ? err.message
      : typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : String(err);
  if (
    code === 'unavailable' ||
    code === 'functions/unavailable' ||
    code.endsWith('/unavailable')
  ) {
    return /\b429\b|too many requests|rate.?limit/i.test(message);
  }
  return /\b429\b|too many requests|rate.?limit|quota exceeded/i.test(message);
}

export function ttsRetryDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(exp * 0.15 * Math.random());
  return exp + jitter;
}

/** Build a generate request: single entry or merged `entries` batch. */
export function mergeCommentatorSpeechInputs(
  inputs: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const first = inputs[0];
  if (!first) {
    throw new Error('mergeCommentatorSpeechInputs requires at least one input.');
  }
  if (inputs.length === 1) {
    const { cacheOnly: _ignored, entries: _e, ...rest } = first;
    return { ...rest, cacheOnly: false };
  }
  const entries = inputs.map((input) => {
    if (input.entry == null) {
      throw new Error('Each TTS input needs an entry.');
    }
    return input.entry;
  });
  return {
    names: first.names,
    pronouns: first.pronouns,
    roundStartedAtMs: first.roundStartedAtMs,
    matchId: first.matchId,
    sectorCode: first.sectorCode,
    entry: entries[0],
    entries,
    cacheOnly: false,
  };
}

export function createCommentatorTtsQueue(
  options: CommentatorTtsQueueOptions
): {
  offer: (input: Record<string, unknown>) => void;
  clear: () => void;
  busy: () => boolean;
  pendingCount: () => number;
} {
  const coalesceMs = options.coalesceMs ?? 350;
  const maxPending = options.maxPending ?? 6;
  const maxMerge = options.maxMerge ?? 3;
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1_200;
  const maxDelayMs = options.maxDelayMs ?? 12_000;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const isRetryable = options.isRetryable ?? isTtsRateLimitError;

  let nextId = 1;
  let pending: CommentatorTtsJob[] = [];
  let running = false;
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  let cleared = false;

  const clearCoalesce = () => {
    if (coalesceTimer != null) {
      clearTimeout(coalesceTimer);
      coalesceTimer = null;
    }
  };

  const synthesizeWithRetry = async (
    input: Record<string, unknown>,
    job?: CommentatorTtsJob
  ): Promise<CommentatorTtsResult | null> => {
    let attempt = 0;
    for (;;) {
      if (cleared) {
        return null;
      }
      try {
        return await options.synthesize(input);
      } catch (err) {
        if (!isRetryable(err) || attempt >= maxRetries) {
          options.onError?.(err, job);
          return null;
        }
        const delay = ttsRetryDelayMs(attempt, baseDelayMs, maxDelayMs);
        attempt += 1;
        await sleep(delay);
      }
    }
  };

  const playResult = async (
    result: CommentatorTtsResult,
    job?: CommentatorTtsJob
  ) => {
    if (!result.audioBase64) {
      return;
    }
    try {
      await options.play(result);
    } catch (err) {
      options.onError?.(err, job);
    }
  };

  const flushUncached = async (jobs: CommentatorTtsJob[]) => {
    if (jobs.length === 0) {
      return;
    }
    const merged = mergeCommentatorSpeechInputs(jobs.map((job) => job.input));
    const result = await synthesizeWithRetry(merged, jobs[0]);
    if (result) {
      await playResult(result, jobs[0]);
    }
  };

  const flushBatch = async (jobs: CommentatorTtsJob[]) => {
    const uncached: CommentatorTtsJob[] = [];
    for (const job of jobs) {
      if (cleared) {
        return;
      }
      const { cacheOnly: _c, entries: _e, ...rest } = job.input;
      const probe = await synthesizeWithRetry(
        { ...rest, cacheOnly: true },
        job
      );
      if (probe?.cacheHit && probe.audioBase64) {
        await flushUncached(uncached.splice(0, uncached.length));
        await playResult(probe, job);
        continue;
      }
      uncached.push(job);
      if (uncached.length >= maxMerge) {
        await flushUncached(uncached.splice(0, uncached.length));
      }
    }
    await flushUncached(uncached);
  };

  const pump = async () => {
    if (running) {
      return;
    }
    running = true;
    cleared = false;
    try {
      while (!cleared) {
        if (pending.length === 0) {
          break;
        }
        const batch = pending.splice(0, pending.length);
        await flushBatch(batch);
      }
    } finally {
      running = false;
      if (!cleared && pending.length > 0) {
        void pump();
      }
    }
  };

  return {
    offer(input: Record<string, unknown>) {
      cleared = false;
      pending.push({ id: nextId++, input });
      while (pending.length > maxPending) {
        pending.shift();
      }
      clearCoalesce();
      coalesceTimer = setTimeout(() => {
        coalesceTimer = null;
        void pump();
      }, coalesceMs);
    },
    clear() {
      cleared = true;
      pending = [];
      clearCoalesce();
    },
    busy: () => running || pending.length > 0 || coalesceTimer != null,
    pendingCount: () => pending.length,
  };
}
