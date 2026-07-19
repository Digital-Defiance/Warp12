import {
  coordinatePipValue,
} from '../types/coordinate.js';
import type { Coordinate } from '../types/coordinate.js';
import type { ActionResult, GameAction } from '../types/actions.js';
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
  roundStarterForRound,
} from '../setup/create-game.js';
import { highestPointsCaptainId } from './continuum.js';
import { withRoundAndCaptains } from './helpers.js';
import { determineLongestTrailWinners, getTrailLength } from './longest-trail.js';
import { applySensorGridToRound } from './sensor-grid.js';
import type { PlayerId } from '../types/player.js';
import { scoreGoOutRound } from './go-out-campaign.js';

/**
 * Public Salamander attribution for an ended points round, or null when
 * Module Beta does not charge anyone (disabled, round 1, go-out, no holder).
 * Matches {@link tallyRoundPoints} holder / Continuum-swap targeting.
 */
export function salamanderPenaltyAction(
  state: GameState,
  round: RoundState
): Extract<GameAction, { type: 'SALAMANDER_PENALTY' }> | null {
  if (state.objective === 'go-out') {
    return null;
  }
  if (!state.modules.salamanderPenalty.enabled) {
    return null;
  }
  if (!salamanderPenaltyApplies(round.roundNumber)) {
    return null;
  }

  const maxPip = state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS;
  const points = salamanderPenaltyTileValue(maxPip);

  let holderId: PlayerId | null = null;
  for (const captain of state.captains) {
    if (captain.id === round.roundWinnerId) {
      continue;
    }
    const hand = round.hands[captain.id] ?? [];
    if (hand.some((tile) => isHighestDouble(tile, maxPip))) {
      holderId = captain.id;
      break;
    }
  }
  if (!holderId) {
    return null;
  }

  const salamanderSwap = round.continuumEffects?.salamanderSwap === true;
  let scoredOnId = holderId;
  if (salamanderSwap) {
    const swapTarget = highestPointsCaptainId(
      state.captains,
      round.roundWinnerId ?? undefined
    );
    if (swapTarget && swapTarget !== holderId) {
      scoredOnId = swapTarget;
    }
  }

  return {
    type: 'SALAMANDER_PENALTY',
    holderId,
    scoredOnId,
    points,
  };
}

/**
 * Module Theta scoring annotations for public logs — one per tied longest trail.
 * Matches {@link tallyRoundPoints} winner selection and bonus amount.
 */
export function longestTrailBonusActions(
  state: GameState,
  round: RoundState
): readonly Extract<GameAction, { type: 'LONGEST_TRAIL_BONUS' }>[] {
  if (state.objective === 'go-out') {
    return [];
  }
  if (!state.modules.longestTrail?.enabled) {
    return [];
  }

  const points = state.modules.longestTrail.bonus ?? -3;
  const winners = determineLongestTrailWinners(round);
  if (winners.length === 0) {
    return [];
  }

  return winners.map((playerId) => ({
    type: 'LONGEST_TRAIL_BONUS' as const,
    playerId,
    trailLength: getTrailLength(round, playerId),
    points,
  }));
}

/**
 * Module Eta scoring annotations for public logs — one per captain with debt tokens.
 * Matches {@link tallyRoundPoints} debt charging (tokens × costPerToken).
 */
export function temporalDebtPenaltyActions(
  state: GameState,
  round: RoundState
): readonly Extract<GameAction, { type: 'TEMPORAL_DEBT_PENALTY' }>[] {
  if (state.objective === 'go-out') {
    return [];
  }
  if (!state.modules.temporalDebt?.enabled || !round.debtTokens) {
    return [];
  }

  const costPerToken = state.modules.temporalDebt.costPerToken;
  return state.captains
    .map((captain) => {
      const tokens = round.debtTokens?.[captain.id] ?? 0;
      if (tokens <= 0) {
        return null;
      }
      return {
        type: 'TEMPORAL_DEBT_PENALTY' as const,
        playerId: captain.id,
        tokens,
        points: tokens * costPerToken,
      };
    })
    .filter(
      (entry): entry is Extract<GameAction, { type: 'TEMPORAL_DEBT_PENALTY' }> =>
        entry != null
    );
}

