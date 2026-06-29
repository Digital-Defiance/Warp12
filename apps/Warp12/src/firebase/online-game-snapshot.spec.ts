import { describe, expect, it } from 'vitest';

/** Mirrors subscribeOnlineGame publish() dissolve guard. */
function shouldPublishDissolved(
  latestDoc: unknown,
  gameConnected: boolean,
  serverConfirmedMissing: boolean
): boolean {
  return gameConnected && latestDoc == null && serverConfirmedMissing;
}

/** Mirrors subscribeOnlineGame game listener when snap.exists() is false. */
function applyMissingGameSnapshot(
  fromCache: boolean,
  latestDoc: unknown
): { latestDoc: unknown; serverConfirmedMissing: boolean } {
  if (fromCache) {
    return { latestDoc, serverConfirmedMissing: false };
  }
  return { latestDoc: null, serverConfirmedMissing: true };
}

describe('online game snapshot dissolve guard', () => {
  it('does not treat a missing doc as dissolved before the game snapshot connects', () => {
    expect(shouldPublishDissolved(null, false, false)).toBe(false);
  });

  it('does not treat a cache-only missing snapshot as dissolved', () => {
    expect(shouldPublishDissolved(null, true, false)).toBe(false);
    expect(applyMissingGameSnapshot(true, { id: 'ABC123' }).latestDoc).toEqual({
      id: 'ABC123',
    });
  });

  it('treats a server-confirmed missing doc as dissolved', () => {
    expect(shouldPublishDissolved(null, true, true)).toBe(true);
    expect(applyMissingGameSnapshot(false, { id: 'ABC123' })).toEqual({
      latestDoc: null,
      serverConfirmedMissing: true,
    });
  });

  it('keeps an active sector live once the public doc exists', () => {
    expect(shouldPublishDissolved({ id: 'ABC123' }, true, false)).toBe(false);
  });
});
