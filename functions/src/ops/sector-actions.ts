import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FieldValue,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import { requireAdmin, requireModerator, requireSignedIn } from '../auth';
import { OPS_AUDIT_COLLECTION } from './mute-schema';

const db = admin.firestore();

const MIN_PLAYERS = 2;
const STALE_DEFAULT_DAYS = 7;

type Captain = {
  id: string;
  displayName?: string;
  isAi?: boolean;
  [key: string]: unknown;
};

async function deleteCollectionDocs(
  path: string,
  batchSize = 400
): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) {
      break;
    }
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    total += snap.size;
    if (snap.size < batchSize) {
      break;
    }
  }
  return total;
}

function pickNewHost(captains: Captain[], oldHostId: string): string {
  const remaining = captains.filter((c) => c.id !== oldHostId);
  const human = remaining.find((c) => !c.isAi && !String(c.id).startsWith('ai:'));
  if (human) {
    return human.id;
  }
  // Prefer soft-terminate paths over AI host; still return something for typing.
  if (remaining[0]) {
    return remaining[0].id;
  }
  return oldHostId;
}

/** Best-effort strip of a kicked seat from the public round blob. */
function stripPlayerFromRound(
  round: DocumentData | null | undefined,
  targetUid: string
): DocumentData | null {
  if (!round || typeof round !== 'object') {
    return null;
  }
  const turnOrder = Array.isArray(round.turnOrder)
    ? (round.turnOrder as string[]).filter((id) => id !== targetUid)
    : [];
  if (turnOrder.length === 0) {
    return null;
  }

  const prevOrder = Array.isArray(round.turnOrder)
    ? (round.turnOrder as string[])
    : [];
  let activePlayerId = String(round.activePlayerId ?? '');
  if (activePlayerId === targetUid) {
    const idx = prevOrder.indexOf(targetUid);
    activePlayerId =
      turnOrder[idx % turnOrder.length] ?? turnOrder[0] ?? activePlayerId;
  }

  const handCounts: Record<string, number> = {
    ...((round.handCounts as Record<string, number>) ?? {}),
  };
  delete handCounts[targetUid];

  const debtTokens: Record<string, number> = {
    ...((round.debtTokens as Record<string, number>) ?? {}),
  };
  delete debtTokens[targetUid];

  const table = { ...((round.table as DocumentData) ?? {}) };
  if (Array.isArray(table.warpTrails)) {
    table.warpTrails = (table.warpTrails as DocumentData[]).filter(
      (t) => t.trailPlayerId !== targetUid
    );
  }

  let continuumEffects = round.continuumEffects as DocumentData | null | undefined;
  if (continuumEffects && typeof continuumEffects === 'object') {
    const skip = Array.isArray(continuumEffects.skipNextTurnFor)
      ? (continuumEffects.skipNextTurnFor as string[]).filter(
          (id) => id !== targetUid
        )
      : [];
    continuumEffects = { ...continuumEffects, skipNextTurnFor: skip };
  }

  let hazardMarkerHolder = round.hazardMarkerHolder as string | null | undefined;
  if (hazardMarkerHolder === targetUid) {
    hazardMarkerHolder = null;
  }

  const next: DocumentData = {
    ...round,
    turnOrder,
    activePlayerId,
    handCounts,
    debtTokens,
    table,
    continuumEffects: continuumEffects ?? round.continuumEffects ?? null,
    hazardMarkerHolder: hazardMarkerHolder ?? null,
    dropToImpulseCallPending:
      round.dropToImpulseCallPending === targetUid
        ? null
        : (round.dropToImpulseCallPending ?? null),
    dropToImpulseCatchable:
      round.dropToImpulseCatchable === targetUid
        ? null
        : (round.dropToImpulseCatchable ?? null),
    mandatoryPlay:
      round.mandatoryPlay &&
      (round.mandatoryPlay as { playerId?: string }).playerId === targetUid
        ? null
        : (round.mandatoryPlay ?? null),
  };
  // Firestore rejects undefined; sparse round docs omit many optional fields.
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) {
      delete next[key];
    }
  }
  return next;
}

function softTerminatePatch(
  actorUid: string,
  reason: string
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    phase: 'complete',
    rated: false,
    round: null,
    opsTerminated: true,
    opsTerminatedAt: now,
    opsTerminatedBy: actorUid,
    opsTerminationReason: reason,
    updatedAt: now,
  };
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

/**
 * Force-remove a captain. Lobby: same as host kick.
 * Mid-mission: strip seat + turn state, force unrated; if fleet would drop
 * below min players, soft-terminate instead.
 */
