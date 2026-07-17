/**
 * Review-only system integrity reports.
 * Detectors open human-review queue items — never mute, ban, or delete.
 */

import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

/** Same collection as player/auto reports (`moderation/reports.ts`). */
const MODERATION_REPORTS_COLLECTION = 'moderationReports';

export type IntegrityDetector =
  | 'report-escalate'
  | 'rematch-cohort'
  | 'related-ip'
  | 'manual';

export type SystemIntegrityReportInput = {
  detector: IntegrityDetector;
  /** Stable natural key parts (hashed into reportId). */
  stableKeyParts: string[];
  reason: string;
  subjectType: 'captain' | 'sector' | 'message' | 'display-name';
  targetUid?: string | null;
  gameId?: string | null;
  messageId?: string | null;
  evidence: Record<string, unknown>;
  /** Optional priority hint for ops UI (never auto-acts). */
  priority?: 'normal' | 'elevated';
};

function getDb() {
  return admin.firestore();
}

export function integrityReportId(
  detector: IntegrityDetector,
  ...parts: string[]
): string {
  const digest = createHash('sha256')
    .update([detector, ...parts].join('\0'))
    .digest('hex')
    .slice(0, 40);
  return `system-${detector}-${digest}`;
}

/**
 * Create-if-absent integrity report. Concurrent detectors share one open item.
 * Returns whether a new doc was written (false if already present).
 */
export async function openSystemIntegrityReport(
  input: SystemIntegrityReportInput
): Promise<{ reportId: string; created: boolean }> {
  const reportId = integrityReportId(input.detector, ...input.stableKeyParts);
  const firestore = getDb();
  const ref = firestore.collection(MODERATION_REPORTS_COLLECTION).doc(reportId);

  const created = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data();
      // Re-open dismissed/resolved only when detector fires again with elevated priority.
      if (
        existing?.status === 'open' ||
        existing?.status === 'reviewing' ||
        input.priority !== 'elevated'
      ) {
        return false;
      }
    }
    tx.set(
      ref,
      {
        reportId,
        source: 'system',
        status: 'open',
        category: 'integrity',
        subjectType: input.subjectType,
        reporterUid: null,
        targetUid: input.targetUid ?? null,
        gameId: input.gameId ?? null,
        messageId: input.messageId ?? null,
        reason: input.reason.slice(0, 2000),
        priority: input.priority ?? 'normal',
        detector: input.detector,
        evidence: {
          detector: input.detector,
          reviewOnly: true,
          noAutoEnforcement: true,
          ...input.evidence,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false }
    );
    return true;
  });

  return { reportId, created };
}
