import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import type { WarpAiAction } from './actions.js';
import type { WarpAiObservation } from './observation.js';
import { chooseQFlashEffect, chooseQGambleKeepIndex } from './q-flash.js';

/**
 * Builds the considered actions for a Warp 12 turn, deferring all rules gating
 * (Distress Beacon access, Red Alert cover, Subspace Fracture stabilization) to
 * the engine's {@link getLegalMoves}. Precedence:
 *
 * 1. Q-Flash / Q's gamble resolution when pending.
 * 2. Impulse-drop obligation (round winner must drop to impulse) overrides everything.
 * 3. Any legal chart move → chart candidates (canonical "play if you can").
 * 4. Otherwise draw (if Uncharted Sectors remain).
 * 5. Otherwise pass the Red Alert (if responsible) or deploy the Distress Beacon.
 *
 * House-rule variants can replace this generator wholesale.
 */
export function warpCandidateGenerator(
  obs: WarpAiObservation,
  options?: {
    captains?: readonly import('../types/player.js').Captain[];
    rng?: () => number;
  }
): WarpAiAction[] {
  const { round, playerId, houseRules } = obs;

  if (round.qPendingInvoker === playerId) {
    return [
      {
        kind: 'invoke-q-flash',
        effect: chooseQFlashEffect(obs, obs.captains, { rng: options?.rng }),
      },
    ];
  }

  if (round.qGamblePending?.playerId === playerId) {
    return [
      {
        kind: 'resolve-q-gamble',
        keepIndex: chooseQGambleKeepIndex(obs, { rng: options?.rng }),
      },
    ];
  }

  if (
    round.dropToImpulseRequired &&
    !round.dropToImpulseDeclared &&
    (round.roundWinnerId === playerId ||
      (round.roundWinnerId == null && round.activePlayerId === playerId))
  ) {
    return [{ kind: 'drop-to-impulse' }];
  }

  const moves = getLegalMoves(round, playerId, houseRules);
  if (moves.length > 0) {
    return moves.map((move) => ({ kind: 'chart', move }));
  }

  if (round.unchartedSectors.length > 0) {
    return [{ kind: 'draw' }];
  }

  if (canPassRedAlert(round, playerId, { houseRules })) {
    return [{ kind: 'pass-red-alert' }];
  }

  if (canDeployDistressBeacon(round, playerId, { houseRules })) {
    return [{ kind: 'deploy-beacon' }];
  }

  if (canPassTurn(round, playerId, { houseRules })) {
    return [{ kind: 'pass-turn' }];
  }

  return [];
}
