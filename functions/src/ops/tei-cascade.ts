/**
 * Scope A TEI cascade: rewind + replay one captain’s personal timeline after
 * a voided ledger event. Opponent priors stay frozen from each event’s
 * snapshot (approximate; full multiplayer closure is a later upgrade).
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { updateVsAI } from 'warp12-engine';

import { requireAdmin } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';
import { applyHumanRatingForPlayer } from '../tei/apply-human-tei';
import {
  applyGroupRatingForPlayer,
  groupObjectiveRatingStats,
} from '../tei/apply-group-tei';
import {
  applySquadRatingForPlayer,
  type SquadRatedPlayer,
} from '../tei/apply-squad-tei';
import {
  RATING_EVENTS_COLLECTION,
  type RatingEventDocument,
  type RatingEventParticipant,
} from '../tei/rating-ledger';
import {
  humanObjectiveRatingStats,
  squadObjectiveRatingStats,
  type PlayerStatsDocument,
  type StoredRating,
} from '../tei/rated-match-schema';
import { toStoredRatingWithGrade } from '../tei/rating-types';
import type { RatedPlayer } from '../tei/stats-openskill';

const db = admin.firestore();

type CascadeStep = {
  eventId: string;
  matchId: string;
  uid: string;
  before: StoredRating;
  after: StoredRating;
};

type LocalAiStats = PlayerStatsDocument & {
  localAi?: Record<string, Record<string, { rating?: StoredRating; wins?: number }>>;
};

function participantFor(
  event: RatingEventDocument,
  uid: string
): RatingEventParticipant | undefined {
  return event.participants.find((p) => p.uid === uid);
}

function sameScope(a: RatingEventDocument, b: RatingEventDocument): boolean {
  if (a.pool !== b.pool || a.track !== b.track) {
    return false;
  }
  if (a.pool === 'group') {
    return a.charterId === b.charterId && a.seasonKey === b.seasonKey;
  }
  if (a.pool === 'localAi') {
    return a.skill === b.skill;
  }
  return true;
}

function eventOrderKey(e: RatingEventDocument): string {
  return `${e.playedAt}\0${e.eventId}`;
}

async function loadPersonalTimeline(
  uid: string,
  anchor: RatingEventDocument
): Promise<RatingEventDocument[]> {
  const snap = await db
    .collection(RATING_EVENTS_COLLECTION)
    .where('memberUids', 'array-contains', uid)
    .orderBy('playedAt', 'asc')
    .get();

  const anchorKey = eventOrderKey(anchor);
  return snap.docs
    .map((d) => d.data() as RatingEventDocument)
    .filter(
      (e) =>
        sameScope(e, anchor) &&
        eventOrderKey(e) > anchorKey &&
        e.voided !== true
    );
}

function readBucket(
  stats: LocalAiStats,
  event: RatingEventDocument
): { rating: StoredRating; wins: number } {
  if (event.pool === 'human') {
    const b = humanObjectiveRatingStats(stats, event.objective);
    return { rating: b.rating, wins: b.wins };
  }
  if (event.pool === 'squad') {
    const b = squadObjectiveRatingStats(stats, event.objective);
    return { rating: b.rating, wins: b.wins };
  }
  if (event.pool === 'group') {
    const b = groupObjectiveRatingStats(
      stats,
      event.charterId!,
      event.objective,
      event.seasonKey
    );
    return { rating: b.rating, wins: b.wins };
  }
  const skill = event.skill!;
  const bucket = stats.localAi?.[skill]?.[event.track];
  return {
    rating: bucket?.rating ?? {
      mu: 25,
      sigma: 25 / 3,
      matches: 0,
      displayRating: 0,
    },
    wins: typeof bucket?.wins === 'number' ? bucket.wins : 0,
  };
}

function applyBucketInMemory(
  stats: LocalAiStats,
  event: RatingEventDocument,
  rating: StoredRating,
  wins: number
): LocalAiStats {
  const track = event.track;
  if (event.pool === 'human') {
    return {
      ...stats,
      humanRating: {
        ...stats.humanRating,
        [track]: { rating, wins },
      },
    };
  }
  if (event.pool === 'squad') {
    return {
      ...stats,
      squadRating: {
        ...stats.squadRating,
        [track]: { rating, wins },
      },
    };
  }
  if (event.pool === 'group' && event.charterId) {
    const prior = stats.groupRating?.[event.charterId] ?? {};
    return {
      ...stats,
      groupRating: {
        ...stats.groupRating,
        [event.charterId]: {
          ...prior,
          seasonKey: event.seasonKey ?? prior.seasonKey,
          [track]: { rating, wins },
        },
      },
    };
  }
  if (event.pool === 'localAi' && event.skill) {
    return {
      ...stats,
      localAi: {
        ...stats.localAi,
        [event.skill]: {
          ...(stats.localAi?.[event.skill] ?? {}),
          [track]: { rating, wins },
        },
      },
    };
  }
  return stats;
}

function buildStatsUpdate(
  event: RatingEventDocument,
  rating: StoredRating,
  wins: number,
  existing: LocalAiStats
): Record<string, unknown> {
  const track = event.track;
  if (event.pool === 'human') {
    return {
      [`humanRating.${track}`]: { rating, wins },
      updatedAt: new Date().toISOString(),
    };
  }
  if (event.pool === 'squad') {
    return {
      [`squadRating.${track}`]: { rating, wins },
      updatedAt: new Date().toISOString(),
    };
  }
  if (event.pool === 'group') {
    const charterId = event.charterId!;
    const prior = existing.groupRating?.[charterId] ?? {};
    return {
      [`groupRating.${charterId}`]: {
        ...prior,
        seasonKey: event.seasonKey ?? prior.seasonKey,
        [track]: { rating, wins },
      },
      updatedAt: new Date().toISOString(),
    };
  }
  const skill = event.skill!;
  return {
    localAi: {
      ...existing.localAi,
      [skill]: {
        ...(existing.localAi?.[skill] ?? {}),
        [track]: { rating, wins },
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function replayEventForUid(
  event: RatingEventDocument,
  uid: string,
  stats: LocalAiStats
): { ratingAfter: StoredRating; wins: number; ratingBefore: StoredRating } | null {
  if (event.pool === 'human') {
    const table: RatedPlayer[] = event.snapshot.map((row) => ({
      playerId: row.playerId,
      rank: row.rank,
      rating: row.rating,
    }));
    const applied = applyHumanRatingForPlayer(
      stats,
      event.objective,
      table,
      uid
    );
    if (!applied) {
      return null;
    }
    const bucket = applied.humanRating[event.track];
    return {
      ratingBefore: applied.ratingBefore,
      ratingAfter: applied.ratingAfter,
      wins: bucket?.wins ?? 0,
    };
  }

  if (event.pool === 'group') {
    const table: RatedPlayer[] = event.snapshot.map((row) => ({
      playerId: row.playerId,
      rank: row.rank,
      rating: row.rating,
    }));
    const applied = applyGroupRatingForPlayer(
      stats,
      event.charterId!,
      event.objective,
      table,
      uid,
      event.seasonKey
    );
    if (!applied) {
      return null;
    }
    const bucket = applied.groupRating[event.charterId!]?.[event.track];
    return {
      ratingBefore: applied.ratingBefore,
      ratingAfter: applied.ratingAfter,
      wins: bucket?.wins ?? 0,
    };
  }

  if (event.pool === 'squad') {
    const table: SquadRatedPlayer[] = event.snapshot
      .filter((row) => typeof row.squadId === 'string')
      .map((row) => ({
        playerId: row.playerId,
        squadId: row.squadId!,
        rank: row.rank,
        rating: row.rating,
      }));
    const applied = applySquadRatingForPlayer(
      stats,
      event.objective,
      table,
      uid
    );
    if (!applied) {
      return null;
    }
    const bucket = applied.squadRating[event.track];
    return {
      ratingBefore: applied.ratingBefore,
      ratingAfter: applied.ratingAfter,
      wins: bucket?.wins ?? 0,
    };
  }

  const part = participantFor(event, uid);
  if (!part || !event.skill) {
    return null;
  }
  const prior = readBucket(stats, event);
  const aiRow = event.snapshot.find((r) => r.playerId.startsWith('ai:'));
  const aiAnchor = aiRow?.rating ?? {
    mu: 25,
    sigma: 8.33,
    matches: 999,
    displayRating: 0,
  };
  const updated = updateVsAI(
    uid,
    {
      mu: prior.rating.mu,
      sigma: prior.rating.sigma,
      matches: prior.rating.matches,
    },
    event.skill,
    {
      mu: aiAnchor.mu,
      sigma: aiAnchor.sigma,
      matches: aiAnchor.matches,
    },
    part.won
  );
  const ratingAfter = toStoredRatingWithGrade(
    { ...updated, matches: prior.rating.matches + 1 },
    prior.rating
  );
  return {
    ratingBefore: prior.rating,
    ratingAfter,
    wins: prior.wins + (part.won ? 1 : 0),
  };
}

async function cascadeUid(input: {
  anchor: RatingEventDocument;
  uid: string;
  dryRun: boolean;
}): Promise<{ uid: string; restoredTo: StoredRating; steps: CascadeStep[] }> {
  const { anchor, uid, dryRun } = input;
  const part = participantFor(anchor, uid);
  if (!part) {
    throw new HttpsError(
      'failed-precondition',
      `No participant ${uid} on event.`
    );
  }

  const statsRef = db.collection('playerStats').doc(uid);
  const statsSnap = await statsRef.get();
  if (!statsSnap.exists) {
    throw new HttpsError('not-found', `No playerStats for ${uid}.`);
  }

  let stats = statsSnap.data() as LocalAiStats;
  const current = readBucket(stats, anchor);
  const wins = Math.max(0, current.wins - (part.won ? 1 : 0));
  const restoredTo = part.ratingBefore;

  stats = applyBucketInMemory(stats, anchor, restoredTo, wins);
  if (!dryRun) {
    await statsRef.update(buildStatsUpdate(anchor, restoredTo, wins, stats));
  }

  const later = await loadPersonalTimeline(uid, anchor);
  const steps: CascadeStep[] = [];

  for (const event of later) {
    const replayed = replayEventForUid(event, uid, stats);
    if (!replayed) {
      continue;
    }
    steps.push({
      eventId: event.eventId,
      matchId: event.matchId,
      uid,
      before: replayed.ratingBefore,
      after: replayed.ratingAfter,
    });

    stats = applyBucketInMemory(
      stats,
      event,
      replayed.ratingAfter,
      replayed.wins
    );

    if (!dryRun) {
      await statsRef.update(
        buildStatsUpdate(event, replayed.ratingAfter, replayed.wins, stats)
      );
      const participants = event.participants.map((p) =>
        p.uid === uid
          ? {
              ...p,
              ratingBefore: replayed.ratingBefore,
              ratingAfter: replayed.ratingAfter,
            }
          : p
      );
      await db.collection(RATING_EVENTS_COLLECTION).doc(event.eventId).update({
        participants,
        cascadedAt: new Date().toISOString(),
      });
    }
  }

  return { uid, restoredTo, steps };
}

/**
 * Void (if needed) + Scope A cascade from a ledger event.
 * Mandatory reason. dryRun=true returns the plan without writes.
 */
