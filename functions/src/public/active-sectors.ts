import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';

const db = admin.firestore();

const ACTIVE_PHASES = ['lobby', 'active', 'round-end'] as const;

type CacheEntry = { at: number; active: number; scanned: number };
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

/**
 * Public sector activity pulse for iwdf.org (and similar). No auth required.
 * Counts games in lobby / active / round-end that are not ops-terminated.
 */
export const countActiveSectors = onCall(async () => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return {
      ok: true as const,
      active: cache.active,
      scanned: cache.scanned,
      cached: true,
      updatedAt: new Date(cache.at).toISOString(),
    };
  }

  // Prefer phase+updatedAt index; fall back to a bounded recent scan.
  let snap: admin.firestore.QuerySnapshot;
  try {
    snap = await db
      .collection('games')
      .where('phase', 'in', [...ACTIVE_PHASES])
      .orderBy('updatedAt', 'desc')
      .limit(400)
      .get();
  } catch {
    snap = await db
      .collection('games')
      .orderBy('updatedAt', 'desc')
      .limit(400)
      .get();
  }

  const activePhases = new Set<string>(ACTIVE_PHASES);
  let active = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!activePhases.has(String(data.phase ?? ''))) {
      continue;
    }
    if (data.opsTerminated === true) {
      continue;
    }
    active += 1;
  }

  cache = { at: now, active, scanned: snap.size };
  return {
    ok: true as const,
    active,
    scanned: snap.size,
    cached: false,
    updatedAt: new Date(now).toISOString(),
  };
});
