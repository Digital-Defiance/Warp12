import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { isAiCaptain, isAiCaptainId } from '../game/ai-captain.js';
import { FIRESTORE_COLLECTIONS, getFirestoreDb } from './config.js';
import type { FirestorePlayerHandDocument } from './schema.js';

type Coordinate = { low: number; high: number };

function handRef(gameId: string, playerId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return doc(db, FIRESTORE_COLLECTIONS.games, gameId, 'hands', playerId);
}

export async function fetchAiCaptainHand(
  gameId: string,
  captainId: string
): Promise<readonly Coordinate[]> {
  if (!isAiCaptainId(captainId)) {
    return [];
  }
  const snap = await getDoc(handRef(gameId, captainId));
  return snap.exists()
    ? (snap.data() as FirestorePlayerHandDocument).coordinates
    : [];
}

export function subscribeAiHands(
  gameId: string,
  aiCaptainIds: readonly string[],
  onUpdate: (hands: Record<string, readonly Coordinate[]>) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    onError(new Error('Firebase is not configured'));
    return () => undefined;
  }

  const ids = aiCaptainIds.filter(isAiCaptainId);
  if (ids.length === 0) {
    onUpdate({});
    return () => undefined;
  }

  const latest: Record<string, readonly Coordinate[]> = {};
  const publish = () => onUpdate({ ...latest });

  const unsubs = ids.map((captainId) =>
    onSnapshot(
      handRef(gameId, captainId),
      (snap) => {
        latest[captainId] = snap.exists()
          ? (snap.data() as FirestorePlayerHandDocument).coordinates
          : [];
        publish();
      },
      (err) => onError(err)
    )
  );

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

export function subscribeHostAiHands(
  gameId: string,
  aiCaptainIds: readonly string[],
  onUpdate: (hands: Record<string, readonly Coordinate[]>) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return subscribeAiHands(gameId, aiCaptainIds, onUpdate, onError);
}

export { isAiCaptain };
