import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

import { requireModerator, requireSignedIn } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';
import { isUidBanned } from '../bans';

const db = admin.firestore();

export const SPECTATOR_CAP = 32;

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

/** Join as a public spectator (does not take a fleet seat). */
export const joinSpectate = onCall(async (request) => {
  const uid = requireSignedIn(request);
  if (await isUidBanned(uid)) {
    throw new HttpsError(
      'permission-denied',
      'This captain is banned from Warp online services.'
    );
  }
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }

  const ref = db.collection('games').doc(gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Sector not found.');
    }
    const g = snap.data()!;
    if (g.opsTerminated === true) {
      throw new HttpsError('failed-precondition', 'Sector was terminated.');
    }
    const phase = String(g.phase ?? '');
    if (phase === 'complete' && g.opsTerminated !== true) {
      // Allow spectating completed tables for review unless terminated hard.
    }
    if (g.allowSpectate === false) {
      throw new HttpsError(
        'failed-precondition',
        'The host has disabled spectators for this sector.'
      );
    }
    const captainIds = Array.isArray(g.captainIds)
      ? (g.captainIds as string[])
      : [];
    if (captainIds.includes(uid)) {
      throw new HttpsError(
        'failed-precondition',
        'You are already seated in this sector — open play instead of spectate.'
      );
    }
    const spectatorIds = Array.isArray(g.spectatorIds)
      ? [...(g.spectatorIds as string[])]
      : [];
    if (spectatorIds.includes(uid)) {
      return;
    }
    if (spectatorIds.length >= SPECTATOR_CAP) {
      throw new HttpsError(
        'resource-exhausted',
        `Spectator gallery is full (${SPECTATOR_CAP}).`
      );
    }
    spectatorIds.push(uid);
    tx.update(ref, {
      spectatorIds,
      allowSpectate: g.allowSpectate !== false,
      updatedAt: new Date().toISOString(),
    });
  });

  return { ok: true, gameId, spectating: true };
});

export const leaveSpectate = onCall(async (request) => {
  const uid = requireSignedIn(request);
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const ref = db.collection('games').doc(gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return;
    }
    const g = snap.data()!;
    const spectatorIds = Array.isArray(g.spectatorIds)
      ? (g.spectatorIds as string[]).filter((id) => id !== uid)
      : [];
    tx.update(ref, {
      spectatorIds,
      updatedAt: new Date().toISOString(),
    });
  });
  return { ok: true, gameId, spectating: false };
});

/**
 * Host or admin toggle. When turning off, clears the spectator gallery.
 */
export const setAllowSpectate = onCall(async (request) => {
  const uid = requireSignedIn(request);
  const data = request.data as { gameId?: string; allow?: boolean };
  const gameId = data.gameId?.trim();
  if (!gameId || typeof data.allow !== 'boolean') {
    throw new HttpsError('invalid-argument', 'gameId and allow (boolean) required.');
  }

  const ref = db.collection('games').doc(gameId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const g = snap.data()!;
  const roles = (request.auth?.token?.roles as unknown) ?? [];
  const isOps =
    Array.isArray(roles) &&
    (roles.includes('admin') || roles.includes('moderator'));
  if (g.hostId !== uid && !isOps) {
    throw new HttpsError(
      'permission-denied',
      'Only the host, a moderator, or an admin can change spectator access.'
    );
  }
  if (g.opsTerminated === true) {
    throw new HttpsError('failed-precondition', 'Sector was terminated.');
  }

  const patch: Record<string, unknown> = {
    allowSpectate: data.allow,
    updatedAt: new Date().toISOString(),
  };
  if (!data.allow) {
    patch.spectatorIds = [];
  }
  await ref.update(patch);

  if (isOps && g.hostId !== uid) {
    await writeAudit({
      action: 'ops_set_allow_spectate',
      actorUid: uid,
      targetUid: null,
      detail: { gameId, allow: data.allow },
    });
  }

  return { ok: true, gameId, allowSpectate: data.allow };
});

/** Ops: clear all public spectators (supervision unaffected). */
export const opsDropSpectators = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const ref = db.collection('games').doc(gameId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const before = Array.isArray(snap.data()?.spectatorIds)
    ? (snap.data()!.spectatorIds as string[])
    : [];
  await ref.update({
    spectatorIds: [],
    updatedAt: new Date().toISOString(),
  });
  await writeAudit({
    action: 'ops_drop_spectators',
    actorUid,
    targetUid: null,
    detail: { gameId, dropped: before.length },
  });
  return { ok: true, gameId, dropped: before.length };
});
