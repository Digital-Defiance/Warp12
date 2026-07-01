import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { bootstrapAdminSecret } from './params';

import {
  hasRole,
  requireAdmin,
  requireOfficial,
  requireSignedIn,
  requireVerifiedUser,
} from './auth';
import {
  applyHumanTeiForPlayer,
  buildTeiTableFromStandings,
  generateMatchCode,
  humanObjectiveTeiStats,
  normalizeMatchCode,
  resolveEffectivePlayerTei,
  startingTeiForObjective,
  type PlayerStatsDocument,
  type RatedMatchDocument,
  type RatedMatchStanding,
  type RatedObjective,
  type WarpRole,
} from './tei';

const db = admin.firestore();

function matchRef(code: string) {
  return db.collection('ratedMatches').doc(normalizeMatchCode(code));
}

function statsRef(uid: string) {
  return db.collection('playerStats').doc(uid);
}

async function loadStats(uid: string): Promise<PlayerStatsDocument | null> {
  const snap = await statsRef(uid).get();
  return snap.exists ? (snap.data() as PlayerStatsDocument) : null;
}

function emptyStats(uid: string, displayName: string): PlayerStatsDocument {
  const now = new Date().toISOString();
  return {
    uid,
    displayName,
    matchesCompleted: 0,
    matchesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    totalPoints: 0,
    updatedAt: now,
  };
}

function validateStandings(
  standings: RatedMatchStanding[],
  participants: RatedMatchDocument['participants']
): void {
  if (standings.length < 2) {
    throw new HttpsError(
      'invalid-argument',
      'At least two standings rows are required.'
    );
  }
  const participantIds = new Set(participants.map((p) => p.uid));
  for (const row of standings) {
    if (!participantIds.has(row.uid)) {
      throw new HttpsError(
        'invalid-argument',
        `Standing uid ${row.uid} is not a checked-in participant.`
      );
    }
    if (row.rank < 1) {
      throw new HttpsError('invalid-argument', 'Rank must be at least 1.');
    }
  }
}

async function applyTeiForApprovedMatch(
  match: RatedMatchDocument
): Promise<void> {
  const teiByUid = new Map<string, { tei: number; matches: number }>();
  for (const row of match.standings) {
    const stats = await loadStats(row.uid);
    const track = humanObjectiveTeiStats(stats, match.objective);
    teiByUid.set(row.uid, {
      tei: resolveEffectivePlayerTei(
        track.unassistedTei,
        track.unassistedMatches,
        startingTeiForObjective(stats, match.objective)
      ),
      matches: track.unassistedMatches,
    });
  }

  const table = buildTeiTableFromStandings(match, teiByUid);
  const now = new Date().toISOString();
  const claims: Record<string, boolean> = { ...(match.teiClaims ?? {}) };

  for (const row of match.standings) {
    if (claims[row.uid]) {
      continue;
    }

    const existing = await loadStats(row.uid);
    const applied = applyHumanTeiForPlayer(
      existing,
      match.objective,
      table,
      row.uid
    );
    if (!applied) {
      continue;
    }

    const participant = match.participants.find((p) => p.uid === row.uid);
    const base = existing ?? emptyStats(row.uid, participant?.displayName ?? 'Captain');
    const ratedIds = [...(base.humanRatedGameIds ?? []), match.matchCode];

    const historyEntry = {
      playedAt: now,
      objective: match.objective,
      opponentContext: 'human' as const,
      playerCount: match.participants.length,
      finishRank: applied.rank,
      won: applied.won,
      advisorUsed: false,
      teiBefore: applied.teiBefore,
      teiAfter: applied.teiAfter,
      teiDelta: applied.teiAfter - applied.teiBefore,
    };
    const priorHistory = (base as { matchHistory?: unknown[] }).matchHistory ?? [];
    const matchHistory = [historyEntry, ...priorHistory].slice(0, 60);

    await statsRef(row.uid).set(
      {
        ...base,
        displayName: participant?.displayName ?? base.displayName,
        matchesCompleted: base.matchesCompleted + 1,
        matchesWon: base.matchesWon + (applied.won ? 1 : 0),
        humanTei: applied.humanTei,
        humanRatedGameIds: ratedIds,
        matchHistory,
        lastPlayedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    claims[row.uid] = true;
  }

  await matchRef(match.matchCode).update({
    teiClaims: claims,
    updatedAt: now,
  });
}

export const setUserRoles = onCall(async (request) => {
  requireAdmin(request);
  const { uid, roles } = request.data as { uid?: string; roles?: WarpRole[] };
  if (!uid || !Array.isArray(roles)) {
    throw new HttpsError('invalid-argument', 'uid and roles array required.');
  }
  const allowed: WarpRole[] = ['admin', 'match_official'];
  for (const role of roles) {
    if (!allowed.includes(role)) {
      throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
    }
  }
  await admin.auth().setCustomUserClaims(uid, { roles });
  return { ok: true, uid, roles };
});

export const bootstrapAdmin = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const secret = request.data?.secret as string | undefined;
  const expected = bootstrapAdminSecret.value();
  if (!expected || secret !== expected) {
    throw new HttpsError('permission-denied', 'Invalid bootstrap secret.');
  }
  await admin.auth().setCustomUserClaims(uid, { roles: ['admin'] });
  return { ok: true, uid, roles: ['admin'] };
});

