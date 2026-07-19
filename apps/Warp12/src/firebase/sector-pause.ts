import { doc, updateDoc } from 'firebase/firestore';

import { FIRESTORE_COLLECTIONS, getFirestoreDb } from './config.js';
import type { FirestoreGameDocument } from './schema.js';

function gameRef(gameId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return doc(db, FIRESTORE_COLLECTIONS.games, gameId);
}

/**
 * Host pauses the sector — moves are rejected until resume. Engine state is
 * left intact; clients treat this as temporary spectator mode.
 */
export async function pauseSector(
  gameId: string,
  hostId: string,
  reason?: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  const now = new Date().toISOString();
  await updateDoc(gameRef(gameId), {
    paused: true,
    pausedAt: now,
    pausedBy: hostId,
    ...(reason?.trim() ? { pauseReason: reason.trim() } : { pauseReason: null }),
    updatedAt: now,
  } satisfies Partial<FirestoreGameDocument> & { pauseReason?: string | null });
}

/** Host resumes play after a pause. */
export async function resumeSector(gameId: string, hostId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  const now = new Date().toISOString();
  await updateDoc(gameRef(gameId), {
    paused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    updatedAt: now,
  });
  void hostId;
}
