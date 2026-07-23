import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Query,
  type QuerySnapshot,
} from 'firebase-admin/firestore';

import { requireAdmin, requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';

const db = admin.firestore();

const ROOMS = 'latticeRooms';
const ROOM_CODES = 'latticeRoomCodes';
const TEI = 'latticeTei';
const RATING_EVENTS = 'latticeRatingEvents';

const ACTIVE_PHASES = new Set(['lobby', 'active']);

type LatticeCaptain = {
  id: string;
  displayName: string;
  isAi: boolean;
  color: 'WHITE' | 'BLACK';
};

/** Shape aligned with OpsGameSummary so the Sectors panel can reuse UI. */
export type OpsLatticeRoomSummary = {
  id: string;
  roomCode: string;
  name: string;
  phase: string;
  hostId: string;
  createdAt: string;
  updatedAt: string;
  objective: string;
  rated: boolean;
  assisted: boolean;
  maxPip: number;
  maxPlayers: number;
  captainCount: number;
  captains: LatticeCaptain[];
  charterId: null;
  completedRounds: number;
  campaignRounds: number;
  opsTerminated: boolean;
  allowSpectate: boolean;
  spectatorCount: number;
  winner: string | null;
};

function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

function captainsFromRoom(data: DocumentData): LatticeCaptain[] {
  const out: LatticeCaptain[] = [];
  if (typeof data.whitePlayerId === 'string' && data.whitePlayerId) {
    out.push({
      id: data.whitePlayerId,
      displayName: String(data.whiteDisplayName ?? 'White').trim() || 'White',
      isAi: false,
      color: 'WHITE',
    });
  }
  if (typeof data.blackPlayerId === 'string' && data.blackPlayerId) {
    out.push({
      id: data.blackPlayerId,
      displayName: String(data.blackDisplayName ?? 'Black').trim() || 'Black',
      isAi: false,
      color: 'BLACK',
    });
  }
  return out;
}

function phaseFromRoom(
  data: DocumentData,
  gameState: DocumentData | null
): string {
  if (data.opsTerminated === true) {
    return 'terminated';
  }
  if (gameState?.winner) {
    return 'ended';
  }
  const captains = captainsFromRoom(data);
  if (captains.length >= 2) {
    return 'active';
  }
  return 'lobby';
}

function toSummary(
  id: string,
  data: DocumentData,
  gameState: DocumentData | null = null
): OpsLatticeRoomSummary {
  const captains = captainsFromRoom(data);
  return {
    id,
    roomCode: String(data.roomCode ?? ''),
    name: String(data.name ?? ''),
    phase: phaseFromRoom(data, gameState),
    hostId: String(data.creatorId ?? ''),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    objective: String(data.rulesVersion ?? 'hybrid-fleet'),
    rated: data.rated === true,
    assisted: data.assisted === true,
    maxPip: 0,
    maxPlayers: 2,
    captainCount: captains.length,
    captains,
    charterId: null,
    completedRounds: 0,
    campaignRounds: 0,
    opsTerminated: data.opsTerminated === true,
    allowSpectate: data.allowObservers !== false,
    spectatorCount: Array.isArray(data.observerIds)
      ? data.observerIds.length
      : 0,
    winner:
      typeof gameState?.winner === 'string' ? String(gameState.winner) : null,
  };
}

async function writeAudit(params: {
  action: string;
  actorUid: string;
  actorLabel: string;
  targetUid?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: params.action,
    actorUid: params.actorUid,
    actorLabel: params.actorLabel,
    targetUid: params.targetUid ?? null,
    targetBanId: null,
    detail: { product: 'lattice', ...(params.detail ?? {}) },
    at: FieldValue.serverTimestamp(),
  });
}

async function loadGameState(roomId: string): Promise<DocumentData | null> {
  const snap = await db
    .collection(ROOMS)
    .doc(roomId)
    .collection('meta')
    .doc('gameState')
    .get();
  return snap.exists ? (snap.data() as DocumentData) : null;
}

