import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { requireAdmin } from './auth';
import {
  BANS_COLLECTION,
  OPS_AUDIT_COLLECTION,
  type BanDocument,
} from './ops/ban-schema';
import {
  buildIpKeys,
  classifyClientIp,
  ipOnlyBanId,
  normalizeIpv4,
  normalizeIpv6,
} from './ops/ip-address';
import { recordCaptainNetworkSignal } from './ops/captain-signals';

const db = admin.firestore();

function bansRef(banId: string) {
  return db.collection(BANS_COLLECTION).doc(banId);
}

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

function isActiveBan(data: BanDocument | undefined): boolean {
  if (!data?.active) {
    return false;
  }
  return !isExpired(data.expiresAt ?? null);
}

/** True when uid has an active, non-expired ban. */
export async function isUidBanned(uid: string): Promise<boolean> {
  if (!uid) {
    return false;
  }
  const snap = await bansRef(uid).get();
  if (!snap.exists) {
    return false;
  }
  return isActiveBan(snap.data() as BanDocument);
}

/** True when this IP key matches an active ban (v4 or v6). */
export async function isIpBanned(ipKey: string | null): Promise<boolean> {
  if (!ipKey) {
    return false;
  }
  const snap = await db
    .collection(BANS_COLLECTION)
    .where('ipKeys', 'array-contains', ipKey)
    .limit(5)
    .get();
  return snap.docs.some((d) => isActiveBan(d.data() as BanDocument));
}

export function clientIpFromRequest(
  request: CallableRequest<unknown>
): string | null {
  const raw = request.rawRequest;
  const forwarded = raw.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }
  return raw.ip || null;
}

/** Throws if uid or client IP is banned. */
export async function assertNotBanned(
  uid: string,
  request?: CallableRequest<unknown>
): Promise<void> {
  if (await isUidBanned(uid)) {
    throw new HttpsError(
      'permission-denied',
      'This captain is banned from Warp online services.'
    );
  }
  if (request) {
    const { ipKey } = classifyClientIp(clientIpFromRequest(request));
    if (await isIpBanned(ipKey)) {
      throw new HttpsError(
        'permission-denied',
        'This network address is banned from Warp online services.'
      );
    }
    // Best-effort related-account graph (never blocks; review-only).
    void recordCaptainNetworkSignal(uid, request);
  }
}

async function writeAudit(entry: {
  action: string;
  actorUid: string;
  actorLabel: string;
  targetUid: string | null;
  targetBanId: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  await db.collection(OPS_AUDIT_COLLECTION).add({
    ...entry,
    at: FieldValue.serverTimestamp(),
  });
}

async function resolveUserSnapshot(uid: string): Promise<{
  email: string | null;
  displayName: string | null;
  providers: string[];
  anonymous: boolean;
  exists: boolean;
}> {
  if (!uid) {
    return {
      email: null,
      displayName: null,
      providers: [],
      anonymous: true,
      exists: false,
    };
  }
  try {
    const user = await admin.auth().getUser(uid);
    const providers = user.providerData.map((p) => p.providerId);
    return {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      providers,
      anonymous: providers.length === 0,
      exists: true,
    };
  } catch {
    return {
      email: null,
      displayName: null,
      providers: [],
      anonymous: true,
      exists: false,
    };
  }
}

export type BanParams = {
  uid?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  reason: string;
  actorUid: string;
  actorLabel: string;
  expiresAtMs?: number | null;
  notes?: string | null;
  appealNote?: string | null;
  disableAuth?: boolean;
};

export async function applyBan(params: BanParams): Promise<BanDocument> {
  const reason = params.reason.trim();
  if (!reason) {
    throw new HttpsError('invalid-argument', 'reason is required.');
  }

  const uid = (params.uid ?? '').trim();
  const ipv4 = normalizeIpv4(params.ipv4);
  const ipv6 = normalizeIpv6(params.ipv6);

  if (!uid && !ipv4 && !ipv6) {
    throw new HttpsError(
      'invalid-argument',
      'Provide uid and/or ipv4 and/or ipv6 — one record per subject.'
    );
  }

  const banId = uid || ipOnlyBanId(ipv4, ipv6);
  const snap = await resolveUserSnapshot(uid);
  const disableAuth = Boolean(uid) && params.disableAuth !== false && snap.exists;
  if (disableAuth) {
    await admin.auth().updateUser(uid, { disabled: true });
  }

  const expiresAt =
    params.expiresAtMs != null && params.expiresAtMs > 0
      ? Timestamp.fromMillis(params.expiresAtMs)
      : null;

  const existing = await bansRef(banId).get();
  const prev = existing.exists ? (existing.data() as BanDocument) : null;
  // Merge IPs onto existing record so dual-stack stays on one idiot.
  const mergedIpv4 = ipv4 ?? prev?.ipv4 ?? null;
  const mergedIpv6 = ipv6 ?? prev?.ipv6 ?? null;

  const doc: BanDocument = {
    uid: uid || prev?.uid || '',
    banId,
    active: true,
    reason,
    bannedAt: FieldValue.serverTimestamp(),
    bannedBy: params.actorUid,
    bannedByLabel: params.actorLabel,
    expiresAt,
    email: snap.email ?? prev?.email ?? null,
    displayName: snap.displayName ?? prev?.displayName ?? null,
    providers: snap.exists ? snap.providers : (prev?.providers ?? []),
    anonymous: snap.exists ? snap.anonymous : (prev?.anonymous ?? true),
    authDisabled: disableAuth || prev?.authDisabled === true,
    notes: params.notes?.trim() || prev?.notes || null,
    appealNote:
      params.appealNote !== undefined
        ? params.appealNote?.trim() || null
        : (prev?.appealNote ?? null),
    ipv4: mergedIpv4,
    ipv6: mergedIpv6,
    ipKeys: buildIpKeys(mergedIpv4, mergedIpv6),
  };

  await bansRef(banId).set(doc, { merge: true });

  await writeAudit({
    action: 'ban',
    actorUid: params.actorUid,
    actorLabel: params.actorLabel,
    targetUid: uid || null,
    targetBanId: banId,
    detail: {
      reason,
      expiresAtMs: params.expiresAtMs ?? null,
      authDisabled: disableAuth,
      anonymous: doc.anonymous,
      ipv4: mergedIpv4,
      ipv6: mergedIpv6,
    },
  });

  logger.info('ops ban', {
    banId,
    uid: uid || null,
    ipv4: mergedIpv4,
    ipv6: mergedIpv6,
    reason,
    actor: params.actorLabel,
  });
  return doc;
}

export async function applyUnban(params: {
  banId?: string;
  uid?: string;
  actorUid: string;
  actorLabel: string;
  reenableAuth?: boolean;
}): Promise<void> {
  const banId = (params.banId ?? params.uid ?? '').trim();
  if (!banId) {
    throw new HttpsError('invalid-argument', 'banId or uid is required.');
  }

  const existing = await bansRef(banId).get();
  const data = existing.exists ? (existing.data() as BanDocument) : null;
  const wasDisabled = data?.authDisabled === true;
  const uid = data?.uid || (params.uid ?? '');

  await bansRef(banId).set(
    {
      active: false,
      unbannedAt: FieldValue.serverTimestamp(),
      unbannedBy: params.actorUid,
      unbannedByLabel: params.actorLabel,
    },
    { merge: true }
  );

  if (params.reenableAuth !== false && wasDisabled && uid) {
    try {
      await admin.auth().updateUser(uid, { disabled: false });
    } catch (err) {
      logger.warn('ops unban: could not re-enable Auth user', { uid, err });
    }
  }

  await writeAudit({
    action: 'unban',
    actorUid: params.actorUid,
    actorLabel: params.actorLabel,
    targetUid: uid || null,
    targetBanId: banId,
    detail: { reenabledAuth: wasDisabled && params.reenableAuth !== false },
  });

  logger.info('ops unban', { banId, uid: uid || null, actor: params.actorLabel });
}

export const banUser = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as {
    uid?: string;
    ipv4?: string | null;
    ipv6?: string | null;
    reason?: string;
    expiresAtMs?: number | null;
    notes?: string | null;
    appealNote?: string | null;
    disableAuth?: boolean;
  };
  if (!data.reason) {
    throw new HttpsError('invalid-argument', 'reason is required.');
  }
  if (!data.uid && !data.ipv4 && !data.ipv6) {
    throw new HttpsError(
      'invalid-argument',
      'uid and/or ipv4 and/or ipv6 required.'
    );
  }
  const doc = await applyBan({
    uid: data.uid,
    ipv4: data.ipv4,
    ipv6: data.ipv6,
    reason: data.reason,
    actorUid,
    actorLabel: `admin:${actorUid}`,
    expiresAtMs: data.expiresAtMs,
    notes: data.notes,
    appealNote: data.appealNote,
    disableAuth: data.disableAuth,
  });
  return { ok: true, ban: { ...doc, bannedAt: 'now' } };
});

