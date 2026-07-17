/**
 * Persist an online-sector certificate under ratedMatches/ON-{gameId}.
 * Idempotent: if the doc already has a signed certificate, returns it.
 */

import * as admin from 'firebase-admin';

import {
  buildCertificatePlayer,
  buildRatedMatchCertificate,
} from './build-rated-match-certificate';
import {
  issueSignedCertificate,
  onlineCertificateMatchCode,
  type IssuedCertificate,
} from './issue-certificate';
import type {
  RatedMatchCertificatePlayer,
  RatedObjective,
  StoredRating,
} from './rated-match-schema';
import type { CertificateCharterInput } from './build-rated-match-certificate';

const db = admin.firestore();

export type OnlineCertPlayerInput = {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
  ratingBefore: StoredRating;
  ratingAfter: StoredRating;
  /** When set, primary deltas are crew; optional global human deltas too */
  charterId?: string;
  globalRatingBefore?: StoredRating;
  globalRatingAfter?: StoredRating;
};

export async function issueOnlineSectorCertificate(input: {
  gameId: string;
  objective: RatedObjective;
  campaignRounds: number;
  players: OnlineCertPlayerInput[];
  charter?: CertificateCharterInput;
}): Promise<IssuedCertificate | null> {
  if (input.players.length === 0) {
    return null;
  }

  const matchCode = onlineCertificateMatchCode(input.gameId);
  const ref = db.collection('ratedMatches').doc(matchCode);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() as { certificate?: IssuedCertificate };
    if (data.certificate?.signature && data.certificate?.pdfPath) {
      return data.certificate;
    }
  }

  const now = new Date().toISOString();
  const certPlayers: RatedMatchCertificatePlayer[] = input.players.map((p) =>
    buildCertificatePlayer({
      uid: p.uid,
      displayName: p.displayName,
      rank: p.rank,
      score: p.score,
      ratingBefore: p.ratingBefore,
      ratingAfter: p.ratingAfter,
      charterId: p.charterId,
      globalRatingBefore: p.globalRatingBefore,
      globalRatingAfter: p.globalRatingAfter,
    })
  );

  const certificate = buildRatedMatchCertificate({
    matchCode,
    issuedAt: now,
    objective: input.objective,
    charter: input.charter,
    players: certPlayers,
  });

  const issued = await issueSignedCertificate(certificate);

  await ref.set(
    {
      matchCode,
      status: 'approved',
      source: 'online',
      gameId: input.gameId,
      objective: input.objective,
      campaignRounds: input.campaignRounds,
      officialId: 'online',
      officialDisplayName: 'Online sector',
      createdAt: existing.exists
        ? (existing.data()?.createdAt ?? now)
        : now,
      updatedAt: now,
      completedAt: now,
      approvedAt: now,
      participants: input.players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        checkedInAt: now,
      })),
      standings: input.players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        rank: p.rank,
        score: p.score,
      })),
      ...(input.charter ? { charterId: input.charter.charterId } : {}),
      certificate: issued,
    },
    { merge: true }
  );

  return issued;
}
