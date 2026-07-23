import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';

const db = admin.firestore();

const ACTIVE_PHASES = ['lobby', 'active', 'round-end'] as const;
/** Drop stale Lattice rooms that never finished cleanly. */
const LATTICE_ACTIVE_WINDOW_MS = 90 * 60 * 1000;

type CacheEntry = {
  at: number;
  active: number;
  latticeActive: number;
  scanned: number;
  latticeScanned: number;
};
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

function asMillis(value: unknown): number | null {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

async function countWarpActive(): Promise<{ active: number; scanned: number }> {
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
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!activePhases.has(String(data.phase ?? ''))) {
      continue;
    }
    if (data.opsTerminated === true) {
      continue;
    }
    active += 1;
  }
  return { active, scanned: snap.size };
}

async function countLatticeActive(): Promise<{
  active: number;
  scanned: number;
}> {
  const cutoff = Date.now() - LATTICE_ACTIVE_WINDOW_MS;
  let snap: admin.firestore.QuerySnapshot;
  try {
    snap = await db
      .collection('latticeRooms')
      .orderBy('updatedAt', 'desc')
      .limit(200)
      .get();
  } catch {
    return { active: 0, scanned: 0 };
  }

  let active = 0;
  for (const roomSnap of snap.docs) {
    const data = roomSnap.data();
    if (!data.whitePlayerId || !data.blackPlayerId) {
      continue;
    }
    const updatedAt = asMillis(data.updatedAt);
    if (updatedAt != null && updatedAt < cutoff) {
      continue;
    }
    const stateSnap = await roomSnap.ref
      .collection('meta')
      .doc('gameState')
      .get();
    if (stateSnap.exists && stateSnap.data()?.winner) {
      continue;
    }
    active += 1;
  }
  return { active, scanned: snap.size };
}

/**
 * Public sector activity pulse for iwgf.org (and similar). No auth required.
 * Warp: games in lobby / active / round-end that are not ops-terminated.
 * Lattice: seated rooms updated recently with no winner yet.
 */
export const countActiveSectors = onCall(async () => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return {
      ok: true as const,
      active: cache.active,
      latticeActive: cache.latticeActive,
      scanned: cache.scanned,
      latticeScanned: cache.latticeScanned,
      cached: true,
      updatedAt: new Date(cache.at).toISOString(),
    };
  }

  const [warp, lattice] = await Promise.all([
    countWarpActive(),
    countLatticeActive(),
  ]);

  cache = {
    at: now,
    active: warp.active,
    latticeActive: lattice.active,
    scanned: warp.scanned,
    latticeScanned: lattice.scanned,
  };
  return {
    ok: true as const,
    active: warp.active,
    latticeActive: lattice.active,
    scanned: warp.scanned,
    latticeScanned: lattice.scanned,
    cached: false,
    updatedAt: new Date(now).toISOString(),
  };
});
