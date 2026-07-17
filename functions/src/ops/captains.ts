import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

import { requireModerator } from '../auth';
import { BANS_COLLECTION, type BanDocument } from './ban-schema';
import { OPS_AUDIT_COLLECTION } from './ban-schema';

const db = admin.firestore();

export const ADMIN_NOTES_COLLECTION = 'adminNotes';

export type AdminNote = {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdByLabel: string;
  updatedAt?: string;
};

export type AdminNotesDocument = {
  uid: string;
  notes: AdminNote[];
  updatedAt: unknown;
};

function notesRef(uid: string) {
  return db.collection(ADMIN_NOTES_COLLECTION).doc(uid);
}

function audit(
  action: string,
  actorUid: string,
  targetUid: string,
  detail: Record<string, unknown>
) {
  return db.collection(OPS_AUDIT_COLLECTION).add({
    action,
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid,
    targetBanId: null,
    detail,
    at: FieldValue.serverTimestamp(),
  });
}

export async function loadAdminNotes(uid: string): Promise<AdminNote[]> {
  const snap = await notesRef(uid).get();
  if (!snap.exists) {
    return [];
  }
  const data = snap.data() as AdminNotesDocument;
  return Array.isArray(data.notes) ? data.notes : [];
}

export const listAdminNotes = onCall(async (request) => {
  requireModerator(request);
  const uid = (request.data as { uid?: string }).uid?.trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }
  const notes = await loadAdminNotes(uid);
  return { ok: true, uid, notes };
});

export const addAdminNote = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as { uid?: string; text?: string };
  const uid = data.uid?.trim();
  const text = data.text?.trim() ?? '';
  if (!uid || !text) {
    throw new HttpsError('invalid-argument', 'uid and text required.');
  }
  if (text.length > 4000) {
    throw new HttpsError('invalid-argument', 'Note too long (max 4000).');
  }

  const note: AdminNote = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    createdBy: actorUid,
    createdByLabel: `admin:${actorUid}`,
  };

  await notesRef(uid).set(
    {
      uid,
      notes: FieldValue.arrayUnion(note),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await audit('admin_note_add', actorUid, uid, { noteId: note.id });
  return { ok: true, note };
});

export const updateAdminNote = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as { uid?: string; noteId?: string; text?: string };
  const uid = data.uid?.trim();
  const noteId = data.noteId?.trim();
  const text = data.text?.trim() ?? '';
  if (!uid || !noteId || !text) {
    throw new HttpsError('invalid-argument', 'uid, noteId, and text required.');
  }
  if (text.length > 4000) {
    throw new HttpsError('invalid-argument', 'Note too long (max 4000).');
  }

  const snap = await notesRef(uid).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No notes for this captain.');
  }
  const doc = snap.data() as AdminNotesDocument;
  const notes = Array.isArray(doc.notes) ? [...doc.notes] : [];
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx < 0) {
    throw new HttpsError('not-found', 'Note not found.');
  }
  notes[idx] = {
    ...notes[idx],
    text,
    updatedAt: new Date().toISOString(),
  };
  await notesRef(uid).set(
    { uid, notes, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit('admin_note_update', actorUid, uid, { noteId });
  return { ok: true, note: notes[idx] };
});

export const deleteAdminNote = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as { uid?: string; noteId?: string };
  const uid = data.uid?.trim();
  const noteId = data.noteId?.trim();
  if (!uid || !noteId) {
    throw new HttpsError('invalid-argument', 'uid and noteId required.');
  }

  const snap = await notesRef(uid).get();
  if (!snap.exists) {
    return { ok: true, deleted: false };
  }
  const doc = snap.data() as AdminNotesDocument;
  const notes = (Array.isArray(doc.notes) ? doc.notes : []).filter(
    (n) => n.id !== noteId
  );
  await notesRef(uid).set(
    { uid, notes, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await audit('admin_note_delete', actorUid, uid, { noteId });
  return { ok: true, deleted: true };
});

export type CaptainSearchHit = {
  uid: string;
  displayName: string;
  matchesCompleted: number;
  matchesWon: number;
  lastPlayedAt: string | null;
  updatedAt: string | null;
  match: 'uid' | 'email' | 'name';
};

