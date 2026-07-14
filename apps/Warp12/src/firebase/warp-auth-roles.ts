import type { User } from 'firebase/auth';

/** Mirrors Cloud Functions `WarpRole` claims. */
export type WarpAuthRole = 'admin' | 'match_official';

/** How long a successful (or failed) admin probe is trusted without re-hitting Auth. */
const ADMIN_ROLE_CACHE_MS = 15 * 60 * 1000;

type AdminRoleCache = {
  readonly uid: string;
  readonly isAdmin: boolean;
  readonly at: number;
};

let adminRoleCache: AdminRoleCache | null = null;

export function warpRolesFromClaims(
  claims: Readonly<Record<string, unknown>>
): readonly WarpAuthRole[] {
  const raw = claims.roles;
  if (!Array.isArray(raw)) {
    return [];
  }
  const roles: WarpAuthRole[] = [];
  for (const value of raw) {
    if (value === 'admin' || value === 'match_official') {
      roles.push(value);
    }
  }
  return roles;
}

export function claimsIncludeAdmin(
  claims: Readonly<Record<string, unknown>>
): boolean {
  return warpRolesFromClaims(claims).includes('admin');
}

/** Drop cached admin status (tests / sign-out). */
export function clearAdminRoleCache(): void {
  adminRoleCache = null;
}

export type UserHasAdminRoleOptions = {
  /**
   * Force a network token refresh. Use only for unlock / rare privilege gates —
   * not for every bridge-console call (seed search loops will quota Auth).
   */
  readonly forceRefresh?: boolean;
};

/**
 * Admin claim check with a short in-memory cache.
 * Default path uses a cached ID token (no STS refresh). Unlock should pass
 * `{ forceRefresh: true }` once.
 */
export async function userHasAdminRole(
  user: User | null,
  options?: UserHasAdminRoleOptions
): Promise<boolean> {
  if (!user) {
    adminRoleCache = null;
    return false;
  }

  const forceRefresh = options?.forceRefresh === true;
  const now = Date.now();
  if (
    !forceRefresh &&
    adminRoleCache &&
    adminRoleCache.uid === user.uid &&
    now - adminRoleCache.at < ADMIN_ROLE_CACHE_MS
  ) {
    return adminRoleCache.isAdmin;
  }

  const token = await user.getIdTokenResult(forceRefresh);
  const isAdmin = claimsIncludeAdmin(token.claims as Record<string, unknown>);
  adminRoleCache = { uid: user.uid, isAdmin, at: now };
  return isAdmin;
}
