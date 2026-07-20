import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const linkWithCredential = vi.fn();
const getFirebaseAuth = vi.fn();

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(
    class GoogleAuthProvider {},
    {
      credential: (idToken: string) => ({ idToken }),
    }
  ),
  linkWithCredential: (...args: unknown[]) => linkWithCredential(...args),
}));

vi.mock('./config.js', () => ({
  getFirebaseAuth: () => getFirebaseAuth(),
}));

describe('e2e-auth-hooks', () => {
  beforeEach(() => {
    linkWithCredential.mockReset();
    getFirebaseAuth.mockReset();
    delete window.__warp12E2eVerifyAccount;
  });

  afterEach(() => {
    delete window.__warp12E2eVerifyAccount;
  });

  it('links a fake Google credential for anonymous users', async () => {
    const anonymous = { uid: 'guest-1', isAnonymous: true, getIdToken: vi.fn() };
    const linked = {
      uid: 'guest-1',
      isAnonymous: false,
      getIdToken: vi.fn().mockResolvedValue('tok'),
    };
    getFirebaseAuth.mockReturnValue({ currentUser: anonymous });
    linkWithCredential.mockResolvedValue({ user: linked });

    const { e2eVerifyCurrentAccount, fakeEmulatorGoogleIdToken } = await import(
      './e2e-auth-hooks.js'
    );
    const user = await e2eVerifyCurrentAccount();
    expect(user).toBe(linked);
    expect(linkWithCredential).toHaveBeenCalledOnce();
    expect(window.__warp12E2eAllowRatedLaunch).toBe(true);
    const token = fakeEmulatorGoogleIdToken('guest-1');
    expect(token.split('.')).toHaveLength(3);
  });

  it('no-ops when already verified', async () => {
    const verified = { uid: 'host-1', isAnonymous: false };
    getFirebaseAuth.mockReturnValue({ currentUser: verified });

    const { e2eVerifyCurrentAccount } = await import('./e2e-auth-hooks.js');
    const user = await e2eVerifyCurrentAccount();
    expect(user).toBe(verified);
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});