async function applyCaptainKick(input: {
  gameId: string;
  actorUid: string;
  targetUid: string;
  reason: string;
  /** When true, actor must be the current host (not ops). */
  requireHost: boolean;
}): Promise<{
  mode: 'terminated' | 'kicked';
  hostId: string;
  remaining: number;
}> {
  const { gameId, actorUid, targetUid, reason, requireHost } = input;
  const ref = db.collection('games').doc(gameId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Sector not found.');
    }
    const game = snap.data()!;
    if (game.opsTerminated === true) {
      throw new HttpsError('failed-precondition', 'Sector already terminated.');
    }

    if (requireHost && String(game.hostId ?? '') !== actorUid) {
      throw new HttpsError(
        'permission-denied',
        'Only the sector host can drop a seat.'
      );
    }

    const captains = (Array.isArray(game.captains) ? game.captains : []) as Captain[];
    if (!captains.some((c) => c.id === targetUid)) {
      throw new HttpsError('not-found', 'Captain not aboard this sector.');
    }

    if (requireHost && targetUid === actorUid) {
      throw new HttpsError(
        'failed-precondition',
        'Host cannot drop their own seat — dissolve or transfer first.'
      );
    }

    const phase = String(game.phase ?? 'lobby');
    if (requireHost && phase === 'lobby') {
      throw new HttpsError(
        'failed-precondition',
        'Use lobby remove for waiting-room seats.'
      );
    }

    const remaining = captains.filter((c) => c.id !== targetUid);
    const now = new Date().toISOString();

    // Mid-mission: too few seats left → terminate instead of a broken table.
    if (phase !== 'lobby' && remaining.length < MIN_PLAYERS) {
      tx.update(
        ref,
        softTerminatePatch(
          actorUid,
          `${reason} (fleet below minimum after kick)`
        )
      );
      tx.delete(ref.collection('hands').doc(targetUid));
      tx.delete(ref.collection('presence').doc(targetUid));
      return {
        mode: 'terminated' as const,
        hostId: String(game.hostId ?? ''),
        remaining: remaining.length,
      };
    }

    let hostId = String(game.hostId ?? '');
    if (hostId === targetUid) {
      hostId = pickNewHost(captains, targetUid);
    }

    const patch: Record<string, unknown> = {
      captains: remaining,
      captainIds: remaining.map((c) => c.id),
      hostId,
      updatedAt: now,
      rated: false,
      // Dropping a seat clears pause so the remaining fleet can play.
      paused: false,
    };

    if (phase !== 'lobby' && game.round) {
      const nextRound = stripPlayerFromRound(
        game.round as DocumentData,
        targetUid
      );
      if (!nextRound) {
        Object.assign(
          patch,
          softTerminatePatch(
            actorUid,
            `${reason} (no seats left in turn order)`
          )
        );
      } else {
        patch.round = nextRound;
      }
    }

    tx.update(ref, patch);
    tx.delete(ref.collection('hands').doc(targetUid));
    tx.delete(ref.collection('presence').doc(targetUid));

    return {
      mode: patch.opsTerminated ? ('terminated' as const) : ('kicked' as const),
      hostId,
      remaining: remaining.length,
    };
  });
}

/**
 * Force-remove a captain. Lobby: same as host kick.
 * Mid-mission: strip seat + turn state, force unrated; if fleet would drop
 * below min players, soft-terminate instead.
 */
export const opsKickCaptain = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    gameId?: string;
    targetUid?: string;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const targetUid = data.targetUid?.trim();
  const reason = data.reason?.trim() || 'ops kick';
  if (!gameId || !targetUid) {
    throw new HttpsError('invalid-argument', 'gameId and targetUid required.');
  }

  const result = await applyCaptainKick({
    gameId,
    actorUid,
    targetUid,
    reason,
    requireHost: false,
  });

  await writeAudit({
    action: result.mode === 'terminated' ? 'ops_terminate' : 'ops_kick',
    actorUid,
    targetUid,
    detail: { gameId, reason, ...result },
  });

  return { ok: true, gameId, targetUid, ...result };
});

/**
 * Host mid-mission seat drop when a captain goes offline. Mirrors ops kick
 * stripping, but requires sector host (not moderator).
 */
