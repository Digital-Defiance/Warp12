import { coordinateMatchesValue } from '../types/coordinate.js';
import type { ChartRoute } from '../types/actions.js';
import type { RoundState } from '../types/game-state.js';
import { isNavigationHaltedByFracture } from '../types/anomalies.js';
import {
  DEFAULT_HOUSE_RULES,
  type HouseRules,
} from '../types/house-rules.js';
import {
  neutralZoneOpenValue,
  trailOpenValue,
} from '../table/table-state.js';
import { dropToImpulseRequiredForWin } from './q-continuum.js';
import { getLegalMoves } from './legal-moves.js';
import { resolveDeadRedAlert } from './dead-red-alert.js';

/** Captains who can still helm — skipped captains are sidelined for this cycle. */
function captainsEligibleToResolve(round: RoundState): readonly string[] {
  const skipped = new Set(round.qEffects?.skipNextTurnFor ?? []);
  return round.turnOrder.filter((playerId) => !skipped.has(playerId));
}

function anyHandContainsMatchingValue(
  round: RoundState,
  value: number
): boolean {
  for (const playerId of captainsEligibleToResolve(round)) {
    for (const coordinate of round.hands[playerId] ?? []) {
      if (coordinateMatchesValue(coordinate, value)) {
        return true;
      }
    }
  }
  return false;
}

function fractureNeedsStabilizer(round: RoundState): boolean {
  const fracture = round.table.subspaceFracture;
  return (
    isNavigationHaltedByFracture(fracture, round.table.redAlert) &&
    (fracture?.stabilizers.length ?? 0) < 3
  );
}

function redAlertCoverValue(round: RoundState): number | null {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active) {
    return null;
  }
  if (redAlert.neutralZone) {
    return neutralZoneOpenValue(
      round.table.neutralZone,
      round.spacedockValue
    );
  }
  const trail = round.table.warpTrails[redAlert.trailPlayerId];
  if (!trail) {
    return null;
  }
  return trailOpenValue(trail, round.spacedockValue);
}

/** Draw pile empty and no captain can chart anywhere (after dead-double resolution). */
export function isRoundBlocked(
  round: RoundState,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): boolean {
  if (round.unchartedSectors.length > 0) {
    return false;
  }
  if (round.dropToImpulseRequired && !round.dropToImpulseDeclared) {
    return false;
  }
  if (round.qPendingInvoker || round.qGamblePending) {
    return false;
  }

  const normalized = resolveDeadRedAlert(round);

  for (const playerId of normalized.turnOrder) {
    if (getLegalMoves(normalized, playerId, houseRules).length > 0) {
      return false;
    }
  }

  if (fractureNeedsStabilizer(normalized)) {
    return !anyHandContainsMatchingValue(
      normalized,
      normalized.table.subspaceFracture!.requiredValue
    );
  }

  if (normalized.table.redAlert?.active) {
    const coverValue = redAlertCoverValue(normalized);
    if (coverValue === null) {
      return true;
    }
    return !anyHandContainsMatchingValue(normalized, coverValue);
  }

  return true;
}

export function endBlockedRound(round: RoundState): RoundState {
  return {
    ...round,
    phase: 'ended',
    roundWinnerId: null,
    roundBlocked: true,
    dropToImpulseRequired: false,
    dropToImpulseDeclared: true,
    mandatoryPlay: null,
    pendingRoundWin: null,
  };
}

export function maybeEndBlockedRound(
  round: RoundState,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): RoundState {
  const normalized = resolveDeadRedAlert(round);
  if (normalized.phase === 'ended' || !isRoundBlocked(normalized, houseRules)) {
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
  const dropToImpulseRequired = dropToImpulseRequiredForWin(round, routeKind);
  return {
    ...round,
    pendingRoundWin: null,
    roundWinnerId: playerId,
    dropToImpulseRequired,
    dropToImpulseDeclared: !dropToImpulseRequired,
    phase: dropToImpulseRequired ? 'playing' : 'ended',
  };
}

export function finalizeRoundWinAfterQ(
  round: RoundState,
  houseRules: HouseRules = DEFAULT_HOUSE_RULES
): RoundState {
  let next = applyPendingRoundWin(round);
  if (next.phase === 'ended') {
    return maybeEndBlockedRound(next, houseRules);
  }
  return next;
}
