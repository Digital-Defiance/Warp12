import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { getFirebaseAuth, isFirebaseConfigured } from './config.js';

export interface FirebaseAuthState {
  ready: boolean;
  configured: boolean;
  user: User | null;
  error: string | null;
}

export function useFirebaseAuth(): FirebaseAuthState {
  const [state, setState] = useState<FirebaseAuthState>({
    ready: !isFirebaseConfigured(),
    configured: isFirebaseConfigured(),
    user: null,
    error: null,
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setState({
        ready: true,
        configured: false,
        user: null,
        error: 'Firebase auth unavailable',
      });
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState({
          ready: true,
          configured: true,
          user,
          error: null,
        });
        return;
      }

      try {
        const credential = await signInAnonymously(auth);
        setState({
          ready: true,
          configured: true,
          user: credential.user,
          error: null,
        });
      } catch (err) {
        setState({
          ready: true,
          configured: true,
          user: null,
          error: err instanceof Error ? err.message : 'Sign-in failed',
        });
      }
    });

    return unsub;
  }, []);

  return state;
}
