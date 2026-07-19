import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { requireModerator, requireSignedIn } from '../auth';
import {
  MUTES_COLLECTION,
  OPS_AUDIT_COLLECTION,
  type MuteDocument,
} from './mute-schema';

const db = admin.firestore();

function isExpired(expiresAt: unknown): boolean {
  if (!expiresAt) {
    return false;
  }
  if (expiresAt instanceof Timestamp) {
    return expiresAt.toMillis() <= Date.now();
  }
  if (
    typeof expiresAt === 'object' &&
    expiresAt !== null &&
    'toMillis' in expiresAt &&
    typeof (expiresAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (expiresAt as { toMillis: () => number }).toMillis() <= Date.now();
  }
  return false;
}

function isActiveMute(data: MuteDocument | undefined): boolean {
  if (!data?.active) {
    return false;
  }
  return !isExpired(data.expiresAt ?? null);
}

function muteMode(data: { mode?: unknown } | undefined): 'hard' | 'shadow' {
  return data?.mode === 'shadow' ? 'shadow' : 'hard';
}

/** True when uid has an active hard mute (blocks Subspace creates). */
export async function isUidHardMuted(uid: string): Promise<boolean> {
  if (!uid) {
    return false;
  }
  const snap = await db.collection(MUTES_COLLECTION).doc(uid).get();
  if (!snap.exists) {
    return false;
  }
  const data = snap.data() as MuteDocument;
  return isActiveMute(data) && muteMode(data) === 'hard';
}

/** True when uid has an active shadow mute (hide from others after write). */
export async function isUidShadowMuted(uid: string): Promise<boolean> {
  if (!uid) {
    return false;
  }
  const snap = await db.collection(MUTES_COLLECTION).doc(uid).get();
  if (!snap.exists) {
    return false;
  }
  const data = snap.data() as MuteDocument;
  return isActiveMute(data) && muteMode(data) === 'shadow';
}

export async function isUidMuted(uid: string): Promise<boolean> {
  return isUidHardMuted(uid);
}

export async function isSectorMuted(
  gameId: string,
  uid: string
): Promise<boolean> {
  if (!gameId || !uid) {
    return false;
  }
  const snap = await db
    .collection('games')
    .doc(gameId)
    .collection('mutes')
    .doc(uid)
    .get();
  if (!snap.exists) {
    return false;
  }
  const data = snap.data() as { active?: boolean; expiresAt?: unknown; mode?: unknown };
  if (!data.active || isExpired(data.expiresAt ?? null)) {
    return false;
  }
  return muteMode(data) === 'hard';
}

export async function isSectorShadowMuted(
  gameId: string,
  uid: string
): Promise<boolean> {
  if (!gameId || !uid) {
    return false;
  }
  const snap = await db
    .collection('games')
    .doc(gameId)
    .collection('mutes')
    .doc(uid)
    .get();
  if (!snap.exists) {
    return false;
  }
  const data = snap.data() as { active?: boolean; expiresAt?: unknown; mode?: unknown };
  if (!data.active || isExpired(data.expiresAt ?? null)) {
    return false;
  }
  return muteMode(data) === 'shadow';
}

function expiresFromDays(days: number | undefined): Timestamp | null {
  if (days == null || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  return Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Global mute — blocks Subspace creates across all sectors (or shadow-hides). */
export const muteUser = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    uid?: string;
    reason?: string;
    days?: number;
    notes?: string;
    mode?: 'hard' | 'shadow';
  };
  const uid = data.uid?.trim();
  const reason = data.reason?.trim();
  if (!uid || !reason) {
    throw new HttpsError('invalid-argument', 'uid and reason required.');
  }
  const mode = data.mode === 'shadow' ? 'shadow' : 'hard';

  const expiresAt = expiresFromDays(data.days);
  const doc: MuteDocument = {
    uid,
    active: true,
    reason,
    mutedAt: FieldValue.serverTimestamp(),
    mutedBy: actorUid,
    mutedByLabel: `admin:${actorUid}`,
    expiresAt,
    notes: data.notes?.trim() || null,
    mode,
  };

  await db.collection(MUTES_COLLECTION).doc(uid).set(doc, { merge: true });
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'mute',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: {
      reason,
      days: data.days ?? null,
      scope: 'global',
      mode,
    },
    at: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    muted: true,
    uid,
    mode,
    expiresAt: expiresAt?.toDate().toISOString() ?? null,
  };
});

export const unmuteUser = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const uid = (request.data as { uid?: string }).uid?.trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const ref = db.collection(MUTES_COLLECTION).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No mute record for this uid.');
  }
  await ref.set(
    {
      active: false,
      unmutedAt: FieldValue.serverTimestamp(),
      unmutedBy: actorUid,
      unmutedByLabel: `admin:${actorUid}`,
    },
    { merge: true }
  );
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'unmute',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { scope: 'global' },
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, muted: false, uid };
});

export const getMute = onCall(async (request) => {
  requireModerator(request);
  const uid = (request.data as { uid?: string }).uid?.trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const snap = await db.collection(MUTES_COLLECTION).doc(uid).get();
  const mute = snap.exists ? (snap.data() as MuteDocument) : null;
  return {
    ok: true,
    muted: isActiveMute(mute ?? undefined),
    mute,
  };
});

