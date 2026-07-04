import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

import { getFirebaseApp, isFirebaseConfigured } from './config.js';
import {
  FIREBASE_EMULATOR_HOSTS,
  useFirebaseEmulators,
} from './emulator.js';

let emulatorConnected = false;

/** Same-origin /api/fn proxy (firebase.json) avoids cross-origin preflight to cloudfunctions.net. */
function getFunctionsRegionOrCustomDomain(): string {
  if (useFirebaseEmulators()) {
    return 'us-central1';
  }
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
  const functions = getFunctions(app, getFunctionsRegionOrCustomDomain());
  if (useFirebaseEmulators() && !emulatorConnected) {
    const { host, port } = FIREBASE_EMULATOR_HOSTS.functions;
    connectFunctionsEmulator(functions, host, port);
    emulatorConnected = true;
  }
  return functions;
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
