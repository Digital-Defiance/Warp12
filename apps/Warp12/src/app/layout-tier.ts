/** Layout breakpoints — orientation-safe via shortest viewport edge. */
export const LAYOUT_TIER_PHONE_MAX = 600;
export const LAYOUT_TIER_TABLET_MAX = 900;

export type LayoutTier = 'phone' | 'tablet' | 'desktop';

export function resolveLayoutTier(
  width: number,
  height: number
): LayoutTier {
  const minEdge = Math.min(width, height);
  if (minEdge < LAYOUT_TIER_PHONE_MAX) {
    return 'phone';
  }
  if (minEdge < LAYOUT_TIER_TABLET_MAX) {
    return 'tablet';
  }
  return 'desktop';
}

export function isCompactLayoutTier(tier: LayoutTier): boolean {
  return tier === 'phone';
}

export type LayoutOrientation = 'portrait' | 'landscape';

export function resolveLayoutOrientation(
  width: number,
  height: number
): LayoutOrientation {
  return width > height ? 'landscape' : 'portrait';
}

export function isPhoneLandscape(
  tier: LayoutTier,
  width: number,
  height: number
): boolean {
  return tier === 'phone' && resolveLayoutOrientation(width, height) === 'landscape';
}

export function requiresPortraitLock(
  tier: LayoutTier,
  orientation: LayoutOrientation
): boolean {
  return tier === 'phone' && orientation === 'landscape';
}

/** Phone round-end summaries are portrait-first. */
export function shouldNudgePortraitForSummary(
  tier: LayoutTier,
  orientation: LayoutOrientation
): boolean {
  return requiresPortraitLock(tier, orientation);
}
