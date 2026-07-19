import type { ActionResult } from '../types/actions.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { Captain, PlayerId } from '../types/player.js';
import {
  clampGoOutWinsToWin,
  DEFAULT_GO_OUT_WINS_TO_WIN,
  resolveGoOutOvertime,
  resolveGoOutStructure,
  type GoOutStructure,
} from '../types/go-out-campaign.js';
import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DOUBLE_TWELVE_MAX_PIPS,
} from '../constants/setup.js';
import { shuffleCoordinates } from '../domino/coordinates.js';
import {
  collectRoundCoordinatesForRecycle,
  createRoundStateFromDeal,
  createRoundStateWithDraft,
  dealRoundFromShuffled,
  roundStarterForRound,
} from '../setup/create-game.js';
import { withRoundAndCaptains } from './helpers.js';
import { applySensorGridToRound } from './sensor-grid.js';

function clearActiveQFlash(state: GameState): GameState {
  return {
    ...state,
    modules: {
      ...state.modules,
      continuum: {
        ...state.modules.continuum,
        activeFlash: null,
      },
    },
  };
}

export function goOutWinsOf(captain: Captain): number {
  return captain.goOutWins ?? 0;
}

export function leadingGoOutWins(
  captains: readonly Captain[]
): { readonly maxWins: number; readonly leaders: readonly PlayerId[] } {
  let maxWins = 0;
  for (const captain of captains) {
    maxWins = Math.max(maxWins, goOutWinsOf(captain));
  }
  const leaders = captains
    .filter((c) => goOutWinsOf(c) === maxWins)
    .map((c) => c.id);
  return { maxWins, leaders };
}

function withGoOutWin(
  captains: readonly Captain[],
  winnerId: PlayerId
): readonly Captain[] {
  return captains.map((captain) =>
    captain.id === winnerId
      ? { ...captain, goOutWins: goOutWinsOf(captain) + 1 }
      : captain
  );
}

/**
 * Deal the next (or re-dealt) round. Clears once-per-round module flags
 * (Trail Momentum / Hand Exchange).
 */
export function dealContinuingRound(
  state: GameState,
  captains: readonly Captain[],
  turnOrder: readonly PlayerId[],
  roundNumber: number,
  shuffledCoordinates: readonly import('../types/coordinate.js').Coordinate[],
  squadrons: RoundState['squadrons'],
  completedRounds: number
): GameState {
  const matchStarterIndex = state.matchStarterIndex ?? 0;
  const starterId = roundStarterForRound(
    turnOrder,
    roundNumber,
    matchStarterIndex
  );
  const maxPip = state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS;

  let nextRound: RoundState;

  if (state.modules.drafting.enabled) {
    nextRound = createRoundStateWithDraft({
      roundNumber,
      captains,
      shuffledCoordinates,
      turnOrder,
      roundStarterId: starterId,
      maxPip,
      largeFleetHandSize: state.houseRules.largeFleetHandSize,
      packSize: state.modules.drafting.packSize,
      squadrons,
    });
  } else {
    const nextDeal = dealRoundFromShuffled({
      roundNumber,
      captains,
      shuffledCoordinates,
      turnOrder,
      roundStarterId: starterId,
      largeFleetHandSize: state.houseRules.largeFleetHandSize,
      maxPip,
    });
    nextRound = createRoundStateFromDeal(nextDeal, squadrons);
  }

  nextRound = applySensorGridToRound(nextRound, state.modules);

  if (state.modules.warpDriveSpool.enabled) {
    nextRound = {
      ...nextRound,
      hazardMarkerHolder: nextRound.table.spacedock.placedBy,
      hazardMarkerPassCount: 0,
    };
  }

  if (state.modules.temporalDebt.enabled) {
    const debtTokens: Record<string, number> = {};
    for (const captain of captains) {
      debtTokens[captain.id] = 0;
    }
    nextRound = { ...nextRound, debtTokens };
  }

  return clearActiveQFlash(
    withRoundAndCaptains(
      {
        ...state,
        phase: 'active',
        completedRounds,
        trailMomentumClaimedBy: null,
        handExchangeResolved: false,
        goOutOvertimePending: false,
      },
      nextRound,
      captains
    )
  );
}

function completeGoOutSector(
  state: GameState,
  captains: readonly Captain[],
  round: RoundState
): ActionResult {
  return {
    ok: true,
    state: clearActiveQFlash({
      ...state,
      phase: 'complete',
      captains,
      round: { ...round, phase: 'ended' },
      completedRounds: state.completedRounds + (round.roundBlocked ? 0 : 1),
      goOutOvertimePending: false,
    }),
  };
}