async function deleteSubcollection(
  roomId: string,
  name: string,
  batchSize = 400
): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db
      .collection(ROOMS)
      .doc(roomId)
      .collection(name)
      .limit(batchSize)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) break;
  }
  return total;
}

export const listActiveLatticeRooms = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { limit?: number };
  const limit = Math.min(Math.max(data.limit ?? 100, 1), 300);

  const snap = await db
    .collection(ROOMS)
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(limit * 4, 500))
    .get();

  const rooms: OpsLatticeRoomSummary[] = [];
  for (const doc of snap.docs) {
    const gameState = await loadGameState(doc.id);
    const summary = toSummary(doc.id, doc.data(), gameState);
    if (ACTIVE_PHASES.has(summary.phase)) {
      rooms.push(summary);
    }
    if (rooms.length >= limit) break;
  }

  return { ok: true, games: rooms, scanned: snap.size };
});

export const searchLatticeRooms = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    gameId?: string;
    roomCode?: string;
    hostId?: string;
    phase?: string;
    rated?: boolean | null;
    fromIso?: string;
    toIso?: string;
    limit?: number;
  };
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const gameId = data.gameId?.trim();
  const roomCode = data.roomCode?.trim().toUpperCase();

  if (gameId) {
    const snap = await db.collection(ROOMS).doc(gameId).get();
    if (!snap.exists) {
      return { ok: true, games: [], scanned: 0 };
    }
    const gameState = await loadGameState(snap.id);
    return {
      ok: true,
      games: [toSummary(snap.id, snap.data() as DocumentData, gameState)],
      scanned: 1,
    };
  }

  if (roomCode) {
    const codeSnap = await db.collection(ROOM_CODES).doc(roomCode).get();
    const roomId = String(codeSnap.data()?.roomId ?? '');
    if (!roomId) {
      return { ok: true, games: [], scanned: 0 };
    }
    const snap = await db.collection(ROOMS).doc(roomId).get();
    if (!snap.exists) {
      return { ok: true, games: [], scanned: 0 };
    }
    const gameState = await loadGameState(snap.id);
    return {
      ok: true,
      games: [toSummary(snap.id, snap.data() as DocumentData, gameState)],
      scanned: 1,
    };
  }

  let query: Query = db.collection(ROOMS).orderBy('updatedAt', 'desc');
  if (data.hostId?.trim()) {
    query = db
      .collection(ROOMS)
      .where('creatorId', '==', data.hostId.trim())
      .orderBy('updatedAt', 'desc');
  }
  const snap = await query.limit(Math.min(limit * 3, 300)).get();
  const fromMs = data.fromIso ? Date.parse(data.fromIso) : NaN;
  const toMs = data.toIso ? Date.parse(data.toIso) : NaN;

  const games: OpsLatticeRoomSummary[] = [];
  for (const doc of snap.docs) {
    const gameState = await loadGameState(doc.id);
    const summary = toSummary(doc.id, doc.data(), gameState);
    if (data.phase && summary.phase !== data.phase) continue;
    if (data.rated === true && !summary.rated) continue;
    if (data.rated === false && summary.rated) continue;
    const updatedMs = Date.parse(summary.updatedAt);
    if (!Number.isNaN(fromMs) && updatedMs < fromMs) continue;
    if (!Number.isNaN(toMs) && updatedMs > toMs) continue;
    games.push(summary);
    if (games.length >= limit) break;
  }

  return { ok: true, games, scanned: snap.size };
});

export const getOpsLatticeRoom = onCall(async (request) => {
  requireModerator(request);
  const roomId = String(
    (request.data as { gameId?: string; roomId?: string }).gameId ??
      (request.data as { roomId?: string }).roomId ??
      ''
  ).trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'roomId/gameId required.');
  }
  const snap = await db.collection(ROOMS).doc(roomId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  const data = snap.data() as DocumentData;
  const gameState = await loadGameState(roomId);
  const presenceSnap = await db
    .collection(ROOMS)
    .doc(roomId)
    .collection('presence')
    .get();
  return {
    ok: true,
    game: toSummary(roomId, data, gameState),
    detail: {
      ...data,
      gameState,
      presence: presenceSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    },
  };
});