/**
 * Per-captain round campaign deltas for an ended points round (hand + modules).
 * Matches {@link tallyRoundPoints} before Module Zeta squad rollup.
 */
export function computeRoundPointDeltas(
  state: GameState,
  round: RoundState
): readonly { playerId: PlayerId; points: number }[] {
  return tallyRoundCaptainPenalties(state, round).map(({ captain, penalty }) => ({
    playerId: captain.id,
    points: penalty,
  }));
}

/** One itemized contribution to a captain's round campaign delta. */
export type RoundPointLineKind =
  | 'tile' // a domino still in hand
  | 'wentOut' // charted out — no pips counted
  | 'longestTrail' // Module Theta bonus (negative)
  | 'hazardMarker' // Module Delta hazard-marker pass penalty
  | 'temporalDebt' // Module Eta debt tokens
  | 'salamanderSwapIn' // Module Sigma swap — penalty received from the holder
  | 'inversionBaseline'; // Module Kappa — inverted-round top-hand baseline

export interface RoundPointLine {
  readonly kind: RoundPointLineKind;
  /** Short human-readable label (federation-neutral). */
  readonly label: string;
  /** Signed contribution to the round delta (can be negative, e.g. Theta). */
  readonly points: number;
  /** The held domino for `kind: 'tile'` lines, so callers can render it. */
  readonly tile?: Coordinate;
  /** Optional qualifier, e.g. "Double blank" or "Highest double ×2 (Salamander)". */
  readonly note?: string;
}

/** A captain's fully itemized round campaign delta (pre Module Zeta rollup). */
export interface RoundPointBreakdown {
  readonly playerId: PlayerId;
  /** Matches the per-captain value from {@link computeRoundPointDeltas}. */
  readonly total: number;
  /** This captain emptied their hand (charted out). */
  readonly wentOut: boolean;
  /** Scored 0 for the go-out (individually or as a Module Zeta squad). */
  readonly isWinner: boolean;
  /** Scored under Module Kappa inversion (even points round). */
  readonly inverted: boolean;
  readonly lines: readonly RoundPointLine[];
}

/**
 * Itemized "receipt" for each captain's round campaign delta — the same numbers
 * {@link computeRoundPointDeltas} produces, broken down into per-tile and
 * per-module contributions so the UI can explain how a score came to be.
 */
export function explainRoundPoints(
  state: GameState,
  round: RoundState
): readonly RoundPointBreakdown[] {
  return buildRoundBreakdowns(state, round);
}

function tileLabel(tile: Coordinate): string {
  return `${tile.high}-${tile.low}`;
}

/**
 * Semantic summary of who "won" an ended round versus who emptied their hand.
 *
 * On a normal round these are the same captain — going out wins. Under Module
 * Kappa (Temporal Inversion) on an even points round, going out is catastrophic
 * (max penalty), so the round is won by whoever held the most (the lowest, most
 * negative delta). Consumers use this to show a trophy for the round winner and
 * a separate "goes out" indicator so inverted rounds are not misread as wins.
 */
export interface RoundOutcomeSummary {
  /** Round ended with no legal charts (nobody went out). */
  readonly blocked: boolean;
  /** Scored under Kappa inversion (even points round with the module enabled). */
  readonly inverted: boolean;
  /** Captain who emptied their hand, or null on a blocked round. */
  readonly wentOutId: PlayerId | null;
  /** Captain(s) who won the round in campaign terms (the trophy). */
  readonly roundWinnerIds: readonly PlayerId[];
}