export const opsCascadeFromRatingEvent = onCall(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    const actorUid = requireAdmin(request);
    const data = request.data as {
      eventId?: string;
      reason?: string;
      dryRun?: boolean;
    };
    const eventId = data.eventId?.trim();
    const reason = data.reason?.trim();
    const dryRun = data.dryRun === true;
    if (!eventId || !reason) {
      throw new HttpsError('invalid-argument', 'eventId and reason required.');
    }

    const eventRef = db.collection(RATING_EVENTS_COLLECTION).doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', `No rating event ${eventId}.`);
    }
    const anchor = { ...(eventSnap.data() as RatingEventDocument) };

    if (!dryRun && anchor.voided !== true) {
      await eventRef.set(
        {
          voided: true,
          voidedAt: new Date().toISOString(),
          voidedBy: actorUid,
          voidReason: reason,
        },
        { merge: true }
      );
      anchor.voided = true;
    }

    const results = [];
    for (const uid of anchor.memberUids) {
      results.push(await cascadeUid({ anchor, uid, dryRun }));
    }

    if (!dryRun) {
      await db.collection(OPS_AUDIT_COLLECTION).add({
        action: 'tei_cascade',
        actorUid,
        actorLabel: `admin:${actorUid}`,
        targetUid: null,
        targetBanId: null,
        detail: {
          reason,
          eventId,
          matchId: anchor.matchId,
          pool: anchor.pool,
          track: anchor.track,
          scope: 'personal-timeline',
          results: results.map((r) => ({
            uid: r.uid,
            restoredMu: r.restoredTo.mu,
            steps: r.steps.length,
          })),
        },
        at: FieldValue.serverTimestamp(),
      });
    }

    return {
      ok: true,
      dryRun,
      eventId,
      matchId: anchor.matchId,
      pool: anchor.pool,
      track: anchor.track,
      results,
      note: dryRun
        ? 'Dry run only — no writes.'
        : 'Scope A cascade: personal timelines only; opponent priors frozen from snapshots.',
    };
  }
);
