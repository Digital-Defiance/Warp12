import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import type { WarpRole } from './tei/rated-match-schema';

export function hasRole(
  request: CallableRequest<unknown>,
  role: WarpRole
): boolean {
  const roles = request.auth?.token.roles;
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.includes(role) || roles.includes('admin');
}

export function requireSignedIn(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return request.auth.uid;
}

export function requireVerifiedUser(request: CallableRequest<unknown>): string {
  const uid = requireSignedIn(request);
  const provider = request.auth?.token.firebase?.sign_in_provider;
  if (provider === 'anonymous') {
    throw new HttpsError(
      'failed-precondition',
      'Sign in with Google or email before using rated-match features.'
    );
  }
  return uid;
}

export function requireOfficial(request: CallableRequest<unknown>): string {
  const uid = requireVerifiedUser(request);
  if (!hasRole(request, 'match_official')) {
    throw new HttpsError('permission-denied', 'Match official role required.');
  }
  return uid;
}

export function requireAdmin(request: CallableRequest<unknown>): string {
  const uid = requireVerifiedUser(request);
  if (!hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }
  return uid;
}
