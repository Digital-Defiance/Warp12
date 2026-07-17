import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

import { requireAdmin, requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';
import {
  isGlobalOfficialCharterId,
  type CharterDocument,
  type CharterJoinRequestDocument,
  type CharterMemberDocument,
} from '../tei';

const db = admin.firestore();
const CHARTERS = 'charters';
const CHARTER_MEMBERS = 'charterMembers';
const CHARTER_JOIN_REQUESTS = 'charterJoinRequests';

function charterRef(charterId: string) {
  return db.collection(CHARTERS).doc(charterId);
}

function memberRef(charterId: string, uid: string) {
  return db.collection(CHARTER_MEMBERS).doc(`${charterId}_${uid}`);
}

async function writeAudit(entry: {
  action: string;
  actorUid: string;
  targetId: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: entry.action,
    actorUid: entry.actorUid,
    actorLabel: `admin:${entry.actorUid}`,
    targetUid: null,
    targetBanId: null,
    targetCharterId: entry.targetId,
    detail: entry.detail,
    at: FieldValue.serverTimestamp(),
  });
}

type OpsCharterSummary = {
  charterId: string;
  name: string;
  slug: string;
  createdBy: string;
  memberCount: number;
  listed: boolean;
  isGlobalOfficial: boolean;
  objective: string;
  playerCount: number;
  createdAt: string;
  updatedAt: string;
};

function toSummary(data: CharterDocument): OpsCharterSummary {
  return {
    charterId: data.charterId,
    name: data.name,
    slug: data.slug,
    createdBy: data.createdBy,
    memberCount: Array.isArray(data.memberUids) ? data.memberUids.length : 0,
    listed: data.listed === true,
    isGlobalOfficial: data.isGlobalOfficial === true,
    objective: String(data.objective ?? 'points'),
    playerCount: typeof data.playerCount === 'number' ? data.playerCount : 0,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
}

/** Admin catalog of every charter (crews) with a substring name/slug/id filter. */
export const opsListCharters = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { search?: string; limit?: number };
  const limit = Math.min(Math.max(Number(data.limit) || 100, 1), 400);
  const search = data.search?.trim().toLowerCase() ?? '';

  const snap = await db
    .collection(CHARTERS)
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(limit * 4, 800))
    .get();

  let charters = snap.docs.map((doc) => toSummary(doc.data() as CharterDocument));
  if (search) {
    charters = charters.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.slug.toLowerCase().includes(search) ||
        c.charterId.toLowerCase().includes(search)
    );
  }
  charters = charters.slice(0, limit);
  return { ok: true, charters, scanned: snap.size };
});

/** Full detail for one charter — members + pending join requests. */
export const opsGetCharter = onCall(async (request) => {
  requireModerator(request);
  const { charterId } = request.data as { charterId?: string };
  const id = charterId?.trim();
  if (!id) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }
  const snap = await charterRef(id).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Charter not found.');
  }
  const charter = snap.data() as CharterDocument;

  const [memberSnaps, requestSnaps] = await Promise.all([
    db.collection(CHARTER_MEMBERS).where('charterId', '==', id).get(),
    db
      .collection(CHARTER_JOIN_REQUESTS)
      .where('charterId', '==', id)
      .where('status', '==', 'pending')
      .get(),
  ]);

  const members = memberSnaps.docs.map((doc) => {
    const m = doc.data() as CharterMemberDocument;
    return {
      uid: m.uid,
      role: m.role,
      displayName: m.displayName,
      joinedAt: String(m.joinedAt ?? ''),
    };
  });
  const pendingRequests = requestSnaps.docs.map((doc) => {
    const r = doc.data() as CharterJoinRequestDocument;
    return {
      uid: r.uid,
      displayName: r.displayName,
      requestedAt: String(r.requestedAt ?? ''),
    };
  });

  return {
    ok: true,
    charter: toSummary(charter),
    members,
    pendingRequests,
  };
});

/** Force-remove a member from a charter (cannot remove the owner). */
export const opsRemoveCharterMember = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { charterId, targetUid, reason } = request.data as {
    charterId?: string;
    targetUid?: string;
    reason?: string;
  };
  const id = charterId?.trim();
  const uid = targetUid?.trim();
  if (!id || !uid) {
    throw new HttpsError('invalid-argument', 'charterId and targetUid required.');
  }

  const removed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(charterRef(id));
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Charter not found.');
    }
    const charter = snap.data() as CharterDocument;
    if (charter.createdBy === uid) {
      throw new HttpsError(
        'failed-precondition',
        'Cannot remove the crew owner. Close the charter instead.'
      );
    }
    if (!charter.memberUids.includes(uid)) {
      return false;
    }
    tx.update(charterRef(id), {
      memberUids: charter.memberUids.filter((m) => m !== uid),
      updatedAt: new Date().toISOString(),
    });
    tx.delete(memberRef(id, uid));
    return true;
  });

  await writeAudit({
    action: 'charter_remove_member',
    actorUid,
    targetId: id,
    detail: { targetUid: uid, reason: reason?.trim() ?? null, removed },
  });

  return { ok: true, removed };
});

/** Reject every pending join request on a charter. */
export const opsClearCharterJoinRequests = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { charterId, reason } = request.data as {
    charterId?: string;
    reason?: string;
  };
  const id = charterId?.trim();
  if (!id) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  const pending = await db
    .collection(CHARTER_JOIN_REQUESTS)
    .where('charterId', '==', id)
    .where('status', '==', 'pending')
    .get();

  const now = new Date().toISOString();
  let cleared = 0;
  const batch = db.batch();
  for (const doc of pending.docs) {
    batch.update(doc.ref, {
      status: 'rejected',
      resolvedAt: now,
      resolvedBy: `admin:${actorUid}`,
    });
    cleared += 1;
  }
  if (cleared > 0) {
    await batch.commit();
  }

  await writeAudit({
    action: 'charter_clear_requests',
    actorUid,
    targetId: id,
    detail: { cleared, reason: reason?.trim() ?? null },
  });

  return { ok: true, cleared };
});

/** Close (delete) a charter and its members + join requests. Global Official is protected. */
export const opsCloseCharter = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { charterId, reason } = request.data as {
    charterId?: string;
    reason?: string;
  };
  const id = charterId?.trim();
  if (!id) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }
  if (isGlobalOfficialCharterId(id)) {
    throw new HttpsError(
      'failed-precondition',
      'Global Official charters cannot be closed.'
    );
  }

  const snap = await charterRef(id).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Charter not found.');
  }
  const charter = snap.data() as CharterDocument;

  const [memberSnaps, requestSnaps] = await Promise.all([
    db.collection(CHARTER_MEMBERS).where('charterId', '==', id).get(),
    db.collection(CHARTER_JOIN_REQUESTS).where('charterId', '==', id).get(),
  ]);

  const batch = db.batch();
  for (const doc of memberSnaps.docs) {
    batch.delete(doc.ref);
  }
  for (const doc of requestSnaps.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(charterRef(id));
  await batch.commit();

  await writeAudit({
    action: 'charter_close',
    actorUid,
    targetId: id,
    detail: {
      reason: reason?.trim() ?? null,
      name: charter.name,
      memberCount: memberSnaps.size,
      clearedRequests: requestSnaps.size,
    },
  });

  return { ok: true, closed: true };
});
