import type { LayoutOrientation, LayoutTier } from './layout-tier.js';
import { shouldNudgePortraitForSummary } from './layout-tier.js';

export function shouldShowPortraitLock(
  tier: LayoutTier,
  orientation: LayoutOrientation
): boolean {
  return shouldNudgePortraitForSummary(tier, orientation);
}

/** Best-effort native lock; unsupported in iOS Safari (overlay still shown). */
export async function tryLockPortraitOrientation(): Promise<void> {
  if (typeof screen === 'undefined') {
    return;
  }
  // ScreenOrientation.lock() is standard but missing from the DOM lib types in
  // this TS target; cast to reach it (guarded below for unsupported webviews).
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  if (!orientation || typeof orientation.lock !== 'function') {
    return;
  }
  try {
    await orientation.lock('portrait-primary');
  } catch {
    // Fullscreen-only or unsupported — overlay handles the rest.
  }
}

export function unlockPortraitOrientation(): void {
  if (typeof screen === 'undefined') {
    return;
  }
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Ignore unlock failures.
  }
}