export const unbanUser = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as {
    uid?: string;
    banId?: string;
    reenableAuth?: boolean;
  };
  if (!data.uid && !data.banId) {
    throw new HttpsError('invalid-argument', 'uid or banId is required.');
  }
  await applyUnban({
    uid: data.uid,
    banId: data.banId,
    actorUid,
    actorLabel: `admin:${actorUid}`,
    reenableAuth: data.reenableAuth,
  });
  return { ok: true, banId: data.banId ?? data.uid };
});

export const getBan = onCall(async (request) => {
  requireAdmin(request);
  const data = request.data as { uid?: string; banId?: string; ipv4?: string; ipv6?: string };
  const banId = (data.banId ?? data.uid ?? '').trim();
  if (banId) {
    const snap = await bansRef(banId).get();
    if (!snap.exists) {
      return { ok: true, ban: null, banned: false };
    }
    const ban = snap.data() as BanDocument;
    return { ok: true, ban, banned: isActiveBan(ban) };
  }
  const ipv4 = data.ipv4 ? normalizeIpv4(data.ipv4) : null;
  const ipv6 = data.ipv6 ? normalizeIpv6(data.ipv6) : null;
  const key = ipv4
    ? `v4:${ipv4}`
    : ipv6
      ? `v6:${ipv6}`
      : null;
  if (!key) {
    throw new HttpsError(
      'invalid-argument',
      'uid, banId, ipv4, or ipv6 required.'
    );
  }
  const snap = await db
    .collection(BANS_COLLECTION)
    .where('ipKeys', 'array-contains', key)
    .limit(1)
    .get();
  if (snap.empty) {
    return { ok: true, ban: null, banned: false };
  }
  const ban = snap.docs[0].data() as BanDocument;
  return { ok: true, ban, banned: isActiveBan(ban) };
});

export const listBans = onCall(async (request) => {
  requireAdmin(request);
  const data = request.data as { activeOnly?: boolean; limit?: number };
  const limit = Math.min(Math.max(data.limit ?? 100, 1), 500);
  const col = db.collection(BANS_COLLECTION);
  const snap =
    data.activeOnly !== false
      ? await col.where('active', '==', true).limit(limit).get()
      : await col.limit(limit).get();
  const bans = snap.docs.map((d) => d.data() as BanDocument);
  return { ok: true, bans };
});
