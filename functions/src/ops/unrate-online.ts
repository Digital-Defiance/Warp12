/**
 * Soft-unrate an online sector without Scope A cascade.
 * Strips claim ids, voids ON- certificate + ledger events; leaves μ/σ alone.
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';
import { onlineCertificateMatchCode } from '../tei/issue-certificate';
import { markRatingEventsVoided } from '../tei/rating-ledger';

const db = admin.firestore();

function stripId(list: unknown, id: string): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return (list as string[]).filter((row) => row !== id);
}

export const opsUnrateOnlineSector = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as { gameId?: string; reason?: string };
  const gameId = data.gameId?.trim();
  const reason = data.reason?.trim();
  if (!gameId || !reason) {
    throw new HttpsError('invalid-argument', 'gameId and reason required.');
  }

  const gameRef = db.collection('games').doc(gameId);
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const game = gameSnap.data()!;
  if (game.opsUnrated === true) {
    return { ok: true, gameId, alreadyUnrated: true };
  }

  const matchCode = onlineCertificateMatchCode(gameId);
  const captains = Array.isArray(game.captains) ? game.captains : [];
  const uids = captains
    .map((c: { id?: unknown }) => (typeof c.id === 'string' ? c.id : null))
    .filter((uid): uid is string => !!uid);

  const stripped: string[] = [];
  const batch = db.batch();
  const statsSnaps = await Promise.all(
    uids.map((uid) => db.collection('playerStats').doc(uid).get())
  );
  for (const statsSnap of statsSnaps) {
    if (!statsSnap.exists) {
      continue;
    }
    const uid = statsSnap.id;
    const stats = statsSnap.data()!;
    const humanIds = stripId(stats.humanRatedGameIds, gameId);
    const squadIds = stripId(stats.squadRatedGameIds, gameId);
    // Certificates use ON-…; strip both forms if present.
    const humanIds2 = stripId(humanIds, matchCode);
    const squadIds2 = stripId(squadIds, matchCode);
    const groupIds = Array.isArray(stats.groupRatedIds)
      ? (stats.groupRatedIds as string[]).filter((id) => {
          const parts = id.split(':');
          const tail = parts[parts.length - 1];
          return tail !== gameId && tail !== matchCode && id !== gameId && id !== matchCode;
        })
      : [];
    batch.update(statsSnap.ref, {
      humanRatedGameIds: humanIds2,
      squadRatedGameIds: squadIds2,
      groupRatedIds: groupIds,
      updatedAt: new Date().toISOString(),
    });
    stripped.push(uid);
  }

  batch.update(gameRef, {
    rated: false,
    opsUnrated: true,
    opsUnratedAt: new Date().toISOString(),
    opsUnratedBy: actorUid,
    opsUnratedReason: reason.slice(0, 2000),
    updatedAt: new Date().toISOString(),
  });

  const certRef = db.collection('ratedMatches').doc(matchCode);
  const certSnap = await certRef.get();
  if (certSnap.exists && certSnap.data()?.voided !== true) {
    batch.update(certRef, {
      voided: true,
      voidedAt: new Date().toISOString(),
      voidedBy: actorUid,
      voidReason: reason.slice(0, 2000),
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();

  const ledgerMarked = await markRatingEventsVoided({
    matchId: gameId,
    reason,
    actorUid,
  });

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'tei_unrate_online_sector',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: null,
    targetBanId: null,
    detail: {
      gameId,
      matchCode,
      reason,
      strippedUids: stripped,
      ledgerEventsMarked: ledgerMarked,
      note: 'Soft unrate: claim ids stripped; μ/σ unchanged (no cascade).',
    },
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    gameId,
    matchCode,
    strippedCount: stripped.length,
    ledgerEventsMarked: ledgerMarked,
    note: 'Ratings were not rewound. Override μ/σ or cascade manually if needed.',
  };
});