export const listStaleLatticeRooms = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { olderThanDays?: number; limit?: number };
  const days = Math.min(Math.max(data.olderThanDays ?? 7, 1), 90);
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const cutoff = new Date(Date.now() - days * 86400000);
  const snap = await db
    .collection(ROOMS)
    .orderBy('updatedAt', 'asc')
    .limit(limit * 2)
    .get();

  const games = [];
  for (const doc of snap.docs) {
    const raw = doc.data();
    const updated = toIso(raw.updatedAt);
    const ms = Date.parse(updated);
    if (Number.isNaN(ms) || ms > cutoff.getTime()) continue;
    const gameState = await loadGameState(doc.id);
    const summary = toSummary(doc.id, raw, gameState);
    games.push({
      id: summary.id,
      phase: summary.phase,
      hostId: summary.hostId,
      updatedAt: summary.updatedAt,
      opsTerminated: summary.opsTerminated,
      captainCount: summary.captainCount,
    });
    if (games.length >= limit) break;
  }

  return { ok: true, cutoff: cutoff.toISOString(), games };
});

export const opsTerminateLatticeRoom = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    roomId?: string;
    reason?: string;
    mode?: 'soft' | 'hard';
  };
  const roomId = String(data.gameId ?? data.roomId ?? '').trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'roomId required.');
  }
  const mode = data.mode === 'hard' ? 'hard' : 'soft';
  const ref = db.collection(ROOMS).doc(roomId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  const room = snap.data() as DocumentData;
  const roomCode = String(room.roomCode ?? '');

  if (mode === 'hard') {
    const deleted = {
      chat: await deleteSubcollection(roomId, 'chat'),
      events: await deleteSubcollection(roomId, 'events'),
      presence: await deleteSubcollection(roomId, 'presence'),
      meta: await deleteSubcollection(roomId, 'meta'),
    };
    if (roomCode) {
      await db.collection(ROOM_CODES).doc(roomCode).delete().catch(() => undefined);
    }
    await ref.delete();
    await writeAudit({
      action: 'lattice_terminate_hard',
      actorUid,
      actorLabel: request.auth?.token.email ?? actorUid,
      detail: { roomId, roomCode, reason: data.reason ?? '', deleted },
    });
    return { ok: true, mode, deleted };
  }

  await ref.update({
    opsTerminated: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit({
    action: 'lattice_terminate_soft',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, roomCode, reason: data.reason ?? '' },
  });
  return { ok: true, mode };
});

export const opsCleanupStaleLatticeRoom = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const roomId = String(
    (request.data as { gameId?: string }).gameId ?? ''
  ).trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const ref = db.collection(ROOMS).doc(roomId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  const room = snap.data() as DocumentData;
  const roomCode = String(room.roomCode ?? '');
  const deleted = {
    chat: await deleteSubcollection(roomId, 'chat'),
    events: await deleteSubcollection(roomId, 'events'),
    presence: await deleteSubcollection(roomId, 'presence'),
    meta: await deleteSubcollection(roomId, 'meta'),
  };
  if (roomCode) {
    await db.collection(ROOM_CODES).doc(roomCode).delete().catch(() => undefined);
  }
  await ref.delete();
  await writeAudit({
    action: 'lattice_cleanup_stale',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, roomCode, deleted },
  });
  return { ok: true, deleted };
});

