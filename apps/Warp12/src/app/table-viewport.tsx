import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import { panToCenterContentPoint } from 'warp12-react';
import styles from './table-viewport.module.scss';

const MIN_SCALE_DESKTOP = 0.35;
const MIN_SCALE_COMPACT = 0.2;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;

const LOG_CONTROL_LABEL: Record<'all' | 'mine' | 'off', string> = {
  all: 'Comms log: Fleet (tap for Captain-only)',
  mine: 'Comms log: Captain only (tap to silence)',
  off: 'Comms log: Silenced (tap to show Fleet)',
};

const LOG_CONTROL_GLYPH: Record<'all' | 'mine' | 'off', string> = {
  all: '📡',
  mine: '👤',
  off: '📵',
};

export interface TableViewportFocusTarget {
  x: number;
  y: number;
  key: string;
}

export interface TableViewportFocusControl {
  active: boolean;
  onToggle: () => void;
}

export type LogVisibilityMode = 'all' | 'mine' | 'off';

export interface TableViewportLogControl {
  mode: LogVisibilityMode;
  onCycle: () => void;
}

export interface TableViewportSoundControl {
  muted: boolean;
  onToggle: () => void;
}

export interface TableViewportCommsControl {
  open: boolean;
  onToggle: () => void;
}

export interface TableViewportProps {
  tableWidth: number;
  tableHeight: number;
  children: React.ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  focusControl?: TableViewportFocusControl;
  soundControl?: TableViewportSoundControl;
  logControl?: TableViewportLogControl;
  commsControl?: TableViewportCommsControl;
  autoFollowAction?: boolean;
  actionFocus?: TableViewportFocusTarget | null;
  /** Phone layout: lower min zoom, pinch-to-zoom, auto-fit table in view. */
  compactLayout?: boolean;
}

interface PointerSample {
  x: number;
  y: number;
}

function distance(a: PointerSample, b: PointerSample): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function computeFitView(
  surfaceWidth: number,
  surfaceHeight: number,
  tableWidth: number,
  tableHeight: number,
  minScale: number
): { scale: number; pan: { x: number; y: number } } {
  if (surfaceWidth <= 0 || surfaceHeight <= 0) {
    return { scale: 1, pan: { x: 0, y: 0 } };
  }
  const fit = Math.min(surfaceWidth / tableWidth, surfaceHeight / tableHeight) * 0.96;
  const scale = Math.max(minScale, Math.min(MAX_SCALE, fit));
  return {
    scale,
    pan: {
      x: (surfaceWidth - tableWidth * scale) / 2,
      y: (surfaceHeight - tableHeight * scale) / 2,
    },
  };
}

