import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  onDocumentCreated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { requireAdmin, requireModerator, requireSignedIn } from '../auth';
import { assertNotBanned } from '../bans';
import { OPS_AUDIT_COLLECTION } from '../ops/ban-schema';
import {
  EMPTY_CONTENT_REVIEW_CONFIG,
  findReviewMatches,
  sanitizeContentReviewConfig,
  type ContentReviewConfig,
} from './content-review';
import { maybeEscalateTargetReports } from './escalate';

export const MODERATION_REPORTS_COLLECTION = 'moderationReports';
export const MODERATION_CONFIG_PATH = 'moderationConfig/contentReview';
const REPORT_RATE_COLLECTION = 'moderationReportRate';

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
type ReportCategory =
  | 'harassment'
  | 'spam'
  | 'cheating'
  | 'inappropriate-name'
  | 'other'
  | 'review-term';
type ReportSubjectType = 'message' | 'captain' | 'sector' | 'display-name';

const db = admin.firestore();

function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 40);
}

function captainsOf(game: admin.firestore.DocumentData): Array<{
  id: string;
  displayName: string;
}> {
  if (!Array.isArray(game.captains)) {
    return [];
  }
  return game.captains
    .map((captain: unknown) => {
      if (!captain || typeof captain !== 'object') {
        return null;
      }
      const row = captain as { id?: unknown; displayName?: unknown };
      if (typeof row.id !== 'string') {
        return null;
      }
      return {
        id: row.id,
        displayName:
          typeof row.displayName === 'string' ? row.displayName : 'Captain',
      };
    })
    .filter(
      (captain): captain is { id: string; displayName: string } =>
        captain !== null
    );
}

async function loadContentReviewConfig(): Promise<ContentReviewConfig> {
  const snap = await db.doc(MODERATION_CONFIG_PATH).get();
  if (!snap.exists) {
    return EMPTY_CONTENT_REVIEW_CONFIG;
  }
  const data = snap.data() as Partial<ContentReviewConfig>;
  return {
    chatTerms: Array.isArray(data.chatTerms) ? data.chatTerms : [],
    displayNameTerms: Array.isArray(data.displayNameTerms)
      ? data.displayNameTerms
      : [],
    allowlist: Array.isArray(data.allowlist) ? data.allowlist : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function validCategory(value: unknown): value is Exclude<
  ReportCategory,
  'review-term'
> {
  return (
    value === 'harassment' ||
    value === 'spam' ||
    value === 'cheating' ||
    value === 'inappropriate-name' ||
    value === 'other'
  );
}

/**
 * Player report entry point. Evidence is copied server-side so the client
 * cannot forge message contents or captain identity.
 */
export const submitModerationReport = onCall(async (request) => {
  const reporterUid = requireSignedIn(request);
  await assertNotBanned(reporterUid, request);

  const data = request.data as {
    gameId?: string;
    subjectType?: ReportSubjectType;
    messageId?: string;
    targetUid?: string;
    category?: ReportCategory;
    reason?: string;
  };
  const gameId = data.gameId?.trim();
  const reason = data.reason?.trim();
  const subjectType = data.subjectType;
  if (
    !gameId ||
    !reason ||
    reason.length > 1000 ||
    !validCategory(data.category) ||
    (subjectType !== 'message' &&
      subjectType !== 'captain' &&
      subjectType !== 'sector')
  ) {
    throw new HttpsError(
      'invalid-argument',
      'gameId, valid subject/category, and reason (1–1000 chars) required.'
    );
  }

  const gameSnap = await db.collection('games').doc(gameId).get();
  if (!gameSnap.exists) {
    throw new HttpsError('not-found', 'Sector not found.');
  }
  const captains = captainsOf(gameSnap.data()!);
  if (!captains.some((captain) => captain.id === reporterUid)) {
    throw new HttpsError(
      'permission-denied',
      'Only a captain in this sector may submit a report.'
    );
  }

  let targetUid = data.targetUid?.trim() ?? '';
  let messageId: string | null = null;
  let evidence: Record<string, unknown> = {
    sectorPhase: gameSnap.data()!.phase ?? null,
  };

  if (subjectType === 'message') {
    messageId = data.messageId?.trim() ?? '';
    if (!messageId) {
      throw new HttpsError('invalid-argument', 'messageId required.');
    }
    const messageSnap = await gameSnap.ref
      .collection('messages')
      .doc(messageId)
      .get();
    if (!messageSnap.exists) {
      throw new HttpsError('not-found', 'Message not found.');
    }
    const message = messageSnap.data()!;
    targetUid = String(message.from ?? '');
    evidence = {
      ...evidence,
      message: {
        id: messageId,
        from: targetUid,
        fromName: String(message.fromName ?? ''),
        kind: String(message.kind ?? ''),
        text: typeof message.text === 'string' ? message.text.slice(0, 1000) : null,
        phraseId:
          typeof message.phraseId === 'string' ? message.phraseId : null,
        audience: String(message.audience ?? 'table'),
        channel: String(message.channel ?? 'table'),
        to: typeof message.to === 'string' ? message.to : null,
        at: String(message.at ?? ''),
      },
    };
  } else if (subjectType === 'captain') {
    if (!targetUid || !captains.some((captain) => captain.id === targetUid)) {
      throw new HttpsError('invalid-argument', 'Valid targetUid required.');
    }
    const target = captains.find((captain) => captain.id === targetUid)!;
    evidence = {
      ...evidence,
      captain: { uid: target.id, displayName: target.displayName },
    };
  }

  if (targetUid === reporterUid) {
    throw new HttpsError('invalid-argument', 'You cannot report yourself.');
  }

  const reportId = stableId(
    'player',
    reporterUid,
    gameId,
    subjectType,
    messageId ?? (targetUid || 'sector')
  );
  const reportRef = db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId);
  const rateRef = db.collection(REPORT_RATE_COLLECTION).doc(reporterUid);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const [existing, rateSnap] = await Promise.all([
      tx.get(reportRef),
      tx.get(rateRef),
    ]);
    if (existing.exists) {
      return { alreadySubmitted: true };
    }

    const rate = rateSnap.data() as
      | { windowStartedAt?: Timestamp; count?: number }
      | undefined;
    const hourAgo = now.toMillis() - 60 * 60 * 1000;
    const sameWindow =
      rate?.windowStartedAt instanceof Timestamp &&
      rate.windowStartedAt.toMillis() >= hourAgo;
    const count = sameWindow ? Number(rate?.count ?? 0) : 0;
    if (count >= 10) {
      throw new HttpsError(
        'resource-exhausted',
        'Report limit reached. Try again later.'
      );
    }

    tx.set(rateRef, {
      windowStartedAt: sameWindow ? rate!.windowStartedAt : now,
      count: count + 1,
      updatedAt: now,
    });
    tx.create(reportRef, {
      reportId,
      source: 'player',
      status: 'open',
      category: data.category,
      subjectType,
      reporterUid,
      targetUid: targetUid || null,
      gameId,
      messageId,
      reason,
      evidence,
      createdAt: now,
      updatedAt: now,
    });
    return { alreadySubmitted: false };
  });

  if (!result.alreadySubmitted && targetUid) {
    await maybeEscalateTargetReports(targetUid, reportId);
  }

  return { ok: true, reportId, ...result };
});

