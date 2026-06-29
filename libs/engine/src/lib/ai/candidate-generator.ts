import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { isRedAlertBlocking } from '../types/anomalies.js';
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
 * 2. All-stop obligation (round winner must call all stop) overrides everything.
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
    round.allStopRequired &&
    !round.allStopDeclared &&
    (round.roundWinnerId === playerId ||
      (round.roundWinnerId == null && round.activePlayerId === playerId))
  ) {
    return [{ kind: 'all-stop' }];
  }

  if (round.dropToImpulseCatchable && round.dropToImpulseCatchable !== playerId) {
    const targetHand = round.hands[round.dropToImpulseCatchable]?.length ?? 0;
    if (targetHand === 1) {
      return [
        {
          kind: 'catch-drop-to-impulse',
          targetPlayerId: round.dropToImpulseCatchable,
        },
      ];
    }
  }

  const moves = getLegalMoves(round, playerId, houseRules);
  if (moves.length > 0) {
    return moves.map((move) => ({ kind: 'chart', move }));
  }

  if (
    round.dropToImpulseCallPending === playerId &&
    (round.hands[playerId]?.length ?? 0) === 1 &&
    !isRedAlertBlocking(round.table.redAlert, playerId)
  ) {
    return [{ kind: 'drop-to-impulse' }];
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
