import * as admin from 'firebase-admin';
import { createHash, randomBytes } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { hasRole, requireSignedIn, requireVerifiedUser, requireAdmin } from './auth';
import { assertNotBanned } from './bans';
import {
  GLOBAL_OFFICIAL_PLAYER_COUNTS,
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  isSupportedOfficialRulesProfile,
  applyGroupRatingForPlayer,
  charterMatchesRatedEvent,
  generateCrewInviteToken,
  generateCrewInviteCodeShort,
  normalizeCrewInviteCode,
  formatCrewInviteCode,
  globalOfficialCharterId,
  globalOfficialSlug,
  groupObjectiveRatingStats,
  groupRatedClaimId,
  isGlobalOfficialCharterId,
  normalizeCharterSlug,
  normalizeSeasonKey,
  parseGlobalOfficialFleetSize,
  resolveCharterHouseRules,
  resolveCharterModules,
  effectiveCharterHouseRules,
  effectiveCharterModules,
  OFFICIAL_CHARTER_HOUSE_RULES,
  OFFICIAL_CHARTER_MODULES,
  type CharterHouseRulesInput,
  type CharterModulesInput,
  type CharterDocument,
  type CharterMemberDocument,
  type CharterJoinRequestDocument,
  type RatedObjective,
} from './tei';

const db = admin.firestore();
const CHARTERS = 'charters';
const CHARTER_MEMBERS = 'charterMembers';
const CHARTER_JOIN_REQUESTS = 'charterJoinRequests';
const CHARTER_SEASON_ARCHIVES = 'charterSeasonArchives';

function joinRequestRef(charterId: string, uid: string) {
  return db.collection(CHARTER_JOIN_REQUESTS).doc(`${charterId}_${uid}`);
}

async function allocateUniqueInviteCodeShort(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateCrewInviteCodeShort();
    const taken = await db
      .collection(CHARTERS)
      .where('inviteCodeShort', '==', code)
      .limit(1)
      .get();
    if (taken.empty) {
      return code;
    }
  }
  throw new HttpsError('internal', 'Could not allocate crew invite code.');
}

async function loadCharterByInviteCode(short: string): Promise<CharterDocument> {
  const normalized = normalizeCrewInviteCode(short);
  if (normalized.length < 4) {
    throw new HttpsError('invalid-argument', 'Invalid crew code.');
  }
  const query = await db
    .collection(CHARTERS)
    .where('inviteCodeShort', '==', normalized)
    .limit(1)
    .get();
  if (query.empty) {
    throw new HttpsError('not-found', 'Crew not found for that code.');
  }
  return query.docs[0]!.data() as CharterDocument;
}

async function addCharterMember(
  charter: CharterDocument,
  uid: string,
  displayName: string,
  role: CharterMemberDocument['role']
): Promise<CharterDocument> {
  const now = new Date().toISOString();
  const member: CharterMemberDocument = {
    charterId: charter.charterId,
    uid,
    role,
    displayName,
    joinedAt: now,
  };

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(charterRef(charter.charterId));
    if (!fresh.exists) {
      throw new HttpsError('not-found', 'Crew not found.');
    }
    const current = fresh.data() as CharterDocument;
    if (current.memberUids.includes(uid)) {
      return;
    }
    tx.update(charterRef(charter.charterId), {
      memberUids: [...current.memberUids, uid],
      updatedAt: now,
    });
    tx.set(memberRef(charter.charterId, uid), member);
  });

  return loadCharter(charter.charterId);
}

function charterRef(charterId: string) {
  return db.collection(CHARTERS).doc(charterId);
}

