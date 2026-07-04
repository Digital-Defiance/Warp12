/**
 * Client-side rate limiter for subspace messaging. Prevents spam by enforcing
 * a cooldown between messages per captain per sector.
 *
 * Not a security boundary (the real gate is Firestore rules), but keeps the UX
 * clean and signals to the player when they're sending too fast.
 */

const DEFAULT_COOLDOWN_MS = 3_000;
const DEFAULT_BURST = 3;

export interface RateLimiterOptions {
  /** Minimum ms between messages after the burst is exhausted. */
  cooldownMs?: number;
  /** How many messages are allowed in rapid succession before throttling. */
  burst?: number;
}

export interface MessageRateLimiter {
  /** True if the next message would be allowed. */
  canSend(): boolean;
  /** Record that a message was sent. Returns false if throttled. */
  trySend(): boolean;
  /** Seconds until the next allowed send (0 if allowed now). */
  cooldownRemaining(): number;
  /** Reset (e.g. on sector change). */
  reset(): void;
}

export function createMessageRateLimiter(
  options: RateLimiterOptions = {}
): MessageRateLimiter {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const burst = options.burst ?? DEFAULT_BURST;
  const timestamps: number[] = [];

  function canSend(): boolean {
    const now = Date.now();
    // Evict timestamps older than the cooldown window.
    while (timestamps.length > 0 && now - timestamps[0]! > cooldownMs) {
      timestamps.shift();
    }
    return timestamps.length < burst;
  }

  function trySend(): boolean {
    if (!canSend()) {
      return false;
    }
    timestamps.push(Date.now());
    return true;
  }

  function cooldownRemaining(): number {
    if (canSend()) {
      return 0;
    }
    const oldest = timestamps[0] ?? 0;
    return Math.max(0, Math.ceil((oldest + cooldownMs - Date.now()) / 1000));
  }

  function reset(): void {
    timestamps.length = 0;
  }

  return { canSend, trySend, cooldownRemaining, reset };
}
