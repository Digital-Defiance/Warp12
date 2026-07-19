import type { Coordinate } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';

export interface HandExchangePending {
  /** Captain with the unique largest hand (must choose give-back). */
  readonly largerPlayerId: PlayerId;
  /** Captain with the unique smallest hand (lost a random tile). */
  readonly smallerPlayerId: PlayerId;
  /** Tile taken from the smaller hand into the larger. */
  readonly takenCoordinate: Coordinate;
}

/**
 * Module Kappa (Go-out) Hand Exchange: once per round, after the first
 * non-Spacedock double is charted.
 */
export function isHandExchangeEligible(
  state: Pick<GameState, 'objective' | 'modules' | 'handExchangeResolved'>
): boolean {
  return (
    state.objective === 'go-out' &&
    state.modules.temporalInversion.enabled &&
    state.handExchangeResolved !== true
  );
}

export function findUniqueHandExtremes(
  round: RoundState
): { most: PlayerId; fewest: PlayerId } | null {
  const sizes = round.turnOrder.map((id) => ({
    id,
    size: round.hands[id]?.length ?? 0,
  }));
  if (sizes.length < 2) {
    return null;
  }
  const maxSize = Math.max(...sizes.map((s) => s.size));
  const minSize = Math.min(...sizes.map((s) => s.size));
  const most = sizes.filter((s) => s.size === maxSize);
  const fewest = sizes.filter((s) => s.size === minSize);
  if (most.length !== 1 || fewest.length !== 1) {
    return null;
  }
  if (most[0]!.id === fewest[0]!.id) {
    return null;
  }
  if (fewest[0]!.size < 1) {
    return null;
  }
  return { most: most[0]!.id, fewest: fewest[0]!.id };
}

/** Deterministic pick for tests; production may pass a random index. */
export function pickTakenCoordinate(
  hand: readonly Coordinate[],
  randomIndex: (length: number) => number = (n) =>
    Math.floor(Math.random() * n)
): Coordinate | null {
  if (hand.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.min(hand.length - 1, randomIndex(hand.length)));
  return hand[index] ?? null;
}

/**
 * Mark sector resolved (skip or start). When partners exist, steal one tile
 * from fewest into most and return pending give-back.
 */
export function beginHandExchange(
  round: RoundState,
  randomIndex?: (length: number) => number
): {
  round: RoundState;
  pending: HandExchangePending | null;
  skipped: boolean;
} {
  const extremes = findUniqueHandExtremes(round);
  if (!extremes) {
    return { round, pending: null, skipped: true };
  }
  const smallHand = round.hands[extremes.fewest] ?? [];
  const taken = pickTakenCoordinate(smallHand, randomIndex);
  if (!taken) {
    return { round, pending: null, skipped: true };
  }
  let removed = false;
  const filteredSmall: Coordinate[] = [];
  for (const c of smallHand) {
    if (!removed && c.low === taken.low && c.high === taken.high) {
      removed = true;
      continue;
    }
    filteredSmall.push(c);
  }
  const largeHand = [...(round.hands[extremes.most] ?? []), taken];
  const pending: HandExchangePending = {
    largerPlayerId: extremes.most,
    smallerPlayerId: extremes.fewest,
    takenCoordinate: taken,
  };
  return {
    round: {
      ...round,
      hands: {
        ...round.hands,
        [extremes.fewest]: filteredSmall,
        [extremes.most]: largeHand,
      },
      handExchangePending: pending,
    },
    pending,
    skipped: false,
  };
}

export function applyHandExchangeGiveback(
  round: RoundState,
  playerId: PlayerId,
  coordinate: Coordinate
): RoundState | null {
  const pending = round.handExchangePending;
  if (!pending || pending.largerPlayerId !== playerId) {
    return null;
  }
  const largeHand = round.hands[playerId] ?? [];
  const idx = largeHand.findIndex(
    (c) => c.low === coordinate.low && c.high === coordinate.high
  );
  if (idx < 0) {
    return null;
  }
  const nextLarge = [
    ...largeHand.slice(0, idx),
    ...largeHand.slice(idx + 1),
  ];
  const smallId = pending.smallerPlayerId;
  return {
    ...round,
    hands: {
      ...round.hands,
      [playerId]: nextLarge,
      [smallId]: [...(round.hands[smallId] ?? []), coordinate],
    },
    handExchangePending: null,
  };
}

/**
 * Who must act when a mid-turn resolution is pending (Hand Exchange give-back,
 * Continuum flash/wager). Otherwise the active helm.
 */
export function pendingResolutionActorId(round: RoundState): PlayerId {
  if (round.handExchangePending) {
    return round.handExchangePending.largerPlayerId;
  }
  if (round.continuumPendingInvoker) {
    return round.continuumPendingInvoker;
  }
  if (round.continuumWagerPending) {
    return round.continuumWagerPending.playerId;
  }
  return round.activePlayerId;
}