export const opsKickLatticePlayer = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    targetUid?: string;
    reason?: string;
  };
  const roomId = String(data.gameId ?? '').trim();
  const targetUid = String(data.targetUid ?? '').trim();
  if (!roomId || !targetUid) {
    throw new HttpsError('invalid-argument', 'gameId and targetUid required.');
  }
  const ref = db.collection(ROOMS).doc(roomId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  const room = snap.data() as DocumentData;
  const patch: DocumentData = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (room.whitePlayerId === targetUid) {
    patch.whitePlayerId = null;
    patch.whiteDisplayName = null;
  }
  if (room.blackPlayerId === targetUid) {
    patch.blackPlayerId = null;
    patch.blackDisplayName = null;
  }
  const memberIds = Array.isArray(room.memberIds)
    ? (room.memberIds as string[]).filter((id) => id !== targetUid)
    : [];
  const observerIds = Array.isArray(room.observerIds)
    ? (room.observerIds as string[]).filter((id) => id !== targetUid)
    : [];
  patch.memberIds = memberIds;
  patch.observerIds = observerIds;
  await ref.update(patch);
  await writeAudit({
    action: 'lattice_kick',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    targetUid,
    detail: { roomId, reason: data.reason ?? '' },
  });
  const after = (await ref.get()).data() as DocumentData;
  const remaining =
    (after.whitePlayerId ? 1 : 0) + (after.blackPlayerId ? 1 : 0);
  return { ok: true, mode: 'kicked', remaining };
});

export const opsDropLatticeObservers = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const roomId = String(
    (request.data as { gameId?: string }).gameId ?? ''
  ).trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const ref = db.collection(ROOMS).doc(roomId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Room not found.');
  }
  const room = snap.data() as DocumentData;
  const dropped = Array.isArray(room.observerIds) ? room.observerIds.length : 0;
  const memberIds = Array.isArray(room.memberIds)
    ? (room.memberIds as string[]).filter(
        (id) =>
          id === room.creatorId ||
          id === room.whitePlayerId ||
          id === room.blackPlayerId
      )
    : [];
  await ref.update({
    observerIds: [],
    memberIds,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit({
    action: 'lattice_drop_observers',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, dropped },
  });
  return { ok: true, dropped };
});

export const opsSetLatticeAllowObservers = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as { gameId?: string; allow?: boolean };
  const roomId = String(data.gameId ?? '').trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const allow = data.allow !== false;
  await db.collection(ROOMS).doc(roomId).update({
    allowObservers: allow,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit({
    action: 'lattice_set_allow_observers',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, allow },
  });
  return { ok: true, allow };
});

export const listLatticeRoomChat = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { gameId?: string; limit?: number };
  const roomId = String(data.gameId ?? '').trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const limit = Math.min(Math.max(data.limit ?? 100, 1), 300);
  const snap = await db
    .collection(ROOMS)
    .doc(roomId)
    .collection('chat')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  const messages = snap.docs.map((d) => {
    const m = d.data();
    return {
      id: d.id,
      gameId: roomId,
      senderId: String(m.senderId ?? ''),
      text: String(m.text ?? ''),
      createdAt: toIso(m.timestamp),
      isSystemMessage: m.isSystemMessage === true,
    };
  });
  return { ok: true, messages };
});

export const searchLatticeChat = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    query?: string;
    senderId?: string;
    gameId?: string;
    limit?: number;
  };
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const q = String(data.query ?? '').trim().toLowerCase();
  const senderId = data.senderId?.trim();
  const gameId = data.gameId?.trim();

  let roomIds: string[] = [];
  if (gameId) {
    roomIds = [gameId];
  } else {
    const rooms = await db
      .collection(ROOMS)
      .orderBy('updatedAt', 'desc')
      .limit(40)
      .get();
    roomIds = rooms.docs.map((d) => d.id);
  }

  const messages: Array<Record<string, unknown>> = [];
  for (const roomId of roomIds) {
    let chatQuery: Query = db
      .collection(ROOMS)
      .doc(roomId)
      .collection('chat')
      .orderBy('timestamp', 'desc')
      .limit(80);
    if (senderId) {
      chatQuery = db
        .collection(ROOMS)
        .doc(roomId)
        .collection('chat')
        .where('senderId', '==', senderId)
        .orderBy('timestamp', 'desc')
        .limit(80);
    }
    let snap: QuerySnapshot;
    try {
      snap = await chatQuery.get();
    } catch {
      continue;
    }
    for (const doc of snap.docs) {
      const m = doc.data();
      const text = String(m.text ?? '');
      if (q && !text.toLowerCase().includes(q)) continue;
      messages.push({
        id: doc.id,
        gameId: roomId,
        senderId: String(m.senderId ?? ''),
        text,
        createdAt: toIso(m.timestamp),
        isSystemMessage: m.isSystemMessage === true,
      });
      if (messages.length >= limit) {
        return { ok: true, messages };
      }
    }
  }
  return { ok: true, messages };
});

