import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defaultAcademyTei, type WarpSkillLevel } from 'warp12-engine';

import { requireVerifiedUser } from './auth';
import { objectiveTeiKey, type RatedObjective } from './tei/rated-match-schema';

const db = admin.firestore();

function needsAcademyPlacement(
  existing: FirebaseFirestore.DocumentData | null,
  objective: RatedObjective
): boolean {
  const key = objectiveTeiKey(objective);
  if (existing?.startingTei?.[key] !== undefined) {
    return false;
  }
  const localAi = existing?.localAi as Record<string, Record<string, unknown>> | undefined;
  if (localAi) {
    for (const bucket of Object.values(localAi)) {
      const track = bucket?.[key] as { unassistedMatches?: number } | undefined;
      if ((track?.unassistedMatches ?? 0) > 0) {
        return false;
      }
    }
  }
  const humanTei = existing?.humanTei as Record<string, unknown> | undefined;
  const humanTrack = humanTei?.[key] as { unassistedMatches?: number } | undefined;
  return (humanTrack?.unassistedMatches ?? 0) === 0;
}

/** One-time academy placement — server picks benchmark TEI from class (clients cannot). */
export const setAcademyPlacement = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  const data = request.data as {
    objective?: RatedObjective;
    skill?: WarpSkillLevel;
  };

  if (data.objective !== 'go-out' && data.objective !== 'points') {
    throw new HttpsError('invalid-argument', 'Invalid objective.');
  }
  if (
    data.skill !== 'ensign' &&
    data.skill !== 'lieutenant' &&
    data.skill !== 'commander'
  ) {
    throw new HttpsError('invalid-argument', 'Invalid skill.');
  }

  const ref = db.collection('playerStats').doc(uid);
  const now = new Date().toISOString();
  const key = objectiveTeiKey(data.objective);
  const benchmarkTei = defaultAcademyTei(data.skill, data.objective);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data()! : null;

    if (!needsAcademyPlacement(existing, data.objective!)) {
      throw new HttpsError(
        'failed-precondition',
        'Academy placement is already set or rated play has started on this track.'
      );
    }

    const startingTei = {
      ...((existing?.startingTei as Record<string, number>) ?? {}),
      [key]: benchmarkTei,
    };

    if (!existing) {
      tx.set(ref, {
        uid,
        displayName: 'Captain',
        matchesCompleted: 0,
        matchesWon: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        totalPoints: 0,
        startingTei,
        updatedAt: now,
      });
      return;
    }

    tx.set(ref, { startingTei, updatedAt: now }, { merge: true });
  });

  return { ok: true, tei: benchmarkTei, skill: data.skill, objective: data.objective };
});
