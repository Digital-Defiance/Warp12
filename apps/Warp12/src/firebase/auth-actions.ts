import {
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type AuthCredential,
  type User,
} from 'firebase/auth';

import {
  isNativeAppleSignInSupported,
  runNativeAppleSignIn,
} from './apple-oauth-native.js';
import { getFirebaseAuth } from './config.js';
import { isTauriRuntime } from './platform.js';
import { runNativeGoogleOAuth } from './google-oauth-native.js';

export function isAnonymousUser(user: User | null): boolean {
  return user?.isAnonymous ?? true;
}

export function isVerifiedUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous);
}

function appleProvider(): OAuthProvider {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

function appleCredential(idToken: string, rawNonce: string) {
  return appleProvider().credential({ idToken, rawNonce });
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

async function linkOrSwitchCredential(
  credential: AuthCredential
): Promise<{ user: User; linked: boolean }> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    throw new Error('Firebase auth unavailable');
  }

  try {
    const result = await linkWithCredential(auth.currentUser, credential);
    return { user: result.user, linked: true };
  } catch (err) {
    if (credentialAlreadyInUse(err)) {
      // Switch to the existing account. Do NOT signOut first — that
      // transiently drops the user to null, and the auth listener would race
      // to sign in a fresh anonymous user, clobbering this sign-in.
      const result = await signInWithCredential(auth, credential);
      return { user: result.user, linked: false };
    }
    throw err;
  }
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
    return linkOrSwitchCredential(credential);
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

/** Guest → Apple (web popup or native SIWA on Apple Tauri builds). */
export async function upgradeAnonymousToApple(): Promise<{
  user: User;
  linked: boolean;
}> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    throw new Error('Firebase auth unavailable');
  }
  if (!auth.currentUser.isAnonymous) {
    return { user: auth.currentUser, linked: true };
  }

  if (isTauriRuntime()) {
    if (!isNativeAppleSignInSupported()) {
      throw new Error(
        'Sign in with Apple is available on iPhone, iPad, and Mac builds.'
      );
    }
    const tokens = await runNativeAppleSignIn();
    return linkOrSwitchCredential(
      appleCredential(tokens.idToken, tokens.rawNonce)
    );
  }

  const provider = appleProvider();
  try {
    const result = await linkWithPopup(auth.currentUser, provider);
    return { user: result.user, linked: true };
  } catch (err) {
    if (!credentialAlreadyInUse(err)) {
      throw err;
    }
    const result = await signInWithPopup(auth, provider);
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

export async function signInWithApple(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase auth unavailable');
  }
  if (isTauriRuntime()) {
    if (!isNativeAppleSignInSupported()) {
      throw new Error(
        'Sign in with Apple is available on iPhone, iPad, and Mac builds.'
      );
    }
    const tokens = await runNativeAppleSignIn();
    const result = await signInWithCredential(
      auth,
      appleCredential(tokens.idToken, tokens.rawNonce)
    );
    return result.user;
  }
  const result = await signInWithPopup(auth, appleProvider());
  return result.user;
}

/** Whether the UI should offer Apple (web always; Tauri only on Apple OS). */
export function isAppleSignInOffered(): boolean {
  if (!isTauriRuntime()) {
    return true;
  }
  return isNativeAppleSignInSupported();
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