export const listModerationReports = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    status?: ReportStatus | 'all';
    source?: string | 'all';
    category?: string | 'all';
    limit?: number;
  };
  const limit = Math.min(Math.max(Number(data.limit) || 100, 1), 250);
  const fetchLimit =
    data.source && data.source !== 'all'
      ? Math.min(limit * 3, 250)
      : data.category && data.category !== 'all'
        ? Math.min(limit * 3, 250)
        : limit;
  let query: admin.firestore.Query = db.collection(
    MODERATION_REPORTS_COLLECTION
  );
  if (data.status && data.status !== 'all') {
    query = query.where('status', '==', data.status);
  }
  const snap = await query.orderBy('createdAt', 'desc').limit(fetchLimit).get();
  let reports = snap.docs.map((doc) => {
    const report = doc.data();
    return {
      ...report,
      reportId: doc.id,
      source: report.source as string | undefined,
      category: report.category as string | undefined,
      createdAt:
        report.createdAt instanceof Timestamp
          ? report.createdAt.toDate().toISOString()
          : String(report.createdAt ?? ''),
      updatedAt:
        report.updatedAt instanceof Timestamp
          ? report.updatedAt.toDate().toISOString()
          : String(report.updatedAt ?? ''),
    };
  });
  if (data.source && data.source !== 'all') {
    reports = reports.filter((row) => row.source === data.source);
  }
  if (data.category && data.category !== 'all') {
    reports = reports.filter((row) => row.category === data.category);
  }
  return { ok: true, reports: reports.slice(0, limit) };
});

export const updateModerationReport = onCall(async (request) => {
  const actorUid = requireModerator(request);
  const data = request.data as {
    reportId?: string;
    status?: ReportStatus;
    resolutionNote?: string;
  };
  const reportId = data.reportId?.trim();
  const status = data.status;
  if (
    !reportId ||
    (status !== 'open' &&
      status !== 'reviewing' &&
      status !== 'resolved' &&
      status !== 'dismissed')
  ) {
    throw new HttpsError('invalid-argument', 'reportId and valid status required.');
  }
  const note = data.resolutionNote?.trim() ?? '';
  if (note.length > 2000) {
    throw new HttpsError('invalid-argument', 'Resolution note is too long.');
  }

  const ref = db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Report not found.');
  }
  const before = snap.data()!;
  await ref.update({
    status,
    resolutionNote: note || null,
    resolvedBy:
      status === 'resolved' || status === 'dismissed' ? actorUid : null,
    resolvedAt:
      status === 'resolved' || status === 'dismissed'
        ? FieldValue.serverTimestamp()
        : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'moderation_report_update',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: before.targetUid ?? null,
    targetBanId: null,
    detail: {
      reportId,
      fromStatus: before.status ?? null,
      toStatus: status,
      resolutionNote: note || null,
    },
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, reportId, status };
});

