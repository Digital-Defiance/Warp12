import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FieldValue,
  type DocumentData,
} from 'firebase-admin/firestore';

import { requireSignedIn } from '../auth';
import { OPS_AUDIT_COLLECTION } from './mute-schema';
import {
  isAiCaptain,
  pickHumanHost,
  remapGameSquadrons,
  remapPlayerInRound,
  type ContinuityCaptain,
} from './host-continuity-helpers';

const db = admin.firestore();

type Captain = ContinuityCaptain;

type AiSkill = 'ensign' | 'lieutenant' | 'commander';

/** Mirrors apps/Warp12 AI_OFFICER_POOL ids/names (keep in sync). */
const AI_OFFICER_POOL: readonly { id: string; displayName: string }[] = [
  { id: 'chen', displayName: 'Chen' },
  { id: 'nguyen', displayName: 'Nguyen' },
  { id: 'smith', displayName: 'Smith' },
  { id: 'garcia', displayName: 'Garcia' },
  { id: 'rossi', displayName: 'Rossi' },
  { id: 'muller', displayName: 'Müller' },
  { id: 'kim', displayName: 'Kim' },
  { id: 'patel', displayName: 'Patel' },
  { id: 'okafor', displayName: 'Okafor' },
  { id: 'silva', displayName: 'Silva' },
  { id: 'ivanov', displayName: 'Ivanov' },
  { id: 'berg', displayName: 'Berg' },
  { id: 'suzuki', displayName: 'Suzuki' },
  { id: 'hassan', displayName: 'Hassan' },
  { id: 'novak', displayName: 'Novak' },
  { id: 'owens', displayName: 'Owens' },
  { id: 'park', displayName: 'Park' },
  { id: 'dubois', displayName: 'Dubois' },
  { id: 'sato', displayName: 'Sato' },
  { id: 'haddad', displayName: 'Haddad' },
  { id: 'cruz', displayName: 'Cruz' },
  { id: 'kowalski', displayName: 'Kowalski' },
  { id: 'wong', displayName: 'Wong' },
  { id: 'diallo', displayName: 'Diallo' },
  { id: 'sharma', displayName: 'Sharma' },
  { id: 'hansen', displayName: 'Hansen' },
  { id: 'reyes', displayName: 'Reyes' },
  { id: 'cohen', displayName: 'Cohen' },
  { id: 'costa', displayName: 'Costa' },
  { id: 'ndlovu', displayName: 'Ndlovu' },
  { id: 'jones', displayName: 'Jones' },
  { id: 'mensah', displayName: 'Mensah' },
  { id: 'becker', displayName: 'Becker' },
  { id: 'ali', displayName: 'Ali' },
  { id: 'flores', displayName: 'Flores' },
];

function parseSkill(value: unknown): AiSkill {
  if (value === 'ensign' || value === 'lieutenant' || value === 'commander') {
    return value;
  }
  return 'lieutenant';
}

function pickNextAiOfficer(
  captains: readonly Captain[]
): { id: string; displayName: string } | null {
  const used = new Set(
    captains
      .filter((c) => c.id.startsWith('ai:'))
      .map((c) => c.id.slice(3))
  );
  return AI_OFFICER_POOL.find((officer) => !used.has(officer.id)) ?? null;
}

async function writeAudit(entry: {
  action: string;
  actorUid: string;
  targetUid: string | null;
  detail: Record<string, unknown>;
}): Promise<void> {
  await db.collection(OPS_AUDIT_COLLECTION).add({
    ...entry,
    actorLabel: `host:${entry.actorUid}`,
    targetBanId: null,
    at: FieldValue.serverTimestamp(),
  });
}

async function migrateHand(
  tx: admin.firestore.Transaction,
  gameId: string,
  fromId: string,
  toId: string
): Promise<number> {
  const fromRef = db.collection('games').doc(gameId).collection('hands').doc(fromId);
  const toRef = db.collection('games').doc(gameId).collection('hands').doc(toId);
  const snap = await tx.get(fromRef);
  const coordinates = snap.exists
    ? ((snap.data()?.coordinates as unknown[]) ?? [])
    : [];
  tx.set(toRef, {
    captainId: toId,
    coordinates,
    updatedAt: new Date().toISOString(),
  });
  if (snap.exists) {
    tx.delete(fromRef);
  }
  return Array.isArray(coordinates) ? coordinates.length : 0;
}