function memberRef(charterId: string, uid: string) {
  return db.collection(CHARTER_MEMBERS).doc(`${charterId}_${uid}`);
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newCharterId(): string {
  return randomBytes(8).toString('hex');
}

export async function ensureGlobalOfficialCharterForFleet(
  playerCount: number
): Promise<CharterDocument> {
  if (playerCount < 2 || playerCount > 8) {
    throw new HttpsError('invalid-argument', 'playerCount must be 2–8.');
  }

  const charterId = globalOfficialCharterId(playerCount);
  const slug = globalOfficialSlug(playerCount);
  const ref = charterRef(charterId);
  const snap = await ref.get();
  const displayName =
    playerCount === 4
      ? 'Global Official'
      : `Global Official · ${playerCount} captains`;

  if (snap.exists) {
    const existing = snap.data() as CharterDocument;
    const patch: Partial<CharterDocument> = {};
    if (!existing.seasonLabel) {
      patch.seasonLabel = '2026 Spring';
    }
    if (!existing.seasonKey) {
      patch.seasonKey = '2026-spring';
    }
    if (Object.keys(patch).length > 0) {
      const now = new Date().toISOString();
      await ref.update({ ...patch, updatedAt: now });
      return { ...existing, ...patch, updatedAt: now };
    }
    return existing;
  }

  const now = new Date().toISOString();
  const doc: CharterDocument = {
    charterId,
    slug,
    name: displayName,
    rulesProfileId: WARP12_OFFICIAL_RULES_PROFILE_ID,
    objective: 'points',
    playerCount,
    campaignRounds: 13,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    memberUids: [],
    isGlobalOfficial: true,
    listed: true,
    seasonLabel: '2026 Spring',
    seasonKey: '2026-spring',
    modules: { ...OFFICIAL_CHARTER_MODULES },
    houseRules: { ...OFFICIAL_CHARTER_HOUSE_RULES },
  };
  await ref.set(doc);
  return doc;
}

export async function ensureGlobalOfficialCharter(): Promise<CharterDocument> {
  return ensureGlobalOfficialCharterForFleet(4);
}

export async function ensureAllGlobalOfficialCharters(): Promise<CharterDocument[]> {
  const charters: CharterDocument[] = [];
  for (const playerCount of GLOBAL_OFFICIAL_PLAYER_COUNTS) {
    charters.push(await ensureGlobalOfficialCharterForFleet(playerCount));
  }
  return charters;
}

async function resolveGlobalOfficialCharter(input: {
  charterId?: string;
  slug?: string;
  playerCount?: number;
}): Promise<CharterDocument | null> {
  if (input.playerCount !== undefined) {
    return ensureGlobalOfficialCharterForFleet(input.playerCount);
  }
  if (input.charterId && isGlobalOfficialCharterId(input.charterId)) {
    const fleet = parseGlobalOfficialFleetSize(input.charterId);
    if (fleet !== null) {
      return ensureGlobalOfficialCharterForFleet(fleet);
    }
  }
  if (input.slug) {
    const fleet = parseGlobalOfficialFleetSize(input.slug);
    if (fleet !== null) {
      return ensureGlobalOfficialCharterForFleet(fleet);
    }
  }
  return null;
}

export async function loadCharter(charterId: string): Promise<CharterDocument> {
  if (isGlobalOfficialCharterId(charterId)) {
    const fleet = parseGlobalOfficialFleetSize(charterId);
    if (fleet !== null) {
      return ensureGlobalOfficialCharterForFleet(fleet);
    }
  }
  const snap = await charterRef(charterId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Crew not found.');
  }
  return snap.data() as CharterDocument;
}

async function loadCharterBySlug(slug: string): Promise<CharterDocument> {
  const normalized = normalizeCharterSlug(slug);
  const query = await db
    .collection(CHARTERS)
    .where('slug', '==', normalized)
    .limit(1)
    .get();
  if (query.empty) {
    throw new HttpsError('not-found', 'Crew not found.');
  }
  return query.docs[0]!.data() as CharterDocument;
}

function publicCharterView(charter: CharterDocument) {
  return {
    charterId: charter.charterId,
    slug: charter.slug,
    name: charter.name,
    rulesProfileId: charter.rulesProfileId,
    objective: charter.objective,
    playerCount: charter.playerCount,
    campaignRounds: charter.campaignRounds,
    modules: effectiveCharterModules(charter),
    houseRules: effectiveCharterHouseRules(charter),
    memberCount: charter.memberUids.length,
    isGlobalOfficial: charter.isGlobalOfficial === true,
    listed: charter.listed === true,
    seasonLabel: charter.seasonLabel,
    seasonKey: charter.seasonKey,
    createdAt: charter.createdAt,
  };
}

export const createCharter = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await assertNotBanned(uid, request);
  const data = request.data as {
    name?: string;
    slug?: string;
    objective?: RatedObjective;
    playerCount?: number;
    campaignRounds?: number;
    rulesProfileId?: string;
    modules?: CharterModulesInput;
    houseRules?: CharterHouseRulesInput;
  };

  const name = data.name?.trim();
  if (!name || name.length < 2) {
    throw new HttpsError('invalid-argument', 'Crew name is required.');
  }

  const slug = normalizeCharterSlug(data.slug ?? name);
  if (!slug || slug.length < 2) {
    throw new HttpsError('invalid-argument', 'Crew URL slug is invalid.');
  }
  if (parseGlobalOfficialFleetSize(slug) !== null) {
    throw new HttpsError('invalid-argument', 'That crew slug is reserved.');
  }

  const objective = data.objective;
  if (objective !== 'points' && objective !== 'go-out') {
    throw new HttpsError('invalid-argument', 'objective must be points or go-out.');
  }

  const playerCount = data.playerCount ?? 4;
  if (playerCount < 2 || playerCount > 8) {
    throw new HttpsError('invalid-argument', 'playerCount must be 2–8.');
  }

  const campaignRounds = data.campaignRounds ?? (objective === 'points' ? 13 : 1);
  if (campaignRounds < 1 || campaignRounds > 13) {
    throw new HttpsError('invalid-argument', 'campaignRounds must be 1–13.');
  }

  const rulesProfileId = data.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID;
  if (!isSupportedOfficialRulesProfile(rulesProfileId)) {
    throw new HttpsError(
      'invalid-argument',
      'Only Official Warp 12 rules are supported for crews today.'
    );
  }

  const modules = resolveCharterModules(data.modules);
  const houseRules = resolveCharterHouseRules(data.houseRules);

  const slugTaken = await db
    .collection(CHARTERS)
    .where('slug', '==', slug)
    .limit(1)
    .get();
  if (!slugTaken.empty) {
    throw new HttpsError('already-exists', 'That crew URL is already taken.');
  }

  const charterId = newCharterId();
  const inviteToken = generateCrewInviteToken();
  const inviteCodeShort = await allocateUniqueInviteCodeShort();
  const now = new Date().toISOString();
  const displayName =
    (request.auth?.token.name as string | undefined)?.trim() || 'Captain';

  const charter: CharterDocument = {
    charterId,
    slug,
    name,
    rulesProfileId,
    objective,
    playerCount,
    campaignRounds,
    modules,
    houseRules,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    memberUids: [uid],
    inviteTokenHash: hashInviteToken(inviteToken),
    inviteCodeShort,
    listed: false,
  };

  const member: CharterMemberDocument = {
    charterId,
    uid,
    role: 'owner',
    displayName,
    joinedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(charterRef(charterId), charter);
    tx.set(memberRef(charterId, uid), member);
  });

  return {
    ...publicCharterView(charter),
    inviteToken,
    crewCode: formatCrewInviteCode(inviteCodeShort),
    inviteUrl: `https://iwdf.org/crews/${slug}/join?token=${inviteToken}`,
  };
});

