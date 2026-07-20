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
import { assertNotBanned } from './bans';
import {
  applyHumanRatingForPlayer,
  applyGroupRatingForPlayer,
  buildCertificatePlayer,
  buildRatedMatchCertificate,
  buildRatingTableFromStandings,
  generateMatchCode,
  groupObjectiveRatingStats,
  groupRatedClaimId,
  humanObjectiveRatingStats,
  issueSignedCertificate,
  normalizeMatchCode,
  resolveEffectivePlayerRating,
  startingRatingForObjective,
  writeRatingEventIfAbsent,
  officialRatingEventId,
  snapshotFromRatedTable,
  objectiveToTrackKey,
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  type PlayerStatsDocument,
  type RatedMatchCertificatePlayer,
  type RatedMatchDocument,
  type RatedMatchStanding,
  type RatedObjective,
  type RatingEventParticipant,
  type StoredRating,
  type WarpRole,
} from './tei';
import {
  loadCharter,
  validateCharterRatedMatch,
  assertCharterMember,
} from './charters';
import { omitUndefinedFields } from './ops/host-continuity-helpers.js';

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

async function applyRatingForApprovedMatch(
  match: RatedMatchDocument
): Promise<void> {
  const charter = match.charterId
    ? await loadCharter(match.charterId)
    : null;

  const ratingByUid = new Map<string, { rating: StoredRating; matches: number }>();
  for (const row of match.standings) {
    const stats = await loadStats(row.uid);
    if (charter) {
      const track = groupObjectiveRatingStats(
        stats,
        charter.charterId,
        match.objective,
        charter.seasonKey
      );
      ratingByUid.set(row.uid, {
        rating: resolveEffectivePlayerRating(
          track.rating,
          track.rating.matches,
          startingRatingForObjective(stats, match.objective)
        ),
        matches: track.rating.matches,
      });
    } else {
      const track = humanObjectiveRatingStats(stats, match.objective);
      ratingByUid.set(row.uid, {
        rating: resolveEffectivePlayerRating(
          track.rating,
          track.rating.matches,
          startingRatingForObjective(stats, match.objective)
        ),
        matches: track.rating.matches,
      });
    }
  }

  const table = buildRatingTableFromStandings(match, ratingByUid);
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
  const groupLedgerParticipants: RatingEventParticipant[] = [];
  const humanLedgerParticipants: RatingEventParticipant[] = [];

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

    let ratingBefore: StoredRating = { mu: 25.0, sigma: 8.33, matches: 0, displayRating: 0.0 };
    let ratingAfter: StoredRating = { mu: 25.0, sigma: 8.33, matches: 0, displayRating: 0.0 };
    let won = false;
    let rank = row.rank;
    let humanRating = base.humanRating;
    let groupRating = base.groupRating;
    const groupRatedIds = [...(base.groupRatedIds ?? [])];
    let globalRatingBefore: StoredRating | undefined;
    let globalRatingAfter: StoredRating | undefined;

    if (charter) {
      const groupApplied = applyGroupRatingForPlayer(
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
      ratingBefore = groupApplied.ratingBefore;
      ratingAfter = groupApplied.ratingAfter;
      won = groupApplied.won;
      rank = groupApplied.rank;
      groupRating = groupApplied.groupRating;
      if (groupClaim && !groupRatedIds.includes(groupClaim)) {
        groupRatedIds.push(groupClaim);
      }

      if (charter.isGlobalOfficial) {
        const humanApplied = applyHumanRatingForPlayer(
          existing,
          match.objective,
          table,
          row.uid
        );
        if (humanApplied) {
          humanRating = humanApplied.humanRating;
          globalRatingBefore = humanApplied.ratingBefore;
          globalRatingAfter = humanApplied.ratingAfter;
        }
      }
    } else {
      const applied = applyHumanRatingForPlayer(
        existing,
        match.objective,
        table,
        row.uid
      );
      if (!applied) {
        continue;
      }
      ratingBefore = applied.ratingBefore;
      ratingAfter = applied.ratingAfter;
      won = applied.won;
      rank = applied.rank;
      humanRating = applied.humanRating;
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
      ratingBefore,
      ratingAfter,
      muDelta: ratingAfter.mu - ratingBefore.mu,
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
        humanRating,
        groupRating,
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
    const displayName = participant?.displayName ?? base.displayName;

    if (charter) {
      groupLedgerParticipants.push({
        uid: row.uid,
        displayName,
        rank,
        won,
        ratingBefore,
        ratingAfter,
        score: standing?.score ?? 0,
      });
      if (globalRatingBefore && globalRatingAfter) {
        humanLedgerParticipants.push({
          uid: row.uid,
          displayName,
          rank,
          won,
          ratingBefore: globalRatingBefore,
          ratingAfter: globalRatingAfter,
          score: standing?.score ?? 0,
        });
      }
    } else {
      humanLedgerParticipants.push({
        uid: row.uid,
        displayName,
        rank,
        won,
        ratingBefore,
        ratingAfter,
        score: standing?.score ?? 0,
      });
    }

    certificatePlayers.push(
      buildCertificatePlayer({
        uid: row.uid,
        displayName,
        rank,
        score: standing?.score ?? 0,
        ratingBefore,
        ratingAfter,
        charterId: charter?.charterId,
        globalRatingBefore,
        globalRatingAfter,
      })
    );
  }

  const track = objectiveToTrackKey(match.objective);
  const snapshot = snapshotFromRatedTable(table);
  if (groupLedgerParticipants.length > 0 && charter) {
    await writeRatingEventIfAbsent({
      eventId: officialRatingEventId(match.matchCode, 'group'),
      source: 'official',
      matchId: match.matchCode,
      pool: 'group',
      track,
      objective: match.objective,
      playedAt: match.completedAt ?? now,
      appliedAt: now,
      memberUids: groupLedgerParticipants.map((p) => p.uid),
      participants: groupLedgerParticipants,
      snapshot,
      charterId: charter.charterId,
      seasonKey: charter.seasonKey,
      writer: 'approveRatedMatch',
    });
  }
  if (humanLedgerParticipants.length > 0) {
    await writeRatingEventIfAbsent({
      eventId: officialRatingEventId(match.matchCode, 'human'),
      source: 'official',
      matchId: match.matchCode,
      pool: 'human',
      track,
      objective: match.objective,
      playedAt: match.completedAt ?? now,
      appliedAt: now,
      memberUids: humanLedgerParticipants.map((p) => p.uid),
      participants: humanLedgerParticipants,
      snapshot,
      writer: 'approveRatedMatch',
    });
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

  const certificateWithPdf = await issueSignedCertificate(certificate);

  await matchRef(match.matchCode).update({
    teiClaims: claims,
    certificate: certificateWithPdf,
    updatedAt: now,
  });
}

export const setUserRoles = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { uid, roles } = request.data as { uid?: string; roles?: WarpRole[] };
  if (!uid || !Array.isArray(roles)) {
    throw new HttpsError('invalid-argument', 'uid and roles array required.');
  }
  const allowed: WarpRole[] = ['admin', 'moderator', 'match_official'];
  for (const role of roles) {
    if (!allowed.includes(role)) {
      throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
    }
  }
  const nextRoles = [...new Set(roles)];
  // Never lock yourself out — another admin must demote you.
  if (uid === actorUid && !nextRoles.includes('admin')) {
    throw new HttpsError(
      'failed-precondition',
      'You cannot remove your own admin role.'
    );
  }
  await admin.auth().setCustomUserClaims(uid, { roles: nextRoles });
  return { ok: true, uid, roles: nextRoles };
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
  await assertNotBanned(officialId, request);
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

  await matchRef(matchCode).set(
    omitUndefinedFields(doc as unknown as Record<string, unknown>)
  );
  return { matchCode, status: doc.status };
});

export const checkInToMatch = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await assertNotBanned(uid, request);
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
  await applyRatingForApprovedMatch(approved);

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
