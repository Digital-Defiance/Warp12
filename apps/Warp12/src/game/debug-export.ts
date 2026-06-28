export function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
}

export function buildDebugFilename(sectorCode: string, exportedAt: string): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  return `warp12-${sanitizeFilenamePart(sectorCode)}-${stamp}.json`;
}

export function downloadDebugExport(
  payload: unknown,
  filename?: string
): void {
  const exportedAt =
    typeof payload === 'object' &&
    payload &&
    'exportedAt' in payload &&
    typeof (payload as { exportedAt: unknown }).exportedAt === 'string'
      ? (payload as { exportedAt: string }).exportedAt
      : new Date().toISOString();
  const sectorCode =
    typeof payload === 'object' &&
    payload &&
    'sectorCode' in payload &&
    typeof (payload as { sectorCode: unknown }).sectorCode === 'string'
      ? (payload as { sectorCode: string }).sectorCode
      : 'debug';
  const name = filename ?? buildDebugFilename(sectorCode, exportedAt);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
