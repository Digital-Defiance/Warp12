/** A domino tile (Navigational Coordinate), canonical low–high. */
export interface Coordinate {
  readonly low: number;
  readonly high: number;
}

/** A coordinate placed on a trail or in the fracture. */
export interface PlacedCoordinate {
  readonly coordinate: Coordinate;
  /** Index within the parent trail or branch. */
  readonly index: number;
  /** Pip value open for the next connection along this trail. */
  readonly openValue: number;
}

export function coordinateKey({ low, high }: Coordinate): string {
  return `${low}-${high}`;
}

export function isDouble({ low, high }: Coordinate): boolean {
  return low === high;
}

export function coordinatePipValue({ low, high }: Coordinate): number {
  return low + high;
}

export function normalizeCoordinate(a: number, b: number): Coordinate {
  return a <= b ? { low: a, high: b } : { low: b, high: a };
}

export function coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
  return a.low === b.low && a.high === b.high;
}

export function coordinateMatchesValue(
  { low, high }: Coordinate,
  value: number
): boolean {
  return low === value || high === value;
}

/** Open end after connecting `coordinate` to `connectingValue`. */
export function openValueAfterConnection(
  coordinate: Coordinate,
  connectingValue: number
): number | null {
  if (coordinate.low === connectingValue) {
    return coordinate.high;
  }
  if (coordinate.high === connectingValue) {
    return coordinate.low;
  }
  return null;
}
