import { getFunctions, httpsCallable } from 'firebase/functions';

import { getFirebaseApp, isFirebaseConfigured } from './config';

/** Same-origin /api/fn proxy (firebase.json) avoids cross-origin preflight. */
function getFunctionsRegionOrCustomDomain(): string {
  if (typeof window !== 'undefined') {
    const { hostname, protocol, origin } = window.location;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.localhost');
    if (!isLocalhost && protocol.startsWith('http')) {
      return `${origin}/api/fn`;
    }
  }
  return 'us-central1';
}

export function getCloudFunctions() {
  const app = getFirebaseApp();
  if (!app || !isFirebaseConfigured()) {
    return null;
  }
  return getFunctions(app, getFunctionsRegionOrCustomDomain());
}

export async function callFunction<TInput, TResult>(
  name: string,
  data: TInput
): Promise<TResult> {
  const functions = getCloudFunctions();
  if (!functions) {
    throw new Error('Firebase Functions not configured');
  }
  const callable = httpsCallable<TInput, TResult>(functions, name);
  const result = await callable(data);
  return result.data;
}
