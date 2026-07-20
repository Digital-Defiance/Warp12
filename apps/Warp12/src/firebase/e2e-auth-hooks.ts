import {
  GoogleAuthProvider,
  linkWithCredential,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from './config.js';
import { isAnonymousUser } from './auth-actions.js';

export const WARP12_E2E_VERIFY_ACCOUNT = '__warp12E2eVerifyAccount';
export const WARP12_E2E_ALLOW_RATED_LAUNCH = '__warp12E2eAllowRatedLaunch';

/**
 * Auth emulator: best-effort link of a fake Google credential (uid preserved).
 * Always arms the e2e rated-launch allow flag — emulator link does not always
 * flip `isAnonymous` in React state before the next click.
 */
export async function e2eVerifyCurrentAccount(): Promise<User | null> {
  if (typeof window !== 'undefined') {
    window[WARP12_E2E_ALLOW_RATED_LAUNCH] = true;
  }
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!auth || !user) {
    return null;
  }
  if (!isAnonymousUser(user)) {
    return user;
  }
  try {
    const credential = GoogleAuthProvider.credential(
      fakeEmulatorGoogleIdToken(user.uid)
    );
    const result = await linkWithCredential(user, credential);
    await result.user.getIdToken(true);
    return result.user;
  } catch {
    // Flag alone is enough for Playwright soft-gate bypass.
    return user;
  }
}

/** Minimal unsigned JWT accepted by the Firebase Auth emulator as a fake id_token. */
export function fakeEmulatorGoogleIdToken(sub: string): string {
  const encode = (value: object): string => {
    const json = JSON.stringify(value);
    const base64 =
      typeof btoa === 'function'
        ? btoa(json)
        : Buffer.from(json, 'utf8').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({
    sub,
    iss: 'https://accounts.google.com',
    aud: 'warp12-e2e',
    iat: now,
    exp: now + 3600,
    email: `${sub.replace(/[^a-zA-Z0-9]/g, '')}@e2e.warp12.test`,
    email_verified: true,
    name: 'E2E Captain',
  });
  return `${header}.${payload}.e2e`;
}

declare global {
  interface Window {
    [WARP12_E2E_VERIFY_ACCOUNT]?: () => Promise<User | null>;
    [WARP12_E2E_ALLOW_RATED_LAUNCH]?: boolean;
  }
}

/** Install Playwright-callable hooks when built with Vite `--mode e2e`. */
export function installE2eAuthHooks(): void {
  if (import.meta.env.MODE !== 'e2e') {
    return;
  }
  window[WARP12_E2E_VERIFY_ACCOUNT] = () => e2eVerifyCurrentAccount();
}

export function e2eAllowsRatedAnonymousLaunch(): boolean {
  return (
    import.meta.env.MODE === 'e2e' &&
    typeof window !== 'undefined' &&
    window[WARP12_E2E_ALLOW_RATED_LAUNCH] === true
  );
}
