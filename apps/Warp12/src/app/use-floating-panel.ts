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

interface StoredPosition {
  x: number;
  y: number;
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

export function useFloatingPanel(
  containerRef: RefObject<HTMLElement | null>,
  storageKey: string,
  defaultAnchor: FloatingPanelAnchor = 'bottom-left'
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [position, setPosition] = useState<StoredPosition | null>(() =>
    readStoredPosition(storageKey)
  );
  const [useDefaultAnchor, setUseDefaultAnchor] = useState(
    () => readStoredPosition(storageKey) === null
  );

  const clampPosition = useCallback(
    (nextX: number, nextY: number) => {
      const container = containerRef.current;
      const panel = panelRef.current;
      if (!container || !panel) {
        return { x: nextX, y: nextY };
      }
      const maxX = Math.max(0, container.clientWidth - panel.offsetWidth);
      const maxY = Math.max(0, container.clientHeight - panel.offsetHeight);
      return {
        x: Math.min(maxX, Math.max(0, nextX)),
        y: Math.min(maxY, Math.max(0, nextY)),
      };
    },
    [containerRef]
  );

  const resolvePosition = useCallback(() => {
    const container = containerRef.current;
    const panel = panelRef.current;
    if (!container || !panel) {
      return { x: 12, y: 12 };
    }
    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      x: panelRect.left - containerRect.left,
      y: panelRect.top - containerRect.top,
    };
  }, [containerRef]);

  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const origin = useDefaultAnchor
        ? resolvePosition()
        : (position ?? resolvePosition());
      if (useDefaultAnchor) {
        setUseDefaultAnchor(false);
        setPosition(origin);
      }
      dragRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position, resolvePosition, useDefaultAnchor]
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

  useEffect(() => {
    if (useDefaultAnchor || !position) {
      writeStoredPosition(storageKey, null);
      return;
    }
    writeStoredPosition(storageKey, position);
  }, [position, storageKey, useDefaultAnchor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const onResize = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }
        return clampPosition(current.x, current.y);
      });
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [clampPosition, containerRef]);

  const anchor = useDefaultAnchor ? defaultAnchor : 'custom';
  const style: CSSProperties | undefined =
    anchor === 'custom'
      ? {
          left: `${position?.x ?? 12}px`,
          top: `${position?.y ?? 12}px`,
          right: 'auto',
          bottom: 'auto',
        }
      : undefined;

  return {
    panelRef,
    anchor,
    style,
    headerHandlers: {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerUp,
    },
  };
}