export const hostDropCaptain = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as {
    gameId?: string;
    targetUid?: string;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const targetUid = data.targetUid?.trim();
  const reason = data.reason?.trim() || 'host drop seat';
  if (!gameId || !targetUid) {
    throw new HttpsError('invalid-argument', 'gameId and targetUid required.');
  }

  const result = await applyCaptainKick({
    gameId,
    actorUid,
    targetUid,
    reason,
    requireHost: true,
  });

  await writeAudit({
    action: result.mode === 'terminated' ? 'host_terminate' : 'host_drop',
    actorUid,
    targetUid,
    detail: { gameId, reason, ...result },
  });

  return { ok: true, gameId, targetUid, ...result };
});

/**
 * Soft terminate keeps the game doc + messages for evidence (phase complete,
 * unrated, opsTerminated). Hard deletes the game and subcollections.
 */
export const opsTerminateSector = onCall(async (request) => {
  const data = request.data as {
    gameId?: string;
    reason?: string;
    mode?: 'soft' | 'hard';
  };
  const gameId = data.gameId?.trim();
  const reason = data.reason?.trim() || 'ops terminate';
  const mode = data.mode === 'hard' ? 'hard' : 'soft';
  const actorUid =
    mode === 'hard' ? requireAdmin(request) : requireModerator(request);
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }

  const ref = db.collection('games').doc(gameId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }

  if (mode === 'soft') {
    await ref.update(softTerminatePatch(actorUid, reason));
    await writeAudit({
      action: 'ops_terminate',
      actorUid,
      targetUid: null,
      detail: { gameId, reason, mode: 'soft' },
    });
    return { ok: true, gameId, mode: 'soft', deleted: false };
  }

  const deleted = {
    hands: await deleteCollectionDocs(`games/${gameId}/hands`),
    messages: await deleteCollectionDocs(`games/${gameId}/messages`),
    presence: await deleteCollectionDocs(`games/${gameId}/presence`),
    mutes: await deleteCollectionDocs(`games/${gameId}/mutes`),
  };
  await ref.delete();
  await writeAudit({
    action: 'ops_terminate',
    actorUid,
    targetUid: null,
    detail: { gameId, reason, mode: 'hard', deleted },
  });
  return { ok: true, gameId, mode: 'hard', deleted };
});

/** Lobby / terminated sectors with stale updatedAt (ops cleanup candidates). */
export const listStaleGames = onCall(async (request) => {
  requireAdmin(request);
  const data = request.data as { olderThanDays?: number; limit?: number };
  const days = Math.min(
    Math.max(data.olderThanDays ?? STALE_DEFAULT_DAYS, 1),
    90
  );
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const snap = await db
    .collection('games')
    .where('updatedAt', '<', cutoff)
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(limit * 3, 400))
    .get();

  const games = snap.docs
    .map((d: QueryDocumentSnapshot) => {
      const g = d.data();
      const phase = String(g.phase ?? '');
      const terminated = g.opsTerminated === true;
      const staleLobby = phase === 'lobby';
      const staleTerminated = terminated || phase === 'complete';
      if (!staleLobby && !staleTerminated) {
        return null;
      }
      return {
        id: d.id,
        phase,
        hostId: String(g.hostId ?? ''),
        updatedAt: String(g.updatedAt ?? ''),
        createdAt: String(g.createdAt ?? ''),
        opsTerminated: terminated,
        captainCount: Array.isArray(g.captains) ? g.captains.length : 0,
        rated: g.rated !== false,
      };
    })
    .filter(Boolean)
    .slice(0, limit);

  return { ok: true, cutoff, games, scanned: snap.size };
});

/** Hard-delete one stale/terminated sector (messages + hands + presence). */
export const opsCleanupStaleSector = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const ref = db.collection('games').doc(gameId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const g = snap.data()!;
  const phase = String(g.phase ?? '');
  if (
    phase !== 'lobby' &&
    phase !== 'complete' &&
    g.opsTerminated !== true
  ) {
    throw new HttpsError(
      'failed-precondition',
      'Only lobby, complete, or ops-terminated sectors can be cleaned up. Terminate live sectors first.'
    );
  }

  const deleted = {
    hands: await deleteCollectionDocs(`games/${gameId}/hands`),
    messages: await deleteCollectionDocs(`games/${gameId}/messages`),
    presence: await deleteCollectionDocs(`games/${gameId}/presence`),
    mutes: await deleteCollectionDocs(`games/${gameId}/mutes`),
  };
  await ref.delete();
  await writeAudit({
    action: 'ops_cleanup_stale',
    actorUid,
    targetUid: null,
    detail: { gameId, phase, deleted },
  });
  return { ok: true, gameId, deleted };
});