export const joinCharter = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await assertNotBanned(uid, request);
  const data = request.data as {
    charterId?: string;
    slug?: string;
    inviteToken?: string;
    crewCode?: string;
  };

  const inviteToken = data.inviteToken?.trim();
  let charter: CharterDocument;

  if (data.crewCode?.trim()) {
    charter = await loadCharterByInviteCode(data.crewCode);
  } else if (data.charterId) {
    const globalCharter = await resolveGlobalOfficialCharter({
      charterId: data.charterId,
    });
    charter = globalCharter ?? (await loadCharter(data.charterId));
  } else if (data.slug) {
    const globalCharter = await resolveGlobalOfficialCharter({ slug: data.slug });
    charter = globalCharter ?? (await loadCharterBySlug(data.slug));
  } else {
    throw new HttpsError(
      'invalid-argument',
      'charterId, slug, crewCode, or inviteToken required.'
    );
  }

  if (!data.crewCode && !charter.isGlobalOfficial && !inviteToken) {
    throw new HttpsError('invalid-argument', 'inviteToken or crewCode required.');
  }

  if (charter.isGlobalOfficial) {
    // Open membership — no invite required.
  } else if (data.crewCode?.trim()) {
    if (charter.inviteCodeShort !== normalizeCrewInviteCode(data.crewCode)) {
      throw new HttpsError('permission-denied', 'Invalid crew invite code.');
    }
  } else if (!inviteToken || charter.inviteTokenHash !== hashInviteToken(inviteToken)) {
    throw new HttpsError('permission-denied', 'Invalid crew invite.');
  }

  if (charter.memberUids.includes(uid)) {
    return { ok: true, alreadyMember: true, charter: publicCharterView(charter) };
  }

  const displayName =
    (request.auth?.token.name as string | undefined)?.trim() || 'Captain';
  const updated = await addCharterMember(charter, uid, displayName, 'member');
  return { ok: true, charter: publicCharterView(updated) };
});

