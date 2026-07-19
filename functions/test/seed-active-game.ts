import type { Firestore } from 'firebase-admin/firestore';

export interface SeedCaptain {
  id: string;
  displayName: string;
  isAi?: boolean;
  skill?: string;
}

export interface SeedActiveGameOptions {
  gameId: string;
  hostId: string;
  captains: readonly SeedCaptain[];
  phase?: 'lobby' | 'active' | 'complete';
  rated?: boolean;
  paused?: boolean;
  allowSpectate?: boolean;
  spectatorIds?: readonly string[];
}

/** Minimal active-sector document for host continuity / drop callables. */
export async function seedActiveGame(
  db: Firestore,
  options: SeedActiveGameOptions
): Promise<void> {
  const {
    gameId,
    hostId,
    captains,
    phase = 'active',
    rated = false,
    paused = false,
    allowSpectate = true,
    spectatorIds = [],
  } = options;
  const captainIds = captains.map((c) => c.id);
  const now = new Date().toISOString();

  const round =
    phase === 'active'
      ? {
          phase: 'playing',
          roundNumber: 1,
          turnOrder: [...captainIds],
          activePlayerId: hostId,
          handCounts: Object.fromEntries(captainIds.map((id) => [id, 5])),
          unchartedSectors: [],
          table: {
            spacedock: { low: 12, high: 12 },
            warpTrails: captainIds.map((id) => ({
              trailPlayerId: id,
              tiles: [],
            })),
            neutralZone: { tiles: [] },
          },
        }
      : null;

  await db
    .collection('games')
    .doc(gameId)
    .set({
      phase,
      hostId,
      captains: captains.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        isAi: c.isAi === true,
        ...(c.skill ? { skill: c.skill } : {}),
        joinedAt: now,
      })),
      captainIds,
      rated,
      paused,
      allowSpectate,
      spectatorIds: [...spectatorIds],
      maxPip: 12,
      fleetSize: captains.length,
      updatedAt: now,
      createdAt: now,
      round,
    });

  if (phase === 'active') {
    const batch = db.batch();
    for (const id of captainIds) {
      if (id.startsWith('ai:')) {
        continue;
      }
      batch.set(db.collection('games').doc(gameId).collection('hands').doc(id), {
        captainId: id,
        coordinates: [
          { low: 0, high: 1 },
          { low: 2, high: 3 },
        ],
        updatedAt: now,
      });
    }
    await batch.commit();
  }
}
