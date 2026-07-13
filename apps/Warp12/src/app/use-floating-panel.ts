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

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  originX: number;
  originY: number;
}

const MIN_PANEL_HEIGHT = 140;
const EDGE_MARGIN = 12;
/** Movement before a body touch becomes a panel drag (vs native scroll). */
const BODY_DRAG_THRESHOLD_PX = 10;

const DRAG_EXEMPT_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'option',
  '[role="button"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="separator"]',
  '[data-no-panel-drag]',
].join(', ');

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

/** CSS env(safe-area-inset-*) in CSS pixels (0 when unsupported). */
export function readSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
    'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

/** Touch-first surfaces (phones / tablets), including iPad with a trackpad. */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

export function isPanelDragExemptTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(DRAG_EXEMPT_SELECTOR));
}

function bodyCanScrollInDirection(body: HTMLElement, dy: number): boolean {
  const maxScroll = body.scrollHeight - body.clientHeight;
  if (maxScroll <= 1) {
    return false;
  }
  if (dy < 0) {
    return body.scrollTop < maxScroll - 1;
  }
  if (dy > 0) {
    return body.scrollTop > 1;
  }
  return false;
}

export function useFloatingPanel(
  containerRef: RefObject<HTMLElement | null>,
  storageKey: string,
  defaultAnchor: FloatingPanelAnchor = 'bottom-left',
  bounds: FloatingPanelBounds = 'viewport'
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragOrigin | null>(null);
  const pendingBodyDragRef = useRef<DragOrigin | null>(null);
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
  const [dragging, setDragging] = useState(false);
  const [touchPrimary, setTouchPrimary] = useState(() => isTouchPrimaryDevice());

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const sync = () => setTouchPrimary(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const maxPanelHeight = useCallback(() => {
    if (bounds === 'viewport') {
      const inset = readSafeAreaInsets();
      return Math.max(
        MIN_PANEL_HEIGHT,
        viewportSize().height - EDGE_MARGIN * 2 - inset.top - inset.bottom
      );
    }
    const container = containerRef.current;
    if (!container) {
      return Math.max(MIN_PANEL_HEIGHT, viewportSize().height - EDGE_MARGIN * 2);
    }
    return Math.max(MIN_PANEL_HEIGHT, container.clientHeight - EDGE_MARGIN * 2);
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
        const inset = readSafeAreaInsets();
        const minX = inset.left + EDGE_MARGIN;
        const minY = inset.top + EDGE_MARGIN;
        const maxX = Math.max(minX, width - panel.offsetWidth - inset.right - EDGE_MARGIN);
        const maxY = Math.max(
          minY,
          viewH - panel.offsetHeight - inset.bottom - EDGE_MARGIN
        );
        return {
          x: Math.min(maxX, Math.max(minX, nextX)),
          y: Math.min(maxY, Math.max(minY, nextY)),
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
      return { x: EDGE_MARGIN, y: EDGE_MARGIN };
    }
    const panelRect = panel.getBoundingClientRect();
    if (bounds === 'viewport') {
      return { x: panelRect.left, y: panelRect.top };
    }
    const container = containerRef.current;
    if (!container) {
      return { x: EDGE_MARGIN, y: EDGE_MARGIN };
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

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, origin: StoredPosition) => {
      dragRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      };
      pendingBodyDragRef.current = null;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    []
  );

  const onDragPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const pending = pendingBodyDragRef.current;
      if (pending && !dragRef.current) {
        const dx = event.clientX - pending.pointerX;
        const dy = event.clientY - pending.pointerY;
        if (Math.hypot(dx, dy) < BODY_DRAG_THRESHOLD_PX) {
          return;
        }
        const panel = panelRef.current;
        const body = panel?.querySelector<HTMLElement>('[data-floating-panel-body]');
        if (
          body &&
          Math.abs(dy) >= Math.abs(dx) &&
          bodyCanScrollInDirection(body, dy)
        ) {
          pendingBodyDragRef.current = null;
          return;
        }
        dragRef.current = pending;
        pendingBodyDragRef.current = null;
        setDragging(true);
        panel?.setPointerCapture(event.pointerId);
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      event.preventDefault();
      setPosition(
        clampPosition(
          drag.originX + (event.clientX - drag.pointerX),
          drag.originY + (event.clientY - drag.pointerY)
        )
      );
    },
    [clampPosition]
  );

  const onDragPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    dragRef.current = null;
    pendingBodyDragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isPanelDragExemptTarget(event.target)) {
        return;
      }
      event.preventDefault();
      const origin = pinToCurrentPosition();
      beginDrag(event, origin);
    },
    [beginDrag, pinToCurrentPosition]
  );

  const onPanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!touchPrimary || event.button !== 0) {
        return;
      }
      if (isPanelDragExemptTarget(event.target)) {
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      // Header has its own immediate handler.
      if (event.target.closest('[data-floating-panel-header]')) {
        return;
      }

      const origin = pinToCurrentPosition();
      const inBody = Boolean(event.target.closest('[data-floating-panel-body]'));
      const body = panelRef.current?.querySelector<HTMLElement>(
        '[data-floating-panel-body]'
      );
      const bodyScrolls =
        Boolean(body) && (body?.scrollHeight ?? 0) > (body?.clientHeight ?? 0) + 1;

      if (inBody && bodyScrolls) {
        pendingBodyDragRef.current = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          originX: origin.x,
          originY: origin.y,
        };
        return;
      }

      event.preventDefault();
      beginDrag(event, origin);
    },
    [beginDrag, pinToCurrentPosition, touchPrimary]
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

    // Push legacy y=0 (under the status bar) out of the system gesture zone.
    const frame = requestAnimationFrame(reclamp);

    if (bounds === 'viewport') {
      window.addEventListener('resize', reclamp);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', reclamp);
      };
    }

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame);
    }
    const containerObserver = new ResizeObserver(reclamp);
    containerObserver.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      containerObserver.disconnect();
    };
  }, [bounds, clampHeight, clampPosition, containerRef]);

  const anchor = useDefaultAnchor ? defaultAnchor : 'custom';
  const style: CSSProperties = {
    ...(anchor === 'custom'
      ? {
          left: `${position?.x ?? EDGE_MARGIN}px`,
          top: `${position?.y ?? EDGE_MARGIN}px`,
          right: 'auto',
          bottom: 'auto',
        }
      : {}),
    ...(height != null ? { height: `${height}px` } : {}),
  };

  const dragMoveHandlers = {
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerUp,
    onPointerCancel: onDragPointerUp,
  };

  return {
    panelRef,
    anchor,
    style,
    bounds,
    height,
    dragging,
    touchPrimary,
    headerHandlers: {
      onPointerDown: onHeaderPointerDown,
      ...dragMoveHandlers,
    },
    panelHandlers: touchPrimary
      ? {
          onPointerDown: onPanelPointerDown,
          ...dragMoveHandlers,
        }
      : {},
    resizeHandlers: {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerUp,
    },
  };
}
