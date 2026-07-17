/**
 * Escalate-lite: many open player reports on one target → integrity queue.
 * Review-only — does not mute, ban, or notify outside the Reports inbox.
 */

import * as admin from 'firebase-admin';

import { openSystemIntegrityReport } from './integrity-reports';

const MODERATION_REPORTS_COLLECTION = 'moderationReports';
const db = () => admin.firestore();

/** Open player reports on the same target before elevating. */
export const REPORT_ESCALATE_THRESHOLD = 3;

/**
 * After a player report is filed, count other open reports on the same target.
 * If threshold is met, open a system integrity item for human review.
 */
export async function maybeEscalateTargetReports(
  targetUid: string,
  triggeringReportId: string
): Promise<{ escalated: boolean; openCount: number; reportId?: string }> {
  if (!targetUid) {
    return { escalated: false, openCount: 0 };
  }

  const snap = await db()
    .collection(MODERATION_REPORTS_COLLECTION)
    .where('targetUid', '==', targetUid)
    .where('status', '==', 'open')
    .limit(25)
    .get();


  const openPlayer = snap.docs.filter((doc) => {
    const data = doc.data();
    return data.source === 'player' || data.source === 'auto';
  });
  const openCount = openPlayer.length;
  if (openCount < REPORT_ESCALATE_THRESHOLD) {
    return { escalated: false, openCount };
  }

  const result = await openSystemIntegrityReport({
    detector: 'report-escalate',
    stableKeyParts: [targetUid],
    reason: `${openCount} open moderation reports against this captain (threshold ${REPORT_ESCALATE_THRESHOLD}). Human review only — no automatic enforcement.`,
    subjectType: 'captain',
    targetUid,
    evidence: {
      openCount,
      threshold: REPORT_ESCALATE_THRESHOLD,
      triggeringReportId,
      openReportIds: openPlayer.map((doc) => doc.id).slice(0, 20),
      sources: openPlayer.map((doc) => ({
        reportId: doc.id,
        source: doc.data().source ?? null,
        category: doc.data().category ?? null,
        gameId: doc.data().gameId ?? null,
      })),
    },
    priority: 'elevated',
  });

  return {
    escalated: result.created,
    openCount,
    reportId: result.reportId,
  };
}
