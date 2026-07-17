/**
 * Rating-abuse heuristics → moderation queue (review-only).
 * Never voids ratings, cascades, mutes, or bans automatically.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import {
  RATING_EVENTS_COLLECTION,
  type RatingEventDocument,
} from '../tei/rating-ledger';
import { openSystemIntegrityReport } from './integrity-reports';

/** Same human/squad cohort rematch window. */
const REMATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Minimum shared cohort size to flag (2 = head-to-head rematch). */
const MIN_SHARED_UIDS = 2;
/** How many rematches in the window before elevating. */
const REMATCH_COUNT_THRESHOLD = 3;

function cohortKey(uids: string[]): string {
  return [...uids].sort().join('|');
}

/**
 * When a new online/official rating event is written, look for recent events
 * sharing the same member cohort and open an integrity report if rematch-heavy.
 */
export const onRatingEventAbuseReview = onDocumentCreated(
  `${RATING_EVENTS_COLLECTION}/{eventId}`,
  async (event) => {
    const data = event.data?.data() as RatingEventDocument | undefined;
    if (!data) {
      return;
    }
    if (data.source !== 'online' && data.source !== 'official') {
      return;
    }
    if (data.voided === true) {
      return;
    }
    const memberUids = Array.isArray(data.memberUids)
      ? data.memberUids.filter((uid) => typeof uid === 'string' && uid.length > 0)
      : [];
    if (memberUids.length < MIN_SHARED_UIDS) {
      return;
    }

    const playedAtMs = Date.parse(data.playedAt);
    if (!Number.isFinite(playedAtMs)) {
      return;
    }
    const windowStart = new Date(playedAtMs - REMATCH_WINDOW_MS).toISOString();

    // Query recent events for one member, filter cohort in memory (avoids
    // array-contains-any + multi-field composite for every pair).
    const anchorUid = [...memberUids].sort()[0]!;
    const snap = await event.data!.ref.parent
      .where('memberUids', 'array-contains', anchorUid)
      .where('playedAt', '>=', windowStart)
      .orderBy('playedAt', 'desc')
      .limit(40)
      .get();

    const cohort = cohortKey(memberUids);
    const matches = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as RatingEventDocument) }))
      .filter((row) => {
        if (row.voided === true) {
          return false;
        }
        if (row.source !== 'online' && row.source !== 'official') {
          return false;
        }
        const uids = Array.isArray(row.memberUids) ? row.memberUids : [];
        return cohortKey(uids) === cohort;
      });

    if (matches.length < REMATCH_COUNT_THRESHOLD) {
      return;
    }

    await openSystemIntegrityReport({
      detector: 'rematch-cohort',
      stableKeyParts: [cohort, data.pool, data.track],
      reason: `${matches.length} rated ${data.pool}/${data.track} matches with the same captain cohort within 7 days. Possible rematch / win-trading — human review only.`,
      subjectType: 'captain',
      targetUid: anchorUid,
      gameId: data.source === 'online' ? data.matchId : null,
      evidence: {
        cohortUids: memberUids,
        pool: data.pool,
        track: data.track,
        matchCount: matches.length,
        threshold: REMATCH_COUNT_THRESHOLD,
        windowDays: 7,
        triggeringEventId: data.eventId,
        eventIds: matches.map((row) => row.eventId).slice(0, 20),
        matchIds: matches.map((row) => row.matchId).slice(0, 20),
      },
      priority: matches.length >= REMATCH_COUNT_THRESHOLD + 2 ? 'elevated' : 'normal',
    });
  }
);
