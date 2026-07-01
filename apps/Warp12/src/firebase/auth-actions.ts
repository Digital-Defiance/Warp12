import {
  GoogleAuthProvider,
  linkWithPopup,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from './config.js';

export function isAnonymousUser(user: User | null): boolean {
  return user?.isAnonymous ?? true;
}

export function isVerifiedUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous);
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

  try {
    const result = await linkWithPopup(
      auth.currentUser,
      new GoogleAuthProvider()
    );
    return { user: result.user, linked: true };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code !== 'auth/credential-already-in-use') {
      throw err;
    }
    // Google account already registered (e.g. from leaderboard sign-in) — switch to it.
    await signOut(auth);
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return { user: result.user, linked: false };
  }
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase auth unavailable');
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

export const LEADERBOARD_MATCHES_URL = 'https://leaderboard.warp12.app/matches';

export function ratedMatchCheckInUrl(code?: string): string {
  if (!code) {
    return LEADERBOARD_MATCHES_URL;
  }
  return `${LEADERBOARD_MATCHES_URL}?code=${encodeURIComponent(code)}`;
}