export function summarizeRoundOutcome(
  state: GameState,
  round: RoundState
): RoundOutcomeSummary {
  if (round.roundBlocked) {
    return { blocked: true, inverted: false, wentOutId: null, roundWinnerIds: [] };
  }
  const wentOutId = round.roundWinnerId ?? null;
  const inverted =
    state.objective === 'points' &&
    (state.modules.temporalInversion?.enabled ?? false) &&
    round.roundNumber % 2 === 0;
  if (!inverted) {
    // Normal scoring (and the go-out objective): emptying the hand is the win.
    return {
      blocked: false,
      inverted: false,
      wentOutId,
      roundWinnerIds: wentOutId ? [wentOutId] : [],
    };
  }
  // Inverted points round: highest hand (lowest/most-negative delta) wins.
  const deltas = computeRoundPointDeltas(state, round);
  const best = deltas.length
    ? Math.min(...deltas.map((entry) => entry.points))
    : 0;
  const roundWinnerIds = deltas
    .filter((entry) => entry.points === best)
    .map((entry) => entry.playerId);
  return {
    blocked: false,
    inverted: true,
    wentOutId,
    roundWinnerIds:
      roundWinnerIds.length > 0
        ? roundWinnerIds
        : wentOutId
          ? [wentOutId]
          : [],
  };
}

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

function tallyRoundCaptainPenalties(
  state: GameState,
  round: RoundState
): readonly { captain: (typeof state.captains)[number]; penalty: number }[] {
  const byId = new Map(
    state.captains.map((captain) => [captain.id, captain] as const)
  );
  // Single source of truth: the itemized breakdown's total is the campaign delta.
  return buildRoundBreakdowns(state, round).map((breakdown) => ({
    captain: byId.get(breakdown.playerId)!,
    penalty: breakdown.total,
  }));
}

/**
 * Itemized per-captain penalty computation. This is the authoritative scoring
 * math — {@link tallyRoundCaptainPenalties} sums each captain's lines, and
 * {@link explainRoundPoints} surfaces the lines to the UI, so the receipt can
 * never disagree with the score.
 */
