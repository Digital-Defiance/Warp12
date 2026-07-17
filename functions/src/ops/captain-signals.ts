/**
 * Captain signal graph (IP sightings) — review-only related-account hints.
 * Never bans. Opens integrity queue items when multiple uids share an IP key.
 */

import * as admin from 'firebase-admin';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

import { clientIpFromRequest } from '../bans';
import { classifyClientIp } from './ip-address';
import { openSystemIntegrityReport } from '../moderation/integrity-reports';

export const CAPTAIN_SIGNALS_COLLECTION = 'captainSignals';
export const IP_SIGHTINGS_COLLECTION = 'ipSightings';

function getDb() {
  return admin.firestore();
}

/** Optional Bridge-supplied install/device hint (opaque string). */
export function clientInstallIdFromRequest(
  request: CallableRequest<unknown>
): string | null {
  const raw = (request.data as { clientInstallId?: unknown } | undefined)
    ?.clientInstallId;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim().slice(0, 128);
  return trimmed.length >= 8 ? trimmed : null;
}

/**
 * Record IP (+ optional install id) for a captain. Fire-and-forget safe.
 * If ≥2 distinct uids share the IP, open a related-ip integrity report.
 */
export async function recordCaptainNetworkSignal(
  uid: string,
  request?: CallableRequest<unknown>
): Promise<void> {
  if (!uid || !request) {
    return;
  }
  try {
    const { ipKey } = classifyClientIp(clientIpFromRequest(request));
    const installId = clientInstallIdFromRequest(request);
    if (!ipKey && !installId) {
      return;
    }

    const now = new Date().toISOString();
    const captainRef = getDb().collection(CAPTAIN_SIGNALS_COLLECTION).doc(uid);
    await captainRef.set(
      {
        uid,
        updatedAt: now,
        ...(ipKey
          ? {
              lastIpKey: ipKey,
              ipKeys: FieldValue.arrayUnion(ipKey),
            }
          : {}),
        ...(installId
          ? {
              lastInstallId: installId,
              installIds: FieldValue.arrayUnion(installId),
            }
          : {}),
      },
      { merge: true }
    );

    if (ipKey) {
      const ipRef = getDb().collection(IP_SIGHTINGS_COLLECTION).doc(ipKey);
      await ipRef.set(
        {
          ipKey,
          uids: FieldValue.arrayUnion(uid),
          updatedAt: now,
        },
        { merge: true }
      );

      const ipSnap = await ipRef.get();
      const uids = Array.isArray(ipSnap.data()?.uids)
        ? (ipSnap.data()!.uids as string[]).filter(
            (row) => typeof row === 'string' && row.length > 0
          )
        : [];
      const unique = [...new Set(uids)];
      if (unique.length >= 2) {
        await openSystemIntegrityReport({
          detector: 'related-ip',
          stableKeyParts: [ipKey],
          reason: `${unique.length} captain accounts have used the same network address. Possible related accounts — human review only (no auto-ban).`,
          subjectType: 'captain',
          targetUid: uid,
          evidence: {
            ipKey,
            relatedUids: unique.slice(0, 20),
            installId: installId ?? null,
          },
          priority: unique.length >= 4 ? 'elevated' : 'normal',
        });
      }
    }

    if (installId) {
      // Reverse index for device fingerprint (when Bridge starts sending it).
      const installRef = getDb().collection('installSightings').doc(installId);
      await installRef.set(
        {
          installId,
          uids: FieldValue.arrayUnion(uid),
          updatedAt: now,
        },
        { merge: true }
      );
      const installSnap = await installRef.get();
      const uids = Array.isArray(installSnap.data()?.uids)
        ? (installSnap.data()!.uids as string[]).filter(
            (row) => typeof row === 'string' && row.length > 0
          )
        : [];
      const unique = [...new Set(uids)];
      if (unique.length >= 2) {
        await openSystemIntegrityReport({
          detector: 'related-ip',
          stableKeyParts: [`install:${installId}`],
          reason: `${unique.length} captain accounts share the same install/device fingerprint. Possible related accounts — human review only (no auto-ban).`,
          subjectType: 'captain',
          targetUid: uid,
          evidence: {
            installId,
            relatedUids: unique.slice(0, 20),
            kind: 'install-fingerprint',
          },
          priority: unique.length >= 4 ? 'elevated' : 'normal',
        });
      }
    }
  } catch (err) {
    logger.warn('recordCaptainNetworkSignal failed', {
      uid,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