export type CaptainDossier = {
  uid: string;
  displayName: string;
  email: string | null;
  authDisabled: boolean;
  anonymous: boolean;
  providers: string[];
  createdAt: string | null;
  lastSignInAt: string | null;
  stats: {
    matchesCompleted: number;
    matchesWon: number;
    lastPlayedAt: string | null;
    updatedAt: string | null;
    humanRating: unknown;
    groupRating: unknown;
    squadRating: unknown;
    localAi: unknown;
    startingRating: unknown;
    humanRatedGameIds: string[];
    groupRatedIds: string[];
    squadRatedGameIds: string[];
    matchHistory: unknown[];
  } | null;
  ban: BanDocument | null;
  banned: boolean;
  mute: Record<string, unknown> | null;
  muted: boolean;
  notes: AdminNote[];
};

function statsHit(uid: string, data: DocumentData, match: CaptainSearchHit['match']): CaptainSearchHit {
  return {
    uid,
    displayName: String(data.displayName ?? 'Captain'),
    matchesCompleted:
      typeof data.matchesCompleted === 'number' ? data.matchesCompleted : 0,
    matchesWon: typeof data.matchesWon === 'number' ? data.matchesWon : 0,
    lastPlayedAt: typeof data.lastPlayedAt === 'string' ? data.lastPlayedAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    match,
  };
}

function isExpiredBan(expiresAt: unknown): boolean {
  if (!expiresAt || typeof expiresAt !== 'object') {
    return false;
  }
  if (
    'toMillis' in expiresAt &&
    typeof (expiresAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (expiresAt as { toMillis: () => number }).toMillis() <= Date.now();
  }
  return false;
}

/** Search captains by uid, email, or display-name substring (recent stats scan). */
export const searchCaptains = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { query?: string; limit?: number };
  const query = (data.query ?? '').trim();
  const limit = Math.min(Math.max(data.limit ?? 40, 1), 100);
  if (!query || query.length < 2) {
    throw new HttpsError('invalid-argument', 'query must be at least 2 characters.');
  }

  const hits: CaptainSearchHit[] = [];
  const seen = new Set<string>();

  const push = (hit: CaptainSearchHit) => {
    if (seen.has(hit.uid)) {
      return;
    }
    seen.add(hit.uid);
    hits.push(hit);
  };

  // Exact uid
  const byUid = await db.collection('playerStats').doc(query).get();
  if (byUid.exists) {
    push(statsHit(byUid.id, byUid.data()!, 'uid'));
  } else {
    try {
      const user = await admin.auth().getUser(query);
      const stats = await db.collection('playerStats').doc(user.uid).get();
      if (stats.exists) {
        push(statsHit(stats.id, stats.data()!, 'uid'));
      } else {
        push({
          uid: user.uid,
          displayName: user.displayName ?? 'Captain',
          matchesCompleted: 0,
          matchesWon: 0,
          lastPlayedAt: null,
          updatedAt: null,
          match: 'uid',
        });
      }
    } catch {
      // not a uid
    }
  }

  if (query.includes('@')) {
    try {
      const user = await admin.auth().getUserByEmail(query);
      const stats = await db.collection('playerStats').doc(user.uid).get();
      if (stats.exists) {
        push(statsHit(stats.id, stats.data()!, 'email'));
      } else {
        push({
          uid: user.uid,
          displayName: user.displayName ?? user.email ?? 'Captain',
          matchesCompleted: 0,
          matchesWon: 0,
          lastPlayedAt: null,
          updatedAt: null,
          match: 'email',
        });
      }
    } catch {
      // no email match
    }
  }

  const needle = query.toLowerCase();
  const scan = await db
    .collection('playerStats')
    .orderBy('updatedAt', 'desc')
    .limit(800)
    .get();

  for (const doc of scan.docs) {
    if (hits.length >= limit) {
      break;
    }
    const name = String(doc.data().displayName ?? '').toLowerCase();
    if (name.includes(needle)) {
      push(statsHit(doc.id, doc.data(), 'name'));
    }
  }

  return {
    ok: true,
    query,
    hits: hits.slice(0, limit),
    scanned: scan.size,
    note:
      'Name matches scan the ~800 most recently updated playerStats docs (substring). Exact uid/email always checked.',
  };
});

