import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

import { requireAdmin, requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';
import {
  normalizeMatchCode,
  type RatedMatchDocument,
  type StoredRating,
} from '../tei/rated-match-schema';
import { toStoredRatingWithGrade } from '../tei/rating-types';
import { markRatingEventsVoided, RATING_EVENTS_COLLECTION } from '../tei/rating-ledger';

const db = admin.firestore();

export type TeiPool = 'human' | 'squad' | 'localAi' | 'group';
export type TeiTrack = 'goOut' | 'points';
export type LocalAiSkill = 'ensign' | 'lieutenant' | 'commander';

type ObjectiveBucket = {
  rating?: StoredRating;
  wins?: number;
};

function asObjectiveBucket(raw: unknown): ObjectiveBucket | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as ObjectiveBucket;
}

function readStoredRating(raw: unknown): StoredRating | null {
  const bucket = asObjectiveBucket(raw);
  const r = bucket?.rating;
  if (
    !r ||
    typeof r.mu !== 'number' ||
    typeof r.sigma !== 'number' ||
    typeof r.matches !== 'number'
  ) {
    return null;
  }
  return r;
}

async function writeAudit(entry: {
  action: string;
  actorUid: string;
  targetUid: string | null;
  detail: Record<string, unknown>;
}): Promise<void> {
  await db.collection(OPS_AUDIT_COLLECTION).add({
    ...entry,
    actorLabel: `admin:${entry.actorUid}`,
    targetBanId: null,
    at: FieldValue.serverTimestamp(),
  });
}

/** Official rated match lookup for ops (includes certificate metadata). */
export const getOpsRatedMatch = onCall(async (request) => {
  requireModerator(request);
  const matchCode = normalizeMatchCode(
    (request.data as { matchCode?: string }).matchCode?.trim() ?? ''
  );
  if (!matchCode) {
    throw new HttpsError('invalid-argument', 'matchCode required.');
  }
  const snap = await db.collection('ratedMatches').doc(matchCode).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `No rated match ${matchCode}.`);
  }
  return { ok: true, match: snap.data() as RatedMatchDocument };
});

/**
 * Manual OpenSkill override. Sets μ/σ (and optional matches) on one track;
 * recomputes displayRating + displayGrade. Mandatory reason; audited.
 */
export const opsSetCaptainRating = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as {
    uid?: string;
    pool?: TeiPool;
    track?: TeiTrack;
    /** Required for pool=localAi */
    skill?: LocalAiSkill;
    /** Required for pool=group */
    charterId?: string;
    mu?: number;
    sigma?: number;
    matches?: number;
    reason?: string;
  };

  const uid = data.uid?.trim();
  const reason = data.reason?.trim();
  const pool = data.pool;
  const track = data.track;
  if (!uid || !reason || !pool || !track) {
    throw new HttpsError(
      'invalid-argument',
      'uid, pool, track, and reason required.'
    );
  }
  if (track !== 'goOut' && track !== 'points') {
    throw new HttpsError('invalid-argument', 'track must be goOut or points.');
  }
  if (typeof data.mu !== 'number' || typeof data.sigma !== 'number') {
    throw new HttpsError('invalid-argument', 'mu and sigma (numbers) required.');
  }
  if (!(data.mu > 0) || !(data.sigma > 0)) {
    throw new HttpsError('invalid-argument', 'mu and sigma must be positive.');
  }
  if (pool === 'localAi' && !data.skill) {
    throw new HttpsError('invalid-argument', 'skill required for localAi pool.');
  }
  if (pool === 'group' && !data.charterId?.trim()) {
    throw new HttpsError(
      'invalid-argument',
      'charterId required for group pool.'
    );
  }

  const ref = db.collection('playerStats').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No playerStats for this uid.');
  }
  const stats = snap.data()!;

  let fieldPath: string;
  let previous: StoredRating | null;
  let previousWins = 0;

  if (pool === 'human') {
    fieldPath = `humanRating.${track}`;
    const bucket = asObjectiveBucket(
      (stats.humanRating as Record<string, unknown> | undefined)?.[track]
    );
    previous = readStoredRating(bucket);
    previousWins = typeof bucket?.wins === 'number' ? bucket.wins : 0;
  } else if (pool === 'squad') {
    fieldPath = `squadRating.${track}`;
    const bucket = asObjectiveBucket(
      (stats.squadRating as Record<string, unknown> | undefined)?.[track]
    );
    previous = readStoredRating(bucket);
    previousWins = typeof bucket?.wins === 'number' ? bucket.wins : 0;
  } else if (pool === 'localAi') {
    const skill = data.skill!;
    fieldPath = `localAi.${skill}.${track}`;
    const skillBucket = (stats.localAi as Record<string, unknown> | undefined)?.[
      skill
    ] as Record<string, unknown> | undefined;
    const bucket = asObjectiveBucket(skillBucket?.[track]);
    previous = readStoredRating(bucket);
    previousWins = typeof bucket?.wins === 'number' ? bucket.wins : 0;
  } else {
    const charterId = data.charterId!.trim();
    fieldPath = `groupRating.${charterId}.${track}`;
    const charterBucket = (
      stats.groupRating as Record<string, unknown> | undefined
    )?.[charterId] as Record<string, unknown> | undefined;
    const bucket = asObjectiveBucket(charterBucket?.[track]);
    previous = readStoredRating(bucket);
    previousWins = typeof bucket?.wins === 'number' ? bucket.wins : 0;
  }

  const matches =
    typeof data.matches === 'number' && data.matches >= 0
      ? Math.floor(data.matches)
      : previous?.matches ?? 0;

  const nextRating = toStoredRatingWithGrade(
    { mu: data.mu, sigma: data.sigma, matches },
    previous ?? undefined
  );

  await ref.update({
    [fieldPath]: {
      rating: nextRating,
      wins: previousWins,
    },
    updatedAt: new Date().toISOString(),
  });

  await writeAudit({
    action: 'tei_override',
    actorUid,
    targetUid: uid,
    detail: {
      reason,
      pool,
      track,
      skill: data.skill ?? null,
      charterId: data.charterId?.trim() ?? null,
      fieldPath,
      before: previous,
      after: nextRating,
    },
  });

  return {
    ok: true,
    uid,
    fieldPath,
    before: previous,
    after: nextRating,
  };
});

