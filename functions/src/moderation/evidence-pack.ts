/**
 * Assemble a JSON evidence pack for human moderation review.
 * Read-only — never mutates game state or enforces sanctions.
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';

import { requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from '../ops/ban-schema';
import { RATING_EVENTS_COLLECTION } from '../tei/rating-ledger';
import { onlineCertificateMatchCode } from '../tei/issue-certificate';
import { MODERATION_REPORTS_COLLECTION } from './reports';

const db = admin.firestore();

function isoFromUnknown(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
}

export const getModerationEvidencePack = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    reportId?: string;
    gameId?: string;
    targetUid?: string;
    messageLimit?: number;
  };
  const reportId = data.reportId?.trim();
  const messageLimit = Math.min(Math.max(Number(data.messageLimit) || 80, 1), 200);

  let gameId = data.gameId?.trim() || '';
  let targetUid = data.targetUid?.trim() || '';
  let report: Record<string, unknown> | null = null;

  if (reportId) {
    const snap = await db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Report not found.');
    }
    report = { reportId: snap.id, ...snap.data() };
    if (!gameId && typeof report.gameId === 'string') {
      gameId = report.gameId;
    }
    if (!targetUid && typeof report.targetUid === 'string') {
      targetUid = report.targetUid;
    }
  }

  if (!gameId && !targetUid && !reportId) {
    throw new HttpsError(
      'invalid-argument',
      'Provide reportId and/or gameId / targetUid.'
    );
  }

  const pack: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    generatedBy: actorUid,
    reviewOnly: true,
    noAutoEnforcement: true,
    report,
  };

  if (gameId) {
    const gameSnap = await db.collection('games').doc(gameId).get();
    const game = gameSnap.exists ? gameSnap.data() : null;
    pack.game = game
      ? {
          gameId,
          phase: game.phase ?? null,
          rated: game.rated ?? null,
          opsUnrated: game.opsUnrated ?? null,
          hostId: game.hostId ?? null,
          objective: game.objective ?? null,
          maxPip: game.maxPip ?? null,
          createdAt: game.createdAt ?? null,
          updatedAt: game.updatedAt ?? null,
          captains: Array.isArray(game.captains)
            ? game.captains.map((c: { id?: string; displayName?: string }) => ({
                id: c.id ?? null,
                displayName: c.displayName ?? null,
              }))
            : [],
        }
      : { gameId, missing: true };

    const msgSnap = await db
      .collection('games')
      .doc(gameId)
      .collection('messages')
      .orderBy('at', 'desc')
      .limit(messageLimit)
      .get();
    pack.messages = msgSnap.docs.map((doc) => {
      const row = doc.data();
      return {
        id: doc.id,
        from: row.from ?? null,
        fromName: row.fromName ?? null,
        kind: row.kind ?? null,
        audience: row.audience ?? null,
        channel: row.channel ?? null,
        text: typeof row.text === 'string' ? row.text.slice(0, 2000) : null,
        phraseId: row.phraseId ?? null,
        at: row.at ?? null,
        shadowHidden: row.shadowHidden === true,
      };
    });

    const matchCode = onlineCertificateMatchCode(gameId);
    const [certSnap, ledgerSnap] = await Promise.all([
      db.collection('ratedMatches').doc(matchCode).get(),
      db
        .collection(RATING_EVENTS_COLLECTION)
        .where('matchId', '==', gameId)
        .limit(10)
        .get(),
    ]);
    pack.onlineCertificate = certSnap.exists
      ? { matchCode, ...certSnap.data() }
      : null;
    pack.ratingEvents = ledgerSnap.docs.map((doc) => doc.data());
  }

  if (targetUid) {
    const [statsSnap, banSnap, muteSnap, signalSnap] = await Promise.all([
      db.collection('playerStats').doc(targetUid).get(),
      db.collection('bans').doc(targetUid).get(),
      db.collection('mutes').doc(targetUid).get(),
      db.collection('captainSignals').doc(targetUid).get(),
    ]);
    const stats = statsSnap.exists ? statsSnap.data() : null;
    pack.captain = {
      uid: targetUid,
      displayName: stats?.displayName ?? null,
      humanRating: stats?.humanRating ?? null,
      ban: banSnap.exists ? banSnap.data() : null,
      mute: muteSnap.exists ? muteSnap.data() : null,
      signals: signalSnap.exists ? signalSnap.data() : null,
    };

    const relatedReports = await db
      .collection(MODERATION_REPORTS_COLLECTION)
      .where('targetUid', '==', targetUid)
      .limit(40)
      .get();
    pack.relatedReports = relatedReports.docs
      .map((doc) => {
        const row = doc.data();
        return {
          reportId: doc.id,
          source: row.source ?? null,
          status: row.status ?? null,
          category: row.category ?? null,
          reason: row.reason ?? null,
          createdAt: isoFromUnknown(row.createdAt),
        };
      })
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, 25);
  }

  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'evidence_pack',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: targetUid || null,
    targetBanId: null,
    detail: {
      reportId: reportId || null,
      gameId: gameId || null,
      messageCount: Array.isArray(pack.messages) ? pack.messages.length : 0,
    },
    at: Timestamp.now(),
  });

  return { ok: true, pack };
});
