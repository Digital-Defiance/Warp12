import { coordinatePipValue } from '../types/coordinate.js';
import type { ActionResult } from '../types/actions.js';
import {
  DEFAULT_CAMPAIGN_ROUNDS,
  SALAMANDER_PENALTY_TILE_VALUE,
  salamanderPenaltyApplies,
} from '../constants/setup.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { DoubleZeroScore } from '../types/house-rules.js';
import { shuffleCoordinates } from '../domino/coordinates.js';
import {
  collectRoundCoordinatesForRecycle,
  createRoundStateFromDeal,
  dealRoundFromShuffled,
} from '../setup/create-game.js';
import { highestPointsCaptainId } from './continuum.js';
import { withRoundAndCaptains } from './helpers.js';

function penaltyForHand(
  hand: readonly { low: number; high: number }[],
  salamanderEnabled: boolean,
  roundNumber: number,
  doubleZeroScore: DoubleZeroScore,
  options?: { swapHolder?: boolean }
): number {
  const salamander =
    salamanderEnabled && salamanderPenaltyApplies(roundNumber);
  let total = 0;
  for (const coordinate of hand) {
    if (coordinate.low === 12 && coordinate.high === 12) {
      if (salamander && options?.swapHolder) {
        // Salamander swap: the entire doubled 12-12 penalty leaves the holder
        // and lands on the leader — the holder pays nothing for this tile.
        continue;
      }
      total += salamander
        ? SALAMANDER_PENALTY_TILE_VALUE
        : coordinatePipValue(coordinate);
    } else if (coordinate.low === 0 && coordinate.high === 0) {
      total += doubleZeroScore;
    } else {
      total += coordinatePipValue(coordinate);
    }
  }
  return total;
}

/**
 * Pip penalty for tiles still in hand (same rules as end-of-round scoring).
 * `doubleZeroScore` sets the double-blank value (default 50 = tournament standard).
 */
export function handPoints(
  hand: readonly { low: number; high: number }[],
  salamanderEnabled: boolean,
  roundNumber: number,
  doubleZeroScore: DoubleZeroScore = 50
): number {
  return penaltyForHand(hand, salamanderEnabled, roundNumber, doubleZeroScore);
}

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

function tallyRoundPoints(state: GameState, round: RoundState) {
  const salamander = state.modules.salamanderPenalty.enabled;
  const doubleZeroScore = state.houseRules.doubleZeroScore;
  const salamanderSwap =
    salamander && round.continuumEffects?.salamanderSwap === true;

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
      swapTarget = highestPointsCaptainId(
        state.captains,
        round.roundWinnerId ?? undefined
      );
    }
  }

  return state.captains.map((captain) => {
    if (!round.roundBlocked && captain.id === round.roundWinnerId) {
      return captain;
    }
    const hand = round.hands[captain.id] ?? [];
    let penalty = penaltyForHand(
      hand,
      salamander,
      round.roundNumber,
      doubleZeroScore,
      { swapHolder: captain.id === swapHolder }
    );
    if (
      swapTarget &&
      swapHolder &&
      swapTarget !== swapHolder &&
      captain.id === swapTarget
    ) {
      // The full doubled Salamander penalty lands on the leader; the 12-12
      // holder paid nothing for the tile (swapHolder above).
      penalty += SALAMANDER_PENALTY_TILE_VALUE;
    }
    return {
      ...captain,
      pointsScore: captain.pointsScore + penalty,
    };
  });
}

export function scoreRound(
  state: GameState,
  round: RoundState,
  random: () => number = Math.random
): ActionResult {
  if (round.phase !== 'ended') {
    return { ok: false, violation: 'ROUND_NOT_PLAYING' };
  }
  if (!round.roundBlocked && !round.roundWinnerId) {
    return { ok: false, violation: 'ROUND_NOT_PLAYING' };
  }

  const tallyPoints = state.objective !== 'go-out';
  const captains = tallyPoints
    ? tallyRoundPoints(state, round)
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
  const campaignRounds = state.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS;
  const gameComplete = nextRoundNumber > campaignRounds;

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
    largeFleetHandSize: state.houseRules.largeFleetHandSize,
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
