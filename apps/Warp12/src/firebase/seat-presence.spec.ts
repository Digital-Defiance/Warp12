import { describe, expect, it } from 'vitest';

import { isSeatStale, SEAT_STALE_MS } from './seat-presence.js';

describe('isSeatStale', () => {
  it('is fresh when lastSeenAt is recent', () => {
    const now = Date.parse('2026-07-18T12:00:00.000Z');
    expect(
      isSeatStale(
        { lastSeenAt: new Date(now - 5_000).toISOString() },
        now
      )
    ).toBe(false);
  });

  it('is stale when lastSeenAt is older than the threshold', () => {
    const now = Date.parse('2026-07-18T12:00:00.000Z');
    expect(
      isSeatStale(
        { lastSeenAt: new Date(now - SEAT_STALE_MS - 1).toISOString() },
        now
      )
    ).toBe(true);
  });

  it('is not stale when no heartbeat has arrived yet', () => {
    expect(isSeatStale(undefined)).toBe(false);
    expect(isSeatStale({})).toBe(false);
  });
});
