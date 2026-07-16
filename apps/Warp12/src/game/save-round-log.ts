import { sanitizeFilenamePart } from './debug-export.js';
import { deliverBlob, type DeliverFileResult } from './deliver-file.js';
import type { RoundLogExport } from 'warp12-react';

export function buildRoundLogFilename(
  roundNumber: number,
  exportedAt: string,
  sectorCode?: string,
  extension: 'txt' | 'json' = 'txt'
): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const sector = sectorCode ? `${sanitizeFilenamePart(sectorCode)}-` : '';
  return `warp12-${sector}round-${roundNumber}-log-${stamp}.${extension}`;
}

export async function downloadRoundLog(
  payload: RoundLogExport
): Promise<DeliverFileResult> {
  const filename = buildRoundLogFilename(
    payload.roundNumber,
    payload.exportedAt,
    payload.sectorCode,
    'txt'
  );
  const body = payload.lines.join('\n');
  return deliverBlob({
    blob: new Blob([body], { type: 'text/plain;charset=utf-8' }),
    filename,
    title: `Warp 12 · Round ${payload.roundNumber} log`,
    text: body,
  });
}

export async function downloadRoundLogJson(
  payload: RoundLogExport
): Promise<DeliverFileResult> {
  const filename = buildRoundLogFilename(
    payload.roundNumber,
    payload.exportedAt,
    payload.sectorCode,
    'json'
  );
  const json = JSON.stringify(payload, null, 2);
  return deliverBlob({
    blob: new Blob([json], { type: 'application/json' }),
    filename,
    title: `Warp 12 · Round ${payload.roundNumber} log (JSON)`,
    text: json,
  });
}