export const getCaptainDossier = onCall(async (request) => {
  requireModerator(request);
  const uid = (request.data as { uid?: string }).uid?.trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'uid required.');
  }

  const [statsSnap, banSnap, muteSnap, notes, authUser] = await Promise.all([
    db.collection('playerStats').doc(uid).get(),
    db.collection(BANS_COLLECTION).doc(uid).get(),
    db.collection('mutes').doc(uid).get(),
    loadAdminNotes(uid),
    admin
      .auth()
      .getUser(uid)
      .catch(() => null),
  ]);

  const ban = banSnap.exists ? (banSnap.data() as BanDocument) : null;
  const banned = Boolean(
    ban?.active && !isExpiredBan(ban.expiresAt ?? null)
  );
  const mute = muteSnap.exists ? muteSnap.data()! : null;
  const muted = Boolean(
    mute?.active && !isExpiredBan(mute.expiresAt ?? null)
  );

  const statsData = statsSnap.exists ? statsSnap.data()! : null;
  const providers = authUser?.providerData.map((p) => p.providerId) ?? [];

  const dossier: CaptainDossier = {
    uid,
    displayName:
      (statsData?.displayName as string | undefined) ??
      authUser?.displayName ??
      'Captain',
    email: authUser?.email ?? null,
    authDisabled: authUser?.disabled ?? false,
    anonymous: providers.length === 0 && Boolean(authUser),
    providers,
    createdAt: authUser?.metadata.creationTime ?? null,
    lastSignInAt: authUser?.metadata.lastSignInTime ?? null,
    stats: statsData
      ? {
          matchesCompleted:
            typeof statsData.matchesCompleted === 'number'
              ? statsData.matchesCompleted
              : 0,
          matchesWon:
            typeof statsData.matchesWon === 'number' ? statsData.matchesWon : 0,
          lastPlayedAt:
            typeof statsData.lastPlayedAt === 'string'
              ? statsData.lastPlayedAt
              : null,
          updatedAt:
            typeof statsData.updatedAt === 'string' ? statsData.updatedAt : null,
          humanRating: statsData.humanRating ?? null,
          groupRating: statsData.groupRating ?? null,
          squadRating: statsData.squadRating ?? null,
          localAi: statsData.localAi ?? null,
          startingRating: statsData.startingRating ?? null,
          humanRatedGameIds: Array.isArray(statsData.humanRatedGameIds)
            ? statsData.humanRatedGameIds.slice(0, 40)
            : [],
          groupRatedIds: Array.isArray(statsData.groupRatedIds)
            ? statsData.groupRatedIds.slice(0, 40)
            : [],
          squadRatedGameIds: Array.isArray(statsData.squadRatedGameIds)
            ? statsData.squadRatedGameIds.slice(0, 40)
            : [],
          matchHistory: Array.isArray(statsData.matchHistory)
            ? statsData.matchHistory.slice(0, 40)
            : [],
        }
      : null,
    ban,
    banned,
    mute,
    muted,
    notes,
  };

  return { ok: true, dossier };
});

/** Ops rename — updates Auth displayName + playerStats.displayName when present. */
export const opsSetDisplayName = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    uid?: string;
    displayName?: string;
    reason?: string;
  };
  const uid = data.uid?.trim();
  const displayName = data.displayName?.trim();
  const reason = data.reason?.trim();
  if (!uid || !displayName || displayName.length < 1 || displayName.length > 24) {
    throw new HttpsError(
      'invalid-argument',
      'uid and displayName (1–24 chars) required.'
    );
  }
  if (!reason) {
    throw new HttpsError('invalid-argument', 'reason required.');
  }

  let previous: string | null = null;
  try {
    const user = await admin.auth().getUser(uid);
    previous = user.displayName ?? null;
    await admin.auth().updateUser(uid, { displayName });
  } catch {
    // Auth user may be missing for pure stats docs; still update playerStats.
  }

  const statsRef = db.collection('playerStats').doc(uid);
  const statsSnap = await statsRef.get();
  if (statsSnap.exists) {
    const prevStats = String(statsSnap.data()?.displayName ?? '') || null;
    if (!previous) {
      previous = prevStats;
    }
    await statsRef.set(
      { displayName, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'display_name_set',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: uid,
    targetBanId: null,
    detail: { previous, displayName, reason },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid, displayName, previous };
});
