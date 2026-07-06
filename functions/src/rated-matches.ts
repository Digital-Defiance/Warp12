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
  applyGroupTeiForPlayer,
  buildCertificatePlayer,
  buildRatedMatchCertificate,
  buildTeiTableFromStandings,
  generateMatchCode,
  groupObjectiveTeiStats,
  groupRatedClaimId,
  humanObjectiveTeiStats,
  normalizeMatchCode,
  resolveEffectivePlayerTei,
  startingTeiForObjective,
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  type PlayerStatsDocument,
  type RatedMatchCertificatePlayer,
  type RatedMatchDocument,
  type RatedMatchStanding,
  type RatedObjective,
  type WarpRole,
} from './tei';
import {
  loadCharter,
  validateCharterRatedMatch,
  assertCharterMember,
} from './charters';

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
  const charter = match.charterId
    ? await loadCharter(match.charterId)
    : null;

  const teiByUid = new Map<string, { tei: number; matches: number }>();
  for (const row of match.standings) {
    const stats = await loadStats(row.uid);
    if (charter) {
      const track = groupObjectiveTeiStats(
        stats,
        charter.charterId,
        match.objective,
        charter.seasonKey
      );
      teiByUid.set(row.uid, {
        tei: resolveEffectivePlayerTei(
          track.unassistedTei,
          track.unassistedMatches,
          startingTeiForObjective(stats, match.objective)
        ),
        matches: track.unassistedMatches,
      });
    } else {
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
  }

  const table = buildTeiTableFromStandings(match, teiByUid);
  const now = new Date().toISOString();
  const claims: Record<string, boolean> = { ...(match.teiClaims ?? {}) };
  const groupClaim = charter
    ? groupRatedClaimId(
        charter.charterId,
        match.matchCode,
        charter.seasonKey
      )
    : null;
  const certificatePlayers: RatedMatchCertificatePlayer[] = [];

  for (const row of match.standings) {
    if (claims[row.uid]) {
      continue;
    }

    const existing = await loadStats(row.uid);
    if (
      groupClaim &&
      existing?.groupRatedIds?.includes(groupClaim)
    ) {
      claims[row.uid] = true;
      continue;
    }

    const participant = match.participants.find((p) => p.uid === row.uid);
    const base =
      existing ?? emptyStats(row.uid, participant?.displayName ?? 'Captain');

    let teiBefore = 0;
    let teiAfter = 0;
    let won = false;
    let rank = row.rank;
    let humanTei = base.humanTei;
    let groupTei = base.groupTei;
    const groupRatedIds = [...(base.groupRatedIds ?? [])];
    let globalTeiBefore: number | undefined;
    let globalTeiAfter: number | undefined;

    if (charter) {
      const groupApplied = applyGroupTeiForPlayer(
        existing,
        charter.charterId,
        match.objective,
        table,
        row.uid,
        charter.seasonKey
      );
      if (!groupApplied) {
        continue;
      }
      teiBefore = groupApplied.teiBefore;
      teiAfter = groupApplied.teiAfter;
      won = groupApplied.won;
      rank = groupApplied.rank;
      groupTei = groupApplied.groupTei;
      if (groupClaim && !groupRatedIds.includes(groupClaim)) {
        groupRatedIds.push(groupClaim);
      }

      if (charter.isGlobalOfficial) {
        const humanApplied = applyHumanTeiForPlayer(
          existing,
          match.objective,
          table,
          row.uid
        );
        if (humanApplied) {
          humanTei = humanApplied.humanTei;
          globalTeiBefore = humanApplied.teiBefore;
          globalTeiAfter = humanApplied.teiAfter;
        }
      }
    } else {
      const applied = applyHumanTeiForPlayer(
        existing,
        match.objective,
        table,
        row.uid
      );
      if (!applied) {
        continue;
      }
      teiBefore = applied.teiBefore;
      teiAfter = applied.teiAfter;
      won = applied.won;
      rank = applied.rank;
      humanTei = applied.humanTei;
    }

    const historyEntry = {
      playedAt: now,
      objective: match.objective,
      opponentContext: 'human' as const,
      playerCount:
        match.playerCount ?? match.participants.length,
      finishRank: rank,
      won,
      advisorUsed: false,
      teiBefore,
      teiAfter,
      teiDelta: teiAfter - teiBefore,
      charterId: charter?.charterId,
      charterName: charter?.name,
    };
    const priorHistory = (base as { matchHistory?: unknown[] }).matchHistory ?? [];
    const matchHistory = [historyEntry, ...priorHistory].slice(0, 60);
    const ratedIds = !charter
      ? [...(base.humanRatedGameIds ?? []), match.matchCode]
      : charter.isGlobalOfficial
        ? [...(base.humanRatedGameIds ?? []), match.matchCode]
        : base.humanRatedGameIds;

    await statsRef(row.uid).set(
      {
        ...base,
        displayName: participant?.displayName ?? base.displayName,
        matchesCompleted: base.matchesCompleted + 1,
        matchesWon: base.matchesWon + (won ? 1 : 0),
        humanTei,
        groupTei,
        humanRatedGameIds: ratedIds,
        groupRatedIds,
        matchHistory,
        lastPlayedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    claims[row.uid] = true;

    const standing = match.standings.find((s) => s.uid === row.uid);
    certificatePlayers.push(
      buildCertificatePlayer({
        uid: row.uid,
        displayName: participant?.displayName ?? base.displayName,
        rank,
        score: standing?.score ?? 0,
        teiBefore,
        teiAfter,
        charterId: charter?.charterId,
        globalTeiBefore,
        globalTeiAfter,
      })
    );
  }

  const certificate = buildRatedMatchCertificate({
    matchCode: match.matchCode,
    issuedAt: now,
    objective: match.objective,
    charter: charter
      ? {
          charterId: charter.charterId,
          name: charter.name,
          slug: charter.slug,
          rulesProfileId: charter.rulesProfileId,
          playerCount: charter.playerCount,
          campaignRounds: charter.campaignRounds,
          seasonLabel: charter.seasonLabel,
        }
      : undefined,
    players: certificatePlayers,
  });

  await matchRef(match.matchCode).update({
    teiClaims: claims,
    certificate,
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
    charterId?: string;
    playerCount?: number;
    rulesProfileId?: string;
  };

  let objective = data.objective;
  let campaignRounds = data.campaignRounds ?? 4;
  let charterId = data.charterId?.trim() || undefined;
  let playerCount = data.playerCount;
  let rulesProfileId = data.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID;

  if (charterId) {
    const charter = await loadCharter(charterId);
    await assertCharterMember(charter, officialId);
    objective = charter.objective;
    campaignRounds = charter.campaignRounds;
    playerCount = charter.playerCount;
    rulesProfileId = charter.rulesProfileId;
  }

  if (objective !== 'go-out' && objective !== 'points') {
    throw new HttpsError('invalid-argument', 'objective must be go-out or points.');
  }

  if (campaignRounds < 1 || campaignRounds > 13) {
    throw new HttpsError('invalid-argument', 'campaignRounds must be 1–13.');
  }

  if (playerCount !== undefined && (playerCount < 2 || playerCount > 8)) {
    throw new HttpsError('invalid-argument', 'playerCount must be 2–8.');
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
    objective,
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
    charterId,
    rulesProfileId,
    playerCount,
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

  if (match.charterId) {
    const charter = await loadCharter(match.charterId);
    if (!charter.memberUids.includes(uid)) {
      throw new HttpsError(
        'permission-denied',
        'Join this crew on the leaderboard before checking in to a crew match.'
      );
    }
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

  if (match.charterId) {
    const charter = await loadCharter(match.charterId);
    await validateCharterRatedMatch(charter, {
      objective: match.objective,
      campaignRounds: match.campaignRounds,
      rulesProfileId: match.rulesProfileId,
      playerCount: match.playerCount,
      participantUids: match.participants.map((p) => p.uid),
    });
  }

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
