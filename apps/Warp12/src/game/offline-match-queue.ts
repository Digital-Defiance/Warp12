import type { GameAction } from 'warp12-engine';

import type { ReportLocalAiMatchInput } from '../firebase/stats-service.js';
import { isReplayableLocalAiMatch } from './local-ai-match-validation.js';

const STORAGE_KEY = 'warp12.pendingLocalAiMatches';

export interface PendingLocalAiMatch extends ReportLocalAiMatchInput {
  /** ISO timestamp when the match finished offline. */
  queuedAt: string;
  /** Idempotency — avoid double-submit after sync. */
  matchKey: string;
}

function readQueue(): PendingLocalAiMatch[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PendingLocalAiMatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: PendingLocalAiMatch[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (entries.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function isNetworkAvailable(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine !== false;
}

export function pendingLocalAiMatchCount(uid?: string): number {
  const queue = readQueue();
  return uid ? queue.filter((entry) => entry.uid === uid).length : queue.length;
}

/** Persist a verified match report for upload when connectivity returns. */
export function enqueuePendingLocalAiMatch(
  input: ReportLocalAiMatchInput,
  matchKey: string
): void {
  const queue = readQueue();
  if (queue.some((entry) => entry.matchKey === matchKey)) {
    return;
  }
  writeQueue([
    ...queue,
    {
      ...input,
      matchKey,
      queuedAt: new Date().toISOString(),
    },
  ]);
}

export function listPendingLocalAiMatches(uid: string): PendingLocalAiMatch[] {
  return readQueue().filter((entry) => entry.uid === uid);
}

export function removePendingLocalAiMatch(matchKey: string): void {
  writeQueue(readQueue().filter((entry) => entry.matchKey !== matchKey));
}

export function dequeuePendingLocalAiMatch(matchKey: string): void {
  removePendingLocalAiMatch(matchKey);
}

/** Remove queued rows that cannot pass server replay validation. */
export function pruneNonReplayablePendingLocalAiMatches(uid?: string): number {
  const queue = readQueue();
  const next = queue.filter((entry) => {
    if (uid && entry.uid !== uid) {
      return true;
    }
    return isReplayableLocalAiMatch(entry);
  });
  const removed = queue.length - next.length;
  if (removed > 0) {
    writeQueue(next);
  }
  return removed;
}

/** Human-readable payload size guard. */
export function sanitizeHumanActions(
  actions: readonly GameAction[]
): GameAction[] {
  return actions.slice(0, 4_000);
}