export const listMutes = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { all?: boolean; limit?: number };
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  let q = db.collection(MUTES_COLLECTION).orderBy('mutedAt', 'desc').limit(limit);
  if (!data.all) {
    q = db
      .collection(MUTES_COLLECTION)
      .where('active', '==', true)
      .orderBy('mutedAt', 'desc')
      .limit(limit);
  }
  const snap = await q.get();
  const mutes = snap.docs.map((d) => d.data());
  return { ok: true, mutes, count: mutes.length };
});

/** Mute a captain inside one sector only. */
export const muteInSector = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    uid?: string;
    reason?: string;
    days?: number;
    notes?: string;
    mode?: 'hard' | 'shadow';
  };
  const gameId = data.gameId?.trim();
  const uid = data.uid?.trim();
  const reason = data.reason?.trim();
  if (!gameId || !uid || !reason) {
    throw new HttpsError('invalid-argument', 'gameId, uid, and reason required.');
  }
  const mode = data.mode === 'shadow' ? 'shadow' : 'hard';
  const game = await db.collection('games').doc(gameId).get();
  if (!game.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }

  const expiresAt = expiresFromDays(data.days);
  await db
    .collection('games')
    .doc(gameId)
    .collection('mutes')
    .doc(uid)
    .set(
      {
        uid,
        gameId,
        active: true,
        reason,
        mutedAt: FieldValue.serverTimestamp(),
        mutedBy: actorUid,
        mutedByLabel: `admin:${actorUid}`,
        expiresAt,
        notes: data.notes?.trim() || null,
        mode,
      },
      { merge: true }
    );

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'mute_sector',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { gameId, reason, days: data.days ?? null, mode },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, muted: true, gameId, uid, mode };
});

/** Host mute — hard mute only, this sector. */
export const hostMuteInSector = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as {
    gameId?: string;
    uid?: string;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const uid = data.uid?.trim();
  const reason = data.reason?.trim() || 'Host muted in sector';
  if (!gameId || !uid) {
    throw new HttpsError('invalid-argument', 'gameId and uid required.');
  }
  if (uid === actorUid) {
    throw new HttpsError('invalid-argument', 'You cannot mute yourself.');
  }

  const gameSnap = await db.collection('games').doc(gameId).get();
  if (!gameSnap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const game = gameSnap.data()!;
  if (String(game.hostId ?? '') !== actorUid) {
    throw new HttpsError(
      'permission-denied',
      'Only the sector host can mute captains here.'
    );
  }
  if (game.opsTerminated === true) {
    throw new HttpsError('failed-precondition', 'Sector was terminated.');
  }
  const captainIds = Array.isArray(game.captainIds)
    ? (game.captainIds as string[])
    : [];
  if (!captainIds.includes(uid)) {
    throw new HttpsError('not-found', 'Captain not aboard this sector.');
  }

  await db
    .collection('games')
    .doc(gameId)
    .collection('mutes')
    .doc(uid)
    .set(
      {
        uid,
        gameId,
        active: true,
        reason,
        mutedAt: FieldValue.serverTimestamp(),
        mutedBy: actorUid,
        mutedByLabel: `host:${actorUid}`,
        expiresAt: null,
        notes: null,
        mode: 'hard',
      },
      { merge: true }
    );

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'host_mute_sector',
    actorUid,
    actorLabel: `host:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { gameId, reason },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, muted: true, gameId, uid, mode: 'hard' as const };
});

export const unmuteInSector = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as { gameId?: string; uid?: string };
  const gameId = data.gameId?.trim();
  const uid = data.uid?.trim();
  if (!gameId || !uid) {
    throw new HttpsError('invalid-argument', 'gameId and uid required.');
  }
  const ref = db.collection('games').doc(gameId).collection('mutes').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No sector mute for this captain.');
  }
  await ref.set(
    {
      active: false,
      unmutedAt: FieldValue.serverTimestamp(),
      unmutedBy: actorUid,
      unmutedByLabel: `admin:${actorUid}`,
    },
    { merge: true }
  );
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'unmute_sector',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { gameId },
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, muted: false, gameId, uid };
});

/** Host unmute for a captain they muted (or any mute in their sector). */
export const hostUnmuteInSector = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as { gameId?: string; uid?: string };
  const gameId = data.gameId?.trim();
  const uid = data.uid?.trim();
  if (!gameId || !uid) {
    throw new HttpsError('invalid-argument', 'gameId and uid required.');
  }

  const gameSnap = await db.collection('games').doc(gameId).get();
  if (!gameSnap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  if (String(gameSnap.data()?.hostId ?? '') !== actorUid) {
    throw new HttpsError(
      'permission-denied',
      'Only the sector host can unmute captains here.'
    );
  }

  const ref = db.collection('games').doc(gameId).collection('mutes').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No sector mute for this captain.');
  }
  await ref.set(
    {
      active: false,
      unmutedAt: FieldValue.serverTimestamp(),
      unmutedBy: actorUid,
      unmutedByLabel: `host:${actorUid}`,
    },
    { merge: true }
  );
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'host_unmute_sector',
    actorUid,
    actorLabel: `host:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { gameId },
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, muted: false, gameId, uid };
});
