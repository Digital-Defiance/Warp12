import { describe, expect, it, vi } from 'vitest';

import { createMessageRateLimiter } from './message-rate-limit.js';

describe('message rate limiter', () => {
  it('allows a burst of messages then throttles', () => {
    const limiter = createMessageRateLimiter({ burst: 2, cooldownMs: 1000 });
    expect(limiter.trySend()).toBe(true);
    expect(limiter.trySend()).toBe(true);
    expect(limiter.trySend()).toBe(false);
    expect(limiter.canSend()).toBe(false);
    expect(limiter.cooldownRemaining()).toBeGreaterThan(0);
  });

  it('recovers after the cooldown elapses', () => {
    vi.useFakeTimers();
    const limiter = createMessageRateLimiter({ burst: 1, cooldownMs: 500 });
    expect(limiter.trySend()).toBe(true);
    expect(limiter.canSend()).toBe(false);
    vi.advanceTimersByTime(600);
    expect(limiter.canSend()).toBe(true);
    expect(limiter.trySend()).toBe(true);
    vi.useRealTimers();
  });

  it('resets cleanly', () => {
    const limiter = createMessageRateLimiter({ burst: 1, cooldownMs: 5000 });
    limiter.trySend();
    expect(limiter.canSend()).toBe(false);
    limiter.reset();
    expect(limiter.canSend()).toBe(true);
  });
});
