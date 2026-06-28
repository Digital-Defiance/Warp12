import type { ChartRoute } from '../types/actions.js';
import type { RoundState } from '../types/game-state.js';
import { isNavigationHaltedByFracture } from '../types/anomalies.js';
import { getLegalMoves } from './legal-moves.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';

/** Draw pile empty and no captain can chart anywhere (after dead-double resolution). */
export function isRoundBlocked(round: RoundState): boolean {
  if (round.unchartedSectors.length > 0) {
    return false;
  }
  if (round.treatyDeclarationRequired && !round.treatyDeclared) {
    return false;
  }
  if (round.qPendingInvoker || round.qGamblePending) {
    return false;
  }
  if (isNavigationHaltedByFracture(round.table.subspaceFracture)) {
    return false;
  }
  if (round.table.redAlert?.active) {
    return false;
  }

  const normalized = resolveDeadRedAlert(round);
  if (normalized.table.redAlert?.active) {
    return false;
  }

  for (const playerId of normalized.turnOrder) {
    if (getLegalMoves(normalized, playerId).length > 0) {
      return false;
    }
  }
  return true;
}

export function endBlockedRound(round: RoundState): RoundState {
  return {
    ...round,
    phase: 'ended',
    roundWinnerId: null,
    roundBlocked: true,
    treatyDeclarationRequired: false,
    treatyDeclared: true,
    mandatoryPlay: null,
    pendingRoundWin: null,
  };
}

export function maybeEndBlockedRound(round: RoundState): RoundState {
  const normalized = resolveDeadRedAlert(round);
  if (normalized.phase === 'ended' || !isRoundBlocked(normalized)) {
    return normalized;
  }
  return endBlockedRound(normalized);
}

export interface PendingRoundWin {
  readonly playerId: string;
  readonly routeKind: ChartRoute['kind'];
}

export function applyPendingRoundWin(round: RoundState): RoundState {
  if (!round.pendingRoundWin) {
    return round;
  }
  const { playerId, routeKind } = round.pendingRoundWin;
  const treatyRequired =
    routeKind === 'neutral-zone' || round.qEffects?.treatyEcho === true;
  return {
    ...round,
    pendingRoundWin: null,
    roundWinnerId: playerId,
    treatyDeclarationRequired: treatyRequired,
    treatyDeclared: !treatyRequired,
    phase: treatyRequired ? 'playing' : 'ended',
  };
}

export function finalizeRoundWinAfterQ(round: RoundState): RoundState {
  let next = applyPendingRoundWin(round);
  if (next.phase === 'ended') {
    return maybeEndBlockedRound(next);
  }
  return next;
}