function buildRoundBreakdowns(
  state: GameState,
  round: RoundState
): readonly RoundPointBreakdown[] {
  const salamander = state.modules.salamanderPenalty.enabled;
  const doubleZeroScore = state.houseRules.doubleZeroScore;
  const maxPip = state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS;
  const salamanderSwap =
    salamander && round.continuumEffects?.salamanderSwap === true;
  const salamanderValue = salamanderPenaltyTileValue(maxPip);
  // Effective Salamander charge: enabled AND past round 1 (matches penaltyForHand).
  const salamanderActive =
    salamander && salamanderPenaltyApplies(round.roundNumber);
  const warpDriveSpoolEnabled = state.modules.warpDriveSpool?.enabled ?? false;
  const longestTrailEnabled = state.modules.longestTrail?.enabled ?? false;
  const longestTrailBonus = state.modules.longestTrail?.bonus ?? -3;
  const temporalInversionEnabled =
    state.modules.temporalInversion?.enabled ?? false;

  // Module Kappa: Temporal Inversion - even rounds invert scoring
  const isInvertedRound =
    temporalInversionEnabled && round.roundNumber % 2 === 0;

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

  // Only waive the holder's tile when the penalty actually transfers.
  const swapTransfers =
    swapHolder != null && swapTarget != null && swapTarget !== swapHolder;

  // Module Zeta: the winning squad is the squad of the captain who went out.
  const squadrons = round.squadrons;
  const winningSquadId =
    squadrons && !round.roundBlocked && round.roundWinnerId
      ? squadrons.find((s) => s.memberIds.includes(round.roundWinnerId!))?.id ??
        null
      : null;

  // Positive hand-pip term for a captain (mirrors the per-tile scoring below),
  // used only to find the round's highest hand for the Kappa spread baseline.
  const handPipTerm = (
    captainId: PlayerId,
    hand: readonly Coordinate[]
  ): number => {
    const holderWaives = swapTransfers && captainId === swapHolder;
    let sum = 0;
    for (const tile of hand) {
      if (isHighestDouble(tile, maxPip)) {
        if (holderWaives) {
          continue;
        }
        sum += salamanderActive ? salamanderValue : coordinatePipValue(tile);
      } else if (tile.low === 0 && tile.high === 0) {
        sum += doubleZeroScore;
      } else {
        sum += coordinatePipValue(tile);
      }
    }
    if (swapTransfers && captainId === swapTarget) {
      sum += salamanderValue;
    }
    return sum;
  };

  // Module Kappa spread: on an inverted round every captain starts at the round's
  // highest hand, then each tile they kept subtracts its pips — so the biggest
  // hand nets 0 (wins the round) and going out (kept nothing) eats the full
  // baseline. Proportional to the actual hands: no flat 2N×13 cliff, no negative
  // ledger, and the swing stays on the same scale as a normal round.
  const topHand = isInvertedRound
    ? state.captains.reduce(
        (max, captain) =>
          Math.max(max, handPipTerm(captain.id, round.hands[captain.id] ?? [])),
        0
      )
    : 0;

  return state.captains.map((captain) => {
    const hand = round.hands[captain.id] ?? [];
    const chartedOut =
      !round.roundBlocked && captain.id === round.roundWinnerId;
    // In squad play the whole winning squad scores the go-out (0); otherwise the
    // individual round winner scores 0.
    const isWinner = squadrons
      ? winningSquadId != null && captain.squadronId === winningSquadId
      : chartedOut;

    const lines: RoundPointLine[] = [];
    const holderWaives = swapTransfers && captain.id === swapHolder;
    // Inverted rounds: held tiles subtract from the top-hand baseline (+1 → −1).
    const tileSign = isInvertedRound ? -1 : 1;

    if (isInvertedRound) {
      lines.push({
        kind: 'inversionBaseline',
        label: 'Inverted round — top-hand baseline',
        points: topHand,
        note: `top hand ${topHand}`,
      });
    }

    if (!isInvertedRound && isWinner) {
      lines.push({
        kind: 'wentOut',
        label: chartedOut
          ? 'Charted out — no pips counted'
          : 'Squad charted out — no pips counted',
        points: 0,
      });
    } else {
      // Enumerate held tiles. Normal rounds add pips; inverted rounds subtract
      // them from the baseline above (holding the biggest hand is best). The
      // go-out captain's hand is empty here, so on an inverted round they simply
      // keep the full baseline — the proportional "worst outcome".
      for (const tile of hand) {
        if (isHighestDouble(tile, maxPip)) {
          if (holderWaives) {
            // Salamander swap: the holder's highest double moves to the target.
            lines.push({
              kind: 'tile',
              label: tileLabel(tile),
              points: 0,
              tile,
              note: 'Highest double — transferred (Salamander swap)',
            });
          } else if (salamanderActive) {
            lines.push({
              kind: 'tile',
              label: tileLabel(tile),
              points: tileSign * salamanderValue,
              tile,
              note: 'Highest double ×2 (Salamander)',
            });
          } else {
            lines.push({
              kind: 'tile',
              label: tileLabel(tile),
              points: tileSign * coordinatePipValue(tile),
              tile,
              note: 'Highest double',
            });
          }
        } else if (tile.low === 0 && tile.high === 0) {
          lines.push({
            kind: 'tile',
            label: tileLabel(tile),
            points: tileSign * doubleZeroScore,
            tile,
            note: 'Double blank',
          });
        } else {
          lines.push({
            kind: 'tile',
            label: tileLabel(tile),
            points: tileSign * coordinatePipValue(tile),
            tile,
          });
        }
      }

      if (swapTransfers && captain.id === swapTarget) {
        lines.push({
          kind: 'salamanderSwapIn',
          label: 'Salamander swap — received highest double',
          points: tileSign * salamanderValue,
        });
      }
    }

    // Module Delta: Hazard marker pass penalty (winners and non-winners alike).
    if (
      warpDriveSpoolEnabled &&
      captain.id === round.hazardMarkerHolder &&
      round.hazardMarkerPassCount &&
      round.hazardMarkerPassCount > 0
    ) {
      const passes = round.hazardMarkerPassCount;
      lines.push({
        kind: 'hazardMarker',
        label: 'Hazard marker passes',
        points: HAZARD_MARKER_PASS_PENALTY * passes,
        note: `${passes} pass${passes === 1 ? '' : 'es'} × ${HAZARD_MARKER_PASS_PENALTY}`,
      });
    }

    // Module Theta: Longest trail bonus (negative value = bonus).
    if (longestTrailEnabled && longestTrailWinners.has(captain.id)) {
      lines.push({
        kind: 'longestTrail',
        label: 'Longest trail bonus',
        points: longestTrailBonus,
      });
    }

    // Module Eta: Temporal debt penalty.
    if (state.modules.temporalDebt?.enabled && round.debtTokens) {
      const debt = round.debtTokens[captain.id] ?? 0;
      if (debt !== 0) {
        const costPerToken = state.modules.temporalDebt.costPerToken;
        lines.push({
          kind: 'temporalDebt',
          label: 'Temporal debt',
          points: debt * costPerToken,
          note: `${debt} token${debt === 1 ? '' : 's'} × ${costPerToken}`,
        });
      }
    }

    // No floor. The only term that can dip below zero is the Module Theta
    // (Longest Trail) −3 bonus; it's kept raw so it can break otherwise-tied
    // standings ("−3 vs 0"). Scoreboards clamp the *display* to zero
    // (formatCampaignPoints / formatPointsScoreLine) — ranking uses the raw value.
    const total = lines.reduce((sum, line) => sum + line.points, 0);

    return {
      playerId: captain.id,
      total,
      wentOut: chartedOut,
      isWinner,
      inverted: isInvertedRound,
      lines,
    };
  });
}

