import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  Timestamp,
  type DocumentData,
  type Query,
  type QuerySnapshot,
} from 'firebase-admin/firestore';

import { requireModerator } from '../auth';
import { OPS_AUDIT_COLLECTION } from './ban-schema';

const db = admin.firestore();

export type OpsAuditEntry = {
  id: string;
  action: string;
  actorUid: string;
  actorLabel: string;
  targetUid: string | null;
  targetBanId: string | null;
  detail: Record<string, unknown>;
  at: string;
};

function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

function toEntry(id: string, data: DocumentData): OpsAuditEntry {
  return {
    id,
    action: String(data.action ?? ''),
    actorUid: String(data.actorUid ?? ''),
    actorLabel: String(data.actorLabel ?? ''),
    targetUid: typeof data.targetUid === 'string' ? data.targetUid : null,
    targetBanId:
      typeof data.targetBanId === 'string' ? data.targetBanId : null,
    detail:
      data.detail && typeof data.detail === 'object'
        ? (data.detail as Record<string, unknown>)
        : {},
    at: toIso(data.at),
  };
}

/**
 * Ops audit log browser. Moderators and admins can read; writes stay Admin SDK only.
 */
export const listOpsAudit = onCall(async (request) => {
  requireModerator(request);
  const data = request.data as {
    action?: string;
    actorUid?: string;
    targetUid?: string;
    limit?: number;
  };
  const limit = Math.min(Math.max(Number(data.limit) || 100, 1), 300);
  const action = data.action?.trim();
  const actorUid = data.actorUid?.trim();
  const targetUid = data.targetUid?.trim();

  let query: Query = db.collection(OPS_AUDIT_COLLECTION);
  if (action) {
    query = query.where('action', '==', action);
  } else if (actorUid) {
    query = query.where('actorUid', '==', actorUid);
  } else if (targetUid) {
    query = query.where('targetUid', '==', targetUid);
  }
  query = query.orderBy('at', 'desc').limit(limit);

  let snap: QuerySnapshot;
  try {
    snap = await query.get();
  } catch (err) {
    throw new HttpsError(
      'failed-precondition',
      err instanceof Error
        ? `Audit query failed (index may be building): ${err.message}`
        : 'Audit query failed.'
    );
  }

  return {
    ok: true,
    entries: snap.docs.map((doc) => toEntry(doc.id, doc.data())),
  };
});