export const leaveCharter = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId } = request.data as { charterId?: string };
  if (!charterId) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  const charter = await loadCharter(charterId);
  if (!charter.memberUids.includes(uid)) {
    return { ok: true };
  }
  if (charter.createdBy === uid && charter.memberUids.length > 1) {
    throw new HttpsError(
      'failed-precondition',
      'Transfer ownership or remove other members before leaving as owner.'
    );
  }

  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(charterRef(charterId));
    if (!fresh.exists) {
      return;
    }
    const current = fresh.data() as CharterDocument;
    tx.update(charterRef(charterId), {
      memberUids: current.memberUids.filter((id) => id !== uid),
      updatedAt: now,
    });
    tx.delete(memberRef(charterId, uid));
  });

  return { ok: true };
});

export const listMyCharters = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await ensureGlobalOfficialCharter();

  const memberSnaps = await db
    .collection(CHARTER_MEMBERS)
    .where('uid', '==', uid)
    .get();

  const charters: ReturnType<typeof publicCharterView>[] = [];
  for (const memberDoc of memberSnaps.docs) {
    const member = memberDoc.data() as CharterMemberDocument;
    const snap = await charterRef(member.charterId).get();
    if (snap.exists) {
      charters.push(publicCharterView(snap.data() as CharterDocument));
    }
  }

  charters.sort((a, b) => a.name.localeCompare(b.name));
  return { charters };
});

export const getCharter = onCall(async (request) => {
  requireSignedIn(request);
  const { slug, charterId, playerCount } = request.data as {
    slug?: string;
    charterId?: string;
    playerCount?: number;
  };

  const globalCharter = await resolveGlobalOfficialCharter({
    charterId,
    slug,
    playerCount,
  });
  if (globalCharter) {
    return { charter: publicCharterView(globalCharter) };
  }

  const charter = charterId
    ? await loadCharter(charterId)
    : await loadCharterBySlug(slug ?? '');

  return { charter: publicCharterView(charter) };
});

export const rotateCharterInvite = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId } = request.data as { charterId?: string };
  if (!charterId) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  const charter = await loadCharter(charterId);
  if (charter.createdBy !== uid && !hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Only the crew owner can rotate invites.');
  }
  if (charter.isGlobalOfficial) {
    throw new HttpsError('failed-precondition', 'Global Official has open membership.');
  }

  const inviteToken = generateCrewInviteToken();
  const inviteCodeShort = await allocateUniqueInviteCodeShort();
  const now = new Date().toISOString();
  await charterRef(charterId).update({
    inviteTokenHash: hashInviteToken(inviteToken),
    inviteCodeShort,
    updatedAt: now,
  });

  return {
    inviteToken,
    crewCode: formatCrewInviteCode(inviteCodeShort),
    inviteUrl: `https://iwdf.org/crews/${charter.slug}/join?token=${inviteToken}`,
  };
});

export const getCharterLeaderboard = onCall(async (request) => {
  requireSignedIn(request);
  const { charterId, slug, playerCount } = request.data as {
    charterId?: string;
    slug?: string;
    playerCount?: number;
  };

  const globalCharter = await resolveGlobalOfficialCharter({
    charterId,
    slug,
    playerCount,
  });
  const charter =
    globalCharter ??
    (charterId
      ? await loadCharter(charterId)
      : await loadCharterBySlug(slug ?? ''));

  const entries: {
    uid: string;
    displayName: string;
    rating: import('./tei').StoredRating;
    matches: number;
    wins: number;
  }[] = [];

  for (const memberUid of charter.memberUids) {
    const statsSnap = await db.collection('playerStats').doc(memberUid).get();
    const stats = statsSnap.exists
      ? (statsSnap.data() as import('./tei').PlayerStatsDocument)
      : null;
    const memberSnap = await memberRef(charter.charterId, memberUid).get();
    const memberName =
      (memberSnap.data() as CharterMemberDocument | undefined)?.displayName ??
      stats?.displayName ??
      'Captain';
    const bucket = groupObjectiveRatingStats(
      stats,
      charter.charterId,
      charter.objective,
      charter.seasonKey
    );
    entries.push({
      uid: memberUid,
      displayName: memberName,
      rating: bucket.rating,
      matches: bucket.rating.matches,
      wins: bucket.wins,
    });
  }

  entries.sort((a, b) => {
    const aDisplay = a.rating.displayRating;
    const bDisplay = b.rating.displayRating;
    if (bDisplay !== aDisplay) {
      return bDisplay - aDisplay;
    }
    return b.matches - a.matches;
  });

  return {
    charter: publicCharterView(charter),
    entries: entries.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    })),
  };
});

