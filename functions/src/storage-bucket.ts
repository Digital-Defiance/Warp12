import * as admin from 'firebase-admin';

import { gcsBucket } from './params.js';

/**
 * Default Firebase Storage bucket for Functions.
 * Prefer an explicit name — `admin.storage().bucket()` with no args often
 * resolves to a legacy `*.appspot.com` bucket that was never created.
 */
export function getAppStorageBucket(): ReturnType<
  ReturnType<typeof admin.storage>['bucket']
> {
  const configured = gcsBucket.value().trim();
  if (configured) {
    return admin.storage().bucket(configured);
  }
  return admin.storage().bucket();
}

export function isMissingStorageBucketError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /bucket does not exist|No such object|The specified bucket/i.test(
    message
  );
}
