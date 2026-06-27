import type { Transaction } from 'firebase/firestore';

import type { FirestorePlayerHandDocument } from './schema.js';

type Coordinate = { low: number; high: number };

export type HandRefFn = (
  gameId: string,
  playerId: string
) => ReturnType<typeof import('firebase/firestore').doc>;

/** Load every captain's private hand — required for penalty scoring and redeal. */
export async function loadPrivateHandsForTurnOrder(
  tx: Transaction,
  gameId: string,
  turnOrder: readonly string[],
  ref: HandRefFn
): Promise<Record<string, readonly Coordinate[]>> {
  const hands: Record<string, readonly Coordinate[]> = {};
  for (const captainId of turnOrder) {
    const snap = await tx.get(ref(gameId, captainId));
    hands[captainId] = snap.exists()
      ? (snap.data() as FirestorePlayerHandDocument).coordinates
      : [];
  }
  return hands;
}

export function toHandDocument(
  playerId: string,
  coordinates: readonly Coordinate[]
): FirestorePlayerHandDocument {
  return {
    captainId: playerId,
    coordinates: coordinates.map((c) => ({ low: c.low, high: c.high })),
    updatedAt: new Date().toISOString(),
  };
}

/** Whether END_ROUND should redeals tiles into the hands subcollection. */
export function shouldRedealHandsAfterScore(
  phase: import('@warp12/Warp12-lib').GamePhase
): boolean {
  return phase === 'active';
}
