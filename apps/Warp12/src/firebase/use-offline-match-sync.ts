import { useEffect } from 'react';

import { isFirebaseConfigured } from './config.js';
import {
  flushPendingLocalAiMatches,
  pendingLocalAiMatchCount,
} from './stats-service.js';
import {
  isNetworkAvailable,
  pruneNonReplayablePendingLocalAiMatches,
} from '../game/offline-match-queue.js';

/**
 * When the app regains connectivity, upload queued offline vs-AI match reports.
 */
export function useOfflineMatchSync(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid || !isFirebaseConfigured() || !isNetworkAvailable()) {
      return;
    }

    if (pendingLocalAiMatchCount(uid) === 0) {
      return;
    }

    pruneNonReplayablePendingLocalAiMatches(uid);
    if (pendingLocalAiMatchCount(uid) === 0) {
      return;
    }

    void flushPendingLocalAiMatches(uid).catch(() => {
      /* keep queue — will retry on next online event */
    });
  }, [uid]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      return;
    }

    const onOnline = () => {
      if (!isNetworkAvailable()) {
        return;
      }
      pruneNonReplayablePendingLocalAiMatches(uid);
      void flushPendingLocalAiMatches(uid).catch(() => undefined);
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [uid]);
}
