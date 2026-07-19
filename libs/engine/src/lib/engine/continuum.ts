import type { Captain, PlayerId } from '../types/player.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { GameModules } from '../types/modules.js';
import type { Coordinate } from '../types/coordinate.js';
import { trailKeyFor } from './squadrons.js';
import type {
  FlashEffect,
  FlashEffectKind,
  GamblePending,
  RoundEffects,
} from '../types/continuum.js';
import { getAvailableFlashEffects } from '../types/continuum.js';
import { refillSensorGrid } from './sensor-grid.js';

function mergecontinuumEffects(
  current: RoundEffects | null,
  patch: Partial<RoundEffects>
): RoundEffects {
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
  const effects = round.continuumEffects;
  if (!effects) {
    return false;
  }
  return effects.reverseTurnOrder || effects.temporalInversion;
}

export function consumeSkipForPlayer(
  effects: RoundEffects | null,
  playerId: PlayerId
): RoundEffects | null {
  if (!effects || !effects.skipNextTurnFor.includes(playerId)) {
    return effects;
  }
  return mergecontinuumEffects(effects, {
    skipNextTurnFor: effects.skipNextTurnFor.filter((id) => id !== playerId),
  });
}

/** Advance helm to the next captain, consuming any skip-next-turn effects passed over. */
export function advanceToNextPlayer(
  round: RoundState,
  currentPlayerId: PlayerId
): { nextId: PlayerId; continuumEffects: RoundEffects | null } {
  const reversed = turnOrderReversed(round);
  const order = reversed
    ? [...round.turnOrder].reverse()
    : [...round.turnOrder];
  const startIndex = order.indexOf(currentPlayerId);
  let continuumEffects = round.continuumEffects ?? null;

  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(startIndex + step) % order.length]!;
    const skips = new Set(continuumEffects?.skipNextTurnFor ?? []);
    if (!skips.has(candidate)) {
      return { nextId: candidate, continuumEffects };
    }
    continuumEffects = consumeSkipForPlayer(continuumEffects, candidate);
  }

  return {
    nextId: order[(startIndex + 1) % order.length]!,
    continuumEffects,
  };
}

export function nextActivePlayerId(
  round: RoundState,
  currentPlayerId: PlayerId
): PlayerId {
  return advanceToNextPlayer(round, currentPlayerId).nextId;
}

export function advanceActivePlayer(round: RoundState): RoundState {
  const { nextId, continuumEffects } = advanceToNextPlayer(
    round,
    round.activePlayerId
  );
  return {
    ...round,
    activePlayerId: nextId,
    continuumEffects,
  };
}

export function lowestPointsCaptainId(
  captains: readonly Captain[]
): PlayerId | null {
  if (captains.length === 0) {
    return null;
  }
  return captains.reduce((lowest, captain) =>
    captain.pointsScore < lowest.pointsScore ? captain : lowest
  ).id;
}

export function highestPointsCaptainId(
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
    captain.pointsScore > highest.pointsScore ? captain : highest
  ).id;
}

/** Captains tied for fewest coordinates in hand (Go-out Skip Lightest Hand). */
export function lightestHandCaptainIds(
  round: RoundState,
  captains: readonly Captain[]
): readonly PlayerId[] {
  if (captains.length === 0) {
    return [];
  }
  const counts = captains.map((captain) => ({
    id: captain.id,
    n: (round.hands[captain.id] ?? []).length,
  }));
  const min = Math.min(...counts.map((c) => c.n));
  return counts.filter((c) => c.n === min).map((c) => c.id);
}

/**
 * Draw up to `count` tiles into pools from Uncharted, then Sensor Grid.
 * Returns updated pools + tiles drawn (may be fewer than count).
 */
export function drawTilesFromPools(
  round: RoundState,
  modules: GameModules,
  count: number
): {
  readonly tiles: readonly Coordinate[];
  readonly unchartedSectors: readonly Coordinate[];
  readonly sensorGrid: readonly Coordinate[];
} {
  const tiles: Coordinate[] = [];
  let remainingUncharted = [...round.unchartedSectors];
  let remainingSensorGrid = [...(round.sensorGrid ?? [])];

  for (let i = 0; i < count; i += 1) {
    if (remainingUncharted.length > 0) {
      tiles.push(remainingUncharted.shift()!);
    } else if (remainingSensorGrid.length > 0) {
      tiles.push(remainingSensorGrid.shift()!);
    } else {
      break;
    }
  }

  const refilled = refillSensorGrid(
    remainingSensorGrid,
    remainingUncharted,
    modules.sensorGrid.enabled ? modules.sensorGrid.gridSize : 0
  );

  return {
    tiles,
    unchartedSectors: refilled.unchartedSectors,
    sensorGrid: refilled.sensorGrid,
  };
}

export function buildQFlashEffect(
  kind: FlashEffectKind,
  state: GameState,
  round: RoundState,
  invokerId: PlayerId,
  targetPlayerId?: PlayerId
): FlashEffect | null {
  if (
    !getAvailableFlashEffects(
      round,
      state.modules,
      state.captains,
      state.objective
    ).includes(kind)
  ) {
    return null;
  }

  switch (kind) {
    case 'reverse-turn-order':
      return { kind };
    case 'skip-lowest-points': {
      const lowest = lowestPointsCaptainId(state.captains);
      return lowest ? { kind, targetPlayerId: lowest } : null;
    }
    case 'skip-lightest-hand':
      return { kind };
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
    case 'force-draw': {
      if (
        !targetPlayerId ||
        targetPlayerId === invokerId ||
        !state.captains.some((c) => c.id === targetPlayerId)
      ) {
        return null;
      }
      return { kind, targetPlayerId };
    }
    case 'all-stop-echo':
      return { kind };
    case 'continuum-wager':
      return { kind };
  }
}

