/**
 * Platform achievement unlock API (Play Games / Game Center).
 *
 * Web and desktop no-op after local dedupe. Mobile invokes Tauri commands that
 * will call the native plugin once Phase 2 lands.
 */

import { isTauriMobile, isTauriRuntime } from '../../firebase/platform.js';
import {
  getWarpAchievement,
  type WarpAchievementId,
} from './catalog.js';
import {
  getAchievementProgressLocally,
  isAchievementUnlockedLocally,
  markAchievementUnlockedLocally,
  setAchievementProgressLocally,
} from './local-state.js';

export type AchievementUnlockStatus =
  | 'unlocked'
  | 'already_unlocked'
  | 'progressed'
  | 'skipped_web'
  | 'skipped_desktop'
  | 'native_pending'
  | 'missing_platform_id'
  | 'unknown_id'
  | 'error';

export interface AchievementUnlockResult {
  readonly id: WarpAchievementId;
  readonly status: AchievementUnlockStatus;
  readonly detail?: string;
}

async function invokeNativeUnlock(
  id: WarpAchievementId,
  playGamesId: string | undefined,
  gameCenterId: string | undefined
): Promise<AchievementUnlockResult> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const native = await invoke<{
      status?: string;
      detail?: string;
    }>('plugin:warp-achievements|unlock', {
      id,
      playGamesId: playGamesId ?? null,
      gameCenterId: gameCenterId ?? null,
    });
    return {
      id,
      status: (native.status as AchievementUnlockStatus) ?? 'native_pending',
      detail: native.detail,
    };
  } catch (err) {
    return {
      id,
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function invokeNativeProgress(
  id: WarpAchievementId,
  current: number,
  steps: number,
  playGamesId: string | undefined,
  gameCenterId: string | undefined
): Promise<AchievementUnlockResult> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const native = await invoke<{
      status?: string;
      detail?: string;
    }>('plugin:warp-achievements|progress', {
      id,
      current,
      steps,
      playGamesId: playGamesId ?? null,
      gameCenterId: gameCenterId ?? null,
    });
    return {
      id,
      status: (native.status as AchievementUnlockStatus) ?? 'native_pending',
      detail: native.detail,
    };
  } catch (err) {
    return {
      id,
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Unlock a standard (non-incremental) achievement.
 * Safe to call repeatedly — local dedupe + platform idempotency.
 */
export async function unlockAchievement(
  id: WarpAchievementId
): Promise<AchievementUnlockResult> {
  const def = getWarpAchievement(id);
  if (!def) {
    return { id, status: 'unknown_id' };
  }
  if (def.steps != null) {
    return progressAchievement(id, def.steps);
  }
  if (isAchievementUnlockedLocally(id)) {
    return { id, status: 'already_unlocked' };
  }

  if (!isTauriRuntime()) {
    return { id, status: 'skipped_web' };
  }
  if (!isTauriMobile()) {
    return { id, status: 'skipped_desktop' };
  }

  const native = await invokeNativeUnlock(
    id,
    def.playGamesId,
    def.gameCenterId
  );
  if (native.status === 'unlocked') {
    markAchievementUnlockedLocally(id);
  }
  return native;
}

/**
 * Report incremental progress. Unlocks when `current >= steps`.
 */
export async function progressAchievement(
  id: WarpAchievementId,
  current: number
): Promise<AchievementUnlockResult> {
  const def = getWarpAchievement(id);
  if (!def) {
    return { id, status: 'unknown_id' };
  }
  const steps = def.steps ?? 1;
  if (isAchievementUnlockedLocally(id)) {
    return { id, status: 'already_unlocked' };
  }

  const previous = getAchievementProgressLocally(id);
  const next = setAchievementProgressLocally(id, current, steps);
  if (next <= previous && next < steps) {
    return { id, status: 'progressed', detail: `unchanged:${next}/${steps}` };
  }

  if (!isTauriRuntime()) {
    if (next >= steps) {
      markAchievementUnlockedLocally(id);
    }
    return {
      id,
      status: next >= steps ? 'unlocked' : 'skipped_web',
      detail: `${next}/${steps}`,
    };
  }
  if (!isTauriMobile()) {
    if (next >= steps) {
      markAchievementUnlockedLocally(id);
    }
    return {
      id,
      status: next >= steps ? 'unlocked' : 'skipped_desktop',
      detail: `${next}/${steps}`,
    };
  }

  const native = await invokeNativeProgress(
    id,
    next,
    steps,
    def.playGamesId,
    def.gameCenterId
  );
  if (native.status === 'unlocked') {
    markAchievementUnlockedLocally(id);
  }
  return {
    ...native,
    status:
      native.status === 'unlocked'
        ? 'unlocked'
        : native.status === 'error'
          ? 'error'
          : 'progressed',
    detail: native.detail ?? `${next}/${steps}`,
  };
}

/** Open the platform achievements UI when available. */
export async function showAchievementsUi(): Promise<boolean> {
  if (!isTauriMobile()) {
    return false;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:warp-achievements|show_ui');
    return true;
  } catch {
    return false;
  }
}

export { WARP_ACHIEVEMENTS, getWarpAchievement } from './catalog.js';
export type { WarpAchievement, WarpAchievementId } from './catalog.js';
