import {
  coordinateKey,
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import { DOUBLE_TWELVE_SET_SIZE } from '../constants/setup.js';

/** Every unique coordinate in a double-twelve set (91 tiles). */
export function generateCoordinateSet(maxPips = 12): Coordinate[] {
  const tiles: Coordinate[] = [];
  for (let low = 0; low <= maxPips; low++) {
    for (let high = low; high <= maxPips; high++) {
      tiles.push({ low, high });
    }
  }
  return tiles;
}

export function assertCoordinateSetSize(
  coordinates: readonly Coordinate[],
  expected = DOUBLE_TWELVE_SET_SIZE
): void {
  if (coordinates.length !== expected) {
    throw new Error(
      `Expected ${expected} coordinates in the set; received ${coordinates.length}.`
    );
  }

  const keys = new Set(coordinates.map(coordinateKey));
  if (keys.size !== expected) {
    throw new Error('Coordinate set contains duplicate tiles.');
  }
}

/** Fisher–Yates shuffle. Pass a seeded rng for deterministic tests. */
export function shuffleCoordinates(
  coordinates: readonly Coordinate[],
  random: () => number = Math.random
): Coordinate[] {
  const pile = coordinates.map((c) => ({ ...c }));
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pile[i], pile[j]] = [pile[j], pile[i]];
  }
  return pile;
}

export function findCoordinateInHand(
  hand: readonly Coordinate[],
  target: Coordinate
): number {
  const key = coordinateKey(normalizeCoordinate(target.low, target.high));
  return hand.findIndex((c) => coordinateKey(c) === key);
}

export function removeCoordinateFromHand(
  hand: readonly Coordinate[],
  target: Coordinate
): { hand: Coordinate[]; removed: Coordinate | null } {
  const index = findCoordinateInHand(hand, target);
  if (index === -1) {
    return { hand: [...hand], removed: null };
  }
  const next = [...hand];
  const [removed] = next.splice(index, 1);
  return { hand: next, removed };
}

export function handContains(
  hand: readonly Coordinate[],
  target: Coordinate
): boolean {
  return findCoordinateInHand(hand, target) !== -1;
}