/**
 * Soft-void an official rated match: mark voided, clear teiClaims, strip
 * claim ids from participants. Does NOT rewind μ/σ (use opsSetCaptainRating
 * or wait for ledger cascade).
 */
export const opsVoidRatedMatch = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as { matchCode?: string; reason?: string };
  const matchCode = normalizeMatchCode(data.matchCode?.trim() ?? '');
  const reason = data.reason?.trim();
  if (!matchCode || !reason) {
    throw new HttpsError('invalid-argument', 'matchCode and reason required.');
  }

  const matchRef = db.collection('ratedMatches').doc(matchCode);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', `No rated match ${matchCode}.`);
  }
  const match = matchSnap.data() as RatedMatchDocument;
  if (match.status !== 'approved' && !(match as { voided?: boolean }).voided) {
    // Allow void of approved; also allow re-void idempotent
  }
  if ((match as { voided?: boolean }).voided === true) {
    return { ok: true, matchCode, alreadyVoided: true };
  }
  if (match.status !== 'approved') {
    throw new HttpsError(
      'failed-precondition',
      `Only approved matches can be voided (status=${match.status}). Reject drafts before approve instead.`
    );
  }

  const participantUids = (match.standings?.length
    ? match.standings
    : match.participants
  ).map((p) => p.uid);

  const stripped: string[] = [];
  const batch = db.batch();
  const statsSnaps = await Promise.all(
    participantUids.map((uid) => db.collection('playerStats').doc(uid).get())
  );
  for (const statsSnap of statsSnaps) {
    if (!statsSnap.exists) {
      continue;
    }
    const uid = statsSnap.id;
    const stats = statsSnap.data()!;
    const humanIds = Array.isArray(stats.humanRatedGameIds)
      ? (stats.humanRatedGameIds as string[]).filter((id) => id !== matchCode)
      : [];
    const squadIds = Array.isArray(stats.squadRatedGameIds)
      ? (stats.squadRatedGameIds as string[]).filter((id) => id !== matchCode)
      : [];
    const groupIds = Array.isArray(stats.groupRatedIds)
      ? (stats.groupRatedIds as string[]).filter((id) => {
          const parts = id.split(':');
          return parts[parts.length - 1] !== matchCode && id !== matchCode;
        })
      : [];
    batch.update(statsSnap.ref, {
      humanRatedGameIds: humanIds,
      squadRatedGameIds: squadIds,
      groupRatedIds: groupIds,
      updatedAt: new Date().toISOString(),
    });
    stripped.push(uid);
  }

  batch.update(matchRef, {
    voided: true,
    voidedAt: new Date().toISOString(),
    voidedBy: actorUid,
    voidReason: reason,
    teiClaims: {},
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();

  const ledgerMarked = await markRatingEventsVoided({
    matchId: matchCode,
    reason,
    actorUid,
  });

  await writeAudit({
    action: 'tei_void_match',
    actorUid,
    targetUid: null,
    detail: {
      matchCode,
      reason,
      strippedUids: stripped,
      ledgerEventsMarked: ledgerMarked,
      note: 'Soft void: claim ids stripped; μ/σ left unchanged (no cascade).',
    },
  });

  return {
    ok: true,
    matchCode,
    strippedCount: stripped.length,
    ledgerEventsMarked: ledgerMarked,
    note: 'Ratings were not rewound. Override μ/σ manually if needed.',
  };
});

/** List ledger events for one captain (newest first). */
export const listCaptainRatingEvents = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { uid?: string; limit?: number };
  const uid = data.uid?.trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const limit = Math.min(Math.max(Number(data.limit) || 40, 1), 100);
  const snap = await db
    .collection(RATING_EVENTS_COLLECTION)
    .where('memberUids', 'array-contains', uid)
    .orderBy('playedAt', 'desc')
    .limit(limit)
    .get();
  return {
    ok: true,
    uid,
    events: snap.docs.map((d) => d.data()),
  };
});

/** List ledger events for a match id (MT-… or online gameId). */
export const listMatchRatingEvents = onCall(async (request) => {
  requireModerator(request);
  const matchId = (request.data as { matchId?: string }).matchId?.trim();
  if (!matchId) {
    throw new HttpsError('invalid-argument', 'matchId required.');
  }
  const snap = await db
    .collection(RATING_EVENTS_COLLECTION)
    .where('matchId', '==', matchId)
    .get();
  const events = snap.docs
    .map((d) => d.data())
    .sort((a, b) =>
      String(b.playedAt ?? '').localeCompare(String(a.playedAt ?? ''))
    );
  return { ok: true, matchId, events };
});