function tallyRoundPoints(state: GameState, round: RoundState) {
  const perCaptain = tallyRoundCaptainPenalties(state, round);
  const squadrons = round.squadrons;

  // FFA: each captain keeps their own penalty.
  if (!squadrons) {
    return perCaptain.map(({ captain, penalty }) => ({
      ...captain,
      pointsScore: captain.pointsScore + penalty,
    }));
  }

  // Module Zeta: aggregate each squad's penalties and assign the squad total to
  // every member, so cumulative standings compare squads (decision #4). The
  // winning squad's members each computed 0, so their squad total is 0.
  const squadTotals = new Map<string, number>();
  for (const { captain, penalty } of perCaptain) {
    const key = captain.squadronId ?? captain.id;
    squadTotals.set(key, (squadTotals.get(key) ?? 0) + penalty);
  }

  return perCaptain.map(({ captain, penalty }) => {
    const key = captain.squadronId ?? captain.id;
    const squadPenalty = squadTotals.get(key) ?? penalty;
    return {
      ...captain,
      pointsScore: captain.pointsScore + squadPenalty,
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
    return scoreGoOutRound(state, round, random);
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

  const matchStarterIndex = state.matchStarterIndex ?? 0;
  const nextStarterId = roundStarterForRound(
    round.turnOrder,
    nextRoundNumber,
    matchStarterIndex
  );
  
  // Module Epsilon: Use drafting for subsequent rounds if enabled
  if (state.modules.drafting.enabled) {
    const nextRound = createRoundStateWithDraft({
      roundNumber: nextRoundNumber,
      captains,
      shuffledCoordinates: shuffled,
      turnOrder: round.turnOrder,
      roundStarterId: nextStarterId,
      maxPip: state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS,
      largeFleetHandSize: state.houseRules.largeFleetHandSize,
      packSize: state.modules.drafting.packSize,
      squadrons: round.squadrons,
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
    roundStarterId: nextStarterId,
    largeFleetHandSize: state.houseRules.largeFleetHandSize,
    maxPip: state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS,
  });
  let nextRound = createRoundStateFromDeal(nextDeal, round.squadrons);

  // Module Gamma: seed the face-up Sensor Grid (same as startGame — rounds 2+
  // used to skip this and leave an empty grid while the module stayed "On").
  nextRound = applySensorGridToRound(nextRound, state.modules);

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
