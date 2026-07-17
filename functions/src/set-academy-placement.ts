import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getAIAnchor, type WarpSkillLevel } from 'warp12-engine';

import { requireVerifiedUser } from './auth';
import { assertNotBanned } from './bans';
import { objectiveTeiKey, type RatedObjective } from './tei/rated-match-schema';
import { toStoredRating } from './tei/rating-types.js';

const db = admin.firestore();

function needsAcademyPlacement(
  existing: FirebaseFirestore.DocumentData | null,
  objective: RatedObjective
): boolean {
  const key = objectiveTeiKey(objective);
  
  // Check if starting rating already set
  if (existing?.startingRating?.[key] !== undefined) {
    return false;
  }
  
  // Check OpenSkill humanRating field
  const humanRating = existing?.humanRating as Record<string, { matches?: number }> | undefined;
  const humanTrack = humanRating?.[key];
  if ((humanTrack?.matches ?? 0) > 0) {
    return false;
  }
  
  // Check OpenSkill localAi field  
  const localAi = existing?.localAi as Record<string, Record<string, { rating?: { matches?: number } }>> | undefined;
  if (localAi) {
    for (const bucket of Object.values(localAi)) {
      const track = bucket?.[key];
      if ((track?.rating?.matches ?? 0) > 0) {
        return false;
      }
    }
  }
  
  return true;
}

/** One-time academy placement — server picks benchmark TEI from class (clients cannot). */
export const setAcademyPlacement = onCall(async (request) => {
  const uid = requireVerifiedUser(request);
  await assertNotBanned(uid, request);
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
  
  // Get AI anchor rating for the selected skill level
  const track = data.objective === 'go-out' ? 'goOut' : 'points';
  const anchorRating = getAIAnchor(track, data.skill);
  const storedRating = toStoredRating(anchorRating);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data()! : null;

    if (!needsAcademyPlacement(existing, data.objective!)) {
      throw new HttpsError(
        'failed-precondition',
        'Academy placement is already set or rated play has started on this track.'
      );
    }

    const startingRating = {
      ...((existing?.startingRating as Record<string, unknown>) ?? {}),
      [key]: storedRating,
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
        startingRating,
        updatedAt: now,
      });
      return;
    }

    tx.set(ref, { startingRating, updatedAt: now }, { merge: true });
  });

  return { 
    ok: true, 
    rating: storedRating,
    skill: data.skill, 
    objective: data.objective 
  };
});
