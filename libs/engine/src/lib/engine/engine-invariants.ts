import { generateCoordinateSet } from '../domino/coordinates.js';
import {
  coordinateKey,
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';

/** Every coordinate currently accounted for in a round (should be the full set). */
export function collectAllRoundCoordinates(round: RoundState): Coordinate[] {
  const all: Coordinate[] = [];

  for (const id of round.turnOrder) {
    all.push(...(round.hands[id] ?? []));
  }
  all.push(...round.unchartedSectors);

  for (const trail of Object.values(round.table.warpTrails)) {
    for (const placed of trail.tiles) {
      all.push(placed.coordinate);
    }
  }
  for (const placed of round.table.neutralZone.tiles) {
    all.push(placed.coordinate);
  }
  const fracture = round.table.subspaceFracture;
  if (fracture) {
    for (const placed of fracture.stabilizers) {
      all.push(placed.coordinate);
    }
  }

  // Q-gamble pulls two tiles out of the pile until the invoker keeps one.
  if (round.continuumWagerPending) {
    all.push(...round.continuumWagerPending.options);
  }

  // Spacedock double is set aside before the deal — part of the 91, never dealt.
  all.push(normalizeCoordinate(round.spacedockValue, round.spacedockValue));

  return all;
}

export interface InvariantViolation {
  readonly kind: string;
  readonly detail: string;
}

/**
 * Assert every rules-engine invariant that must hold for an in-progress or
 * just-ended round. Returns the list of violations (empty when healthy).
 */
export function checkRoundInvariants(
  state: GameState,
  round: RoundState
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const push = (kind: string, detail: string) =>
    violations.push({ kind, detail });

  // 1. Tile conservation: exactly the 91-tile double-twelve set, no dupes.
  const all = collectAllRoundCoordinates(round);
  if (all.length !== 91) {
    push('tile-count', `expected 91 tiles, found ${all.length}`);
  }
  const keys = new Set<string>();
  const expected = new Set(
    generateCoordinateSet(12).map(coordinateKey)
  );
  for (const coordinate of all) {
    const key = coordinateKey(normalizeCoordinate(coordinate.low, coordinate.high));
    if (keys.has(key)) {
      push('tile-duplicate', `tile ${key} appears more than once`);
    }
    keys.add(key);
    if (!expected.has(key)) {
      push('tile-foreign', `tile ${key} is not part of a double-twelve set`);
    }
  }
  for (const key of expected) {
    if (!keys.has(key)) {
      push('tile-missing', `tile ${key} vanished from the round`);
    }
  }

  // 2. Active player must be a real seat.
  if (!round.turnOrder.includes(round.activePlayerId)) {
    push('active-player', `active ${round.activePlayerId} not in turn order`);
  }

  // 3. Placed tiles must genuinely connect (openValue is one of the tile's pips).
  for (const [owner, trail] of Object.entries(round.table.warpTrails)) {
    for (const placed of trail.tiles) {
      const { low, high } = placed.coordinate;
      if (placed.openValue !== low && placed.openValue !== high) {
        push(
          'open-value',
          `trail ${owner} tile ${coordinateKey(placed.coordinate)} openValue ${placed.openValue} not a pip`
        );
      }
    }
  }
  for (const placed of round.table.neutralZone.tiles) {
    const { low, high } = placed.coordinate;
    if (placed.openValue !== low && placed.openValue !== high) {
      push(
        'open-value',
        `neutral zone tile ${coordinateKey(placed.coordinate)} openValue ${placed.openValue} not a pip`
      );
    }
  }

  // 4. No captain ever holds negative or NaN tiles (defensive).
  for (const id of round.turnOrder) {
    const count = round.hands[id]?.length ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      push('hand-count', `captain ${id} has invalid hand size ${count}`);
    }
  }

  // 5. An ended round must name a winner or be a blocked sector.
  if (round.phase === 'ended' && !round.roundWinnerId && !round.roundBlocked) {
    push('ended-no-winner', 'round ended without a winner or blocked flag');
  }

  // 6. A round winner must actually have emptied their hand (unless blocked).
  if (
    round.phase === 'ended' &&
    round.roundWinnerId &&
    !round.roundBlocked &&
    (round.hands[round.roundWinnerId]?.length ?? 0) !== 0
  ) {
    push(
      'winner-nonempty',
      `winner ${round.roundWinnerId} still holds ${round.hands[round.roundWinnerId]?.length} tiles`
    );
  }

  return violations;
}
