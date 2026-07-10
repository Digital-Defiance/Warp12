import { toPng } from 'html-to-image';

import { sanitizeFilenamePart } from './debug-export.js';

import { formatRoundPointsDelta } from 'warp12-engine';

export const TABLE_CAPTURE_WIDTH = 1200;
export const TABLE_CAPTURE_HEIGHT = 800;
export const TABLE_CAPTURE_PIXEL_RATIO = 2;

export const LOGO_VIEWBOX = { width: 531.41, height: 111.65 } as const;

export type ShareRoundImageMode = 'board' | 'overlay';
export type ShareRoundDelivery = 'share' | 'save';

export interface ShareRoundMetadata {
  roundNumber: number;
  headline: string;
  subtitle?: string;
  statsLines?: string[];
  sectorCode?: string;
}

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function formatPointsStatLines(
  entries: readonly { name: string; points: number }[]
): string[] {
  if (entries.length === 0) {
    return ['No points held this round.'];
  }
  return entries.map(
    (entry) => `${entry.name}: ${formatRoundPointsDelta(entry.points)}`
  );
}

export function formatShareRoundMessage(meta: ShareRoundMetadata): string {
  const lines = [meta.headline];
  if (meta.subtitle) {
    lines.push(meta.subtitle);
  }
  if (meta.statsLines?.length) {
    lines.push(...meta.statsLines);
  }
  lines.push('https://warp.iwdf.org');
  return lines.join('\n');
}

export function buildShareRoundFilename(
  meta: ShareRoundMetadata,
  exportedAt: string,
  mode: ShareRoundImageMode = 'board'
): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const sector = meta.sectorCode
    ? `${sanitizeFilenamePart(meta.sectorCode)}-`
    : '';
  const suffix = mode === 'overlay' ? '-overlay' : '';
  return `warp12-${sector}round-${meta.roundNumber}${suffix}-${stamp}.png`;
}

export function mergeContentBounds(
  rootWidth: number,
  rootHeight: number,
  boxes: readonly { left: number; top: number; right: number; bottom: number }[],
  padding = 32
): ContentBounds {
  let minX = 0;
  let minY = 0;
  let maxX = rootWidth;
  let maxY = rootHeight;

  for (const box of boxes) {
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
  }

  minX = Math.floor(minX - padding);
  minY = Math.floor(minY - padding);
  maxX = Math.ceil(maxX + padding);
  maxY = Math.ceil(maxY + padding);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function readViewportScale(root: HTMLElement): number {
  const canvas = root.parentElement;
  if (!canvas) {
    return 1;
  }
  const transform = getComputedStyle(canvas).transform;
  if (!transform || transform === 'none') {
    return 1;
  }
  const scale = new DOMMatrix(transform).a;
  return scale > 0 ? scale : 1;
}

export function measureTableContentBounds(
  root: HTMLElement,
  padding = 32
): ContentBounds {
  const scale = readViewportScale(root);
  const rootRect = root.getBoundingClientRect();
  const boxes: { left: number; top: number; right: number; bottom: number }[] =
    [];

  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const left = (rect.left - rootRect.left) / scale;
    const top = (rect.top - rootRect.top) / scale;
    boxes.push({
      left,
      top,
      right: left + rect.width / scale,
      bottom: top + rect.height / scale,
    });
  });

  return mergeContentBounds(root.offsetWidth, root.offsetHeight, boxes, padding);
}

export function computeLogoOverlayLayout(boardWidth: number): {
  padding: number;
  logoWidth: number;
  logoHeight: number;
} {
  const padding = Math.max(16, Math.round(boardWidth * 0.018));
  const logoWidth = Math.min(Math.round(boardWidth * 0.26), 480);
  const logoHeight = logoWidth * (LOGO_VIEWBOX.height / LOGO_VIEWBOX.width);
  return { padding, logoWidth, logoHeight };
}

