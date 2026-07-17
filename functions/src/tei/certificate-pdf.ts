import { createHmac, timingSafeEqual } from 'node:crypto';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { RatedMatchCertificate } from '../tei/rated-match-schema.js';

export type SignedCertificateBundle = {
  certificate: RatedMatchCertificate;
  /** Detached HMAC-SHA256 hex over canonical JSON. */
  signature: string;
  /** PDF bytes. */
  pdfBytes: Uint8Array;
  storagePath: string;
};

function canonicalPayload(cert: RatedMatchCertificate): string {
  return JSON.stringify({
    version: cert.version,
    matchCode: cert.matchCode,
    issuedAt: cert.issuedAt,
    objective: cert.objective,
    charter: cert.charter ?? null,
    players: cert.players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      rank: p.rank,
      score: p.score,
      humanMuDelta: p.humanMuDelta ?? null,
      crewMuDelta: p.crewMuDelta ?? null,
    })),
  });
}

export function signCertificatePayload(
  cert: RatedMatchCertificate,
  secret: string
): string {
  return createHmac('sha256', secret)
    .update(canonicalPayload(cert))
    .digest('hex');
}

export function verifyCertificateSignature(
  cert: RatedMatchCertificate,
  signature: string,
  secret: string
): boolean {
  const expected = signCertificatePayload(cert, secret);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function gradeLine(p: RatedMatchCertificate['players'][number]): string {
  const bits: string[] = [`#${p.rank}`, `${p.displayName}`, `score ${p.score}`];
  if (p.humanMuDelta != null) {
    bits.push(
      `TEI dmu ${p.humanMuDelta >= 0 ? '+' : ''}${p.humanMuDelta.toFixed(3)}`
    );
  }
  if (p.crewMuDelta != null) {
    bits.push(
      `crew dmu ${p.crewMuDelta >= 0 ? '+' : ''}${p.crewMuDelta.toFixed(3)}`
    );
  }
  return bits.join(' · ');
}

/** Required PDF participation / result certificate for a rated match. */
export async function renderCertificatePdf(
  cert: RatedMatchCertificate,
  signature: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = 740;

  const draw = (
    text: string,
    opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }
  ) => {
    const size = opts?.size ?? 11;
    const f = opts?.bold ? fontBold : font;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: f,
      color: opts?.color ?? rgb(0.08, 0.1, 0.14),
    });
    y -= size + 8;
  };

  draw('WARP', { bold: true, size: 28, color: rgb(0.15, 0.35, 0.7) });
  draw('Match Certificate', { bold: true, size: 18 });
  y -= 8;
  draw(`Code: ${cert.matchCode}`, { bold: true, size: 12 });
  draw(`Issued: ${cert.issuedAt}`);
  draw(`Objective: ${cert.objective}`);
  if (cert.charter) {
    draw(
      `Crew: ${cert.charter.name} (${cert.charter.slug}) · season ${cert.charter.seasonLabel ?? '—'}`
    );
  }
  y -= 10;
  draw('Standings', { bold: true, size: 14 });
  for (const p of [...cert.players].sort((a, b) => a.rank - b.rank)) {
    draw(gradeLine(p), { size: 10 });
    if (y < 120) {
      break;
    }
  }
  y = Math.min(y, 140);
  draw('Server signature (HMAC-SHA256)', { bold: true, size: 10 });
  draw(signature.slice(0, 64), { size: 8, color: rgb(0.35, 0.4, 0.45) });
  if (signature.length > 64) {
    draw(signature.slice(64), { size: 8, color: rgb(0.35, 0.4, 0.45) });
  }
  draw('Verify at https://iwdf.org/verify', {
    size: 9,
    color: rgb(0.2, 0.45, 0.7),
  });

  return doc.save();
}

export async function buildSignedCertificatePdf(input: {
  certificate: RatedMatchCertificate;
  secret: string;
}): Promise<SignedCertificateBundle> {
  const signature = signCertificatePayload(input.certificate, input.secret);
  const pdfBytes = await renderCertificatePdf(input.certificate, signature);
  const storagePath = `certificates/${input.certificate.matchCode}.pdf`;
  return {
    certificate: input.certificate,
    signature,
    pdfBytes,
    storagePath,
  };
}
