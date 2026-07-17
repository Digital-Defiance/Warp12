import { describe, expect, it } from 'vitest';

import {
  buildSignedCertificatePdf,
  signCertificatePayload,
  verifyCertificateSignature,
} from '../tei/certificate-pdf';
import type { RatedMatchCertificate } from '../tei/rated-match-schema';

const sample: RatedMatchCertificate = {
  version: 1,
  matchCode: 'MT-TEST01',
  issuedAt: '2026-07-16T00:00:00.000Z',
  objective: 'points',
  players: [
    {
      uid: 'u1',
      displayName: 'Alpha',
      rank: 1,
      score: 12,
      humanMuDelta: 0.4,
    },
    {
      uid: 'u2',
      displayName: 'Bravo',
      rank: 2,
      score: 40,
      humanMuDelta: -0.2,
    },
  ],
};

describe('certificate-pdf', () => {
  it('signs and verifies', () => {
    const secret = 'test-secret';
    const sig = signCertificatePayload(sample, secret);
    expect(sig).toHaveLength(64);
    expect(verifyCertificateSignature(sample, sig, secret)).toBe(true);
    expect(verifyCertificateSignature(sample, '00'.repeat(32), secret)).toBe(
      false
    );
  });

  it('renders a non-empty PDF', async () => {
    const bundle = await buildSignedCertificatePdf({
      certificate: sample,
      secret: 'test-secret',
    });
    expect(bundle.pdfBytes.byteLength).toBeGreaterThan(500);
    expect(bundle.storagePath).toBe('certificates/MT-TEST01.pdf');
    expect(bundle.signature).toHaveLength(64);
  });
});
