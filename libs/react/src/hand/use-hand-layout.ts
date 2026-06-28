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

const TRANSPARENT_DRAG_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let sharedDragImage: HTMLImageElement | null = null;

function getTransparentDragImage(): HTMLImageElement {
  if (!sharedDragImage) {
    sharedDragImage = new Image();
    sharedDragImage.src = TRANSPARENT_DRAG_IMAGE;
  }
  return sharedDragImage;
}

export function useHandLayout(
  gameId: string,
  playerId: string,
  hand: readonly Coordinate[]
) {
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

  const dragKeyRef = useRef<string | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    setOrder((previous) => mergeHandOrder(previous, hand));
    setFlipped((previous) => mergeFlippedKeys(previous, hand));
  }, [gameId, playerId, handSignature]);

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

  const onDragStart = useCallback(
    (key: string, event: React.DragEvent<HTMLButtonElement>) => {
      dragKeyRef.current = key;
      didDragRef.current = true;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', key);
      event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0);
    },
    []
  );

  const onDragEnd = useCallback(() => {
    dragKeyRef.current = null;
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((targetKey: string) => {
    const fromKey = dragKeyRef.current;
    if (!fromKey) return;
    setOrder((previous) => reorderHand(previous, fromKey, targetKey));
    dragKeyRef.current = null;
  }, []);

  const shouldIgnoreClick = useCallback(() => didDragRef.current, []);

  return {
    orderedHand,
    applySort,
    toggleFlip,
    isFlipped,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    shouldIgnoreClick,
  };
}
