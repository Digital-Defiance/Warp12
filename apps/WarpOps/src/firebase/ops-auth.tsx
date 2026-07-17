import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  userHasOpsRole,
  type WarpAuthRole,
} from './admin-roles';
import { getFirebaseAuth, isFirebaseConfigured } from './config';
import { runDesktopGoogleOAuth } from './google-oauth-desktop';
import { isTauriRuntime } from './platform';

export type OpsAuthState = {
  ready: boolean;
  configured: boolean;
  user: User | null;
  /** Admin or moderator — may use Warp Ops. */
  isOps: boolean;
  /** Full admin — bans, hard delete, TEI mutate, season, review config. */
  isAdmin: boolean;
  roles: readonly WarpAuthRole[];
  checkingAdmin: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const OpsAuthContext = createContext<OpsAuthState | null>(null);

function formatAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Popup blocked. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase sign-in. Add ops.iwdf.org in Firebase Auth settings.';
    default:
      return err instanceof Error ? err.message : 'Sign-in failed.';
  }
}

export function OpsAuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isOps, setIsOps] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<readonly WarpAuthRole[]>([]);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, [configured]);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (!user || user.isAnonymous) {
        setIsOps(false);
        setIsAdmin(false);
        setRoles([]);
        setCheckingAdmin(false);
        return;
      }
      setCheckingAdmin(true);
      try {
        const next = await userHasOpsRole(user, true);
        if (!cancelled) {
          setIsOps(next.isOps);
          setIsAdmin(next.isAdmin);
          setRoles(next.roles);
        }
      } catch {
        if (!cancelled) {
          setIsOps(false);
          setIsAdmin(false);
          setRoles([]);
        }
      } finally {
        if (!cancelled) {
          setCheckingAdmin(false);
        }
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const clearRoles = () => {
    setIsOps(false);
    setIsAdmin(false);
    setRoles([]);
  };

  const value: OpsAuthState = {
    ready,
    configured,
    user,
    isOps,
    isAdmin,
    roles,
    checkingAdmin,
    error,
    signIn: async () => {
      setError(null);
      const auth = getFirebaseAuth();
      if (!auth) {
        setError('Firebase is not configured.');
        return;
      }
      try {
        // Tauri WKWebView cannot complete Firebase popup OAuth — use the same
        // system-browser + loopback flow as The Bridge desktop app.
        if (isTauriRuntime()) {
          const tokens = await runDesktopGoogleOAuth();
          const credential = GoogleAuthProvider.credential(
            tokens.idToken,
            tokens.accessToken ?? undefined
          );
          await signInWithCredential(auth, credential);
          return;
        }
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (err) {
        setError(formatAuthError(err));
      }
    },
    signOut: async () => {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
      clearRoles();
    },
    refreshAdmin: async () => {
      if (!user) {
        clearRoles();
        return;
      }
      setCheckingAdmin(true);
      try {
        const next = await userHasOpsRole(user, true);
        setIsOps(next.isOps);
        setIsAdmin(next.isAdmin);
        setRoles(next.roles);
      } finally {
        setCheckingAdmin(false);
      }
    },
  };

  return (
    <OpsAuthContext.Provider value={value}>{children}</OpsAuthContext.Provider>
  );
}

export function useOpsAuth(): OpsAuthState {
  const ctx = useContext(OpsAuthContext);
  if (!ctx) {
    throw new Error('useOpsAuth must be used within OpsAuthProvider');
  }
  return ctx;
}
