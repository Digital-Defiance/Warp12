import { sanitizeFilenamePart } from './debug-export.js';
import type { RoundLogExport } from 'warp12-react';

export function buildRoundLogFilename(
  roundNumber: number,
  exportedAt: string,
  sectorCode?: string
): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const sector = sectorCode ? `${sanitizeFilenamePart(sectorCode)}-` : '';
  return `warp12-${sector}round-${roundNumber}-log-${stamp}.txt`;
}

export function downloadRoundLog(payload: RoundLogExport): void {
  const filename = buildRoundLogFilename(
    payload.roundNumber,
    payload.exportedAt,
    payload.sectorCode
  );
  const body = payload.lines.join('\n');
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
