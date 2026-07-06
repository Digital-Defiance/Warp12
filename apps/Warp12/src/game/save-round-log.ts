import { sanitizeFilenamePart } from './debug-export.js';
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

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadRoundLog(payload: RoundLogExport): void {
  const filename = buildRoundLogFilename(
    payload.roundNumber,
    payload.exportedAt,
    payload.sectorCode,
    'txt'
  );
  const body = payload.lines.join('\n');
  downloadBlob(filename, new Blob([body], { type: 'text/plain;charset=utf-8' }));
}

export function downloadRoundLogJson(payload: RoundLogExport): void {
  const filename = buildRoundLogFilename(
    payload.roundNumber,
    payload.exportedAt,
    payload.sectorCode,
    'json'
  );
  const json = JSON.stringify(payload, null, 2);
  downloadBlob(filename, new Blob([json], { type: 'application/json' }));
}
