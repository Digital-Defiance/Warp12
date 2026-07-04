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

const MIN_SCALE = 0.35;
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
}: TableViewportProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  );

  const clampScale = (next: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

  const zoomBy = useCallback((delta: number) => {
    setScale((current) => clampScale(Number((current + delta).toFixed(2))));
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

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
      if (event.button !== 0) {
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
    [pan.x, pan.y]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div className={styles.viewport}>
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
            {focusControl ? (
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
        <div className={styles.viewportControls} aria-label="Table view controls">
          <button type="button" className={styles.viewportBtn} onClick={() => zoomBy(ZOOM_STEP)}>
            Zoom in
          </button>
          <button type="button" className={styles.viewportBtn} onClick={() => zoomBy(-ZOOM_STEP)}>
            Zoom out
          </button>
          <button type="button" className={styles.viewportBtn} onClick={resetView}>
            Reset view
          </button>
          <span className={styles.viewportScale}>{Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
