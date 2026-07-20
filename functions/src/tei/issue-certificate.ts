/**
 * Shared certificate issue: HMAC sign + PDF upload + verify URL.
 */

import { HttpsError } from 'firebase-functions/v2/https';

import { certificateSigningSecret } from '../params';
import { getAppStorageBucket } from '../storage-bucket';
import { buildSignedCertificatePdf } from './certificate-pdf';
import type { RatedMatchCertificate } from './rated-match-schema';

export type IssuedCertificate = RatedMatchCertificate & {
  signature: string;
  pdfPath: string;
  verifyUrl: string;
};

export function onlineCertificateMatchCode(gameId: string): string {
  return `ON-${gameId.trim().toUpperCase()}`;
}

/** Accept MT-… (official) or ON-… (online sector) codes. */
export function resolveCertificateLookupCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('ON-')) {
    return trimmed;
  }
  if (trimmed.startsWith('MT-')) {
    return trimmed;
  }
  if (trimmed.startsWith('MT')) {
    return `MT-${trimmed.slice(2)}`;
  }
  // Bare suffix → official MT-
  return `MT-${trimmed}`;
}

export async function issueSignedCertificate(
  certificate: RatedMatchCertificate
): Promise<IssuedCertificate> {
  const secret = certificateSigningSecret.value();
  if (!secret) {
    throw new HttpsError(
      'failed-precondition',
      'CERTIFICATE_SIGNING_SECRET is not configured.'
    );
  }

  const signed = await buildSignedCertificatePdf({
    certificate,
    secret,
  });

  await getAppStorageBucket()
    .file(signed.storagePath)
    .save(Buffer.from(signed.pdfBytes), {
      contentType: 'application/pdf',
      metadata: {
        cacheControl: 'public,max-age=31536000',
        matchCode: certificate.matchCode,
      },
    });

  return {
    ...certificate,
    signature: signed.signature,
    pdfPath: signed.storagePath,
    verifyUrl: `https://iwdf.org/verify?code=${encodeURIComponent(certificate.matchCode)}`,
  };
}