export const getCharterManageInfo = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId } = request.data as { charterId?: string };
  if (!charterId) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  let charter = await loadCharter(charterId);
  const isOwner = charter.createdBy === uid || hasRole(request, 'admin');
  const isMember = charter.memberUids.includes(uid);

  if (
    isOwner &&
    !charter.isGlobalOfficial &&
    !charter.inviteCodeShort
  ) {
    const inviteCodeShort = await allocateUniqueInviteCodeShort();
    const now = new Date().toISOString();
    await charterRef(charterId).update({ inviteCodeShort, updatedAt: now });
    charter = { ...charter, inviteCodeShort, updatedAt: now };
  }

  let pendingRequestCount = 0;
  if (isOwner && !charter.isGlobalOfficial) {
    const pending = await db
      .collection(CHARTER_JOIN_REQUESTS)
      .where('charterId', '==', charterId)
      .where('status', '==', 'pending')
      .get();
    pendingRequestCount = pending.size;
  }

  return {
    role: isOwner ? 'owner' : isMember ? 'member' : 'none',
    canManage: isOwner && !charter.isGlobalOfficial,
    crewCode: isOwner && charter.inviteCodeShort
      ? formatCrewInviteCode(charter.inviteCodeShort)
      : undefined,
    listed: charter.listed === true,
    pendingRequestCount,
  };
});

export const updateCharterListing = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId, listed } = request.data as {
    charterId?: string;
    listed?: boolean;
  };
  if (!charterId || typeof listed !== 'boolean') {
    throw new HttpsError('invalid-argument', 'charterId and listed required.');
  }

  const charter = await loadCharter(charterId);
  if (charter.createdBy !== uid && !hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Only the crew owner can change listing.');
  }
  if (charter.isGlobalOfficial) {
    throw new HttpsError('failed-precondition', 'Global Official is always listed.');
  }

  const now = new Date().toISOString();
  await charterRef(charterId).update({ listed, updatedAt: now });
  return { ok: true, listed };
});

export const listListedCharters = onCall(async (request) => {
  requireSignedIn(request);
  const snap = await db
    .collection(CHARTERS)
    .where('listed', '==', true)
    .limit(50)
    .get();

  const globalOfficial = await ensureAllGlobalOfficialCharters();
  const charters = snap.docs
    .map((doc) => publicCharterView(doc.data() as CharterDocument))
    .filter((c) => !c.isGlobalOfficial);

  for (const official of globalOfficial) {
    charters.unshift(publicCharterView(official));
  }
  charters.sort((a, b) => a.name.localeCompare(b.name));
  return { charters };
});

export const requestJoinCharter = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await assertNotBanned(uid, request);
  const { charterId } = request.data as { charterId?: string };
  if (!charterId) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  const charter = await loadCharter(charterId);
  if (!charter.listed && !charter.isGlobalOfficial) {
    throw new HttpsError(
      'failed-precondition',
      'This crew is invite-only. Use a CREW- code or invite link.'
    );
  }
  if (charter.memberUids.includes(uid)) {
    return { ok: true, alreadyMember: true };
  }
  if (charter.isGlobalOfficial) {
    const displayName =
      (request.auth?.token.name as string | undefined)?.trim() || 'Captain';
    await addCharterMember(charter, uid, displayName, 'member');
    return { ok: true, joined: true };
  }

  const displayName =
    (request.auth?.token.name as string | undefined)?.trim() || 'Captain';
  const now = new Date().toISOString();
  const doc: CharterJoinRequestDocument = {
    charterId,
    uid,
    displayName,
    requestedAt: now,
    status: 'pending',
  };
  await joinRequestRef(charterId, uid).set(doc);
  return { ok: true, pending: true };
});

export const listCharterJoinRequests = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId } = request.data as { charterId?: string };
  if (!charterId) {
    throw new HttpsError('invalid-argument', 'charterId required.');
  }

  const charter = await loadCharter(charterId);
  if (charter.createdBy !== uid && !hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Only the crew owner can view requests.');
  }

  const snap = await db
    .collection(CHARTER_JOIN_REQUESTS)
    .where('charterId', '==', charterId)
    .where('status', '==', 'pending')
    .get();

  return {
    requests: snap.docs.map((doc) => {
      const row = doc.data() as CharterJoinRequestDocument;
      return {
        uid: row.uid,
        displayName: row.displayName,
        requestedAt: row.requestedAt,
      };
    }),
  };
});