function structureOf(state: GameState): GoOutStructure {
  return resolveGoOutStructure(state.goOutStructure);
}

/**
 * Score an ended go-out round: credit a win, re-deal blocked rounds, continue
 * campaigns, or complete the sector.
 */
export function scoreGoOutRound(
  state: GameState,
  round: RoundState,
  random: () => number = Math.random
): ActionResult {
  const shuffled = shuffleCoordinates(
    collectRoundCoordinatesForRecycle(round),
    random
  );

  // Blocked: re-deal the same Spacedock / starter — no win credited.
  if (round.roundBlocked || !round.roundWinnerId) {
    return {
      ok: true,
      state: dealContinuingRound(
        state,
        state.captains,
        round.turnOrder,
        round.roundNumber,
        shuffled,
        round.squadrons,
        state.completedRounds
      ),
    };
  }

  const captains = withGoOutWin(state.captains, round.roundWinnerId);
  const structure = structureOf(state);
  const completedAfter = state.completedRounds + 1;
  const { maxWins, leaders } = leadingGoOutWins(captains);

  if (structure === 'sudden-death') {
    return completeGoOutSector(state, captains, round);
  }

  if (structure === 'first-to') {
    const target = clampGoOutWinsToWin(
      state.goOutWinsToWin ?? DEFAULT_GO_OUT_WINS_TO_WIN
    );
    if (maxWins >= target && leaders.length === 1) {
      return completeGoOutSector(state, captains, round);
    }
    return {
      ok: true,
      state: dealContinuingRound(
        {
          ...state,
          goOutInOvertime:
            round.roundNumber >= (state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS) + 1
              ? true
              : state.goOutInOvertime,
        },
        captains,
        round.turnOrder,
        round.roundNumber + 1,
        shuffled,
        round.squadrons,
        completedAfter
      ),
    };
  }

  // fixed-rounds
  const campaignRounds = state.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS;
  const inOvertime = state.goOutInOvertime === true;

  if (!inOvertime && completedAfter < campaignRounds) {
    return {
      ok: true,
      state: dealContinuingRound(
        state,
        captains,
        round.turnOrder,
        round.roundNumber + 1,
        shuffled,
        round.squadrons,
        completedAfter
      ),
    };
  }

  // Regulation complete (or OT round finished) — unique leader wins.
  if (leaders.length === 1) {
    return completeGoOutSector(state, captains, round);
  }

  // Tied — overtime
  const overtime = resolveGoOutOvertime(state.goOutOvertime);
  if (overtime === 'offer' && !inOvertime) {
    return {
      ok: true,
      state: clearActiveQFlash({
        ...state,
        phase: 'complete',
        captains,
        round: { ...round, phase: 'ended' },
        completedRounds: completedAfter,
        goOutOvertimePending: true,
      }),
    };
  }

  // Force OT (or continue OT after an accepted offer)
  return {
    ok: true,
    state: dealContinuingRound(
      { ...state, goOutInOvertime: true },
      captains,
      round.turnOrder,
      round.roundNumber + 1,
      shuffled,
      round.squadrons,
      completedAfter
    ),
  };
}

/**
 * Host accepts or declines offered go-out overtime after a tied fixed campaign.
 */
export function resolveGoOutOvertimeOffer(
  state: GameState,
  accept: boolean,
  random: () => number = Math.random
): ActionResult {
  if (state.objective !== 'go-out' || state.goOutOvertimePending !== true) {
    return { ok: false, violation: 'GAME_NOT_ACTIVE' };
  }
  const round = state.round;
  if (!round) {
    return { ok: false, violation: 'GAME_NOT_ACTIVE' };
  }

  if (!accept) {
    return {
      ok: true,
      state: clearActiveQFlash({
        ...state,
        phase: 'complete',
        goOutOvertimePending: false,
        round: { ...round, phase: 'ended' },
      }),
    };
  }

  const shuffled = shuffleCoordinates(
    collectRoundCoordinatesForRecycle(round),
    random
  );
  return {
    ok: true,
    state: dealContinuingRound(
      { ...state, goOutInOvertime: true, goOutOvertimePending: false },
      state.captains,
      round.turnOrder,
      round.roundNumber + 1,
      shuffled,
      round.squadrons,
      state.completedRounds
    ),
  };
}
