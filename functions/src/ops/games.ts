import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type {
  DocumentData,
  Query,
  QuerySnapshot,
} from 'firebase-admin/firestore';

import { requireAdmin, requireModerator } from '../auth';

const db = admin.firestore();

const ACTIVE_PHASES = new Set(['lobby', 'active', 'round-end']);

export type OpsGameCaptain = {
  id: string;
  displayName: string;
  isAi: boolean;
  verified?: boolean;
};

export type OpsGameSummary = {
  id: string;
  phase: string;
  hostId: string;
  createdAt: string;
  updatedAt: string;
  objective: string;
  rated: boolean;
  maxPip: number;
  maxPlayers: number;
  captainCount: number;
  captains: OpsGameCaptain[];
  charterId: string | null;
  completedRounds: number;
  campaignRounds: number;
  opsTerminated: boolean;
  allowSpectate: boolean;
  spectatorCount: number;
};

function toSummary(id: string, data: DocumentData): OpsGameSummary {
  const captainsRaw = Array.isArray(data.captains) ? data.captains : [];
  const captains: OpsGameCaptain[] = captainsRaw.map(
    (c: {
      id?: string;
      displayName?: string;
      isAi?: boolean;
      verified?: boolean;
    }) => ({
      id: String(c.id ?? ''),
      displayName: String(c.displayName ?? 'Captain'),
      isAi: Boolean(c.isAi),
      verified: c.verified,
    })
  );
  return {
    id,
    phase: String(data.phase ?? 'unknown'),
    hostId: String(data.hostId ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    objective: String(data.objective ?? 'points'),
    rated: data.rated !== false,
    maxPip: typeof data.maxPip === 'number' ? data.maxPip : 12,
    maxPlayers:
      typeof data.maxPlayers === 'number' ? data.maxPlayers : captains.length,
    captainCount: captains.length,
    captains,
    charterId: typeof data.charterId === 'string' ? data.charterId : null,
    completedRounds:
      typeof data.completedRounds === 'number' ? data.completedRounds : 0,
    campaignRounds:
      typeof data.campaignRounds === 'number' ? data.campaignRounds : 0,
    opsTerminated: data.opsTerminated === true,
    allowSpectate: data.allowSpectate !== false,
    spectatorCount: Array.isArray(data.spectatorIds)
      ? data.spectatorIds.length
      : 0,
  };
}

/** Live / in-progress sectors for the ops dashboard. */
export const listActiveGames = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as { limit?: number };
  const limit = Math.min(Math.max(data.limit ?? 100, 1), 300);

  const snap = await db
    .collection('games')
    .orderBy('updatedAt', 'desc')
    .limit(Math.min(limit * 4, 500))
    .get();

  const games = snap.docs
    .map((d) => toSummary(d.id, d.data()))
    .filter((g) => ACTIVE_PHASES.has(g.phase))
    .slice(0, limit);

  return { ok: true, games, scanned: snap.size };
});

/** Historical / filtered sector search (complaint date windows, host, id). */
export const searchGames = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    gameId?: string;
    hostId?: string;
    phase?: string;
    rated?: boolean | null;
    fromIso?: string;
    toIso?: string;
    limit?: number;
  };
  const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
  const gameId = data.gameId?.trim();

  if (gameId) {
    const snap = await db.collection('games').doc(gameId).get();
    if (!snap.exists) {
      return { ok: true, games: [] as OpsGameSummary[] };
    }
    return { ok: true, games: [toSummary(snap.id, snap.data()!)] };
  }

  const fromIso = data.fromIso?.trim();
  const toIso = data.toIso?.trim();
  let query: Query = db.collection('games');

  if (fromIso && toIso) {
    query = query
      .where('createdAt', '>=', fromIso)
      .where('createdAt', '<=', toIso)
      .orderBy('createdAt', 'desc');
  } else if (fromIso) {
    query = query.where('createdAt', '>=', fromIso).orderBy('createdAt', 'desc');
  } else if (toIso) {
    query = query.where('createdAt', '<=', toIso).orderBy('createdAt', 'desc');
  } else if (data.hostId?.trim()) {
    query = query
      .where('hostId', '==', data.hostId.trim())
      .orderBy('createdAt', 'desc');
  } else if (data.phase?.trim()) {
    query = query
      .where('phase', '==', data.phase.trim())
      .orderBy('updatedAt', 'desc');
  } else {
    query = query.orderBy('createdAt', 'desc');
  }

  const fetchLimit =
    data.hostId || data.phase || data.rated != null
      ? Math.min(limit * 3, 400)
      : limit;

  let snap: QuerySnapshot;
  try {
    snap = await query.limit(fetchLimit).get();
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      err instanceof Error
        ? `Game search query failed (index may be building): ${err.message}`
        : 'Game search query failed.'
    );
  }

  let games = snap.docs.map((d) => toSummary(d.id, d.data()));
  if (data.hostId?.trim() && (fromIso || toIso)) {
    const host = data.hostId.trim();
    games = games.filter((g) => g.hostId === host);
  }
  if (data.phase?.trim() && (fromIso || toIso || data.hostId?.trim())) {
    const phase = data.phase.trim();
    games = games.filter((g) => g.phase === phase);
  }
  if (data.rated === true || data.rated === false) {
    games = games.filter((g) => g.rated === data.rated);
  }

  return { ok: true, games: games.slice(0, limit), scanned: snap.size };
});

