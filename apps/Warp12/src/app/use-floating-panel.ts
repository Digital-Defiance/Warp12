import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export type FloatingPanelAnchor = 'bottom-left' | 'bottom-right' | 'top-right';

/** Where the panel may be dragged / clamped. */
export type FloatingPanelBounds = 'container' | 'viewport';

interface StoredPosition {
  x: number;
  y: number;
}

const MIN_PANEL_HEIGHT = 140;

function heightStorageKey(storageKey: string): string {
  return `${storageKey}:height`;
}

function readStoredPosition(storageKey: string): StoredPosition | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredPosition;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredPosition(
  storageKey: string,
  position: StoredPosition | null
): void {
  try {
    if (!position) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // ignore quota / private mode
  }
}

function readStoredHeight(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(heightStorageKey(storageKey));
    if (!raw) {
      return null;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= MIN_PANEL_HEIGHT ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredHeight(storageKey: string, height: number | null): void {
  try {
    if (height == null) {
      localStorage.removeItem(heightStorageKey(storageKey));
      return;
    }
    localStorage.setItem(heightStorageKey(storageKey), String(Math.round(height)));
  } catch {
    // ignore quota / private mode
  }
}

function viewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function useFloatingPanel(
  containerRef: RefObject<HTMLElement | null>,
  storageKey: string,
  defaultAnchor: FloatingPanelAnchor = 'bottom-left',
  bounds: FloatingPanelBounds = 'viewport'
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startY: number;
    startHeight: number;
    top: number;
  } | null>(null);
  const [position, setPosition] = useState<StoredPosition | null>(() =>
    readStoredPosition(storageKey)
  );
  const [useDefaultAnchor, setUseDefaultAnchor] = useState(
    () => readStoredPosition(storageKey) === null
  );
  const [height, setHeight] = useState<number | null>(() =>
    readStoredHeight(storageKey)
  );

  const maxPanelHeight = useCallback(() => {
    if (bounds === 'viewport') {
      return Math.max(MIN_PANEL_HEIGHT, viewportSize().height - 24);
    }
    const container = containerRef.current;
    if (!container) {
      return Math.max(MIN_PANEL_HEIGHT, viewportSize().height - 24);
    }
    return Math.max(MIN_PANEL_HEIGHT, container.clientHeight - 24);
  }, [bounds, containerRef]);

  const clampHeight = useCallback(
    (next: number) =>
      Math.min(maxPanelHeight(), Math.max(MIN_PANEL_HEIGHT, Math.round(next))),
    [maxPanelHeight]
  );

  const clampPosition = useCallback(
    (nextX: number, nextY: number) => {
      const panel = panelRef.current;
      if (!panel) {
        return { x: nextX, y: nextY };
      }
      if (bounds === 'viewport') {
        const { width, height: viewH } = viewportSize();
        const maxX = Math.max(0, width - panel.offsetWidth);
        const maxY = Math.max(0, viewH - panel.offsetHeight);
        return {
          x: Math.min(maxX, Math.max(0, nextX)),
          y: Math.min(maxY, Math.max(0, nextY)),
        };
      }
      const container = containerRef.current;
      if (!container) {
        return { x: nextX, y: nextY };
      }
      const maxX = Math.max(0, container.clientWidth - panel.offsetWidth);
      const maxY = Math.max(0, container.clientHeight - panel.offsetHeight);
      return {
        x: Math.min(maxX, Math.max(0, nextX)),
        y: Math.min(maxY, Math.max(0, nextY)),
      };
    },
    [bounds, containerRef]
  );

  const resolvePosition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) {
      return { x: 12, y: 12 };
    }
    const panelRect = panel.getBoundingClientRect();
    if (bounds === 'viewport') {
      return { x: panelRect.left, y: panelRect.top };
    }
    const container = containerRef.current;
    if (!container) {
      return { x: 12, y: 12 };
    }
    const containerRect = container.getBoundingClientRect();
    return {
      x: panelRect.left - containerRect.left,
      y: panelRect.top - containerRect.top,
    };
  }, [bounds, containerRef]);

  /** Lock current on-screen box to top/left so height resize grows downward. */
  const pinToCurrentPosition = useCallback(() => {
    if (!useDefaultAnchor) {
      return resolvePosition();
    }
    const origin = resolvePosition();
    setUseDefaultAnchor(false);
    setPosition(origin);
    return origin;
  }, [resolvePosition, useDefaultAnchor]);

  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const origin = pinToCurrentPosition();
      dragRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pinToCurrentPosition]
  );

  const onHeaderPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      setPosition(
        clampPosition(
          drag.originX + (event.clientX - drag.pointerX),
          drag.originY + (event.clientY - drag.pointerY)
        )
      );
    },
    [clampPosition]
  );

  const onHeaderPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    []
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      pinToCurrentPosition();
      const rect = panel.getBoundingClientRect();
      const startHeight = height ?? rect.height;
      setHeight(clampHeight(startHeight));
      resizeRef.current = {
        startY: event.clientY,
        startHeight,
        top: rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clampHeight, height, pinToCurrentPosition]
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const resize = resizeRef.current;
      if (!resize) {
        return;
      }
      // Keep top edge fixed; bottom edge follows the pointer.
      const next = event.clientY - resize.top;
      setHeight(clampHeight(next));
    },
    [clampHeight]
  );

  const onResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    []
  );

  useEffect(() => {
    if (useDefaultAnchor || !position) {
      writeStoredPosition(storageKey, null);
      return;
    }
    writeStoredPosition(storageKey, position);
  }, [position, storageKey, useDefaultAnchor]);

  useEffect(() => {
    writeStoredHeight(storageKey, height);
  }, [height, storageKey]);

  useEffect(() => {
    const reclamp = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }
        return clampPosition(current.x, current.y);
      });
      setHeight((current) => (current == null ? current : clampHeight(current)));
    };

    if (bounds === 'viewport') {
      window.addEventListener('resize', reclamp);
      return () => {
        window.removeEventListener('resize', reclamp);
      };
    }

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }
    const containerObserver = new ResizeObserver(reclamp);
    containerObserver.observe(container);
    return () => {
      containerObserver.disconnect();
    };
  }, [bounds, clampHeight, clampPosition, containerRef]);

  const anchor = useDefaultAnchor ? defaultAnchor : 'custom';
  const style: CSSProperties = {
    ...(anchor === 'custom'
      ? {
          left: `${position?.x ?? 12}px`,
          top: `${position?.y ?? 12}px`,
          right: 'auto',
          bottom: 'auto',
        }
      : {}),
    ...(height != null ? { height: `${height}px` } : {}),
  };

  return {
    panelRef,
    anchor,
    style,
    bounds,
    height,
    headerHandlers: {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerUp,
    },
    resizeHandlers: {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerUp,
    },
  };
}