export const resolveJoinRequest = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const { charterId, targetUid, approve } = request.data as {
    charterId?: string;
    targetUid?: string;
    approve?: boolean;
  };
  if (!charterId || !targetUid || typeof approve !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'charterId, targetUid, and approve required.'
    );
  }

  const charter = await loadCharter(charterId);
  if (charter.createdBy !== uid && !hasRole(request, 'admin')) {
    throw new HttpsError('permission-denied', 'Only the crew owner can resolve requests.');
  }

  const ref = joinRequestRef(charterId, targetUid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Join request not found.');
  }
  const row = snap.data() as CharterJoinRequestDocument;
  if (row.status !== 'pending') {
    return { ok: true, alreadyResolved: true };
  }

  const now = new Date().toISOString();
  if (approve) {
    await addCharterMember(charter, targetUid, row.displayName, 'member');
    await ref.update({ status: 'approved', resolvedAt: now, resolvedBy: uid });
    return { ok: true, approved: true };
  }

  await ref.update({ status: 'rejected', resolvedAt: now, resolvedBy: uid });
  return { ok: true, approved: false };
});

export const resetGlobalOfficialSeason = onCall(async (request) => {
  const adminId = requireAdmin(request);
  const { seasonLabel, seasonKey: rawSeasonKey, playerCounts } = request.data as {
    seasonLabel?: string;
    seasonKey?: string;
    playerCounts?: number[];
  };

  const label = seasonLabel?.trim();
  if (!label) {
    throw new HttpsError('invalid-argument', 'seasonLabel required.');
  }

  const seasonKey = rawSeasonKey?.trim()
    ? normalizeSeasonKey(rawSeasonKey)
    : normalizeSeasonKey(label);
  if (!seasonKey) {
    throw new HttpsError('invalid-argument', 'seasonKey is invalid.');
  }

  const fleets =
    playerCounts?.length && playerCounts.every((n) => n >= 2 && n <= 8)
      ? playerCounts
      : [...GLOBAL_OFFICIAL_PLAYER_COUNTS];

  const now = new Date().toISOString();
  const updatedCharterIds: string[] = [];

  for (const playerCount of fleets) {
    const charter = await ensureGlobalOfficialCharterForFleet(playerCount);
    const oldSeasonKey = charter.seasonKey ?? 'legacy';

    if (oldSeasonKey !== seasonKey) {
      await db
        .collection(CHARTER_SEASON_ARCHIVES)
        .doc(`${charter.charterId}_${oldSeasonKey}`)
        .set(
          {
            charterId: charter.charterId,
            playerCount: charter.playerCount,
            seasonKey: oldSeasonKey,
            seasonLabel: charter.seasonLabel ?? oldSeasonKey,
            endedAt: now,
            endedBy: adminId,
          },
          { merge: true }
        );
    }

    await charterRef(charter.charterId).update({
      seasonLabel: label,
      seasonKey,
      updatedAt: now,
    });
    updatedCharterIds.push(charter.charterId);
  }

  return {
    ok: true,
    seasonLabel: label,
    seasonKey,
    charterIds: updatedCharterIds,
  };
});

export async function assertCharterMember(
  charter: CharterDocument,
  uid: string
): Promise<void> {
  if (!charter.memberUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'Not a member of this crew.');
  }
}

export async function validateCharterRatedMatch(
  charter: CharterDocument,
  match: {
    objective: RatedObjective;
    campaignRounds: number;
    rulesProfileId?: string;
    playerCount?: number;
    modules?: CharterModulesInput;
    houseRules?: CharterHouseRulesInput;
    participantUids: string[];
  }
): Promise<void> {
  if (
    !charterMatchesRatedEvent(charter, {
      objective: match.objective,
      campaignRounds: match.campaignRounds,
      rulesProfileId: match.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID,
      playerCount: match.playerCount ?? match.participantUids.length,
      modules: match.modules,
      houseRules: match.houseRules,
    })
  ) {
    throw new HttpsError(
      'failed-precondition',
      'Match settings do not match the crew charter.'
    );
  }

  for (const participantUid of match.participantUids) {
    if (!charter.memberUids.includes(participantUid)) {
      throw new HttpsError(
        'failed-precondition',
        'Every checked-in captain must be a crew member for a crew-rated match.'
      );
    }
  }
}

export { groupObjectiveRatingStats, applyGroupRatingForPlayer, groupRatedClaimId };
