import {
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { WARP_FACTORS, type WarpFactor, isWarpFactor } from 'warp12-engine';

import { getWarpFactor } from './warp-factor';
import styles from './factor-gauge.module.scss';

/** SVG face centre — shared by warp-9/12/15/18.svg (not geometric 256,256). */
const GAUGE_CX = 261.12;
const GAUGE_CY = 256;
const GAUGE_R = 204.8;
const VIEWBOX = 512;
/** Eighteen circumference dashes, 20° apart, tick 0 at 12 o'clock, clockwise. */
const TICK_COUNT = 18;
const DEGREES_PER_TICK = 360 / TICK_COUNT;

const GAUGE_SRC: Record<WarpFactor, string> = {
  9: '/warp-9.svg',
  12: '/warp-12.svg',
  15: '/warp-15.svg',
  18: '/warp-18.svg',
};

export interface FactorGaugeProps {
  factor?: number;
  width?: number;
  /** When set, the dial is interactive and reports the warp zone under the pointer. */
  onFactorSelect?: (factor: WarpFactor) => void;
  disabled?: boolean;
}

/**
 * Map a circumference tick (0–17) to the warp factor that first illuminates it.
 *
 * Illumination is cumulative around the dial (matching warp-9/12/15/18.svg):
 * - Warp 9: top half — ticks 14–17 and 0–4
 * - Warp 12: + next 3 down the left — ticks 11–13
 * - Warp 15: + bottom arc — ticks 8–10 (all but the last 3)
 * - Warp 18: + last 3 on the lower right — ticks 5–7
 */
export function warpFactorFromTick(tick: number): WarpFactor {
  const t = ((Math.trunc(tick) % TICK_COUNT) + TICK_COUNT) % TICK_COUNT;
  // Exclusive click bands (clockwise from 12 o'clock):
  // 0–4 → 9, 5–7 → 18, 8–10 → 15, 11–13 → 12, 14–17 → 9
  if (t <= 4 || t >= 14) return 9;
  if (t <= 7) return 18;
  if (t <= 10) return 15;
  return 12;
}

/** Degrees clockwise from 12 o'clock → nearest dash index 0–17. */
export function tickFromDegreesCw(degreesCwFromTop: number): number {
  const normalized = ((degreesCwFromTop % 360) + 360) % 360;
  return Math.floor((normalized + DEGREES_PER_TICK / 2) / DEGREES_PER_TICK) % TICK_COUNT;
}

/**
 * Resolve a point in SVG viewBox space to a warp factor, or null outside the face.
 */
export function warpFactorFromViewBoxPoint(
  x: number,
  y: number
): WarpFactor | null {
  const dx = x - GAUGE_CX;
  const dy = y - GAUGE_CY;
  if (dx * dx + dy * dy > GAUGE_R * GAUGE_R) {
    return null;
  }
  // atan2(dx, -dy): 0 at top, clockwise positive (screen y grows downward).
  const degreesCw = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return warpFactorFromTick(tickFromDegreesCw(degreesCw));
}

function normalizeFactor(factor: number | undefined): WarpFactor {
  if (factor !== undefined && isWarpFactor(factor)) {
    return factor;
  }
  return getWarpFactor() ?? 12;
}

function factorIndex(factor: WarpFactor): number {
  return WARP_FACTORS.indexOf(factor);
}

export const FactorGauge: FC<FactorGaugeProps> = ({
  factor: factorProp,
  width = 512,
  onFactorSelect,
  disabled = false,
}) => {
  const labelId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const factor = normalizeFactor(factorProp);
  const interactive = Boolean(onFactorSelect) && !disabled;

  /** Live preview on press/drag so the needle art swaps before parent state catches up. */
  const [previewFactor, setPreviewFactor] = useState<WarpFactor | null>(null);
  const previewRef = useRef<WarpFactor | null>(null);
  const lastEmittedRef = useRef<WarpFactor>(factor);
  const displayFactor = previewFactor ?? factor;
  const draggingRef = useRef(false);

  useEffect(() => {
    lastEmittedRef.current = factor;
    if (previewRef.current !== null && previewRef.current === factor) {
      previewRef.current = null;
      setPreviewFactor(null);
    }
  }, [factor]);

  const commit = (next: WarpFactor) => {
    previewRef.current = next;
    setPreviewFactor(next);
    if (next !== lastEmittedRef.current) {
      lastEmittedRef.current = next;
      onFactorSelect?.(next);
    }
  };

  const resolveFromClient = (
    clientX: number,
    clientY: number
  ): WarpFactor | null => {
    const el = surfaceRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * VIEWBOX;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX;
    return warpFactorFromViewBoxPoint(x, y);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const next = resolveFromClient(event.clientX, event.clientY);
    if (next === null) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    commit(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !draggingRef.current) return;
    const next = resolveFromClient(event.clientX, event.clientY);
    if (next === null) return;
    if (next !== previewRef.current) {
      commit(next);
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Keep preview until `factor` prop matches so the art does not snap back.
  };

  const nudge = (delta: number) => {
    if (!interactive) return;
    const idx = factorIndex(displayFactor);
    const next = WARP_FACTORS[(idx + delta + WARP_FACTORS.length) % WARP_FACTORS.length];
    commit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        nudge(1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        nudge(-1);
        break;
      case 'Home':
        event.preventDefault();
        commit(WARP_FACTORS[0]);
        break;
      case 'End':
        event.preventDefault();
        commit(WARP_FACTORS[WARP_FACTORS.length - 1]);
        break;
      default:
        break;
    }
  };

  const img = (
    <img
      src={GAUGE_SRC[displayFactor]}
      alt=""
      width={width}
      height={width}
      draggable={false}
      className={styles.face}
    />
  );

  if (!interactive) {
    return (
      <div className={styles.root} style={{ width }}>
        <img
          src={GAUGE_SRC[displayFactor]}
          alt={`Warp ${displayFactor} gauge`}
          width={width}
          height={width}
          className={styles.face}
        />
      </div>
    );
  }

  const sliderIndex = factorIndex(displayFactor);

  return (
    <div className={styles.root} style={{ width }}>
      <p id={labelId} className="sr-only">
        Warp factor
      </p>
      <div
        ref={surfaceRef}
        className={styles.dial}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={WARP_FACTORS.length - 1}
        aria-valuenow={sliderIndex}
        aria-valuetext={`Warp ${displayFactor}`}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {img}
        <span className="sr-only">
          Drag around the dial or use arrow keys to choose Warp 9, 12, 15, or 18.
        </span>
      </div>
    </div>
  );
};
