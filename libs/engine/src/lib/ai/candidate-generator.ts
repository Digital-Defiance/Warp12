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

function isAllStopObligated(
  round: WarpAiObservation['round'],
  playerId: string
): boolean {
  return (
    round.allStopRequired &&
    !round.allStopDeclared &&
    (round.roundWinnerId === playerId ||
      (round.roundWinnerId == null && round.activePlayerId === playerId))
  );
}

function catchDropToImpulseCandidate(
  round: WarpAiObservation['round'],
  playerId: string
): WarpAiAction | null {
  if (!round.dropToImpulseCatchable || round.dropToImpulseCatchable === playerId) {
    return null;
  }
  const targetHand = round.hands[round.dropToImpulseCatchable]?.length ?? 0;
  if (targetHand !== 1 || round.unchartedSectors.length === 0) {
    return null;
  }
  return {
    kind: 'catch-drop-to-impulse',
    targetPlayerId: round.dropToImpulseCatchable,
  };
}

function dropToImpulseDeclareCandidate(
  round: WarpAiObservation['round'],
  playerId: string,
  houseRules: WarpAiObservation['houseRules']
): WarpAiAction | null {
  if (!houseRules.dropToImpulseCall) {
    return null;
  }
  if (round.dropToImpulseCallPending !== playerId) {
    return null;
  }
  if ((round.hands[playerId]?.length ?? 0) !== 1) {
    return null;
  }
  if (isRedAlertBlocking(round.table.redAlert, playerId)) {
    return null;
  }
  return { kind: 'drop-to-impulse' };
}

function resolutionCandidates(
  obs: WarpAiObservation
): WarpAiAction[] {
  const { round, playerId, houseRules } = obs;
  const candidates: WarpAiAction[] = [];

  const declare = dropToImpulseDeclareCandidate(round, playerId, houseRules);
  if (declare) {
    candidates.push(declare);
  }

  if (round.unchartedSectors.length > 0) {
    candidates.push({ kind: 'draw' });
  }

  if (canPassRedAlert(round, playerId, { houseRules })) {
    candidates.push({ kind: 'pass-red-alert' });
  }

  if (canPassTurn(round, playerId, { houseRules })) {
    candidates.push({ kind: 'pass-turn' });
  }

  if (canDeployDistressBeacon(round, playerId, { houseRules })) {
    candidates.push({ kind: 'deploy-beacon' });
  }

  return candidates;
}

/**
 * Off-turn reactions (e.g. catching a missed Drop to Impulse). Host runners and
 * bridge UI can call this when `obs.playerId` is not the active captain.
 */
export function warpOffTurnCandidateGenerator(
  obs: WarpAiObservation
): WarpAiAction[] {
  if (!obs.houseRules.dropToImpulseCall) {
    return [];
  }
  const catchAction = catchDropToImpulseCandidate(obs.round, obs.playerId);
  return catchAction ? [catchAction] : [];
}

/**
 * Builds the considered actions for a Warp 12 turn, deferring all rules gating
 * (Distress Beacon access, Red Alert cover, Subspace Fracture stabilization) to
 * the engine's {@link getLegalMoves}. Precedence:
 *
 * 1. Q-Flash / Q's gamble resolution when pending.
 * 2. All-stop obligation (round winner must call all stop) overrides everything.
 * 3. Catch a missed Drop to Impulse when the window is open.
 * 4. Any legal chart move → chart candidates (canonical "play if you can"), plus
 *    optional Drop to Impulse declare when pending at one tile.
 * 5. Otherwise draw (if Uncharted Sectors remain).
 * 6. Otherwise pass the Red Alert (if responsible) or deploy the Distress Beacon.
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

  if (isAllStopObligated(round, playerId)) {
    const ceremony: WarpAiAction[] = [{ kind: 'all-stop' }];
    if (round.unchartedSectors.length > 0) {
      ceremony.push({ kind: 'return-to-warp' });
    }
    return ceremony;
  }

  if (houseRules?.dropToImpulseCall) {
    const catchAction = catchDropToImpulseCandidate(round, playerId);
    if (catchAction) {
      return [catchAction];
    }
  }

  const moves = getLegalMoves(round, playerId, houseRules);
  if (moves.length > 0) {
    const candidates: WarpAiAction[] = moves.map((move) => ({
      kind: 'chart' as const,
      move,
    }));
    const declare = dropToImpulseDeclareCandidate(round, playerId, houseRules);
    if (declare) {
      candidates.push(declare);
    }
    return candidates;
  }

  const resolution = resolutionCandidates(obs);
  if (resolution.length > 0) {
    return resolution;
  }

  return [];
}