export function TableViewport({
  tableWidth,
  tableHeight,
  children,
  contentRef,
  focusControl,
  soundControl,
  logControl,
  commsControl,
  autoFollowAction = false,
  actionFocus = null,
  compactLayout = false,
}: TableViewportProps) {
  const minScale = compactLayout ? MIN_SCALE_COMPACT : MIN_SCALE_DESKTOP;
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  );
  const pointersRef = useRef(new Map<number, PointerSample>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    panX: number;
    panY: number;
  } | null>(null);

  const clampScale = useCallback(
    (next: number) => Math.min(MAX_SCALE, Math.max(minScale, next)),
    [minScale]
  );

  const applyFitView = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const { width, height } = surface.getBoundingClientRect();
    const fit = computeFitView(width, height, tableWidth, tableHeight, minScale);
    setScale(fit.scale);
    setPan(fit.pan);
  }, [minScale, tableHeight, tableWidth]);

  const zoomBy = useCallback(
    (delta: number) => {
      setScale((current) => clampScale(Number((current + delta).toFixed(2))));
    },
    [clampScale]
  );

  const resetView = useCallback(() => {
    if (compactLayout) {
      applyFitView();
      return;
    }
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [applyFitView, compactLayout]);

  useEffect(() => {
    if (!compactLayout) {
      return;
    }
    applyFitView();
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      applyFitView();
    });
    observer.observe(surface);
    return () => {
      observer.disconnect();
    };
  }, [applyFitView, compactLayout]);

  useEffect(() => {
    if (!autoFollowAction || !actionFocus) {
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const { width, height } = surface.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }
    setPan(panToCenterContentPoint(width, height, scale, actionFocus.x, actionFocus.y));
  }, [actionFocus?.key, autoFollowAction, scale]);

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomBy(delta);
    },
    [zoomBy]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (pointersRef.current.size === 2) {
        dragRef.current = null;
        const [first, second] = [...pointersRef.current.values()];
        pinchRef.current = {
          distance: distance(first, second),
          scale,
          panX: pan.x,
          panY: pan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (event.button !== 0 || pointersRef.current.size > 1) {
        return;
      }
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y, scale]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }

      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const [first, second] = [...pointersRef.current.values()];
        const nextDistance = distance(first, second);
        if (nextDistance > 0 && pinchRef.current.distance > 0) {
          const ratio = nextDistance / pinchRef.current.distance;
          setScale(clampScale(Number((pinchRef.current.scale * ratio).toFixed(3))));
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      setPan({
        x: drag.panX + (event.clientX - drag.x),
        y: drag.panY + (event.clientY - drag.y),
      });
    },
    [clampScale]
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div className={styles.viewport} data-compact={compactLayout ? 'true' : undefined}>
      <div
        ref={surfaceRef}
        className={styles.viewportSurface}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={styles.viewportCanvas}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <div
            ref={contentRef}
            className={styles.viewportContent}
            style={{
              width: `${tableWidth}px`,
              height: `${tableHeight}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>

      <div className={styles.viewportHud}>
        {soundControl || focusControl || logControl || commsControl ? (
          <div className={styles.viewportToolbar}>
            {logControl ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-pressed={logControl.mode !== 'off'}
                aria-label={LOG_CONTROL_LABEL[logControl.mode]}
                title={LOG_CONTROL_LABEL[logControl.mode]}
                onClick={logControl.onCycle}
              >
                <span className={styles.hudIconToggleGlyph} aria-hidden>
                  {LOG_CONTROL_GLYPH[logControl.mode]}
                </span>
              </button>
            ) : null}
            {soundControl ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-pressed={soundControl.muted}
                aria-label={soundControl.muted ? 'Unmute bridge sounds' : 'Mute bridge sounds'}
                title={soundControl.muted ? 'Unmute sounds' : 'Mute sounds'}
                onClick={soundControl.onToggle}
              >
                <span className={styles.hudIconToggleGlyph} aria-hidden>
                  {soundControl.muted ? '🔇' : '🔊'}
                </span>
              </button>
            ) : null}
            {commsControl ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-pressed={commsControl.open}
                aria-label={commsControl.open ? 'Close subspace comms' : 'Open subspace comms'}
                title={commsControl.open ? 'Close comms' : 'Subspace comms'}
                onClick={commsControl.onToggle}
              >
                <span className={styles.hudIconToggleGlyph} aria-hidden>
                  💬
                </span>
              </button>
            ) : null}
            {focusControl && !compactLayout ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-pressed={focusControl.active}
                aria-label={
                  focusControl.active ? 'Restore standard layout' : 'Expand play area'
                }
                title={focusControl.active ? 'Exit focus mode' : 'Focus mode'}
                onClick={focusControl.onToggle}
              >
                <span className={styles.hudIconToggleGlyph} aria-hidden>
                  {focusControl.active ? '▣' : '⛶'}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          className={styles.viewportControls}
          data-compact={compactLayout ? 'true' : undefined}
          aria-label="Table view controls"
        >
          <button type="button" className={styles.viewportBtn} onClick={() => zoomBy(ZOOM_STEP)}>
            Zoom in
          </button>
          <button type="button" className={styles.viewportBtn} onClick={() => zoomBy(-ZOOM_STEP)}>
            Zoom out
          </button>
          <button type="button" className={styles.viewportBtn} onClick={resetView}>
            {compactLayout ? 'Fit table' : 'Reset view'}
          </button>
          <span className={styles.viewportScale}>{Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
