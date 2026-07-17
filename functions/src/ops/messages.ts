import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FieldValue,
  type DocumentData,
  type Query,
  type QuerySnapshot,
} from 'firebase-admin/firestore';

import { requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';

const db = admin.firestore();

export type OpsMessageHit = {
  gameId: string;
  messageId: string;
  from: string;
  fromName: string;
  kind: string;
  text: string | null;
  phraseId: string | null;
  to: string | null;
  channel: string;
  at: string;
};

function pathGameId(docPath: string): string {
  // games/{gameId}/messages/{messageId}
  const parts = docPath.split('/');
  const gi = parts.indexOf('games');
  if (gi >= 0 && parts[gi + 1]) {
    return parts[gi + 1];
  }
  return '';
}

function toHit(
  gameId: string,
  messageId: string,
  data: DocumentData
): OpsMessageHit {
  return {
    gameId,
    messageId,
    from: String(data.from ?? ''),
    fromName: String(data.fromName ?? ''),
    kind: String(data.kind ?? ''),
    text: typeof data.text === 'string' ? data.text : null,
    phraseId: typeof data.phraseId === 'string' ? data.phraseId : null,
    to: typeof data.to === 'string' ? data.to : null,
    channel: String(data.channel ?? 'table'),
    at: String(data.at ?? ''),
  };
}

function defaultFromIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Cross-sector message search for complaints.
 * Bounds by date (default last 7 days) and/or gameId / sender, then filters text in memory.
 */
export const searchMessages = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    text?: string;
    fromUid?: string;
    fromName?: string;
    gameId?: string;
    fromIso?: string;
    toIso?: string;
    limit?: number;
  };

  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const gameId = data.gameId?.trim();
  const fromUid = data.fromUid?.trim();
  const fromNameNeedle = data.fromName?.trim().toLowerCase() ?? '';
  const textNeedle = data.text?.trim().toLowerCase() ?? '';
  const fromIso = data.fromIso?.trim() || (gameId ? '' : defaultFromIso());
  const toIso = data.toIso?.trim() || new Date().toISOString();

  const fetchLimit = Math.min(
    limit * (textNeedle || fromNameNeedle ? 8 : 2),
    800
  );

  let snap: QuerySnapshot;
  try {
    if (gameId) {
      let q: Query = db.collection('games').doc(gameId).collection('messages');
      if (fromUid) {
        q = q.where('from', '==', fromUid);
      }
      if (fromIso) {
        q = q.where('at', '>=', fromIso);
      }
      if (toIso) {
        q = q.where('at', '<=', toIso);
      }
      q = q.orderBy('at', 'desc').limit(fetchLimit);
      snap = await q.get();
    } else if (fromUid) {
      let q: Query = db
        .collectionGroup('messages')
        .where('from', '==', fromUid);
      if (fromIso) {
        q = q.where('at', '>=', fromIso);
      }
      if (toIso) {
        q = q.where('at', '<=', toIso);
      }
      q = q.orderBy('at', 'desc').limit(fetchLimit);
      snap = await q.get();
    } else {
      let q: Query = db.collectionGroup('messages');
      if (fromIso) {
        q = q.where('at', '>=', fromIso);
      }
      if (toIso) {
        q = q.where('at', '<=', toIso);
      }
      q = q.orderBy('at', 'desc').limit(fetchLimit);
      snap = await q.get();
    }
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      err instanceof Error
        ? `Message search failed (index may be building): ${err.message}`
        : 'Message search failed.'
    );
  }

  let hits = snap.docs.map((d) => {
    const gid = gameId || pathGameId(d.ref.path);
    return toHit(gid, d.id, d.data());
  });

  if (textNeedle) {
    hits = hits.filter((h) => {
      const blob = `${h.text ?? ''} ${h.fromName} ${h.phraseId ?? ''}`.toLowerCase();
      return blob.includes(textNeedle);
    });
  }
  if (fromNameNeedle) {
    hits = hits.filter((h) => h.fromName.toLowerCase().includes(fromNameNeedle));
  }

  return {
    ok: true,
    hits: hits.slice(0, limit),
    scanned: snap.size,
    window: { fromIso: fromIso || null, toIso },
    note: textNeedle
      ? 'Text filter is substring match over the date/sender-bounded scan (not full-text index).'
      : null,
  };
});

/** Full thread for one sector (ops browse). */
export const listSectorMessages = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { gameId?: string; limit?: number };
  const gameId = data.gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const limit = Math.min(Math.max(data.limit ?? 200, 1), 500);
  const snap = await db
    .collection('games')
    .doc(gameId)
    .collection('messages')
    .orderBy('at', 'asc')
    .limit(limit)
    .get();

  const messages = snap.docs.map((d) => toHit(gameId, d.id, d.data()));
  return { ok: true, gameId, messages };
});

/** Hard-delete a message (Admin SDK). Audited. */
export const deleteSectorMessage = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    messageId?: string;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const messageId = data.messageId?.trim();
  if (!gameId || !messageId) {
    throw new HttpsError('invalid-argument', 'gameId and messageId required.');
  }

  const ref = db
    .collection('games')
    .doc(gameId)
    .collection('messages')
    .doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Message not found.');
  }
  const before = snap.data()!;
  await ref.delete();

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'message_delete',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: String(before.from ?? ''),
    targetBanId: null,
    detail: {
      gameId,
      messageId,
      reason: data.reason?.trim() || null,
      at: before.at ?? null,
      kind: before.kind ?? null,
      textPreview:
        typeof before.text === 'string' ? before.text.slice(0, 200) : null,
    },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, deleted: true, gameId, messageId };
});

const REDACTED_PLACEHOLDER = '[transmission redacted by Ops]';

/** Keep the message doc but blank the body for evidence retention. Audited. */
export const redactSectorMessage = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    messageId?: string;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const messageId = data.messageId?.trim();
  if (!gameId || !messageId) {
    throw new HttpsError('invalid-argument', 'gameId and messageId required.');
  }

  const ref = db
    .collection('games')
    .doc(gameId)
    .collection('messages')
    .doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Message not found.');
  }
  const before = snap.data()!;
  await ref.update({
    text: REDACTED_PLACEHOLDER,
    phraseId: FieldValue.delete(),
    kind: 'text',
    redacted: true,
    redactedAt: new Date().toISOString(),
    redactedBy: actorUid,
  });

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'message_redact',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: String(before.from ?? ''),
    targetBanId: null,
    detail: {
      gameId,
      messageId,
      reason: data.reason?.trim() || null,
      at: before.at ?? null,
      kind: before.kind ?? null,
      textPreview:
        typeof before.text === 'string' ? before.text.slice(0, 200) : null,
    },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, redacted: true, gameId, messageId };
});
