import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked firebase/auth surface. Uses vi.hoisted so the factory can reference it.
const mocks = vi.hoisted(() => {
  const credential = vi.fn(() => ({ providerId: 'google.com' }));
  function GoogleAuthProvider() {
    /* stub constructor */
  }
  (GoogleAuthProvider as unknown as { credential: unknown }).credential =
    credential;
  return {
    GoogleAuthProvider,
    credential,
    linkWithCredential: vi.fn(),
    signInWithCredential: vi.fn(),
    linkWithPopup: vi.fn(),
    signInWithPopup: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    runNativeGoogleOAuth: vi.fn(async () => ({
      idToken: 'id-token',
      accessToken: 'access-token',
    })),
  };
});

const fakeAuth: { currentUser: { isAnonymous: boolean; uid: string } | null } =
  { currentUser: { isAnonymous: true, uid: 'guest' } };

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: mocks.GoogleAuthProvider,
  OAuthProvider: class OAuthProvider {
    addScope() {
      /* stub */
    }
    credential() {
      return { providerId: 'apple.com' };
    }
  },
  linkWithCredential: mocks.linkWithCredential,
  signInWithCredential: mocks.signInWithCredential,
  linkWithPopup: mocks.linkWithPopup,
  signInWithPopup: mocks.signInWithPopup,
  signInAnonymously: mocks.signInAnonymously,
  signOut: mocks.signOut,
}));

vi.mock('./config.js', () => ({
  getFirebaseAuth: () => fakeAuth,
  isFirebaseConfigured: () => true,
}));

vi.mock('./platform.js', () => ({
  isTauriRuntime: () => true,
  isTauriMobile: () => false,
  tauriPlatform: () => 'darwin',
}));

vi.mock('./google-oauth-native.js', () => ({
  runNativeGoogleOAuth: mocks.runNativeGoogleOAuth,
}));

vi.mock('./apple-oauth-native.js', () => ({
  isNativeAppleSignInSupported: () => false,
  runNativeAppleSignIn: vi.fn(),
}));

import { upgradeAnonymousToGoogle } from './auth-actions.js';

describe('upgradeAnonymousToGoogle (native runtime)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeAuth.currentUser = { isAnonymous: true, uid: 'guest' };
  });

  it('links the guest account to Google when the credential is free', async () => {
    mocks.linkWithCredential.mockResolvedValueOnce({
      user: { uid: 'guest', isAnonymous: false },
    });

    const result = await upgradeAnonymousToGoogle();

    expect(result.linked).toBe(true);
    expect(mocks.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithCredential).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('switches to the existing account WITHOUT signOut when the credential is already in use', async () => {
    // Regression: signing out first drops the user to null, and the auth
    // listener races in a fresh anonymous user that clobbers this sign-in.
    mocks.linkWithCredential.mockRejectedValueOnce({
      code: 'auth/credential-already-in-use',
    });
    mocks.signInWithCredential.mockResolvedValueOnce({
      user: { uid: 'google-user', isAnonymous: false },
    });

    const result = await upgradeAnonymousToGoogle();

    expect(result.linked).toBe(false);
    expect(result.user.uid).toBe('google-user');
    expect(mocks.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('rethrows unexpected link errors', async () => {
    mocks.linkWithCredential.mockRejectedValueOnce({
      code: 'auth/network-request-failed',
    });

    await expect(upgradeAnonymousToGoogle()).rejects.toMatchObject({
      code: 'auth/network-request-failed',
    });
    expect(mocks.signInWithCredential).not.toHaveBeenCalled();
  });
});