export const deleteLatticeChatMessage = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    messageId?: string;
  };
  const roomId = String(data.gameId ?? '').trim();
  const messageId = String(data.messageId ?? '').trim();
  if (!roomId || !messageId) {
    throw new HttpsError(
      'invalid-argument',
      'gameId and messageId required.'
    );
  }
  await db
    .collection(ROOMS)
    .doc(roomId)
    .collection('chat')
    .doc(messageId)
    .delete();
  await writeAudit({
    action: 'lattice_delete_chat',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, messageId },
  });
  return { ok: true };
});

export const getLatticeTei = onCall(async (request) => {
  requireModerator(request);
  const uid = String((request.data as { uid?: string }).uid ?? '').trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const snap = await db.collection(TEI).doc(uid).get();
  return { ok: true, uid, tei: snap.exists ? snap.data() : null };
});

export const opsSetLatticeTei = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as {
    uid?: string;
    track?: 'localAi' | 'online';
    mu?: number;
    sigma?: number;
    reason?: string;
  };
  const uid = String(data.uid ?? '').trim();
  const track = data.track === 'online' ? 'online' : 'localAi';
  if (!uid || typeof data.mu !== 'number' || typeof data.sigma !== 'number') {
    throw new HttpsError(
      'invalid-argument',
      'uid, track, mu, and sigma required.'
    );
  }
  const ref = db.collection(TEI).doc(uid);
  await ref.set(
    {
      [track]: {
        mu: data.mu,
        sigma: data.sigma,
        updatedAt: FieldValue.serverTimestamp(),
        opsSet: true,
      },
    },
    { merge: true }
  );
  await writeAudit({
    action: 'lattice_set_tei',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    targetUid: uid,
    detail: {
      track,
      mu: data.mu,
      sigma: data.sigma,
      reason: data.reason ?? '',
    },
  });
  return { ok: true };
});

export const listLatticeCaptainRatingEvents = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { uid?: string; limit?: number };
  const uid = String(data.uid ?? '').trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const snap = await db
    .collection(RATING_EVENTS)
    .where('playerIds', 'array-contains', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
    .catch(async () => {
      // Fallback if composite index missing: scan recent events.
      return db
        .collection(RATING_EVENTS)
        .orderBy('createdAt', 'desc')
        .limit(limit * 5)
        .get();
    });

  const events = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => {
      const ids = (e as { playerIds?: string[] }).playerIds;
      return Array.isArray(ids) ? ids.includes(uid) : true;
    })
    .slice(0, limit);

  return { ok: true, events };
});

export const opsUnrateLatticeOnlineRoom = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const roomId = String(
    (request.data as { gameId?: string }).gameId ?? ''
  ).trim();
  if (!roomId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const eventId = `online:${roomId}`;
  const eventRef = db.collection(RATING_EVENTS).doc(eventId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) {
    await eventRef.set(
      {
        voided: true,
        voidedAt: FieldValue.serverTimestamp(),
        voidedBy: actorUid,
      },
      { merge: true }
    );
  }
  await db.collection(ROOMS).doc(roomId).set(
    {
      rated: false,
      opsUnrated: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await writeAudit({
    action: 'lattice_unrate_online',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { roomId, eventId },
  });
  return { ok: true, eventId };
});

export const opsVoidLatticeRatingEvent = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const eventId = String(
    (request.data as { eventId?: string }).eventId ?? ''
  ).trim();
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'eventId required.');
  }
  await db.collection(RATING_EVENTS).doc(eventId).set(
    {
      voided: true,
      voidedAt: FieldValue.serverTimestamp(),
      voidedBy: actorUid,
    },
    { merge: true }
  );
  await writeAudit({
    action: 'lattice_void_rating_event',
    actorUid,
    actorLabel: request.auth?.token.email ?? actorUid,
    detail: { eventId },
  });
  return { ok: true };
});
