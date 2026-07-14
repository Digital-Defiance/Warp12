import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  claimsIncludeAdmin,
  clearAdminRoleCache,
  userHasAdminRole,
  warpRolesFromClaims,
} from './warp-auth-roles.js';

describe('warp-auth-roles', () => {
  beforeEach(() => {
    clearAdminRoleCache();
  });

  it('reads admin from token roles', () => {
    expect(claimsIncludeAdmin({ roles: ['admin'] })).toBe(true);
    expect(claimsIncludeAdmin({ roles: ['match_official'] })).toBe(false);
    expect(claimsIncludeAdmin({})).toBe(false);
    expect(warpRolesFromClaims({ roles: ['admin', 'match_official'] })).toEqual([
      'admin',
      'match_official',
    ]);
  });

  it('caches admin probes so seed loops do not force-refresh every call', async () => {
    const getIdTokenResult = vi.fn(async (forceRefresh?: boolean) => ({
      claims: { roles: ['admin'] },
      forceRefresh: Boolean(forceRefresh),
    }));
    const user = { uid: 'admin-uid', getIdTokenResult } as never;

    await expect(userHasAdminRole(user, { forceRefresh: true })).resolves.toBe(
      true
    );
    await expect(userHasAdminRole(user)).resolves.toBe(true);
    await expect(userHasAdminRole(user)).resolves.toBe(true);

    expect(getIdTokenResult).toHaveBeenCalledTimes(1);
    expect(getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it('forceRefresh bypasses the cache', async () => {
    const getIdTokenResult = vi.fn(async () => ({
      claims: { roles: ['admin'] },
    }));
    const user = { uid: 'admin-uid', getIdTokenResult } as never;

    await userHasAdminRole(user, { forceRefresh: true });
    await userHasAdminRole(user, { forceRefresh: true });
    expect(getIdTokenResult).toHaveBeenCalledTimes(2);
  });
});