function replaceCaptainEntry(
  captains: Captain[],
  fromId: string,
  ai: { id: string; displayName: string; skill: AiSkill }
): Captain[] {
  return captains.map((captain) => {
    if (captain.id !== fromId) {
      return captain;
    }
    return {
      ...captain,
      id: ai.id,
      displayName: ai.displayName,
      isAi: true,
      skill: ai.skill,
      joinedAt: new Date().toISOString(),
    };
  });
}

/**
 * Mid-mission: remap a human seat to a new AI officer (keeps hand + turn order).
 */
export const hostReplaceCaptainWithAi = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as {
    gameId?: string;
    targetUid?: string;
    skill?: string;
  };
  const gameId = data.gameId?.trim();
  const targetUid = data.targetUid?.trim();
  const skill = parseSkill(data.skill);
  if (!gameId || !targetUid) {
    throw new HttpsError('invalid-argument', 'gameId and targetUid required.');
  }

  const ref = db.collection('games').doc(gameId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Sector not found.');
    }
    const game = snap.data()!;
    if (game.opsTerminated === true) {
      throw new HttpsError('failed-precondition', 'Sector was terminated.');
    }
    if (String(game.hostId ?? '') !== actorUid) {
      throw new HttpsError(
        'permission-denied',
        'Only the sector host can replace a seat with AI.'
      );
    }
    if (String(game.phase ?? '') === 'lobby') {
      throw new HttpsError(
        'failed-precondition',
        'Add AI officers from the waiting room instead.'
      );
    }
    if (targetUid === actorUid) {
      throw new HttpsError(
        'failed-precondition',
        'Use leave-with-AI to replace your own seat.'
      );
    }

    const captains = (Array.isArray(game.captains) ? game.captains : []) as Captain[];
    const target = captains.find((c) => c.id === targetUid);
    if (!target) {
      throw new HttpsError('not-found', 'Captain not aboard this sector.');
    }
    if (isAiCaptain(target)) {
      throw new HttpsError(
        'failed-precondition',
        'That seat is already an AI officer — drop it instead.'
      );
    }

    const officer = pickNextAiOfficer(captains);
    if (!officer) {
      throw new HttpsError(
        'resource-exhausted',
        'All AI officer slots are already aboard.'
      );
    }
    const aiId = `ai:${officer.id}`;
    const nextCaptains = replaceCaptainEntry(captains, targetUid, {
      id: aiId,
      displayName: officer.displayName,
      skill,
    });
    const handCount = await migrateHand(tx, gameId, targetUid, aiId);
    const nextRound = game.round
      ? remapPlayerInRound(game.round as DocumentData, targetUid, aiId)
      : null;
    if (nextRound && typeof nextRound.handCounts === 'object') {
      (nextRound.handCounts as Record<string, number>)[aiId] = handCount;
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      captains: nextCaptains,
      captainIds: nextCaptains.map((c) => c.id),
      rated: false,
      paused: false,
      pauseReason: FieldValue.delete(),
      updatedAt: now,
    };
    if (nextRound) {
      patch.round = nextRound;
    }
    const squadrons = remapGameSquadrons(game.squadrons, targetUid, aiId);
    if (squadrons) {
      patch.squadrons = squadrons;
    }

    tx.update(ref, patch);
    tx.delete(ref.collection('presence').doc(targetUid));

    return { aiId, displayName: officer.displayName, skill };
  });

  await writeAudit({
    action: 'host_replace_with_ai',
    actorUid,
    targetUid,
    detail: { gameId, ...result },
  });

  return { ok: true, gameId, targetUid, ...result };
});

