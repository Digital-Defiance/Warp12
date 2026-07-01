import { coordinatePipValue } from '../types/coordinate.js';
import { getLegalMoves } from '../engine/legal-moves.js';
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
    captain.pointsScore < best.pointsScore ? captain : best
  );
  const highest = captains.reduce((best, captain) =>
    captain.pointsScore > best.pointsScore ? captain : best
  );
  const myHand = round.hands[playerId] ?? [];
  const handPips = myHand.reduce(
    (total, tile) => total + coordinatePipValue(tile),
    0
  );
  const goOut = objective === 'go-out';

  switch (kind) {
    case 'reverse-turn-order':
      return goOut
        ? myHand.length >= 4
          ? 6
          : 3
        : me && me.pointsScore > highest.pointsScore * 0.5
          ? 8
          : 4;
    case 'skip-lowest-points':
      return goOut ? 2 : lowest.id !== playerId ? 12 : -5;
    case 'peek-uncharted':
      return round.unchartedSectors.length > 0 ? 6 : 0;
    case 'temporal-inversion':
      return goOut
        ? myHand.length >= 5
          ? 9
          : 4
        : handPips > 30
          ? 7
          : 3;
    case 'distress-amplification':
      return goOut
        ? myHand.length <= 3
          ? 10
          : 4
        : myHand.length <= 4
          ? 9
          : 5;
    case 'fracture-immunity':
      return myHand.some((tile) => tile.low === tile.high) ? 10 : 2;
    case 'salamander-swap':
      return myHand.some((tile) => tile.low === 12 && tile.high === 12)
        ? 20
        : highest.id !== playerId
          ? 6
          : 0;
    case 'all-stop-echo':
      return goOut ? 0 : 5;
    case 'q-gamble':
      return round.unchartedSectors.length >= 2
        ? goOut
          ? myHand.length >= 4
            ? 10
            : 6
          : 8
        : 0;
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

function playableMoveCount(obs: WarpAiObservation, tileIndex: 0 | 1): number {
  const pending = obs.round.qGamblePending;
  if (!pending) {
    return 0;
  }
  const tile = pending.options[tileIndex];
  const syntheticRound = {
    ...obs.round,
    hands: {
      ...obs.round.hands,
      [obs.playerId]: [tile],
    },
    qGamblePending: null,
  };
  return getLegalMoves(syntheticRound, obs.playerId, obs.houseRules).length;
}

/** Keep the tile that best fits the active objective. */
export function chooseQGambleKeepIndex(
  obs: WarpAiObservation,
  options: ChooseQFlashOptions = {}
): 0 | 1 {
  const pending = obs.round.qGamblePending;
  if (!pending) {
    return 0;
  }
  const [a, b] = pending.options;
  const rng = options.rng ?? Math.random;

  if (obs.objective === 'go-out') {
    const playsA = playableMoveCount(obs, 0);
    const playsB = playableMoveCount(obs, 1);
    if (playsA !== playsB) {
      return playsA > playsB ? 0 : 1;
    }
    const pipA = coordinatePipValue(a);
    const pipB = coordinatePipValue(b);
    if (pipA !== pipB) {
      return pipA < pipB ? 0 : 1;
    }
    return rng() < 0.5 ? 0 : 1;
  }

  const pipA = coordinatePipValue(a);
  const pipB = coordinatePipValue(b);
  if (pipA === pipB) {
    return rng() < 0.5 ? 0 : 1;
  }
  return pipA > pipB ? 0 : 1;
}
