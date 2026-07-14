import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getFirestoreDb } from './config.js';

export interface SquadMatchSquadView {
  readonly id: string;
  readonly memberIds: readonly string[];
  readonly rank: number;
  readonly name?: string;
  readonly memberDisplayNames: readonly string[];
}

export interface SquadMatchView {
  readonly gameId: string;
  readonly playedAt: string;
  readonly objective: 'points' | 'go-out';
  readonly squadrons: readonly SquadMatchSquadView[];
  readonly winnerSquadIds: readonly string[];
}

/** Recent rated Zeta sectors the signed-in captain was aboard. */
export async function listMySquadMatches(
  uid: string,
  max = 12
): Promise<SquadMatchView[]> {
  const db = getFirestoreDb();
  if (!db) {
    return [];
  }
  const q = query(
    collection(db, 'squadMatches'),
    where('memberUids', 'array-contains', uid),
    orderBy('playedAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => {
    const data = doc.data() as SquadMatchView & { gameId?: string };
    return {
      gameId: data.gameId ?? doc.id,
      playedAt: data.playedAt,
      objective: data.objective,
      squadrons: data.squadrons ?? [],
      winnerSquadIds: data.winnerSquadIds ?? [],
    };
  });
}
