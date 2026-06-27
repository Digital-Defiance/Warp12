import { coordinatePipValue } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { ActionResult } from '../types/actions.js';
import {
  SALAMANDER_PENALTY_TILE_VALUE,
  salamanderPenaltyApplies,
} from '../constants/setup.js';
import { shuffleCoordinates } from '../domino/coordinates.js';
import {
  collectRoundCoordinatesForRecycle,
  createRoundStateFromDeal,
  dealRoundFromShuffled,
} from '../setup/create-game.js';
import { highestPenaltyCaptainId } from './q-continuum.js';
import { withRoundAndCaptains } from './helpers.js';

function penaltyForHand(
  hand: readonly { low: number; high: number }[],
  salamanderEnabled: boolean,
  roundNumber: number,
  options?: { ignoreSalamanderDoubling?: boolean }
): number {
  const salamander =
    salamanderEnabled && salamanderPenaltyApplies(roundNumber);
  let total = 0;
  for (const coordinate of hand) {
    if (
      salamander &&
      !options?.ignoreSalamanderDoubling &&
      coordinate.low === 12 &&
      coordinate.high === 12
    ) {
      total += SALAMANDER_PENALTY_TILE_VALUE;
    } else {
      total += coordinatePipValue(coordinate);
    }
  }
  return total;
}

function clearActiveQFlash(state: GameState): GameState {
  return {
    ...state,
    modules: {
      ...state.modules,
      qContinuum: {
        ...state.modules.qContinuum,
        activeFlash: null,
      },
    },
  };
}

function tallyRoundPenalties(state: GameState, round: RoundState) {
  const salamander = state.modules.salamanderPenalty.enabled;
  const salamanderSwap =
    salamander && round.qEffects?.salamanderSwap === true;

  let swapHolder: string | null = null;
  let swapTarget: string | null = null;

  if (salamanderSwap) {
    for (const captain of state.captains) {
      if (captain.id === round.roundWinnerId) {
        continue;
      }
      const hand = round.hands[captain.id] ?? [];
      if (hand.some((tile) => tile.low === 12 && tile.high === 12)) {
        swapHolder = captain.id;
        break;
      }
    }
    if (swapHolder) {
      swapTarget = highestPenaltyCaptainId(
        state.captains,
        round.roundWinnerId ?? undefined
      );
    }
  }

  return state.captains.map((captain) => {
    if (captain.id === round.roundWinnerId) {
      return captain;
    }
    const hand = round.hands[captain.id] ?? [];
    let penalty = penaltyForHand(hand, salamander, round.roundNumber, {
      ignoreSalamanderDoubling: captain.id === swapHolder,
    });
    if (
      swapTarget &&
      swapHolder &&
      swapTarget !== swapHolder &&
      captain.id === swapTarget
    ) {
      penalty += SALAMANDER_PENALTY_TILE_VALUE;
    }
    return {
      ...captain,
      penaltyScore: captain.penaltyScore + penalty,
    };
  });
}

export function scoreRound(
  state: GameState,
  round: RoundState,
  random: () => number = Math.random
): ActionResult {
  if (round.phase !== 'ended' || !round.roundWinnerId) {
    return { ok: false, violation: 'ROUND_NOT_PLAYING' };
  }

  const tallyPenalties = state.objective !== 'go-out';
  const captains = tallyPenalties
    ? tallyRoundPenalties(state, round)
    : state.captains;

  if (state.objective === 'go-out') {
    return {
      ok: true,
      state: clearActiveQFlash({
        ...state,
        phase: 'complete',
        captains,
        round: { ...round, phase: 'ended' },
        completedRounds: 1,
      }),
    };
  }

  const nextRoundNumber = round.roundNumber + 1;
  const gameComplete = nextRoundNumber > 13;

  if (gameComplete) {
    return {
      ok: true,
      state: clearActiveQFlash({
        ...state,
        phase: 'complete',
        captains,
        round: { ...round, phase: 'ended' },
        completedRounds: state.completedRounds + 1,
      }),
    };
  }

  const shuffled = shuffleCoordinates(
    collectRoundCoordinatesForRecycle(round),
    random
  );
  const nextDeal = dealRoundFromShuffled({
    roundNumber: nextRoundNumber,
    captains,
    shuffledCoordinates: shuffled,
    turnOrder: round.turnOrder,
  });
  const nextRound = createRoundStateFromDeal(nextDeal);

  return {
    ok: true,
    state: clearActiveQFlash(
      withRoundAndCaptains(
        { ...state, phase: 'active', completedRounds: state.completedRounds + 1 },
        nextRound,
        captains
      )
    ),
  };
}
