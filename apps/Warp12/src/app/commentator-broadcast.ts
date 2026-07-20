import type { NameColorEntry } from './game-log-display.js';

export const COMMENTATOR_CHANNEL = 'warp12-commentator-v1';

export interface CommentatorSnapshotMessage {
  readonly type: 'snapshot';
  readonly lines: readonly string[];
  readonly nameColors: readonly NameColorEntry[];
  readonly title: string;
  readonly sectorCode?: string;
  readonly at: string;
}

export interface CommentatorHelloMessage {
  readonly type: 'hello';
}

export type CommentatorBroadcastMessage =
  | CommentatorSnapshotMessage
  | CommentatorHelloMessage;

export function isCommentatorBroadcastMessage(
  value: unknown
): value is CommentatorBroadcastMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === 'snapshot' || type === 'hello';
}

/** Publish the current highlight feed for OBS / pop-out overlays. */
export function publishCommentatorSnapshot(
  snapshot: Omit<CommentatorSnapshotMessage, 'type' | 'at'> & {
    readonly at?: string;
  }
): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(COMMENTATOR_CHANNEL);
    const message: CommentatorSnapshotMessage = {
      type: 'snapshot',
      lines: snapshot.lines,
      nameColors: snapshot.nameColors,
      title: snapshot.title,
      ...(snapshot.sectorCode ? { sectorCode: snapshot.sectorCode } : {}),
      at: snapshot.at ?? new Date().toISOString(),
    };
    channel.postMessage(message);
    channel.close();
  } catch {
    // Cross-origin / unsupported
  }
}

export function requestCommentatorSnapshot(): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(COMMENTATOR_CHANNEL);
    const message: CommentatorHelloMessage = { type: 'hello' };
    channel.postMessage(message);
    channel.close();
  } catch {
    // ignore
  }
}

export const COMMENTARY_OVERLAY_PATH = '/commentary';

export function openCommentaryOverlayWindow(): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = new URL(COMMENTARY_OVERLAY_PATH, window.location.origin);
  return window.open(
    url.toString(),
    'warp12-commentary',
    'popup=yes,width=960,height=540'
  );
}