export function compactOverlaySubtitle(
  subtitle: string,
  roundNumber: number
): string {
  const completeSuffix = ` — round ${roundNumber} complete.`;
  if (subtitle.endsWith(completeSuffix)) {
    return `${subtitle.slice(0, -completeSuffix.length)}.`;
  }
  const blockedPrefix = `Round ${roundNumber} blocked — `;
  if (subtitle.startsWith(blockedPrefix)) {
    return subtitle.slice(blockedPrefix.length);
  }
  return subtitle;
}

export function statsOverlayLines(meta: ShareRoundMetadata): string[] {
  const lines = [`Round ${meta.roundNumber}`, meta.headline];
  if (meta.subtitle) {
    lines.push(compactOverlaySubtitle(meta.subtitle, meta.roundNumber));
  }
  if (meta.statsLines?.length) {
    lines.push(...meta.statsLines);
  }
  return lines;
}

export function computeStatsOverlayLayout(
  boardWidth: number,
  boardHeight: number,
  lineCount: number
): {
  padding: number;
  fontSize: number;
  lineHeight: number;
  panelWidth: number;
  panelHeight: number;
  x: number;
  y: number;
} {
  const padding = Math.max(16, Math.round(boardWidth * 0.018));
  const fontSize = Math.max(14, Math.round(boardWidth * 0.013));
  const lineHeight = Math.round(fontSize * 1.4);
  const panelWidth = Math.min(
    boardWidth * 0.42,
    Math.max(220, Math.round(boardWidth * 0.28))
  );
  const panelHeight = lineCount * lineHeight + padding * 2;
  return {
    padding,
    fontSize,
    lineHeight,
    panelWidth,
    panelHeight,
    x: boardWidth - panelWidth,
    y: boardHeight - panelHeight,
  };
}

interface CaptureStyleSnapshot {
  canvasTransform: string;
  surfaceOverflow: string;
  rootWidth: string;
  rootHeight: string;
  rootTransform: string;
  rootOverflow: string;
}

function snapshotTableCaptureStyles(root: HTMLElement): CaptureStyleSnapshot {
  const canvas = root.parentElement;
  const surface = canvas?.parentElement ?? null;
  return {
    canvasTransform: canvas?.style.transform ?? '',
    surfaceOverflow: surface?.style.overflow ?? '',
    rootWidth: root.style.width,
    rootHeight: root.style.height,
    rootTransform: root.style.transform,
    rootOverflow: root.style.overflow,
  };
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load board image'));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Failed to encode share image')),
      'image/png',
      1
    );
  });
}

export async function drawWarp12Logo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
): Promise<void> {
  await Promise.all([
    document.fonts.load('normal 72px FederationWide'),
    document.fonts.load('normal 72px Federation'),
    document.fonts.load('100 42px "Nova Light"'),
  ]);

  const scale = width / LOGO_VIEWBOX.width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.font = 'normal 72px FederationWide, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('Warp', 17.16, 60.98);

  ctx.font = 'normal 72px Federation, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('12', 383.22, 60.98);

  ctx.font = '100 42px "Nova Light", Federation, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('Interstellar Dominoes', 345.15, 97.29);

  ctx.restore();
}

async function drawLogoOverlay(
  ctx: CanvasRenderingContext2D,
  boardWidth: number
): Promise<void> {
  const { padding, logoWidth, logoHeight } = computeLogoOverlayLayout(boardWidth);
  ctx.fillStyle = 'rgba(5, 8, 22, 0.55)';
  ctx.fillRect(0, 0, logoWidth + padding * 2, logoHeight + padding * 2);

  const logoScale = logoWidth / LOGO_VIEWBOX.width;
  await drawWarp12Logo(ctx, padding, padding + 14 * logoScale, logoWidth);
}