export function applyQFlashEffect(
  round: RoundState,
  effect: FlashEffect,
  invokerId: PlayerId,
  modules?: GameModules
): { round: RoundState; gamble: GamblePending | null } {
  let nextRound = { ...round, continuumPendingInvoker: null as PlayerId | null };
  let gamble: GamblePending | null = null;

  switch (effect.kind) {
    case 'reverse-turn-order':
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          reverseTurnOrder: true,
        }),
      };
      break;
    case 'skip-lowest-points':
      if (effect.targetPlayerId) {
        const existing = nextRound.continuumEffects?.skipNextTurnFor ?? [];
        nextRound = {
          ...nextRound,
          continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
            skipNextTurnFor: existing.includes(effect.targetPlayerId)
              ? existing
              : [...existing, effect.targetPlayerId],
          }),
        };
      }
      break;
    case 'skip-lightest-hand': {
      const lightest = lightestHandCaptainIds(
        nextRound,
        nextRound.turnOrder.map((id) => ({
          id,
          displayName: id,
          pointsScore: 0,
        }))
      );
      const existing = nextRound.continuumEffects?.skipNextTurnFor ?? [];
      const merged = [...existing];
      for (const id of lightest) {
        if (!merged.includes(id)) {
          merged.push(id);
        }
      }
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          skipNextTurnFor: merged,
        }),
      };
      break;
    }
    case 'peek-uncharted':
      if (effect.peek) {
        nextRound = {
          ...nextRound,
          continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
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
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          temporalInversion: true,
        }),
      };
      break;
    case 'distress-amplification':
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          openAllTrails: true,
        }),
      };
      break;
    case 'fracture-immunity':
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          suppressNextFracture: true,
        }),
      };
      break;
    case 'salamander-swap':
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          salamanderSwap: true,
        }),
      };
      break;
    case 'force-draw': {
      if (effect.targetPlayerId && modules) {
        const drawn = drawTilesFromPools(nextRound, modules, 1);
        if (drawn.tiles.length > 0) {
          nextRound = {
            ...nextRound,
            unchartedSectors: drawn.unchartedSectors,
            sensorGrid: drawn.sensorGrid,
            hands: {
              ...nextRound.hands,
              [effect.targetPlayerId]: [
                ...(nextRound.hands[effect.targetPlayerId] ?? []),
                ...drawn.tiles,
              ],
            },
          };
        }
      }
      break;
    }
    case 'all-stop-echo':
      nextRound = {
        ...nextRound,
        continuumEffects: mergecontinuumEffects(nextRound.continuumEffects, {
          allStopEcho: true,
        }),
      };
      break;
    case 'continuum-wager': {
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
        continuumWagerPending: gamble,
      };
      break;
    }
  }

  return { round: nextRound, gamble };
}

export function clearTemporalInversionOnDouble(
  round: RoundState
): RoundState {
  if (!round.continuumEffects?.temporalInversion) {
    return round;
  }
  return {
    ...round,
    continuumEffects: mergecontinuumEffects(round.continuumEffects, {
      temporalInversion: false,
    }),
  };
}

export function consumeFractureImmunity(
  round: RoundState
): { round: RoundState; consumed: boolean } {
  if (!round.continuumEffects?.suppressNextFracture) {
    return { round, consumed: false };
  }
  return {
    round: {
      ...round,
      continuumEffects: mergecontinuumEffects(round.continuumEffects, {
        suppressNextFracture: false,
      }),
    },
    consumed: true,
  };
}

export function resolveQGamble(
  round: RoundState,
  playerId: PlayerId,
  keepIndex: 0 | 1
): RoundState {
  const pending = round.continuumWagerPending;
  if (!pending || pending.playerId !== playerId) {
    return round;
  }

  const kept = pending.options[keepIndex];
  const returned = pending.options[keepIndex === 0 ? 1 : 0];

  return {
    ...round,
    continuumWagerPending: null,
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
  return round.continuumEffects?.allStopEcho === true;
}

/** Round ends immediately; ceremony only affects log/sound flags. */
export function resolveRoundWinAllStop(
  round: RoundState,
  routeKind: import('../types/actions.js').ChartRoute['kind'],
  houseRules: import('../types/house-rules.js').HouseRules
): {
  readonly allStopRequired: boolean;
  readonly allStopDeclared: boolean;
  readonly phase: 'ended';
} {
  const announce =
    allStopRequiredForWin(round, routeKind) && houseRules.allStopCeremony;
  return {
    allStopRequired: announce,
    allStopDeclared: announce,
    phase: 'ended',
  };
}

export function trailsOpenToOthers(
  round: RoundState,
  trailPlayerId: PlayerId
): boolean {
  if (round.continuumEffects?.openAllTrails) {
    return true;
  }
  const trailKey = trailKeyFor(round, trailPlayerId);
  return round.table.warpTrails[trailKey]?.distressBeacon.active === true;
}

// Re-export for tests
export { mergecontinuumEffects };