export const getContentReviewConfig = onCall(async (request) => {
  requireAdmin(request);
  return { ok: true, config: await loadContentReviewConfig() };
});

export const updateContentReviewConfig = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as Partial<ContentReviewConfig>;
  if (
    !Array.isArray(data.chatTerms) ||
    !Array.isArray(data.displayNameTerms) ||
    !Array.isArray(data.allowlist)
  ) {
    throw new HttpsError(
      'invalid-argument',
      'chatTerms, displayNameTerms, and allowlist arrays required.'
    );
  }
  const config = {
    ...sanitizeContentReviewConfig({
      chatTerms: data.chatTerms,
      displayNameTerms: data.displayNameTerms,
      allowlist: data.allowlist,
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
  await db.doc(MODERATION_CONFIG_PATH).set(config);
  await db.collection(OPS_AUDIT_COLLECTION).add({
    action: 'content_review_config_update',
    actorUid,
    actorLabel: `admin:${actorUid}`,
    targetUid: null,
    targetBanId: null,
    detail: {
      chatTerms: config.chatTerms.length,
      displayNameTerms: config.displayNameTerms.length,
      allowlist: config.allowlist.length,
    },
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, config };
});

/** Review-only auto flag. Message remains visible; no automatic mute or ban. */
/** Firestore trigger — auto-flag chat text against review terms (review-only). */
export const onMessageContentReview = onDocumentCreated(
  'games/{gameId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message || message.kind !== 'text' || typeof message.text !== 'string') {
      return;
    }
    const config = await loadContentReviewConfig();
    const matches = findReviewMatches(
      message.text,
      config.chatTerms,
      config.allowlist
    );
    if (matches.length === 0) {
      return;
    }
    const gameId = event.params.gameId;
    const messageId = event.params.messageId;
    const reportId = `auto-message-${stableId(gameId, messageId)}`;
    const targetUid = String(message.from ?? '');
    await db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId).set(
      {
        reportId,
        source: 'auto',
        status: 'open',
        category: 'review-term',
        subjectType: 'message',
        reporterUid: null,
        targetUid,
        gameId,
        messageId,
        reason: 'Message matched configured review terms.',
        matchedTerms: matches.map((match) => match.normalizedTerm),
        evidence: {
          message: {
            id: messageId,
            from: targetUid,
            fromName: String(message.fromName ?? ''),
            text: message.text.slice(0, 1000),
            audience: String(message.audience ?? 'table'),
            channel: String(message.channel ?? 'table'),
            at: String(message.at ?? ''),
          },
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false }
    );
    if (targetUid) {
      await maybeEscalateTargetReports(targetUid, reportId);
    }
  }
);

/** Flag newly introduced/changed callsigns; routine game-state writes are ignored. */
/** Firestore trigger — auto-flag captain display-name changes (review-only). */
export const onDisplayNameContentReview = onDocumentWritten(
  'games/{gameId}',
  async (event) => {
    const before = event.data?.before.exists
      ? captainsOf(event.data.before.data()!)
      : [];
    const after = event.data?.after.exists
      ? captainsOf(event.data.after.data()!)
      : [];
    const beforeNames = new Map(
      before.map((captain) => [captain.id, captain.displayName])
    );
    const changed = after.filter(
      (captain) => beforeNames.get(captain.id) !== captain.displayName
    );
    if (changed.length === 0) {
      return;
    }

    const config = await loadContentReviewConfig();
    for (const captain of changed) {
      const matches = findReviewMatches(
        captain.displayName,
        config.displayNameTerms,
        config.allowlist
      );
      if (matches.length === 0) {
        continue;
      }
      const gameId = event.params.gameId;
      const reportId = `auto-name-${stableId(
        captain.id,
        captain.displayName
      )}`;
      await db.collection(MODERATION_REPORTS_COLLECTION).doc(reportId).set(
        {
          reportId,
          source: 'auto',
          status: 'open',
          category: 'review-term',
          subjectType: 'display-name',
          reporterUid: null,
          targetUid: captain.id,
          gameId,
          messageId: null,
          reason: 'Display name matched configured review terms.',
          matchedTerms: matches.map((match) => match.normalizedTerm),
          evidence: {
            captain: {
              uid: captain.id,
              displayName: captain.displayName,
            },
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
      await maybeEscalateTargetReports(captain.id, reportId);
    }
  }
);
