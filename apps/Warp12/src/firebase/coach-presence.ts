import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { FIRESTORE_COLLECTIONS, getFirestoreDb } from './config.js';
import type { FirestoreCoachPresence } from './schema.js';

export type CoachPresence = FirestoreCoachPresence;

/** How long the per-request “Advisor engaged” flash stays visible. */
export const COACH_FLASH_MS = 45_000;

export function coachPresenceRef(gameId: string, playerId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return doc(db, FIRESTORE_COLLECTIONS.games, gameId, 'presence', playerId);
}

export async function signalCoachRequest(
  gameId: string,
  playerId: string,
  roundNumber: number
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  await setDoc(
    coachPresenceRef(gameId, playerId),
    {
      coachRequestedAt: new Date().toISOString(),
      coachRoundNumber: roundNumber,
      coachUsedThisRound: true,
    } satisfies FirestoreCoachPresence,
    { merge: true }
  );
}

export function subscribeCoachPresence(
  gameId: string,
  onUpdate: (presence: Record<string, CoachPresence>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    return () => undefined;
  }

  const presenceCol = collection(
    db,
    FIRESTORE_COLLECTIONS.games,
    gameId,
    'presence'
  );

  return onSnapshot(
    presenceCol,
    (snapshot) => {
      const presence: Record<string, CoachPresence> = {};
      for (const docSnap of snapshot.docs) {
        presence[docSnap.id] = docSnap.data() as CoachPresence;
      }
      onUpdate(presence);
    },
    (err) => onError?.(err)
  );
}

export interface CoachIndicator {
  readonly flash: boolean;
  readonly usedThisRound: boolean;
}

export function resolveCoachIndicator(
  presence: CoachPresence | undefined,
  roundNumber: number,
  now = Date.now()
): CoachIndicator | null {
  if (!presence || presence.coachRoundNumber !== roundNumber) {
    return null;
  }

  const requestedAt = Date.parse(presence.coachRequestedAt ?? '');
  const flash =
    Number.isFinite(requestedAt) && now - requestedAt < COACH_FLASH_MS;

  if (!presence.coachUsedThisRound && !flash) {
    return null;
  }

  return {
    flash,
    usedThisRound: presence.coachUsedThisRound === true,
  };
}
