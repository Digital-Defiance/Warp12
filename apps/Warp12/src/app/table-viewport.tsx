import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import styles from './table-viewport.module.scss';

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;

export interface TableViewportProps {
  tableWidth: number;
  tableHeight: number;
  children: React.ReactNode;
}

export function TableViewport({
  tableWidth,
  tableHeight,
  children,
}: TableViewportProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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

      <div
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
            width: `${tableWidth}px`,
            height: `${tableHeight}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