function drawStatsOverlay(
  ctx: CanvasRenderingContext2D,
  boardWidth: number,
  boardHeight: number,
  meta: ShareRoundMetadata
): void {
  const lines = statsOverlayLines(meta);
  const layout = computeStatsOverlayLayout(boardWidth, boardHeight, lines.length);

  ctx.fillStyle = 'rgba(5, 8, 22, 0.55)';
  ctx.fillRect(layout.x, layout.y, layout.panelWidth, layout.panelHeight);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  let y = layout.y + layout.padding + layout.fontSize;
  for (const [index, line] of lines.entries()) {
    ctx.font = `400 ${layout.fontSize}px Federation, FederationWide, system-ui, sans-serif`;
    ctx.fillStyle = index === 0 ? '#7dd3fc' : index === 1 ? '#e2e8f0' : '#cbd5e1';
    ctx.fillText(line, boardWidth - layout.padding, y);
    y += layout.lineHeight;
  }
}

export async function captureTableContentPng(
  root: HTMLElement,
  options?: {
    padding?: number;
    pixelRatio?: number;
    backgroundColor?: string;
  }
): Promise<string> {
  const padding = options?.padding ?? 32;
  const pixelRatio = options?.pixelRatio ?? TABLE_CAPTURE_PIXEL_RATIO;
  const backgroundColor = options?.backgroundColor ?? '#050816';
  const snap = snapshotTableCaptureStyles(root);
  const canvas = root.parentElement;
  const surface = canvas?.parentElement ?? null;

  try {
    if (canvas) {
      canvas.style.transform = 'none';
    }
    if (surface) {
      surface.style.overflow = 'visible';
    }
    await waitForPaint();

    const bounds = measureTableContentBounds(root, padding);
    root.style.width = `${bounds.width}px`;
    root.style.height = `${bounds.height}px`;
    root.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px)`;
    root.style.overflow = 'visible';
    await waitForPaint();

    await document.fonts.ready;
    return await toPng(root, {
      width: bounds.width,
      height: bounds.height,
      pixelRatio,
      cacheBust: true,
      backgroundColor,
    });
  } finally {
    if (canvas) {
      canvas.style.transform = snap.canvasTransform;
    }
    if (surface) {
      surface.style.overflow = snap.surfaceOverflow;
    }
    root.style.width = snap.rootWidth;
    root.style.height = snap.rootHeight;
    root.style.transform = snap.rootTransform;
    root.style.overflow = snap.rootOverflow;
  }
}

/** Full-board PNG with Warp 12 logo overlaid top-left; optional stats bottom-right. */
export async function composeBoardShareImage(
  boardDataUrl: string,
  meta: ShareRoundMetadata,
  mode: ShareRoundImageMode = 'board'
): Promise<Blob> {
  const board = await loadImage(boardDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = board.width;
  canvas.height = board.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.drawImage(board, 0, 0);
  await drawLogoOverlay(ctx, board.width);

  if (mode === 'overlay') {
    drawStatsOverlay(ctx, board.width, board.height, meta);
  }

  return canvasToBlob(canvas);
}

export function canUseSystemShare(): boolean {
  return typeof navigator.share === 'function';
}

export function downloadRoundImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function shareRoundImageBlob(
  blob: Blob,
  filename: string,
  meta: ShareRoundMetadata
): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  const text = formatShareRoundMessage(meta);
  const payload = { title: meta.headline, text, files: [file] };

  if (!canUseSystemShare()) {
    throw new Error('System share is unavailable');
  }
  if (navigator.canShare && !navigator.canShare(payload)) {
    throw new Error('System share is unavailable for this image');
  }

  await navigator.share(payload);
}

export async function deliverRoundImage(options: {
  tableContent: HTMLElement;
  meta: ShareRoundMetadata;
  mode?: ShareRoundImageMode;
  delivery: ShareRoundDelivery;
}): Promise<'shared' | 'saved'> {
  const mode = options.mode ?? 'board';
  const boardDataUrl = await captureTableContentPng(options.tableContent);
  const blob = await composeBoardShareImage(boardDataUrl, options.meta, mode);
  const filename = buildShareRoundFilename(
    options.meta,
    new Date().toISOString(),
    mode
  );

  if (options.delivery === 'save') {
    downloadRoundImage(blob, filename);
    return 'saved';
  }

  await shareRoundImageBlob(blob, filename, options.meta);
  return 'shared';
}
