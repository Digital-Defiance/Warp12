/**
 * Append-only TEI match ledger (`ratingEvents`).
 * Prerequisite for cascade replay — does not rewind ratings by itself.
 */

import * as admin from 'firebase-admin';

import type { RatedObjective, StoredRating } from './rated-match-schema.js';
import { objectiveToTrackKey, type RatingTrackKey } from './rating-types.js';

export const RATING_EVENTS_COLLECTION = 'ratingEvents';

export type RatingEventSource = 'official' | 'online' | 'practice';
export type RatingEventPool = 'human' | 'squad' | 'group' | 'localAi';

export type RatingEventParticipant = {
  uid: string;
  displayName?: string;
  rank: number;
  won: boolean;
  ratingBefore: StoredRating;
  ratingAfter: StoredRating;
  squadId?: string;
  score?: number;
};

/** Pre-match OpenSkill table row (enough to re-run apply helpers later). */
export type RatingEventSnapshotRow = {
  playerId: string;
  rank: number;
  rating: StoredRating;
  /** Squad pool only */
  squadId?: string;
  memberIds?: string[];
};

export type RatingEventDocument = {
  eventId: string;
  source: RatingEventSource;
  matchId: string;
  pool: RatingEventPool;
  track: RatingTrackKey;
  objective: RatedObjective;
  playedAt: string;
  appliedAt: string;
  memberUids: string[];
  participants: RatingEventParticipant[];
  /** Frozen pre-match table used for this apply */
  snapshot: RatingEventSnapshotRow[];
  charterId?: string;
  seasonKey?: string;
  skill?: 'ensign' | 'lieutenant' | 'commander';
  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  writer: string;
};

const db = admin.firestore();

export function officialRatingEventId(
  matchCode: string,
  pool: 'human' | 'group'
): string {
  return `official:${matchCode}:${pool}`;
}

export function onlineRatingEventId(
  gameId: string,
  pool: 'human' | 'squad' | 'group'
): string {
  return `online:${gameId}:${pool}`;
}

export function practiceRatingEventId(
  uid: string,
  seed: number,
  skill: string,
  objective: RatedObjective
): string {
  const track = objectiveToTrackKey(objective);
  return `practice:${uid}:${seed}:${skill}:${track}`;
}

/**
 * Create-if-absent. Concurrent reporters of the same match share one event.
 */
export async function writeRatingEventIfAbsent(
  event: RatingEventDocument
): Promise<{ written: boolean }> {
  const ref = db.collection(RATING_EVENTS_COLLECTION).doc(event.eventId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { written: false };
    }
    tx.set(ref, event);
    return { written: true };
  });
}

export async function markRatingEventsVoided(input: {
  matchId: string;
  reason: string;
  actorUid: string;
  /** When set, only these event ids; otherwise all events for matchId */
  eventIds?: string[];
}): Promise<number> {
  const now = new Date().toISOString();
  let refs: admin.firestore.DocumentReference[];

  if (input.eventIds && input.eventIds.length > 0) {
    refs = input.eventIds.map((id) =>
      db.collection(RATING_EVENTS_COLLECTION).doc(id)
    );
  } else {
    const q = await db
      .collection(RATING_EVENTS_COLLECTION)
      .where('matchId', '==', input.matchId)
      .get();
    refs = q.docs.map((d) => d.ref);
  }

  let marked = 0;
  const batch = db.batch();
  for (const ref of refs) {
    batch.set(
      ref,
      {
        voided: true,
        voidedAt: now,
        voidedBy: input.actorUid,
        voidReason: input.reason,
      },
      { merge: true }
    );
    marked += 1;
  }
  if (marked > 0) {
    await batch.commit();
  }
  return marked;
}

export function snapshotFromRatedTable(
  table: readonly {
    playerId: string;
    rank: number;
    rating: StoredRating;
    squadId?: string;
    memberIds?: readonly string[];
  }[]
): RatingEventSnapshotRow[] {
  return table.map((row) => ({
    playerId: row.playerId,
    rank: row.rank,
    rating: row.rating,
    ...(row.squadId ? { squadId: row.squadId } : {}),
    ...(row.memberIds ? { memberIds: [...row.memberIds] } : {}),
  }));
}
