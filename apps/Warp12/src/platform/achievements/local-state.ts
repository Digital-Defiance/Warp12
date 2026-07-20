/**
 * Local unlock / progress dedupe so we do not spam platform APIs.
 * Platform stores remain authoritative once wired; this is a client hint.
 */

import type { WarpAchievementId } from './catalog.js';

const STORAGE_KEY = 'warp.platformAchievements.v1';

export interface AchievementLocalState {
  readonly unlocked: readonly WarpAchievementId[];
  /** Current step counts for incremental achievements. */
  readonly progress: Readonly<Partial<Record<WarpAchievementId, number>>>;
}

function emptyState(): AchievementLocalState {
  return { unlocked: [], progress: {} };
}

function readState(): AchievementLocalState {
  if (typeof localStorage === 'undefined') {
    return emptyState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as Partial<AchievementLocalState>;
    const unlocked = Array.isArray(parsed.unlocked)
      ? (parsed.unlocked.filter(
          (id): id is WarpAchievementId => typeof id === 'string'
        ) as WarpAchievementId[])
      : [];
    const progress =
      parsed.progress && typeof parsed.progress === 'object'
        ? (parsed.progress as AchievementLocalState['progress'])
        : {};
    return { unlocked, progress };
  } catch {
    return emptyState();
  }
}

function writeState(state: AchievementLocalState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isAchievementUnlockedLocally(id: WarpAchievementId): boolean {
  return readState().unlocked.includes(id);
}

export function markAchievementUnlockedLocally(id: WarpAchievementId): void {
  const state = readState();
  if (state.unlocked.includes(id)) {
    return;
  }
  writeState({
    unlocked: [...state.unlocked, id],
    progress: state.progress,
  });
}

export function getAchievementProgressLocally(id: WarpAchievementId): number {
  return readState().progress[id] ?? 0;
}

/** Returns the new progress value after clamping to `steps`. */
export function setAchievementProgressLocally(
  id: WarpAchievementId,
  current: number,
  steps: number
): number {
  const next = Math.max(0, Math.min(steps, Math.floor(current)));
  const state = readState();
  writeState({
    unlocked: state.unlocked,
    progress: { ...state.progress, [id]: next },
  });
  return next;
}

/** Test helper — clears local achievement state. */
export function resetAchievementLocalState(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
