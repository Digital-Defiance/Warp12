import { describe, expect, it } from 'vitest';

import {
  PUBLIC_BRIDGE_ORIGIN,
  sectorCommentaryUrl,
  sectorHandUrl,
  sectorInviteLinks,
  sectorJoinUrl,
  sectorWatchUrl,
} from './sector-invite-urls.js';

describe('sector invite urls', () => {
  it('builds join, watch, commentary, and hand paths from a sector code', () => {
    expect(sectorJoinUrl('ab12cd', PUBLIC_BRIDGE_ORIGIN)).toBe(
      `${PUBLIC_BRIDGE_ORIGIN}/online/AB12CD`
    );
    expect(sectorWatchUrl('ab12cd', PUBLIC_BRIDGE_ORIGIN)).toBe(
      `${PUBLIC_BRIDGE_ORIGIN}/online/AB12CD/watch`
    );
    expect(sectorCommentaryUrl('ab12cd', PUBLIC_BRIDGE_ORIGIN)).toBe(
      `${PUBLIC_BRIDGE_ORIGIN}/online/AB12CD/commentary`
    );
    expect(sectorHandUrl('ab12cd', PUBLIC_BRIDGE_ORIGIN)).toBe(
      `${PUBLIC_BRIDGE_ORIGIN}/online/AB12CD/hand`
    );
  });

  it('returns a link pack', () => {
    const links = sectorInviteLinks('xy99zz');
    expect(links.code).toBe('XY99ZZ');
    expect(links.joinUrl).toMatch(/\/online\/XY99ZZ$/);
    expect(links.watchUrl).toMatch(/\/online\/XY99ZZ\/watch$/);
    expect(links.commentaryUrl).toMatch(/\/online\/XY99ZZ\/commentary$/);
    expect(links.handUrl).toMatch(/\/online\/XY99ZZ\/hand$/);
  });
});
