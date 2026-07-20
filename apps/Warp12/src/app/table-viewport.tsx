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
import {
  FOLLOW_RETURN_EASE_MS,
  interpolatePan,
  pulseStartDelayMs,
  sanitizeAutoFollowReturnDelayMs,
  type PanVector,
} from './follow-snap-back.js';
import { RoundLogIcon } from './round-image-icons';
import styles from './table-viewport.module.scss';

const MIN_SCALE_DESKTOP = 0.35;
const MIN_SCALE_COMPACT = 0.2;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;

export type LogVisibilityMode = 'all' | 'mine' | 'commentator' | 'off';

const LOG_CONTROL_LABEL: Record<LogVisibilityMode, string> = {
  all: 'Comms log: All captains (tap for Yourself)',
  mine: 'Comms log: Yourself (tap for Commentator)',
  commentator: 'Comms log: Commentator (tap to silence)',
  off: 'Comms log: Silenced (tap for All captains)',
};

const LOG_CONTROL_GLYPH: Record<LogVisibilityMode, string> = {
  all: '📡',
  mine: '👤',
  commentator: '🎙️',
  off: '📵',
};

/** Cycle: all captains → yourself → commentator → silenced. */
export function nextLogVisibilityMode(
  mode: LogVisibilityMode
): LogVisibilityMode {
  switch (mode) {
    case 'all':
      return 'mine';
    case 'mine':
      return 'commentator';
    case 'commentator':
      return 'off';
    case 'off':
      return 'all';
  }
}

export interface TableViewportFocusTarget {
  x: number;
  y: number;
  key: string;
}

export interface TableViewportFocusControl {
  active: boolean;
  onToggle: () => void;
}
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

export interface TableViewportHostModControl {
  onOpen: () => void;
}

export interface TableViewportLogDialogControl {
  onOpen: () => void;
}

