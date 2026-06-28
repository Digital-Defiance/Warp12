import type { Coordinate } from 'warp12-engine';

export type HandSortMode =
  | 'custom'
  | 'pips-desc'
  | 'pips-asc'
  | 'low-first'
  | 'doubles-first'
  | 'best-train';

export function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.low}-${coordinate.high}`;
}

export function pipValue(coordinate: Coordinate): number {
  return coordinate.low + coordinate.high;
}

/** Keep the player's custom order; append newly drawn tiles at the end. */
export function mergeHandOrder(
  previousOrder: readonly string[],
  hand: readonly Coordinate[]
): string[] {
  const available = new Set(hand.map(coordinateKey));
  const merged = previousOrder.filter((key) => available.has(key));
  for (const coordinate of hand) {
    const key = coordinateKey(coordinate);
    if (!merged.includes(key)) {
      merged.push(key);
    }
  }
  return merged;
}

export function sortHand(hand: readonly Coordinate[], mode: HandSortMode): string[] {
  const entries = hand.map((coordinate) => ({
    key: coordinateKey(coordinate),
    coordinate,
  }));

  switch (mode) {
    case 'pips-desc':
      entries.sort(
        (a, b) =>
          pipValue(b.coordinate) - pipValue(a.coordinate) ||
          a.coordinate.low - b.coordinate.low ||
          a.coordinate.high - b.coordinate.high
      );
      break;
    case 'pips-asc':
      entries.sort(
        (a, b) =>
          pipValue(a.coordinate) - pipValue(b.coordinate) ||
          a.coordinate.low - b.coordinate.low ||
          a.coordinate.high - b.coordinate.high
      );
      break;
    case 'low-first':
      entries.sort(
        (a, b) =>
          a.coordinate.low - b.coordinate.low ||
          a.coordinate.high - b.coordinate.high
      );
      break;
    case 'doubles-first':
      entries.sort((a, b) => {
        const aDouble = a.coordinate.low === a.coordinate.high ? 0 : 1;
        const bDouble = b.coordinate.low === b.coordinate.high ? 0 : 1;
        return (
          aDouble - bDouble ||
          pipValue(b.coordinate) - pipValue(a.coordinate) ||
          a.coordinate.low - b.coordinate.low
        );
      });
      break;
    default:
      break;
  }

  return entries.map((entry) => entry.key);
}

function connectsToEnd(coordinate: Coordinate, end: number): boolean {
  return coordinate.low === end || coordinate.high === end;
}

function otherEnd(coordinate: Coordinate, connectedEnd: number): number {
  return coordinate.low === connectedEnd ? coordinate.high : coordinate.low;
}

/** Top pip faces the previous link (hub on the first tile). */
function flipForConnection(
  coordinate: Coordinate,
  connectOn: number
): boolean {
  if (coordinate.low === connectOn) {
    return false;
  }
  if (coordinate.high === connectOn) {
    return true;
  }
  return false;
}

interface TrainChainStep {
  key: string;
  connectOn: number;
}

function compareTrainChains(
  a: readonly TrainChainStep[],
  b: readonly TrainChainStep[],
  byKey: ReadonlyMap<string, Coordinate>
): number {
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  const score = (chain: readonly TrainChainStep[]) =>
    chain.reduce(
      (sum, step) => sum + pipValue(byKey.get(step.key) ?? { low: 0, high: 0 }),
      0
    );
  const scoreDiff = score(a) - score(b);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return a.map((step) => step.key).join(',').localeCompare(
    b.map((step) => step.key).join(',')
  );
}

function findLongestTrainChain(
  hand: readonly Coordinate[],
  connectValue: number
): TrainChainStep[] {
  const tiles = hand.map((coordinate) => ({
    key: coordinateKey(coordinate),
    coordinate,
  }));
  const byKey = new Map(tiles.map((tile) => [tile.key, tile.coordinate]));
  const n = tiles.length;
  let bestChain: TrainChainStep[] = [];

  const search = (
    currentEnd: number,
    used: boolean[],
    chain: TrainChainStep[]
  ) => {
    if (compareTrainChains(chain, bestChain, byKey) > 0) {
      bestChain = chain.slice();
    }
    if (chain.length + (n - chain.length) <= bestChain.length) {
      return;
    }
    for (let index = 0; index < n; index += 1) {
      if (used[index]) {
        continue;
      }
      const { key, coordinate } = tiles[index];
      if (!connectsToEnd(coordinate, currentEnd)) {
        continue;
      }
      used[index] = true;
      chain.push({ key, connectOn: currentEnd });
      search(otherEnd(coordinate, currentEnd), used, chain);
      chain.pop();
      used[index] = false;
    }
  };

  search(connectValue, Array.from({ length: n }, () => false), []);
  return bestChain;
}

/** Order and orient the hand as the longest chain from the given open end. */
export function bestTrainLayout(
  hand: readonly Coordinate[],
  connectValue: number
): StoredHandLayout {
  const tiles = hand.map((coordinate) => ({
    key: coordinateKey(coordinate),
    coordinate,
  }));
  const byKey = new Map(tiles.map((tile) => [tile.key, tile.coordinate]));
  const chain = findLongestTrainChain(hand, connectValue);
  const chainKeys = new Set(chain.map((step) => step.key));
  const flipped: Record<string, boolean> = {};

  for (const step of chain) {
    const coordinate = byKey.get(step.key);
    if (coordinate && flipForConnection(coordinate, step.connectOn)) {
      flipped[step.key] = true;
    }
  }

  const leftovers = tiles
    .filter((tile) => !chainKeys.has(tile.key))
    .sort(
      (a, b) =>
        pipValue(b.coordinate) - pipValue(a.coordinate) ||
        a.coordinate.low - b.coordinate.low ||
        a.coordinate.high - b.coordinate.high
    )
    .map((tile) => tile.key);

  return {
    order: [...chain.map((step) => step.key), ...leftovers],
    flipped: mergeFlippedKeys(flipped, hand),
  };
}

export function reorderHand(
  order: readonly string[],
  fromKey: string,
  toKey: string
): string[] {
  if (fromKey === toKey) {
    return [...order];
  }
  const next = order.filter((key) => key !== fromKey);
  const targetIndex = next.indexOf(toKey);
  if (targetIndex === -1) {
    return [...order];
  }
  next.splice(targetIndex, 0, fromKey);
  return next;
}

export function orderHand(
  hand: readonly Coordinate[],
  order: readonly string[]
): Coordinate[] {
  const byKey = new Map(hand.map((coordinate) => [coordinateKey(coordinate), coordinate]));
  return order
    .map((key) => byKey.get(key))
    .filter((coordinate): coordinate is Coordinate => coordinate !== undefined);
}

export function handLayoutStorageKey(gameId: string, playerId: string): string {
  return `warp12-hand-layout:${gameId}:${playerId}`;
}

const legacyHandOrderStorageKey = (gameId: string, playerId: string): string =>
  `warp12-hand-order:${gameId}:${playerId}`;

export interface StoredHandLayout {
  order: string[];
  flipped?: Record<string, boolean>;
}

export function mergeFlippedKeys(
  previous: Readonly<Record<string, boolean>>,
  hand: readonly Coordinate[]
): Record<string, boolean> {
  const available = new Set(hand.map(coordinateKey));
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (available.has(key) && value) {
      next[key] = true;
    }
  }
  return next;
}

export function toggleFlippedKey(
  flipped: Readonly<Record<string, boolean>>,
  key: string
): Record<string, boolean> {
  if (flipped[key]) {
    const next = { ...flipped };
    delete next[key];
    return next;
  }
  return { ...flipped, [key]: true };
}

export function isCoordinateFlipped(
  flipped: Readonly<Record<string, boolean>>,
  key: string
): boolean {
  return flipped[key] ?? false;
}

export function displayCoordinateValues(
  coordinate: Coordinate,
  flipped: boolean
): { top: number; bottom: number } {
  return flipped
    ? { top: coordinate.high, bottom: coordinate.low }
    : { top: coordinate.low, bottom: coordinate.high };
}

export function readStoredHandLayout(
  gameId: string,
  playerId: string
): StoredHandLayout | null {
  try {
    const raw =
      localStorage.getItem(handLayoutStorageKey(gameId, playerId)) ??
      localStorage.getItem(legacyHandOrderStorageKey(gameId, playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return { order: parsed };
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      'order' in parsed &&
      Array.isArray((parsed as StoredHandLayout).order) &&
      (parsed as StoredHandLayout).order.every((item) => typeof item === 'string')
    ) {
      return parsed as StoredHandLayout;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredHandLayout(
  gameId: string,
  playerId: string,
  layout: StoredHandLayout
): void {
  try {
    localStorage.setItem(
      handLayoutStorageKey(gameId, playerId),
      JSON.stringify(layout)
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}

/** @deprecated Use readStoredHandLayout */
export function readStoredHandOrder(
  gameId: string,
  playerId: string
): string[] | null {
  return readStoredHandLayout(gameId, playerId)?.order ?? null;
}

/** @deprecated Use writeStoredHandLayout */
export function writeStoredHandOrder(
  gameId: string,
  playerId: string,
  order: readonly string[]
): void {
  writeStoredHandLayout(gameId, playerId, { order: [...order] });
}
