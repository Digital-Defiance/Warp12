import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
} from '../engine/beacon.js';
import { isRedAlertBlocking } from '../types/anomalies.js';
import { getLegalMoves } from '../engine/legal-moves.js';
import type { WarpAiAction } from './actions.js';
import type { WarpAiObservation } from './observation.js';
import { chooseQFlashEffect, chooseQGambleKeepIndex } from './flash.js';

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

  if (canDrawFromUncharted(round, playerId, houseRules)) {
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
 * 1. Continuum Flash / Continuum Wager resolution when pending.
 * 2. Catch a missed Drop to Impulse when the window is open.
 * 3. Any legal chart move → chart candidates (canonical "play if you can"), plus
 *    Drop to Impulse declare and pass when pending at one tile (no chart while pending).
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

  if (round.continuumPendingInvoker === playerId) {
    return [
      {
        kind: 'invoke-continuum-flash',
        effect: chooseQFlashEffect(obs, obs.captains, { rng: options?.rng }),
      },
    ];
  }

  if (round.continuumWagerPending?.playerId === playerId) {
    return [
      {
        kind: 'resolve-continuum-wager',
        keepIndex: chooseQGambleKeepIndex(obs, { rng: options?.rng }),
      },
    ];
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
    if (
      houseRules.dropToImpulseCall &&
      round.dropToImpulseCallPending === playerId &&
      canPassTurn(round, playerId, { houseRules })
    ) {
      candidates.push({ kind: 'pass-turn' });
    }
    if (houseRules.manualShieldControl) {
      if (canDeployDistressBeacon(round, playerId, { houseRules })) {
        candidates.push({ kind: 'deploy-beacon' });
      }
      if (canRaiseShieldsManually(round, playerId, houseRules)) {
        candidates.push({ kind: 'raise-shields' });
      }
    }
    return candidates;
  }

  const resolution = resolutionCandidates(obs);
  if (resolution.length > 0) {
    return resolution;
  }

  return [];
}
