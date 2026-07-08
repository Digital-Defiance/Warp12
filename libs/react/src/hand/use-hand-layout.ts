import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinate } from 'warp12-engine';

import {
  bestTrainLayout,
  coordinateKey,
  isCoordinateFlipped,
  mergeFlippedKeys,
  mergeHandOrder,
  orderHand,
  readStoredHandLayout,
  reorderHand,
  sortHand,
  toggleFlippedKey,
  writeStoredHandLayout,
  type HandSortMode,
} from './hand-layout.js';

const POINTER_DRAG_THRESHOLD_PX = 6;

export interface HandLayoutOptions {
  /**
   * Hand scrolls horizontally (phone). Horizontal swipes scroll; only vertical
   * drags reorder. Pointer capture is deferred so the scroll container can pan.
   */
  horizontalScroll?: boolean;
}

function shouldUsePointerDrag(
  _event: Pick<PointerEvent, 'pointerType'>
): boolean {
  // Pointer-based reordering for ALL pointer types (mouse, touch, pen). Native
  // HTML5 drag-and-drop is unreliable in the macOS Tauri WKWebview, so we do not
  // depend on it — pointer events work everywhere.
  return true;
}

function isScrollIntent(dx: number, dy: number): boolean {
  return Math.abs(dx) >= Math.abs(dy);
}

export function useHandLayout(
  gameId: string,
  playerId: string,
  hand: readonly Coordinate[],
  options: HandLayoutOptions = {}
) {
  const horizontalScroll = options.horizontalScroll === true;
  const handSignature = useMemo(
    () => hand.map(coordinateKey).sort().join('|'),
    [hand]
  );

  const [order, setOrder] = useState<string[]>(() => {
    const stored = readStoredHandLayout(gameId, playerId);
    return mergeHandOrder(stored?.order ?? hand.map(coordinateKey), hand);
  });
  const [flipped, setFlipped] = useState<Record<string, boolean>>(() => {
    const stored = readStoredHandLayout(gameId, playerId);
    return mergeFlippedKeys(stored?.flipped ?? {}, hand);
  });
  const [pointerDropTargetKey, setPointerDropTargetKey] = useState<string | null>(
    null
  );
  const [pointerDraggingKey, setPointerDraggingKey] = useState<string | null>(
    null
  );

  const layoutScopeRef = useRef('');
  const dragKeyRef = useRef<string | null>(null);
  const didDragRef = useRef(false);
  const pointerDragRef = useRef<{
    key: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    captureTarget: HTMLButtonElement | null;
  } | null>(null);

  useEffect(() => {
    const scope = `${gameId}:${playerId}`;
    const scopeChanged = layoutScopeRef.current !== scope;
    layoutScopeRef.current = scope;

    if (scopeChanged) {
      const stored = readStoredHandLayout(gameId, playerId);
      setOrder(mergeHandOrder(stored?.order ?? hand.map(coordinateKey), hand));
      setFlipped(mergeFlippedKeys(stored?.flipped ?? {}, hand));
      return;
    }

    setOrder((previous) => mergeHandOrder(previous, hand));
    setFlipped((previous) => mergeFlippedKeys(previous, hand));
  }, [gameId, playerId, handSignature, hand]);

  useEffect(() => {
    writeStoredHandLayout(gameId, playerId, { order, flipped });
  }, [gameId, playerId, order, flipped]);

  const orderedHand = useMemo(
    () => orderHand(hand, order),
    [hand, order]
  );

  const applySort = useCallback(
    (mode: HandSortMode, connectValue?: number) => {
      if (mode === 'best-train' && connectValue !== undefined) {
        const layout = bestTrainLayout(hand, connectValue);
        setOrder(layout.order);
        setFlipped(layout.flipped ?? {});
        return;
      }
      setOrder(sortHand(hand, mode));
    },
    [hand]
  );

  const toggleFlip = useCallback((key: string) => {
    setFlipped((previous) => toggleFlippedKey(previous, key));
  }, []);

  const isFlipped = useCallback(
    (key: string) => isCoordinateFlipped(flipped, key),
    [flipped]
  );

  const finishPointerDrag = useCallback((targetKey?: string) => {
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    setPointerDraggingKey(null);
    setPointerDropTargetKey(null);
    dragKeyRef.current = null;

    if (drag?.active && targetKey && drag.key !== targetKey) {
      setOrder((previous) => reorderHand(previous, drag.key, targetKey));
    }

    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, []);

  const onHandTilePointerDown = useCallback(
    (key: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !shouldUsePointerDrag(event.nativeEvent)) {
        return;
      }
      pointerDragRef.current = {
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        captureTarget: event.currentTarget,
      };
      if (!horizontalScroll) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [horizontalScroll]
  );

  const onHandTilePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!shouldUsePointerDrag(event.nativeEvent)) {
        return;
      }
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < POINTER_DRAG_THRESHOLD_PX) {
          return;
        }
        if (horizontalScroll && isScrollIntent(dx, dy)) {
          pointerDragRef.current = null;
          return;
        }
        drag.active = true;
        drag.captureTarget?.setPointerCapture(drag.pointerId);
        dragKeyRef.current = drag.key;
        didDragRef.current = true;
        setPointerDraggingKey(drag.key);
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const tile = target?.closest('[data-hand-tile-key]');
      const targetKey = tile?.getAttribute('data-hand-tile-key');
      setPointerDropTargetKey(
        targetKey && targetKey !== drag.key ? targetKey : null
      );
    },
    [horizontalScroll]
  );

  const onHandTilePointerUp = useCallback(
    (key: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (!shouldUsePointerDrag(event.nativeEvent)) {
        return;
      }
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      let dropKey: string | undefined;
      if (drag.active) {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const tile = target?.closest('[data-hand-tile-key]');
        dropKey = tile?.getAttribute('data-hand-tile-key') ?? key;
      }
      finishPointerDrag(dropKey);
    },
    [finishPointerDrag]
  );

  const onHandTilePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!shouldUsePointerDrag(event.nativeEvent)) {
        return;
      }
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishPointerDrag();
    },
    [finishPointerDrag]
  );

  const shouldIgnoreClick = useCallback(() => didDragRef.current, []);

  return {
    orderedHand,
    applySort,
    toggleFlip,
    isFlipped,
    onHandTilePointerDown,
    onHandTilePointerMove,
    onHandTilePointerUp,
    onHandTilePointerCancel,
    pointerDraggingKey,
    pointerDropTargetKey,
    shouldIgnoreClick,
  };
}
