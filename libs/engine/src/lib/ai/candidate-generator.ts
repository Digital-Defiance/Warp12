import {
  canDeployDistressBeacon,
  canDesperationDig,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
} from '../engine/beacon.js';
import { getLegalMoves, getSpoolOptions } from '../engine/legal-moves.js';
import { isRedAlertBlocking } from '../types/anomalies.js';
import type { WarpAiAction } from './actions.js';
import type { WarpAiObservation } from './observation.js';
import { chooseQFlashEffect, chooseForceDrawTarget, chooseQGambleKeepIndex } from './flash.js';
import { observationToState } from './observation.js';
import { shouldConsiderSpool } from './spool-strategy.js';

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
  if (
    canDesperationDig(
      { objective: obs.objective, modules: obs.modules },
      round,
      playerId,
      houseRules
    )
  ) {
    candidates.push({ kind: 'desperation-dig' });
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

function appendSpoolCandidates(
  obs: WarpAiObservation,
  candidates: WarpAiAction[]
): void {
  if (!shouldConsiderSpool(obs)) {
    return;
  }
  const state = observationToState(obs);
  for (const option of getSpoolOptions(
    state,
    obs.round,
    obs.playerId,
    obs.houseRules
  )) {
    candidates.push({ kind: 'spool', option });
  }
}

/**
 * Builds the considered actions for a Warp 12 turn, deferring all rules gating
 * (Distress Beacon access, Red Alert cover, Subspace Fracture stabilization) to
 * the engine's {@link getLegalMoves}. Precedence:
 *
 * 1. Hand Exchange give-back / Continuum Flash / Continuum Wager when pending.
 * 2. Catch a missed Drop to Impulse when the window is open.
 * 3. Legal chart moves (+ Engage Warp Drive when Delta is on) and related helm.
 * 4. Otherwise draw / Desperation Dig / pass Red Alert / deploy beacon.
 */
export function warpCandidateGenerator(
  obs: WarpAiObservation,
  options?: {
    captains?: readonly import('../types/player.js').Captain[];
    rng?: () => number;
  }
): WarpAiAction[] {
  const { round, playerId, houseRules } = obs;

  // Module Kappa (Go-out): larger hand must give one tile back before anything else.
  if (round.handExchangePending) {
    if (round.handExchangePending.largerPlayerId !== playerId) {
      return [];
    }
    const hand = round.hands[playerId] ?? [];
    return hand.map((coordinate) => ({
      kind: 'resolve-hand-exchange' as const,
      coordinate,
    }));
  }

  // Module Epsilon: Drafting phase
  if (round.phase === 'drafting' && round.draftState) {
    const pack = round.draftState.currentPacks[playerId];
    if (pack && pack.length > 0) {
      // Return all tiles in the pack as pick candidates
      return pack.map((coordinate) => ({
        kind: 'pick-from-pack' as const,
        coordinate,
      }));
    }
    // No pack or empty pack means drafting is complete for this player
    return [];
  }

  if (round.continuumPendingInvoker === playerId) {
    const effect = chooseQFlashEffect(obs, obs.captains, { rng: options?.rng });
    return [
      {
        kind: 'invoke-continuum-flash' as const,
        effect,
        ...(effect === 'force-draw'
          ? { targetPlayerId: chooseForceDrawTarget(obs, obs.captains) }
          : {}),
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

    appendSpoolCandidates(obs, candidates);

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

  // No chart from hand — still allow Engage Warp Drive when legal (often
  // better than a blind draw under Delta).
  const stuckCandidates: WarpAiAction[] = [];
  appendSpoolCandidates(obs, stuckCandidates);
  if (stuckCandidates.length > 0) {
    const resolution = resolutionCandidates(obs);
    return [...stuckCandidates, ...resolution];
  }

  const resolution = resolutionCandidates(obs);
  if (resolution.length > 0) {
    return resolution;
  }

  return [];
}