export const createRatedMatch = onCall(async (request) => {
  const officialId = requireOfficial(request);
  const data = request.data as {
    objective?: RatedObjective;
    campaignRounds?: number;
    venue?: string;
    notes?: string;
    officialDisplayName?: string;
  };

  if (data.objective !== 'go-out' && data.objective !== 'points') {
    throw new HttpsError('invalid-argument', 'objective must be go-out or points.');
  }

  const campaignRounds = data.campaignRounds ?? 4;
  if (campaignRounds < 1 || campaignRounds > 13) {
    throw new HttpsError('invalid-argument', 'campaignRounds must be 1–13.');
  }

  let matchCode = generateMatchCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const snap = await matchRef(matchCode).get();
    if (!snap.exists) {
      break;
    }
    matchCode = generateMatchCode();
  }

  const now = new Date().toISOString();
  const doc: RatedMatchDocument = {
    matchCode,
    status: 'open',
    objective: data.objective,
    campaignRounds,
    venue: data.venue?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    officialId,
    officialDisplayName: data.officialDisplayName?.trim() || 'Match Official',
    createdAt: now,
    updatedAt: now,
    openedAt: now,
    participants: [],
    standings: [],
    teiClaims: {},
  };

  await matchRef(matchCode).set(doc);
  return { matchCode, status: doc.status };
});

export const checkInToMatch = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { matchCode, displayName } = request.data as {
    matchCode?: string;
    displayName?: string;
  };
  if (!matchCode) {
    throw new HttpsError('invalid-argument', 'matchCode required.');
  }

  const ref = matchRef(matchCode);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }

  const match = snap.data() as RatedMatchDocument;
  if (match.status !== 'open') {
    throw new HttpsError(
      'failed-precondition',
      `Match is ${match.status}; check-in is only allowed while open.`
    );
  }

  if (match.participants.some((p) => p.uid === uid)) {
    return { ok: true, alreadyCheckedIn: true, matchCode: match.matchCode };
  }

  const name = displayName?.trim() || 'Captain';
  const now = new Date().toISOString();
  const participants = [
    ...match.participants,
    { uid, displayName: name, checkedInAt: now },
  ];

  await ref.update({ participants, updatedAt: now });
  return { ok: true, matchCode: match.matchCode, participants };
});

export const submitMatchStandings = onCall(async (request) => {
  const officialId = requireOfficial(request);
  const { matchCode, standings } = request.data as {
    matchCode?: string;
    standings?: RatedMatchStanding[];
  };

  if (!matchCode || !Array.isArray(standings)) {
    throw new HttpsError('invalid-argument', 'matchCode and standings required.');
  }

  const ref = matchRef(matchCode);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }

  const match = snap.data() as RatedMatchDocument;
  if (match.officialId !== officialId && !hasRole(request, 'admin')) {
    throw new HttpsError(
      'permission-denied',
      'Only the assigned official or an admin can submit standings.'
    );
  }

  if (match.status !== 'open' && match.status !== 'completed') {
    throw new HttpsError(
      'failed-precondition',
      `Cannot submit standings while status is ${match.status}.`
    );
  }

  validateStandings(standings, match.participants);

  const now = new Date().toISOString();
  await ref.update({
    standings,
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  });

  return { ok: true, status: 'completed' };
});

export const approveRatedMatch = onCall(async (request) => {
  const approverId = requireOfficial(request);
  const { matchCode } = request.data as { matchCode?: string };
  if (!matchCode) {
    throw new HttpsError('invalid-argument', 'matchCode required.');
  }

  const ref = matchRef(matchCode);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }

  const match = snap.data() as RatedMatchDocument;
  if (match.status !== 'completed') {
    throw new HttpsError(
      'failed-precondition',
      'Match must be completed before approval.'
    );
  }

  if (match.standings.length < 2) {
    throw new HttpsError('failed-precondition', 'Standings not submitted.');
  }

  const now = new Date().toISOString();
  await ref.update({
    status: 'approved',
    approvedAt: now,
    approvedBy: approverId,
    updatedAt: now,
  });

  const approved = { ...match, status: 'approved' as const, approvedAt: now, approvedBy: approverId };
  await applyTeiForApprovedMatch(approved);

  return { ok: true, status: 'approved' };
});

export const rejectRatedMatch = onCall(async (request) => {
  const officialId = requireOfficial(request);
  const { matchCode, reason } = request.data as {
    matchCode?: string;
    reason?: string;
  };
  if (!matchCode) {
    throw new HttpsError('invalid-argument', 'matchCode required.');
  }

  const ref = matchRef(matchCode);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Match not found.');
  }

  const match = snap.data() as RatedMatchDocument;
  if (match.officialId !== officialId && !hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Not authorized to reject this match.');
  }

  const now = new Date().toISOString();
  await ref.update({
    status: 'rejected',
    rejectedAt: now,
    rejectedBy: officialId,
    rejectionReason: reason?.trim() || undefined,
    updatedAt: now,
  });

  return { ok: true, status: 'rejected' };
});

export const getMyRoles = onCall(async (request) => {
  requireSignedIn(request);
  const roles = request.auth?.token.roles;
  return { roles: Array.isArray(roles) ? roles : [] };
});
