import { invoke } from '@tauri-apps/api/core';

import { isTauriDesktop, isTauriMobile } from '../firebase/platform.js';

/**
 * Platforms where `<a download>` + blob: URLs are ignored (WKWebView / iOS).
 * On those, prefer the system share sheet or clipboard instead of a silent no-op.
 *
 * Important: do not treat desktop macOS (including Tauri) as iPad. Trackpads often
 * report `maxTouchPoints > 1`, which falsely matched the old iPadOS desktop-UA check
 * and broke Save / Download on Mac.
 */
export function canUseAnchorDownload(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  if (isTauriMobile()) {
    return false;
  }
  // Desktop Tauri still reports canUseAnchorDownload for tests / web fallbacks,
  // but deliverBlob prefers the native save dialog (WKWebView ignores download).
  if (isTauriDesktop()) {
    return true;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return false;
  }
  // iPadOS 13+ desktop UA: MacIntel + touch, without a fine pointer (trackpad Macs
  // also have maxTouchPoints > 1, so require coarse/touch-primary to avoid false hits).
  if (
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1 &&
    typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches
  ) {
    return false;
  }
  return true;
}

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function downloadBlobViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Native OS save picker — required on Tauri desktop (WKWebView no-ops download). */
export async function saveBlobViaTauriDialog(
  blob: Blob,
  filename: string
): Promise<'downloaded' | 'cancelled'> {
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  const saved = await invoke<boolean>('save_download', {
    defaultName: filename,
    contents: bytes,
  });
  return saved ? 'downloaded' : 'cancelled';
}

async function shareBlobAsFile(
  blob: Blob,
  filename: string,
  options?: { title?: string; text?: string }
): Promise<'shared'> {
  if (!canShareFiles()) {
    throw new Error('System share is unavailable');
  }

  const looksLikeText =
    blob.type.startsWith('text/') ||
    blob.type === 'application/json' ||
    filename.endsWith('.txt') ||
    filename.endsWith('.json');

  // Prefer text share when we have a body — more reliable than file share on iOS.
  if (looksLikeText && options?.text != null) {
    const textPayload: ShareData = {
      ...(options.title ? { title: options.title } : {}),
      text: options.text,
    };
    if (!navigator.canShare || navigator.canShare(textPayload)) {
      await navigator.share(textPayload);
      return 'shared';
    }
  }

  const file = new File([blob], filename, {
    type: blob.type || 'application/octet-stream',
  });
  const payload: ShareData = {
    files: [file],
    ...(options.title ? { title: options.title } : {}),
    ...(options?.text ? { text: options.text } : {}),
  };
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    throw new Error('System share is unavailable for this file');
  }
  await navigator.share(payload);
  return 'shared';
}

export async function copyTextToClipboard(text: string): Promise<'copied'> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard is unavailable');
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export type DeliverFileResult = 'downloaded' | 'shared' | 'copied' | 'cancelled';

/**
 * Deliver a blob to the captain: download when the webview supports it, else
 * system share (Save Image / Files / Mail…), else clipboard for text-like types.
 */
export async function deliverBlob(options: {
  blob: Blob;
  filename: string;
  title?: string;
  text?: string;
  /** Prefer share even when download works (e.g. explicit Share button). */
  preferShare?: boolean;
}): Promise<DeliverFileResult> {
  const { blob, filename, title, text, preferShare = false } = options;

  if (!preferShare && isTauriDesktop()) {
    try {
      return await saveBlobViaTauriDialog(blob, filename);
    } catch (err) {
      console.warn('[deliver-file] Tauri save dialog failed; trying anchor', err);
      // Fall through to anchor / share / clipboard.
    }
  }

  if (!preferShare && canUseAnchorDownload()) {
    downloadBlobViaAnchor(blob, filename);
    return 'downloaded';
  }

  try {
    await shareBlobAsFile(blob, filename, { title, text });
    return 'shared';
  } catch (err) {
    // User dismissed the sheet — not a failure to surface as an error toast.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    // Images need a fresh tap after async capture; text can fall back to clipboard.
    const looksLikeTextEarly =
      blob.type.startsWith('text/') ||
      blob.type === 'application/json' ||
      filename.endsWith('.txt') ||
      filename.endsWith('.json');
    if (!looksLikeTextEarly && isShareGestureError(err)) {
      throw err;
    }
  }

  const looksLikeText =
    blob.type.startsWith('text/') ||
    blob.type === 'application/json' ||
    filename.endsWith('.txt') ||
    filename.endsWith('.json');

  if (looksLikeText && text != null) {
    await copyTextToClipboard(text);
    return 'copied';
  }

  if (looksLikeText) {
    const body = await blob.text();
    await copyTextToClipboard(body);
    return 'copied';
  }

  throw new Error(
    'Could not save or share this file on this device. Try Copy from the round log.'
  );
}

/**
 * True when async work (e.g. html-to-image) likely burned the user-gesture
 * window that iOS requires for navigator.share.
 */
export function isShareGestureError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'NotAllowedError' || err.name === 'InvalidStateError')
  );
}
