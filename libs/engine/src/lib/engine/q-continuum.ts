import type { Captain, PlayerId } from '../types/player.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type {
  QFlashEffect,
  QFlashEffectKind,
  QGamblePending,
  QRoundEffects,
} from '../types/q-continuum.js';
import { getAvailableQFlashEffects } from '../types/q-continuum.js';

function mergeQEffects(
  current: QRoundEffects | null,
  patch: Partial<QRoundEffects>
): QRoundEffects {
  const base = current ?? {
    reverseTurnOrder: false,
    temporalInversion: false,
    openAllTrails: false,
    suppressNextFracture: false,
    skipNextTurnFor: [],
    peekedSector: null,
    salamanderSwap: false,
    allStopEcho: false,
  };
  return {
    reverseTurnOrder: patch.reverseTurnOrder ?? base.reverseTurnOrder,
    temporalInversion: patch.temporalInversion ?? base.temporalInversion,
    openAllTrails: patch.openAllTrails ?? base.openAllTrails,
    suppressNextFracture: patch.suppressNextFracture ?? base.suppressNextFracture,
    skipNextTurnFor: patch.skipNextTurnFor ?? base.skipNextTurnFor,
    peekedSector:
      patch.peekedSector !== undefined ? patch.peekedSector : base.peekedSector,
    salamanderSwap: patch.salamanderSwap ?? base.salamanderSwap,
    allStopEcho: patch.allStopEcho ?? base.allStopEcho,
  };
}

export function turnOrderReversed(round: RoundState): boolean {
  const effects = round.qEffects;
  if (!effects) {
    return false;
  }
  return effects.reverseTurnOrder || effects.temporalInversion;
}

export function consumeSkipForPlayer(
  effects: QRoundEffects | null,
  playerId: PlayerId
): QRoundEffects | null {
  if (!effects || !effects.skipNextTurnFor.includes(playerId)) {
    return effects;
  }
  return mergeQEffects(effects, {
    skipNextTurnFor: effects.skipNextTurnFor.filter((id) => id !== playerId),
  });
}

/** Advance helm to the next captain, consuming any skip-lowest-penalty effects passed over. */
export function advanceToNextPlayer(
  round: RoundState,
  currentPlayerId: PlayerId
): { nextId: PlayerId; qEffects: QRoundEffects | null } {
  const reversed = turnOrderReversed(round);
  const order = reversed
    ? [...round.turnOrder].reverse()
    : [...round.turnOrder];
  const startIndex = order.indexOf(currentPlayerId);
  let qEffects = round.qEffects ?? null;

  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(startIndex + step) % order.length]!;
    const skips = new Set(qEffects?.skipNextTurnFor ?? []);
    if (!skips.has(candidate)) {
      return { nextId: candidate, qEffects };
    }
    qEffects = consumeSkipForPlayer(qEffects, candidate);
  }

  return {
    nextId: order[(startIndex + 1) % order.length]!,
    qEffects,
  };
}

export function nextActivePlayerId(
  round: RoundState,
  currentPlayerId: PlayerId
): PlayerId {
  return advanceToNextPlayer(round, currentPlayerId).nextId;
}

export function advanceActivePlayer(round: RoundState): RoundState {
  const { nextId, qEffects } = advanceToNextPlayer(
    round,
    round.activePlayerId
  );
  return {
    ...round,
    activePlayerId: nextId,
    qEffects,
  };
}

export function lowestPenaltyCaptainId(
  captains: readonly Captain[]
): PlayerId | null {
  if (captains.length === 0) {
    return null;
  }
  return captains.reduce((lowest, captain) =>
    captain.penaltyScore < lowest.penaltyScore ? captain : lowest
  ).id;
}

export function highestPenaltyCaptainId(
  captains: readonly Captain[],
  excludeId?: PlayerId
): PlayerId | null {
  const eligible = excludeId
    ? captains.filter((captain) => captain.id !== excludeId)
    : captains;
  if (eligible.length === 0) {
    return null;
  }
  return eligible.reduce((highest, captain) =>
    captain.penaltyScore > highest.penaltyScore ? captain : highest
  ).id;
}

