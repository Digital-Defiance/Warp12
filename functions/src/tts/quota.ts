import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const HOUR_LIMIT = 60;
const DAY_LIMIT = 400;

interface TtsQuotaDoc {
  hourStartedAtMs?: number;
  hourCount?: number;
  dayKey?: string;
  dayCount?: number;
}

function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Enforce per-admin TTS generation limits (ElevenLabs cost control).
 * Cache hits should call with `countGeneration: false`.
 */
export async function enforceTtsQuota(
  uid: string,
  options: { countGeneration: boolean }
): Promise<void> {
  const ref = admin.firestore().collection('ttsQuota').doc(uid);
  const now = Date.now();
  const dayKey = utcDayKey(now);

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() ?? {}) as TtsQuotaDoc;

    let hourStartedAtMs = data.hourStartedAtMs ?? now;
    let hourCount = data.hourCount ?? 0;
    if (now - hourStartedAtMs >= 60 * 60 * 1000) {
      hourStartedAtMs = now;
      hourCount = 0;
    }

    let storedDayKey = data.dayKey ?? dayKey;
    let dayCount = data.dayCount ?? 0;
    if (storedDayKey !== dayKey) {
      storedDayKey = dayKey;
      dayCount = 0;
    }

    if (hourCount >= HOUR_LIMIT || dayCount >= DAY_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        'Commentator TTS quota exceeded for this hour or day.'
      );
    }

    if (!options.countGeneration) {
      return;
    }

    tx.set(
      ref,
      {
        uid,
        hourStartedAtMs,
        hourCount: hourCount + 1,
        dayKey: storedDayKey,
        dayCount: dayCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}