/** Pick where follow-chart pans should aim (crosshair on the table). */
export interface TableViewportSetFollowFocusControl {
  /** Currently waiting for a table click. */
  active: boolean;
  /** False when follow-charted-tiles is off. */
  enabled: boolean;
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
  /** Opens the full sector / round log dialog (book icon). */
  logDialogControl?: TableViewportLogDialogControl;
  /** Online host: opens host moderation controls (after set-focus when shown). */
  hostModControl?: TableViewportHostModControl;
  /** Set follow focus point (crosshair; leftmost when follow-chart is on). */
  setFollowFocusControl?: TableViewportSetFollowFocusControl;
  commsControl?: TableViewportCommsControl;
  autoFollowAction?: boolean;
  /** Ease back to the pre-jump pan after a dwell. */
  autoFollowReturn?: boolean;
  /** Dwell before snap-back (ms). */
  autoFollowReturnDelayMs?: number;
  /** Viewport focus for auto-follow (0–1). Default center. */
  followFocusNormX?: number;
  followFocusNormY?: number;
  /**
   * When true, the next click on the surface sets follow focus and calls
   * `onFollowFocusNormChange`, then exits pick mode via `onSetFocusModeChange(false)`.
   */
  setFocusMode?: boolean;
  onSetFocusModeChange?: (active: boolean) => void;
  onFollowFocusNormChange?: (norm: { x: number; y: number }) => void;
  actionFocus?: TableViewportFocusTarget | null;
  /**
   * Increment to abort a pending snap-back (e.g. Fleet Status / Sector HUD
   * pointer interaction outside the viewport).
   */
  followReturnCancelSignal?: number;
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
  logDialogControl,
  hostModControl,
  setFollowFocusControl,
  commsControl,
  autoFollowAction = false,
  autoFollowReturn = false,
  autoFollowReturnDelayMs = 2000,
  followFocusNormX = 0.5,
  followFocusNormY = 0.5,
  setFocusMode = false,
  onSetFocusModeChange,
  onFollowFocusNormChange,
  actionFocus = null,
  followReturnCancelSignal = 0,
  compactLayout = false,
}: TableViewportProps) {
  const minScale = compactLayout ? MIN_SCALE_COMPACT : MIN_SCALE_DESKTOP;
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pulseActive, setPulseActive] = useState(false);
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

  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const originPanRef = useRef<PanVector | null>(null);
  const sessionActiveRef = useRef(false);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const easeRafRef = useRef<number | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);
  const lastCancelSignalRef = useRef(followReturnCancelSignal);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const clearFollowTimers = useCallback(() => {
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (pulseTimerRef.current != null) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    if (easeRafRef.current != null) {
      cancelAnimationFrame(easeRafRef.current);
      easeRafRef.current = null;
    }
    setPulseActive(false);
  }, []);

  const endFollowSession = useCallback(() => {
    clearFollowTimers();
    originPanRef.current = null;
    sessionActiveRef.current = false;
  }, [clearFollowTimers]);

  /** User interaction: abandon return and forget the origin. */
  const abortFollowReturnForUser = useCallback(() => {
    if (!sessionActiveRef.current && dwellTimerRef.current == null && easeRafRef.current == null) {
      return;
    }
    endFollowSession();
  }, [endFollowSession]);

  const startEaseToOrigin = useCallback(() => {
    const origin = originPanRef.current;
    if (!origin) {
      endFollowSession();
      return;
    }
    clearFollowTimers();
    const from = { ...panRef.current };
    const startedAt = performance.now();

    const frame = (now: number) => {
      const t = Math.min(1, (now - startedAt) / FOLLOW_RETURN_EASE_MS);
      setPan(interpolatePan(from, origin, t));
      if (t < 1) {
        easeRafRef.current = requestAnimationFrame(frame);
        return;
      }
      easeRafRef.current = null;
      endFollowSession();
    };
    easeRafRef.current = requestAnimationFrame(frame);
  }, [clearFollowTimers, endFollowSession]);

  const scheduleFollowReturn = useCallback(
    (focus: TableViewportFocusTarget) => {
      clearFollowTimers();
      if (!autoFollowReturn) {
        return;
      }
      const dwellMs = sanitizeAutoFollowReturnDelayMs(autoFollowReturnDelayMs);
      const pulseDelay = pulseStartDelayMs(dwellMs);

      pulseTimerRef.current = setTimeout(() => {
        setPulseActive(true);
      }, pulseDelay);

      dwellTimerRef.current = setTimeout(() => {
        dwellTimerRef.current = null;
        // Keep pulse through the ease, then clear in endFollowSession.
        startEaseToOrigin();
      }, dwellMs);

      // Silence unused focus in schedule (key already applied); kept for clarity.
      void focus;
    },
    [
      autoFollowReturn,
      autoFollowReturnDelayMs,
      clearFollowTimers,
      startEaseToOrigin,
    ]
  );

  const clampScale = useCallback(
    (next: number) => Math.min(MAX_SCALE, Math.max(minScale, next)),
    [minScale]
  );

  const applyFitView = useCallback(
    (abortFollow = true) => {
      if (abortFollow) {
        abortFollowReturnForUser();
      }
      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }
      const { width, height } = surface.getBoundingClientRect();
      const fit = computeFitView(width, height, tableWidth, tableHeight, minScale);
      setScale(fit.scale);
      setPan(fit.pan);
    },
    [abortFollowReturnForUser, minScale, tableHeight, tableWidth]
  );

  const zoomBy = useCallback(
    (delta: number) => {
      abortFollowReturnForUser();
      setScale((current) => clampScale(Number((current + delta).toFixed(2))));
    },
    [abortFollowReturnForUser, clampScale]
  );

  const resetView = useCallback(() => {
    abortFollowReturnForUser();
    if (compactLayout) {
      applyFitView();
      return;
    }
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [abortFollowReturnForUser, applyFitView, compactLayout]);

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
      applyFitView(false);
    });
    observer.observe(surface);
    return () => {
      observer.disconnect();
    };
  }, [applyFitView, compactLayout]);

  // Follow charted tiles + optional snap-back session.
  useEffect(() => {
    if (!autoFollowAction || !actionFocus) {
      lastFocusKeyRef.current = null;
      return;
    }
    if (lastFocusKeyRef.current === actionFocus.key) {
      return;
    }
    lastFocusKeyRef.current = actionFocus.key;

    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const { width, height } = surface.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      return;
    }

    // New chart mid-dwell: cancel pending return/ease, keep original origin.
    clearFollowTimers();

    if (!sessionActiveRef.current || originPanRef.current == null) {
      originPanRef.current = { ...panRef.current };
      sessionActiveRef.current = true;
    }

    setPan(
      panToCenterContentPoint(
        width,
        height,
        scaleRef.current,
        actionFocus.x,
        actionFocus.y,
        followFocusNormX,
        followFocusNormY
      )
    );

    if (autoFollowReturn) {
      scheduleFollowReturn(actionFocus);
    } else {
      // Follow without return — no sticky session.
      endFollowSession();
    }
  }, [
    actionFocus,
    autoFollowAction,
    autoFollowReturn,
    clearFollowTimers,
    endFollowSession,
    followFocusNormX,
    followFocusNormY,
    scheduleFollowReturn,
  ]);

  // Follow without return — drop any pending snap-back session.
  useEffect(() => {
    if (!autoFollowReturn || !autoFollowAction) {
      endFollowSession();
    }
  }, [autoFollowAction, autoFollowReturn, endFollowSession]);

  // External cancel (Fleet Status / Sector HUD, etc.).
  useEffect(() => {
    if (followReturnCancelSignal === lastCancelSignalRef.current) {
      return;
    }
    lastCancelSignalRef.current = followReturnCancelSignal;
    abortFollowReturnForUser();
  }, [abortFollowReturnForUser, followReturnCancelSignal]);

  useEffect(() => {
    return () => {
      clearFollowTimers();
    };
  }, [clearFollowTimers]);

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      abortFollowReturnForUser();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomBy(delta);
    },
    [abortFollowReturnForUser, zoomBy]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (setFocusMode) {
        const surface = surfaceRef.current;
        if (surface && event.button === 0) {
          const rect = surface.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;
            onFollowFocusNormChange?.({
              x: Math.min(0.92, Math.max(0.08, x)),
              y: Math.min(0.92, Math.max(0.08, y)),
            });
            onSetFocusModeChange?.(false);
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      abortFollowReturnForUser();
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
    [
      abortFollowReturnForUser,
      onFollowFocusNormChange,
      onSetFocusModeChange,
      pan.x,
      pan.y,
      scale,
      setFocusMode,
    ]
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

  useEffect(() => {
    if (!setFocusMode) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSetFocusModeChange?.(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSetFocusModeChange, setFocusMode]);

  return (
    <div
      className={styles.viewport}
      data-compact={compactLayout ? 'true' : undefined}
      data-set-focus={setFocusMode ? 'true' : undefined}
    >
      {setFocusMode ? (
        <p className={styles.setFocusBanner} role="status">
          Click the table to set follow focus. Escape cancels.
        </p>
      ) : null}
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
            {pulseActive && actionFocus ? (
              <div
                className={styles.followPulse}
                style={{
                  left: `${actionFocus.x}px`,
                  top: `${actionFocus.y}px`,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.viewportHud}>
        {soundControl ||
        focusControl ||
        logControl ||
        logDialogControl ||
        hostModControl ||
        setFollowFocusControl ||
        commsControl ? (
          <div className={styles.viewportToolbar}>
            {setFollowFocusControl?.enabled ? (
              <button
                type="button"
                className={`${styles.hudIconToggle} ${styles.hudIconToggleGhost}`}
                aria-pressed={setFollowFocusControl.active}
                aria-label={
                  setFollowFocusControl.active
                    ? 'Cancel set follow focus'
                    : 'Set follow focus — click the table'
                }
                title={
                  setFollowFocusControl.active
                    ? 'Cancel set focus'
                    : 'Set follow focus'
                }
                onClick={setFollowFocusControl.onToggle}
              >
                <span className={styles.hudCrosshair} aria-hidden />
              </button>
            ) : null}
            {hostModControl ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-label="Open host controls"
                title="Host controls"
                onClick={hostModControl.onOpen}
              >
                <span
                  className={styles.hudIconToggleMask}
                  style={{
                    maskImage: 'url(/user-headset-duotone-solid-full.svg)',
                    WebkitMaskImage: 'url(/user-headset-duotone-solid-full.svg)',
                  }}
                  aria-hidden
                />
              </button>
            ) : null}
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
            {logDialogControl ? (
              <button
                type="button"
                className={styles.hudIconToggle}
                aria-label="Open sector log"
                title="Sector log"
                onClick={logDialogControl.onOpen}
              >
                <RoundLogIcon className={styles.hudIconToggleSvg} />
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