/** Transfer host to another human (lobby or mid-mission). */
export const hostTransferHost = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as { gameId?: string; newHostId?: string };
  const gameId = data.gameId?.trim();
  const newHostId = data.newHostId?.trim();
  if (!gameId || !newHostId) {
    throw new HttpsError('invalid-argument', 'gameId and newHostId required.');
  }
  if (newHostId === actorUid) {
    throw new HttpsError('invalid-argument', 'You are already the host.');
  }

  const ref = db.collection('games').doc(gameId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Sector not found.');
    }
    const game = snap.data()!;
    if (game.opsTerminated === true) {
      throw new HttpsError('failed-precondition', 'Sector was terminated.');
    }
    if (String(game.hostId ?? '') !== actorUid) {
      throw new HttpsError(
        'permission-denied',
        'Only the sector host can transfer command.'
      );
    }
    const captains = (Array.isArray(game.captains) ? game.captains : []) as Captain[];
    const next = captains.find((c) => c.id === newHostId);
    if (!next) {
      throw new HttpsError('not-found', 'New host is not aboard this sector.');
    }
    if (isAiCaptain(next)) {
      throw new HttpsError(
        'failed-precondition',
        'Host must be a human captain.'
      );
    }
    tx.update(ref, {
      hostId: newHostId,
      updatedAt: new Date().toISOString(),
    });
  });

  await writeAudit({
    action: 'host_transfer',
    actorUid,
    targetUid: newHostId,
    detail: { gameId },
  });

  return { ok: true, gameId, newHostId };
});

/**
 * Host leaves mid-mission without dissolving: seat becomes AI, command
 * transfers to another human.
 */
export const hostLeaveWithAi = onCall(async (request) => {
  const actorUid = requireSignedIn(request);
  const data = request.data as {
    gameId?: string;
    newHostId?: string;
    skill?: string;
  };
  const gameId = data.gameId?.trim();
  const skill = parseSkill(data.skill);
  if (!gameId) {
    throw new HttpsError('invalid-argument', 'gameId required.');
  }

  const ref = db.collection('games').doc(gameId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Sector not found.');
    }
    const game = snap.data()!;
    if (game.opsTerminated === true) {
      throw new HttpsError('failed-precondition', 'Sector was terminated.');
    }
    if (String(game.hostId ?? '') !== actorUid) {
      throw new HttpsError(
        'permission-denied',
        'Only the sector host can leave with AI replacement.'
      );
    }
    const phase = String(game.phase ?? '');
    if (phase === 'lobby') {
      throw new HttpsError(
        'failed-precondition',
        'Transfer host, then leave the waiting room.'
      );
    }

    const captains = (Array.isArray(game.captains) ? game.captains : []) as Captain[];
    const requested = data.newHostId?.trim();
    const newHostId =
      requested &&
      captains.some((c) => c.id === requested && !isAiCaptain(c) && c.id !== actorUid)
        ? requested
        : pickHumanHost(captains, actorUid);
    if (!newHostId) {
      throw new HttpsError(
        'failed-precondition',
        'Need another human captain aboard to transfer command.'
      );
    }

    const officer = pickNextAiOfficer(captains);
    if (!officer) {
      throw new HttpsError(
        'resource-exhausted',
        'All AI officer slots are already aboard.'
      );
    }
    const aiId = `ai:${officer.id}`;
    const nextCaptains = replaceCaptainEntry(captains, actorUid, {
      id: aiId,
      displayName: officer.displayName,
      skill,
    });
    const handCount = await migrateHand(tx, gameId, actorUid, aiId);
    const nextRound = game.round
      ? remapPlayerInRound(game.round as DocumentData, actorUid, aiId)
      : null;
    if (nextRound && typeof nextRound.handCounts === 'object') {
      (nextRound.handCounts as Record<string, number>)[aiId] = handCount;
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      captains: nextCaptains,
      captainIds: nextCaptains.map((c) => c.id),
      hostId: newHostId,
      rated: false,
      paused: false,
      pauseReason: FieldValue.delete(),
      updatedAt: now,
    };
    if (nextRound) {
      patch.round = nextRound;
    }
    const squadrons = remapGameSquadrons(game.squadrons, actorUid, aiId);
    if (squadrons) {
      patch.squadrons = squadrons;
    }

    tx.update(ref, patch);
    tx.delete(ref.collection('presence').doc(actorUid));

    return {
      aiId,
      displayName: officer.displayName,
      skill,
      newHostId,
    };
  });

  await writeAudit({
    action: 'host_leave_with_ai',
    actorUid,
    targetUid: result.newHostId,
    detail: { gameId, ...result },
  });

  return { ok: true, gameId, ...result };
});