export function buildQFlashEffect(
  kind: QFlashEffectKind,
  state: GameState,
  round: RoundState,
  invokerId: PlayerId
): QFlashEffect | null {
  if (!getAvailableQFlashEffects(round, state.modules, state.captains).includes(kind)) {
    return null;
  }

  switch (kind) {
    case 'reverse-turn-order':
      return { kind };
    case 'skip-lowest-penalty': {
      const targetPlayerId = lowestPenaltyCaptainId(state.captains);
      return targetPlayerId ? { kind, targetPlayerId } : null;
    }
    case 'peek-uncharted': {
      const coordinate = round.unchartedSectors[0];
      if (!coordinate) {
        return null;
      }
      return { kind, peek: { index: 0, coordinate } };
    }
    case 'temporal-inversion':
      return { kind };
    case 'distress-amplification':
      return { kind };
    case 'fracture-immunity':
      return { kind };
    case 'salamander-swap':
      return { kind };
    case 'all-stop-echo':
      return { kind };
    case 'q-gamble':
      return { kind };
  }
}

export function applyQFlashEffect(
  round: RoundState,
  effect: QFlashEffect,
  invokerId: PlayerId
): { round: RoundState; gamble: QGamblePending | null } {
  let nextRound = { ...round, qPendingInvoker: null as PlayerId | null };
  let gamble: QGamblePending | null = null;

  switch (effect.kind) {
    case 'reverse-turn-order':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { reverseTurnOrder: true }),
      };
      break;
    case 'skip-lowest-penalty':
      if (effect.targetPlayerId) {
        const existing = nextRound.qEffects?.skipNextTurnFor ?? [];
        nextRound = {
          ...nextRound,
          qEffects: mergeQEffects(nextRound.qEffects, {
            skipNextTurnFor: existing.includes(effect.targetPlayerId)
              ? existing
              : [...existing, effect.targetPlayerId],
          }),
        };
      }
      break;
    case 'peek-uncharted':
      if (effect.peek) {
        nextRound = {
          ...nextRound,
          qEffects: mergeQEffects(nextRound.qEffects, {
            peekedSector: {
              index: effect.peek.index,
              coordinate: effect.peek.coordinate,
              visibleTo: invokerId,
            },
          }),
        };
      }
      break;
    case 'temporal-inversion':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { temporalInversion: true }),
      };
      break;
    case 'distress-amplification':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { openAllTrails: true }),
      };
      break;
    case 'fracture-immunity':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { suppressNextFracture: true }),
      };
      break;
    case 'salamander-swap':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { salamanderSwap: true }),
      };
      break;
    case 'all-stop-echo':
      nextRound = {
        ...nextRound,
        qEffects: mergeQEffects(nextRound.qEffects, { allStopEcho: true }),
      };
      break;
    case 'q-gamble': {
      const [first, second, ...remaining] = nextRound.unchartedSectors;
      if (!first || !second) {
        break;
      }
      gamble = {
        playerId: invokerId,
        options: [first, second],
      };
      nextRound = {
        ...nextRound,
        unchartedSectors: remaining,
        qGamblePending: gamble,
      };
      break;
    }
  }

  return { round: nextRound, gamble };
}

export function clearTemporalInversionOnDouble(
  round: RoundState
): RoundState {
  if (!round.qEffects?.temporalInversion) {
    return round;
  }
  return {
    ...round,
    qEffects: mergeQEffects(round.qEffects, { temporalInversion: false }),
  };
}

export function consumeFractureImmunity(
  round: RoundState
): { round: RoundState; consumed: boolean } {
  if (!round.qEffects?.suppressNextFracture) {
    return { round, consumed: false };
  }
  return {
    round: {
      ...round,
      qEffects: mergeQEffects(round.qEffects, { suppressNextFracture: false }),
    },
    consumed: true,
  };
}

export function resolveQGamble(
  round: RoundState,
  playerId: PlayerId,
  keepIndex: 0 | 1
): RoundState {
  const pending = round.qGamblePending;
  if (!pending || pending.playerId !== playerId) {
    return round;
  }

  const kept = pending.options[keepIndex];
  const returned = pending.options[keepIndex === 0 ? 1 : 0];

  return {
    ...round,
    qGamblePending: null,
    unchartedSectors: [returned, ...round.unchartedSectors],
    hands: {
      ...round.hands,
      [playerId]: [...(round.hands[playerId] ?? []), kept],
    },
  };
}

export function allStopRequiredForWin(
  round: RoundState,
  routeKind: import('../types/actions.js').ChartRoute['kind']
): boolean {
  if (routeKind === 'neutral-zone') {
    return true;
  }
  return round.qEffects?.allStopEcho === true;
}

export function trailsOpenToOthers(round: RoundState, trailPlayerId: PlayerId): boolean {
  if (round.qEffects?.openAllTrails) {
    return true;
  }
  return round.table.warpTrails[trailPlayerId]?.distressBeacon.active === true;
}

// Re-export for tests
export { mergeQEffects };
