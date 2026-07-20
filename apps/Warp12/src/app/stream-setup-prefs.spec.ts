import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { readTableOptions, writeTableOptions } from './table-view-prefs.js';

describe('stream-safe prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('persists hideHandOnBridge', () => {
    writeTableOptions({ hideHandOnBridge: true });
    expect(readTableOptions().hideHandOnBridge).toBe(true);
  });

  it('persists couchMode', () => {
    writeTableOptions({ couchMode: true });
    expect(readTableOptions().couchMode).toBe(true);
  });
});

describe('sector stream urls', () => {
  it('exposes hand and commentary on the invite pack', async () => {
    const { sectorInviteLinks } = await import(
      '../game/sector-invite-urls.js'
    );
    const links = sectorInviteLinks('stream1');
    expect(links.handUrl).toContain('/hand');
    expect(links.commentaryUrl).toContain('/commentary');
  });
});
