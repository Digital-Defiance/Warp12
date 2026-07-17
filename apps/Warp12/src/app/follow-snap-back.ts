/** Ease duration for snap-back pan (keep snappy so last-play context holds). */
export const FOLLOW_RETURN_EASE_MS = 250;

/** Start the focus pulse this many ms before the return ease begins. */
export const FOLLOW_RETURN_PULSE_LEAD_MS = 400;

export const DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS = 2000;
export const MIN_AUTO_FOLLOW_RETURN_DELAY_MS = 300;
export const MAX_AUTO_FOLLOW_RETURN_DELAY_MS = 30_000;

export type PanVector = { readonly x: number; readonly y: number };

/** Cubic ease-in-out (smoothstep-ish) for camera return. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function interpolatePan(
  from: PanVector,
  to: PanVector,
  t: number
): PanVector {
  const e = easeInOutCubic(t);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
  };
}

export function sanitizeAutoFollowReturnDelayMs(value: unknown): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_AUTO_FOLLOW_RETURN_DELAY_MS;
  }
  return Math.min(
    MAX_AUTO_FOLLOW_RETURN_DELAY_MS,
    Math.max(MIN_AUTO_FOLLOW_RETURN_DELAY_MS, Math.round(n))
  );
}

/** When to start the pre-return pulse relative to the dwell deadline. */
export function pulseStartDelayMs(dwellMs: number): number {
  return Math.max(0, dwellMs - FOLLOW_RETURN_PULSE_LEAD_MS);
}