/** Single sector snapshot for ops (public game doc fields only — no hands). */
export const getOpsGame = onCall(async (request) => {
  requireModerator(request);
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const snap = await db.collection('games').doc(gameId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Game not found.');
  }
  const data = snap.data()!;
  const summary = toSummary(snap.id, data);

  const presenceSnap = await db
    .collection('games')
    .doc(gameId)
    .collection('presence')
    .get();
  const coachPresence: Record<
    string,
    {
      coachRequestedAt: string;
      coachRoundNumber: number | null;
      coachUsedThisRound: boolean;
    }
  > = {};
  for (const doc of presenceSnap.docs) {
    const p = doc.data();
    coachPresence[doc.id] = {
      coachRequestedAt: String(p.coachRequestedAt ?? ''),
      coachRoundNumber:
        typeof p.coachRoundNumber === 'number' ? p.coachRoundNumber : null,
      coachUsedThisRound: p.coachUsedThisRound === true,
    };
  }

  return {
    ok: true,
    game: summary,
    detail: {
      modules: data.modules ?? null,
      houseRules: data.houseRules ?? null,
      rulesProfileId: data.rulesProfileId ?? null,
      squadrons: data.squadrons ?? null,
      roundPhase: data.round?.phase ?? null,
      opsTerminated: data.opsTerminated === true,
      opsTerminatedAt: data.opsTerminatedAt ?? null,
      opsTerminatedBy: data.opsTerminatedBy ?? null,
      opsTerminationReason: data.opsTerminationReason ?? null,
      allowSpectate: data.allowSpectate !== false,
      spectatorIds: Array.isArray(data.spectatorIds) ? data.spectatorIds : [],
      coachPresence,
    },
  };
});

/** Admin-only hand peek for a live sector (never exposed to players/spectators). */
export const getOpsHands = onCall(async (request) => {
  requireAdmin(request);
  const gameId = (request.data as { gameId?: string }).gameId?.trim();
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }
  const gameSnap = await db.collection('games').doc(gameId).get();
  if (!gameSnap.exists) {
    throw new HttpsError('not-found', 'Game not found.');
  }
  const data = gameSnap.data()!;
  const captainIds: string[] = Array.isArray(data.captainIds)
    ? data.captainIds.map(String)
    : [];
  const captainsRaw = Array.isArray(data.captains) ? data.captains : [];
  const nameById = new Map<string, string>();
  for (const row of captainsRaw) {
    if (row && typeof row === 'object') {
      const c = row as { id?: unknown; displayName?: unknown };
      if (typeof c.id === 'string') {
        nameById.set(
          c.id,
          typeof c.displayName === 'string' ? c.displayName : 'Captain'
        );
      }
    }
  }

  const handsSnap = await db
    .collection('games')
    .doc(gameId)
    .collection('hands')
    .get();

  const hands = handsSnap.docs.map((doc) => {
    const hand = doc.data();
    const tiles = Array.isArray(hand.tiles) ? hand.tiles : [];
    return {
      playerId: doc.id,
      displayName: nameById.get(doc.id) ?? doc.id,
      tileCount: tiles.length,
      tiles,
      seated: captainIds.includes(doc.id),
    };
  });

  return {
    ok: true,
    gameId,
    phase: String(data.phase ?? ''),
    roundPhase: data.round?.phase ?? null,
    hands,
  };
});
