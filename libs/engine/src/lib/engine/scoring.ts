import {
  coordinatePipValue,
} from '../types/coordinate.js';
import type { ActionResult } from '../types/actions.js';
import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DOUBLE_TWELVE_MAX_PIPS,
  HAZARD_MARKER_PASS_PENALTY,
  isHighestDouble,
  salamanderPenaltyApplies,
  salamanderPenaltyTileValue,
} from '../constants/setup.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { DoubleZeroScore } from '../types/house-rules.js';
import { shuffleCoordinates } from '../domino/coordinates.js';
import {
  collectRoundCoordinatesForRecycle,
  createRoundStateFromDeal,
  createRoundStateWithDraft,
  dealRoundFromShuffled,
} from '../setup/create-game.js';
import { highestPointsCaptainId } from './continuum.js';
import { withRoundAndCaptains } from './helpers.js';
import { determineLongestTrailWinners } from './longest-trail.js';
import type { PlayerId } from '../types/player.js';

function penaltyForHand(
  hand: readonly { low: number; high: number }[],
  salamanderEnabled: boolean,
  roundNumber: number,
  doubleZeroScore: DoubleZeroScore,
  maxPip: number,
  options?: { swapHolder?: boolean }
): number {
  const salamander =
    salamanderEnabled && salamanderPenaltyApplies(roundNumber);
  const salamanderValue = salamanderPenaltyTileValue(maxPip);
  let total = 0;
  for (const coordinate of hand) {
    if (isHighestDouble(coordinate, maxPip)) {
      if (salamander && options?.swapHolder) {
        // Salamander swap: the entire doubled highest-double penalty leaves the
        // holder and lands on the leader — the holder pays nothing for this tile.
        continue;
      }
      total += salamander
        ? salamanderValue
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
  doubleZeroScore: DoubleZeroScore = 50,
  maxPip: number = DOUBLE_TWELVE_MAX_PIPS
): number {
  return penaltyForHand(
    hand,
    salamanderEnabled,
    roundNumber,
    doubleZeroScore,
    maxPip
  );
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
  const maxPip = state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS;
  const salamanderSwap =
    salamander && round.continuumEffects?.salamanderSwap === true;
  const salamanderValue = salamanderPenaltyTileValue(maxPip);
  const warpDriveSpoolEnabled = state.modules.warpDriveSpool?.enabled ?? false;
  const longestTrailEnabled = state.modules.longestTrail?.enabled ?? false;
  const longestTrailBonus = state.modules.longestTrail?.bonus ?? -3;
  const temporalInversionEnabled = state.modules.temporalInversion?.enabled ?? false;
  
  // Module Kappa: Temporal Inversion - even rounds invert scoring
  const isInvertedRound = temporalInversionEnabled && round.roundNumber % 2 === 0;

  let swapHolder: string | null = null;
  let swapTarget: string | null = null;

  // Determine longest trail winners (Module Theta)
  const longestTrailWinners = longestTrailEnabled 
    ? new Set(determineLongestTrailWinners(round))
    : new Set<PlayerId>();

  if (salamanderSwap) {
    for (const captain of state.captains) {
      if (captain.id === round.roundWinnerId) {
        continue;
      }
      const hand = round.hands[captain.id] ?? [];
      if (hand.some((tile) => isHighestDouble(tile, maxPip))) {
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
    const hand = round.hands[captain.id] ?? [];
    const isWinner = !round.roundBlocked && captain.id === round.roundWinnerId;
    
    let penalty = 0;
    
    if (isInvertedRound) {
      // Even rounds: HIGHEST hand wins, going out is bad
      // Winner = person with highest hand penalty (or who went out = gets max penalty)
      if (isWinner) {
        // Going out in an inverted round = you wanted to KEEP tiles, so max penalty
        penalty = maxPip * 2 * 13; // Max possible hand (all tiles)
      } else {
        // Non-winners score their actual hand (higher = better in inverted scoring)
        penalty = -penaltyForHand(
          hand,
          salamander,
          round.roundNumber,
          doubleZeroScore,
          maxPip,
          { swapHolder: captain.id === swapHolder }
        );
        
        if (
          swapTarget &&
          swapHolder &&
          swapTarget !== swapHolder &&
          captain.id === swapTarget
        ) {
          penalty -= salamanderValue;
        }
      }
    } else {
      // Odd rounds: Normal scoring (lowest hand wins)
      if (isWinner) {
        // Winner doesn't score hand penalty, but can still get other adjustments
        // (hazard marker, longest trail)
        penalty = 0;
      } else {
        penalty = penaltyForHand(
          hand,
          salamander,
          round.roundNumber,
          doubleZeroScore,
          maxPip,
          { swapHolder: captain.id === swapHolder }
        );
        
        if (
          swapTarget &&
          swapHolder &&
          swapTarget !== swapHolder &&
          captain.id === swapTarget
        ) {
          penalty += salamanderValue;
        }
      }
    }
    
    // Module Delta: Hazard marker pass penalty (applies in both normal and inverted)
    if (warpDriveSpoolEnabled && 
        captain.id === round.hazardMarkerHolder &&
        round.hazardMarkerPassCount && 
        round.hazardMarkerPassCount > 0) {
      penalty += HAZARD_MARKER_PASS_PENALTY * round.hazardMarkerPassCount;
    }
    
    // Module Theta: Longest trail bonus (applies in both normal and inverted)
    if (longestTrailEnabled && longestTrailWinners.has(captain.id)) {
      penalty += longestTrailBonus; // Negative value = bonus
    }
    
    // Module Eta: Temporal debt penalty (applies in both normal and inverted)
    if (state.modules.temporalDebt?.enabled && round.debtTokens) {
      const debt = round.debtTokens[captain.id] ?? 0;
      const costPerToken = state.modules.temporalDebt.costPerToken;
      penalty += debt * costPerToken;
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
  
  // Module Epsilon: Use drafting for subsequent rounds if enabled
  if (state.modules.drafting.enabled) {
    const nextRound = createRoundStateWithDraft({
      roundNumber: nextRoundNumber,
      captains,
      shuffledCoordinates: shuffled,
      turnOrder: round.turnOrder,
      maxPip: state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS,
      // packSize omitted - will be calculated automatically
    });
    
    // Apply module-specific round initialization
    let roundWithModules = nextRound;
    
    // Module Delta: Initialize hazard marker
    if (state.modules.warpDriveSpool.enabled) {
      roundWithModules = {
        ...roundWithModules,
        hazardMarkerHolder: roundWithModules.table.spacedock.placedBy,
        hazardMarkerPassCount: 0,
      };
    }
    
    // Module Eta: Initialize debt tokens
    if (state.modules.temporalDebt.enabled) {
      const debtTokens: Record<string, number> = {};
      for (const captain of captains) {
        debtTokens[captain.id] = 0;
      }
      roundWithModules = {
        ...roundWithModules,
        debtTokens,
      };
    }
    
    return {
      ok: true,
      state: clearActiveQFlash(
        withRoundAndCaptains(
          { ...state, phase: 'active', completedRounds: state.completedRounds + 1 },
          roundWithModules,
          captains
        )
      ),
    };
  }
  
  // Standard deal (no drafting)
  const nextDeal = dealRoundFromShuffled({
    roundNumber: nextRoundNumber,
    captains,
    shuffledCoordinates: shuffled,
    turnOrder: round.turnOrder,
    largeFleetHandSize: state.houseRules.largeFleetHandSize,
    maxPip: state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS,
  });
  let nextRound = createRoundStateFromDeal(nextDeal);

  // Module Delta: Initialize hazard marker with round starter
  if (state.modules.warpDriveSpool.enabled) {
    nextRound = {
      ...nextRound,
      hazardMarkerHolder: nextDeal.spacedockPlacedBy,
      hazardMarkerPassCount: 0,
    };
  }

  // Module Eta: Initialize debt tokens for next round
  if (state.modules.temporalDebt.enabled) {
    const debtTokens: Record<string, number> = {};
    for (const captain of captains) {
      debtTokens[captain.id] = 0;
    }
    nextRound = {
      ...nextRound,
      debtTokens,
    };
  }

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
