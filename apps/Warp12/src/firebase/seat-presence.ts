import { setDoc } from 'firebase/firestore';

import { coachPresenceRef } from './coach-presence.js';
import type { FirestoreCoachPresence } from './schema.js';

/** How often seated humans ping presence while the sector is active. */
export const SEAT_HEARTBEAT_MS = 8_000;

/**
 * Consider a human seat missing when their last heartbeat is older than this.
 * Must be > SEAT_HEARTBEAT_MS with room for a missed tick.
 */
export const SEAT_STALE_MS = 25_000;

/** Write / refresh this captain's seat heartbeat on the presence doc. */
export async function pingSeatPresence(
  gameId: string,
  playerId: string
): Promise<void> {
  await setDoc(
    coachPresenceRef(gameId, playerId),
    {
      lastSeenAt: new Date().toISOString(),
    } satisfies Pick<FirestoreCoachPresence, 'lastSeenAt'>,
    { merge: true }
  );
}

export function isSeatStale(
  presence: FirestoreCoachPresence | undefined,
  now = Date.now()
): boolean {
  if (!presence?.lastSeenAt) {
    // No ping yet — give them one heartbeat window after subscribe.
    return false;
  }
  const seen = Date.parse(presence.lastSeenAt);
  if (!Number.isFinite(seen)) {
    return false;
  }
  return now - seen > SEAT_STALE_MS;
}
