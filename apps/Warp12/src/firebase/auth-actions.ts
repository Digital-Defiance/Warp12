import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from './config.js';
import { isTauriRuntime } from './platform.js';
import { runNativeGoogleOAuth } from './google-oauth-native.js';

export function isAnonymousUser(user: User | null): boolean {
  return user?.isAnonymous ?? true;
}

export function isVerifiedUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous);
}

/** Sign in to Firebase from an already-obtained Google ID token (native mobile flow). */
export async function signInWithGoogleCredential(
  idToken: string,
  accessToken?: string | null
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase auth unavailable');
  }
  const credential = GoogleAuthProvider.credential(idToken, accessToken ?? undefined);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

/** Keeps the same Firebase uid — practice stats carry over when linking succeeds. */
export async function upgradeAnonymousToGoogle(): Promise<{
  user: User;
  /** True when Google was linked to the guest uid; false when an existing Google account was used instead. */
  linked: boolean;
}> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    throw new Error('Firebase auth unavailable');
  }
  if (!auth.currentUser.isAnonymous) {
    return { user: auth.currentUser, linked: true };
  }

  // Any Tauri webview (iOS/Android/macOS): popups are unavailable, so run the
  // native OAuth flow and link (or switch to) the resulting Google credential.
  if (isTauriRuntime()) {
    const tokens = await runNativeGoogleOAuth();
    const credential = GoogleAuthProvider.credential(
      tokens.idToken,
      tokens.accessToken ?? undefined
    );
    try {
      const result = await linkWithCredential(auth.currentUser, credential);
      return { user: result.user, linked: true };
    } catch (err) {
      if (credentialAlreadyInUse(err)) {
        // Switch to the existing Google account. Do NOT signOut first — that
        // transiently drops the user to null, and the auth listener would race
        // to sign in a fresh anonymous user, clobbering this sign-in.
        // signInWithCredential replaces the current (anonymous) user directly.
        const result = await signInWithCredential(auth, credential);
        return { user: result.user, linked: false };
      }
      throw err;
    }
  }

  try {
    const result = await linkWithPopup(
      auth.currentUser,
      new GoogleAuthProvider()
    );
    return { user: result.user, linked: true };
  } catch (err) {
    if (!credentialAlreadyInUse(err)) {
      throw err;
    }
    // Google account already registered (e.g. from leaderboard sign-in) — switch
    // to it. No signOut first: that would drop the user to null and let the auth
    // listener race in a fresh anonymous user. signInWithPopup replaces the
    // current (anonymous) user directly.
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return { user: result.user, linked: false };
  }
}

function credentialAlreadyInUse(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : '';
  return code === 'auth/credential-already-in-use';
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase auth unavailable');
  }
  // Any Tauri webview (iOS/Android/macOS): system-browser OAuth → Firebase
  // credential (no popup).
  if (isTauriRuntime()) {
    const tokens = await runNativeGoogleOAuth();
    return signInWithGoogleCredential(tokens.idToken, tokens.accessToken);
  }
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

export async function continueAsGuest(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase auth unavailable');
  }
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }
  await signOut(auth);
}

export const LEADERBOARD_MATCHES_URL = 'https://iwgf.org/matches';

export function ratedMatchCheckInUrl(code?: string): string {
  if (!code) {
    return LEADERBOARD_MATCHES_URL;
  }
  return `${LEADERBOARD_MATCHES_URL}?code=${encodeURIComponent(code)}`;
}
