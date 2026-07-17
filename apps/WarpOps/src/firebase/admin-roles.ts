export type WarpAuthRole = 'admin' | 'moderator' | 'match_official';

export function warpRolesFromClaims(
  claims: Readonly<Record<string, unknown>>
): readonly WarpAuthRole[] {
  const raw = claims.roles;
  if (!Array.isArray(raw)) {
    return [];
  }
  const roles: WarpAuthRole[] = [];
  for (const value of raw) {
    if (
      value === 'admin' ||
      value === 'moderator' ||
      value === 'match_official'
    ) {
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

/** Admin or moderator — enough to open Warp Ops. */
export function claimsIncludeOps(
  claims: Readonly<Record<string, unknown>>
): boolean {
  const roles = warpRolesFromClaims(claims);
  return roles.includes('admin') || roles.includes('moderator');
}

export async function userHasAdminRole(
  user: import('firebase/auth').User,
  forceRefresh = false
): Promise<boolean> {
  const token = await user.getIdTokenResult(forceRefresh);
  return claimsIncludeAdmin(token.claims as Record<string, unknown>);
}

export async function userHasOpsRole(
  user: import('firebase/auth').User,
  forceRefresh = false
): Promise<{ isOps: boolean; isAdmin: boolean; roles: readonly WarpAuthRole[] }> {
  const token = await user.getIdTokenResult(forceRefresh);
  const claims = token.claims as Record<string, unknown>;
  const roles = warpRolesFromClaims(claims);
  return {
    isOps: claimsIncludeOps(claims),
    isAdmin: claimsIncludeAdmin(claims),
    roles,
  };
}
