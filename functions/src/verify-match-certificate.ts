import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  resolveCertificateLookupCode,
} from './tei/issue-certificate';
import { verifyCertificateSignature } from './tei/certificate-pdf';
import { certificateSigningSecret } from './params';
import { getAppStorageBucket } from './storage-bucket';
import type {
  RatedMatchCertificate,
  RatedMatchDocument,
} from './tei/rated-match-schema';

const db = admin.firestore();

/** Public: verify a match certificate signature and return PDF signed URL. */
export const verifyMatchCertificate = onCall(async (request) => {
  const data = request.data as { matchCode?: string; signature?: string };
  const matchCode = data.matchCode
    ? resolveCertificateLookupCode(data.matchCode)
    : '';
  if (!matchCode) {
    throw new HttpsError('invalid-argument', 'matchCode required.');
  }

  const snap = await db.collection('ratedMatches').doc(matchCode).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Certificate not found.');
  }
  const match = snap.data() as RatedMatchDocument & {
    source?: string;
    gameId?: string;
  };
  const cert = match.certificate;
  if (!cert) {
    throw new HttpsError('failed-precondition', 'No certificate on this match.');
  }

  const secret = certificateSigningSecret.value();
  const storedSig = cert.signature ?? data.signature;
  if (!storedSig || !secret) {
    throw new HttpsError('failed-precondition', 'Certificate is not signed.');
  }

  const { signature: _s, pdfPath: _p, verifyUrl: _v, ...payload } = cert;
  const valid = verifyCertificateSignature(
    payload as RatedMatchCertificate,
    storedSig,
    secret
  );

  let pdfUrl: string | null = null;
  if (cert.pdfPath) {
    const [url] = await getAppStorageBucket()
      .file(cert.pdfPath)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
    pdfUrl = url;
  }

  return {
    ok: true,
    valid,
    matchCode,
    status: match.status,
    source: match.source ?? 'official',
    gameId: match.gameId ?? null,
    certificate: cert,
    pdfUrl,
  };
});
