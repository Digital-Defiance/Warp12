import { coordinatePipValue } from '../types/coordinate.js';
import type { Captain } from '../types/player.js';
import type { QFlashEffectKind } from '../types/q-continuum.js';
import { getAvailableQFlashEffects } from '../types/q-continuum.js';
import type { WarpAiObservation } from './observation.js';

export interface ChooseQFlashOptions {
  readonly rng?: () => number;
}

function scoreEffect(
  kind: QFlashEffectKind,
  obs: WarpAiObservation,
  captains: readonly Captain[]
): number {
  const { round, playerId, objective } = obs;
  const me = captains.find((captain) => captain.id === playerId);
  const lowest = captains.reduce((best, captain) =>
    captain.penaltyScore < best.penaltyScore ? captain : best
  );
  const highest = captains.reduce((best, captain) =>
    captain.penaltyScore > best.penaltyScore ? captain : best
  );
  const myHand = round.hands[playerId] ?? [];
  const handPips = myHand.reduce(
    (total, tile) => total + coordinatePipValue(tile),
    0
  );

  switch (kind) {
    case 'reverse-turn-order':
      return me && me.penaltyScore > highest.penaltyScore * 0.5 ? 8 : 4;
    case 'skip-lowest-penalty':
      return lowest.id !== playerId ? 12 : -5;
    case 'peek-uncharted':
      return round.unchartedSectors.length > 0 ? 6 : 0;
    case 'temporal-inversion':
      return handPips > 30 ? 7 : 3;
    case 'distress-amplification':
      return myHand.length <= 4 ? 9 : 5;
    case 'fracture-immunity':
      return myHand.some((tile) => tile.low === tile.high) ? 10 : 2;
    case 'salamander-swap':
      return myHand.some((tile) => tile.low === 12 && tile.high === 12)
        ? 20
        : highest.id !== playerId
          ? 6
          : 0;
    case 'treaty-echo':
      return objective === 'penalty' ? 5 : 1;
    case 'q-gamble':
      return round.unchartedSectors.length >= 2 ? 8 : 0;
  }
}

/** Pick the best available Q-Flash for the invoker. */
export function chooseQFlashEffect(
  obs: WarpAiObservation,
  captains: readonly Captain[],
  options: ChooseQFlashOptions = {}
): QFlashEffectKind {
  const rng = options.rng ?? Math.random;
  const available = getAvailableQFlashEffects(
    obs.round,
    obs.modules,
    captains
  );

  if (available.length === 0) {
    return 'reverse-turn-order';
  }

  const ranked = available
    .map((kind) => ({ kind, score: scoreEffect(kind, obs, captains) + rng() * 2 }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.kind ?? available[0]!;
}

/** Keep the stronger tile from Q's gamble. */
export function chooseQGambleKeepIndex(
  obs: WarpAiObservation,
  options: ChooseQFlashOptions = {}
): 0 | 1 {
  const pending = obs.round.qGamblePending;
  if (!pending) {
    return 0;
  }
  const [a, b] = pending.options;
  const pipA = coordinatePipValue(a);
  const pipB = coordinatePipValue(b);
  if (pipA === pipB) {
    return (options.rng ?? Math.random)() < 0.5 ? 0 : 1;
  }
  return pipA > pipB ? 0 : 1;
}
