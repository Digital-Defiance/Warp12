/**
 * Quantifies luck vs skill in Warp variants by measuring decision complexity,
 * hand coherence, move value spread, and outcome variance. Used to assess
 * whether strategic AI improvement is meaningful for a given configuration.
 */

import type { Coordinate } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { observe } from './observation.js';
import { routeIsOwnTrail, trailKeyFor } from '../engine/squadrons.js';

/**
 * Per-turn decision complexity metrics.
 */
export interface TurnDecisionMetrics {
  /** Total number of legal moves available. */
  legalMoveCount: number;
  /** How many different trains can be played on. */
  uniqueTrainOptions: number;
  /** Tiles playable on multiple trains (flexible). */
  multiTrainTileCount: number;
  /** Tiles constrained to a single train. */
  singleTrainTileCount: number;
}

/**
 * Hand coherence / pip clustering metrics.
 */
export interface HandCoherenceMetrics {
  /** Number of unique pip values in hand (0–maxPip). */
  uniquePipValues: number;
  /** Size of largest group of tiles sharing a pip value. */
  maxPipCluster: number;
  /** Shannon entropy of pip distribution (bits). */
  handEntropy: number;
  /** Hand size (tile count). */
  handSize: number;
}

/**
 * Strategic depth: spread in heuristic values across legal moves.
 */
export interface MoveValueMetrics {
  bestMoveValue: number;
  worstMoveValue: number;
  /** best - worst */
  valueSpread: number;
  /** Standard deviation of move values. */
  valueStdDev: number;
  /** Fraction of moves within 90% of best (nearly optimal). */
  nearOptimalFraction: number;
}

/**
 * Per-captain trail development tracking.
 */
export interface TrailDevelopmentMetrics {
  /** Turns where captain played on their own trail. */
  ownTrailPlays: number;
  /** Turns forced to play elsewhere. */
  otherTrailPlays: number;
  /** Turns with shields down (beacon deployed). */
  shieldsDownTurns: number;
  /** Total turns for this captain. */
  totalTurns: number;
}

/**
 * Aggregated luck/skill metrics for one game.
 */
export interface GameLuckSkillMetrics {
  /** Average legal moves per turn across all captains. */
  avgLegalMoves: number;
  /** Average unique trains playable per turn. */
  avgUniqueTrains: number;
  /** Avg % of tiles constrained to single train. */
  avgConstrainedTileFraction: number;
  
  /** Average unique pip values in hand. */
  avgUniquePips: number;
  /** Average max pip cluster size. */
  avgMaxCluster: number;
  /** Average hand entropy (bits). */
  avgHandEntropy: number;
  
  /** Average value spread across decisions. */
  avgValueSpread: number;
  /** Average % of near-optimal moves. */
  avgNearOptimalFraction: number;
  
  /** Per-captain trail development stats. */
  trailDevelopment: Record<PlayerId, TrailDevelopmentMetrics>;
  
  /** Turns sampled for metrics. */
  turnsSampled: number;
}

/**
 * Compute decision complexity for the active captain's turn.
 */
export function measureTurnDecisionComplexity(
  state: GameState,
  round: RoundState
): TurnDecisionMetrics {
  const playerId = round.activePlayerId;
  const hand = round.hands[playerId] ?? [];
  
  if (hand.length === 0) {
    return {
      legalMoveCount: 0,
      uniqueTrainOptions: 0,
      multiTrainTileCount: 0,
      singleTrainTileCount: 0,
    };
  }
  
  const obs = observe(state, playerId);
  if (!obs) {
    return {
      legalMoveCount: 0,
      uniqueTrainOptions: 0,
      multiTrainTileCount: 0,
      singleTrainTileCount: 0,
    };
  }
  
  const candidates: WarpAiAction[] = [];
  
  for (const action of warpCandidateGenerator(obs)) {
    candidates.push(action);
  }
  
  // Track which tiles can play on which trains
  const tileTrainMap = new Map<string, Set<string>>();
  
  for (const action of candidates) {
    if (action.kind === 'chart') {
      const coord = action.move.coordinate;
      const tileKey = `${coord.low}-${coord.high}`;
      const trainKey = action.move.route.kind;
      
      if (!tileTrainMap.has(tileKey)) {
        tileTrainMap.set(tileKey, new Set());
      }
      tileTrainMap.get(tileKey)!.add(trainKey);
    }
  }
  
  const uniqueTrains = new Set<string>();
  for (const action of candidates) {
    if (action.kind === 'chart') {
      uniqueTrains.add(action.move.route.kind);
    }
  }
  
  let multiTrainTiles = 0;
  let singleTrainTiles = 0;
  
  for (const trains of tileTrainMap.values()) {
    if (trains.size > 1) {
      multiTrainTiles++;
    } else if (trains.size === 1) {
      singleTrainTiles++;
    }
  }
  
  return {
    legalMoveCount: candidates.length,
    uniqueTrainOptions: uniqueTrains.size,
    multiTrainTileCount: multiTrainTiles,
    singleTrainTileCount: singleTrainTiles,
  };
}

/**
 * Compute hand coherence metrics.
 */
export function measureHandCoherence(
  hand: readonly Coordinate[],
  maxPip: number
): HandCoherenceMetrics {
  if (hand.length === 0) {
    return {
      uniquePipValues: 0,
      maxPipCluster: 0,
      handEntropy: 0,
      handSize: 0,
    };
  }
  
  // Count pip occurrences
  const pipCounts = new Map<number, number>();
  for (const coord of hand) {
    const low = coord.low;
    const high = coord.high;
    pipCounts.set(low, (pipCounts.get(low) ?? 0) + 1);
    if (high !== low) {
      pipCounts.set(high, (pipCounts.get(high) ?? 0) + 1);
    }
  }
  
  const uniquePipValues = pipCounts.size;
  const maxPipCluster = Math.max(0, ...pipCounts.values());
  
  // Shannon entropy: H = -Σ(p * log2(p))
  const totalPips = hand.length * 2; // Each tile contributes 2 pips
  let entropy = 0;
  for (const count of pipCounts.values()) {
    const p = count / totalPips;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  return {
    uniquePipValues,
    maxPipCluster,
    handEntropy: entropy,
    handSize: hand.length,
  };
}

/**
 * Compute move value spread using a simple heuristic scorer.
 * (In real training this would use the full Commander scorer, but we keep it
 * lightweight here for metrics.)
 */
export function measureMoveValueSpread(
  state: GameState,
  round: RoundState,
  candidates: readonly WarpAiAction[]
): MoveValueMetrics {
  if (candidates.length === 0) {
    return {
      bestMoveValue: 0,
      worstMoveValue: 0,
      valueSpread: 0,
      valueStdDev: 0,
      nearOptimalFraction: 0,
    };
  }
  
  // Simple heuristic: prefer playing high-pip tiles
  const values = candidates.map((action) => {
    if (action.kind === 'chart') {
      const coord = action.move.coordinate;
      return coord.low + coord.high;
    }
    return 0; // Beacon/pass = low value
  });
  
  const best = Math.max(...values);
  const worst = Math.min(...values);
  const spread = best - worst;
  
  // Standard deviation
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Count moves within 90% of best
  const threshold = best * 0.9;
  const nearOptimalCount = values.filter((v) => v >= threshold).length;
  const nearOptimalFraction = nearOptimalCount / values.length;
  
  return {
    bestMoveValue: best,
    worstMoveValue: worst,
    valueSpread: spread,
    valueStdDev: stdDev,
    nearOptimalFraction,
  };
}

/**
 * Track whether a chart action was on own trail, other trail, or neutral zone.
 * Module Zeta: "own" trail is the shared squad trail — pass `round` so a
 * squadmate's own-trail chart on a route keyed by their trailKey (not their
 * own id) is still classified as "own", not "other".
 */
export function categorizeChartTarget(
  action: WarpAiAction,
  playerId: PlayerId,
  round: RoundState
): 'own' | 'other' | 'neutral' | 'none' {
  if (action.kind !== 'chart') {
    return 'none';
  }
  
  const route = action.move.route;
  if (route.kind === 'warp-trail' && routeIsOwnTrail(round, playerId, route)) {
    return 'own';
  } else if (route.kind === 'neutral-zone') {
    return 'neutral';
  } else if (route.kind === 'warp-trail' && !routeIsOwnTrail(round, playerId, route)) {
    return 'other';
  }
  
  return 'none';
}

/**
 * Initialize trail development tracking for all captains.
 */
export function initTrailDevelopment(
  captains: readonly { id: PlayerId }[]
): Record<PlayerId, TrailDevelopmentMetrics> {
  const result: Record<string, TrailDevelopmentMetrics> = {};
  for (const captain of captains) {
    result[captain.id] = {
      ownTrailPlays: 0,
      otherTrailPlays: 0,
      shieldsDownTurns: 0,
      totalTurns: 0,
    };
  }
  return result;
}

/**
 * Update trail development metrics after an action.
 */
export function updateTrailDevelopment(
  metrics: Record<PlayerId, TrailDevelopmentMetrics>,
  playerId: PlayerId,
  action: WarpAiAction,
  shieldsDown: boolean,
  round: RoundState
): void {
  const m = metrics[playerId];
  if (!m) return;
  
  m.totalTurns++;
  if (shieldsDown) {
    m.shieldsDownTurns++;
  }
  
  const category = categorizeChartTarget(action, playerId, round);
  if (category === 'own') {
    m.ownTrailPlays++;
  } else if (category === 'other' || category === 'neutral') {
    m.otherTrailPlays++;
  }
}

/**
 * Sample-based aggregator: collects metrics from a subset of turns during
 * self-play without storing the full game trajectory. Efficient for
 * long Omega training runs.
 */
export class LuckSkillMetricsSampler {
  private decisionSamples: TurnDecisionMetrics[] = [];
  private coherenceSamples: HandCoherenceMetrics[] = [];
  private valueSamples: MoveValueMetrics[] = [];
  private trailDevelopment: Record<PlayerId, TrailDevelopmentMetrics>;
  
  constructor(captains: readonly { id: PlayerId }[]) {
    this.trailDevelopment = initTrailDevelopment(captains);
  }
  
  /**
   * Sample metrics for the current turn based on state only.
   * Does not require knowledge of which action was chosen.
   */
  sampleTurnFromState(
    state: GameState,
    round: RoundState
  ): void {
    const playerId = round.activePlayerId;
    const hand = round.hands[playerId] ?? [];
    const maxPip = state.maxPip ?? 12;
    
    // Decision complexity
    const decision = measureTurnDecisionComplexity(state, round);
    this.decisionSamples.push(decision);
    
    // Hand coherence
    const coherence = measureHandCoherence(hand, maxPip);
    this.coherenceSamples.push(coherence);
    
    // Move value spread
    const obs = observe(state, playerId);
    if (!obs) return;
    
    const candidates: WarpAiAction[] = [];
    for (const action of warpCandidateGenerator(obs)) {
      candidates.push(action);
    }
    const values = measureMoveValueSpread(state, round, candidates);
    this.valueSamples.push(values);
    
    // Trail development tracking
    const m = this.trailDevelopment[playerId];
    if (m) {
      m.totalTurns++;
      // Module Zeta: read the shared squad trail via trailKeyFor.
      const trail = round.table.warpTrails[trailKeyFor(round, playerId)];
      if (trail && trail.tiles.length === 0) {
        m.shieldsDownTurns++;
      }
    }
  }
  
  /**
   * Update trail development after an action is known.
   * Called separately when action details are available.
   */
  recordAction(
    playerId: PlayerId,
    action: WarpAiAction,
    shieldsDown: boolean,
    round: RoundState
  ): void {
    updateTrailDevelopment(this.trailDevelopment, playerId, action, shieldsDown, round);
  }
  
  /**
   * Finalize and return aggregated metrics.
   */
  finalize(): GameLuckSkillMetrics {
    const n = this.decisionSamples.length;
    
    if (n === 0) {
      return {
        avgLegalMoves: 0,
        avgUniqueTrains: 0,
        avgConstrainedTileFraction: 0,
        avgUniquePips: 0,
        avgMaxCluster: 0,
        avgHandEntropy: 0,
        avgValueSpread: 0,
        avgNearOptimalFraction: 0,
        trailDevelopment: this.trailDevelopment,
        turnsSampled: 0,
      };
    }
    
    const sumDecision = this.decisionSamples.reduce(
      (acc, m) => ({
        legalMoves: acc.legalMoves + m.legalMoveCount,
        uniqueTrains: acc.uniqueTrains + m.uniqueTrainOptions,
        constrainedFraction: acc.constrainedFraction + 
          (m.legalMoveCount > 0 ? m.singleTrainTileCount / m.legalMoveCount : 0),
      }),
      { legalMoves: 0, uniqueTrains: 0, constrainedFraction: 0 }
    );
    
    const sumCoherence = this.coherenceSamples.reduce(
      (acc, m) => ({
        uniquePips: acc.uniquePips + m.uniquePipValues,
        maxCluster: acc.maxCluster + m.maxPipCluster,
        entropy: acc.entropy + m.handEntropy,
      }),
      { uniquePips: 0, maxCluster: 0, entropy: 0 }
    );
    
    const sumValues = this.valueSamples.reduce(
      (acc, m) => ({
        spread: acc.spread + m.valueSpread,
        nearOptimal: acc.nearOptimal + m.nearOptimalFraction,
      }),
      { spread: 0, nearOptimal: 0 }
    );
    
    return {
      avgLegalMoves: sumDecision.legalMoves / n,
      avgUniqueTrains: sumDecision.uniqueTrains / n,
      avgConstrainedTileFraction: sumDecision.constrainedFraction / n,
      avgUniquePips: sumCoherence.uniquePips / n,
      avgMaxCluster: sumCoherence.maxCluster / n,
      avgHandEntropy: sumCoherence.entropy / n,
      avgValueSpread: sumValues.spread / n,
      avgNearOptimalFraction: sumValues.nearOptimal / n,
      trailDevelopment: this.trailDevelopment,
      turnsSampled: n,
    };
  }
}

/**
 * Aggregate game-level metrics into a summary report.
 */
export interface LuckSkillSummary {
  games: number;
  playerCount: number;
  maxPip: number;
  objective: string;
  
  avgLegalMovesPerTurn: number;
  avgUniqueTrainsPerTurn: number;
  avgConstrainedTileFraction: number;
  
  avgUniquePipsInHand: number;
  avgMaxPipCluster: number;
  avgHandEntropy: number;
  
  avgMoveValueSpread: number;
  avgNearOptimalFraction: number;
  
  avgOwnTrailPlayRate: number;
  avgShieldsDownRate: number;
}

export function summarizeLuckSkillMetrics(
  gameMetrics: readonly GameLuckSkillMetrics[],
  playerCount: number,
  maxPip: number,
  objective: string
): LuckSkillSummary {
  if (gameMetrics.length === 0) {
    return {
      games: 0,
      playerCount,
      maxPip,
      objective,
      avgLegalMovesPerTurn: 0,
      avgUniqueTrainsPerTurn: 0,
      avgConstrainedTileFraction: 0,
      avgUniquePipsInHand: 0,
      avgMaxPipCluster: 0,
      avgHandEntropy: 0,
      avgMoveValueSpread: 0,
      avgNearOptimalFraction: 0,
      avgOwnTrailPlayRate: 0,
      avgShieldsDownRate: 0,
    };
  }
  
  const n = gameMetrics.length;
  
  // Aggregate per-game averages
  const sums = gameMetrics.reduce(
    (acc, m) => ({
      legalMoves: acc.legalMoves + m.avgLegalMoves,
      uniqueTrains: acc.uniqueTrains + m.avgUniqueTrains,
      constrainedFraction: acc.constrainedFraction + m.avgConstrainedTileFraction,
      uniquePips: acc.uniquePips + m.avgUniquePips,
      maxCluster: acc.maxCluster + m.avgMaxCluster,
      entropy: acc.entropy + m.avgHandEntropy,
      spread: acc.spread + m.avgValueSpread,
      nearOptimal: acc.nearOptimal + m.avgNearOptimalFraction,
    }),
    {
      legalMoves: 0,
      uniqueTrains: 0,
      constrainedFraction: 0,
      uniquePips: 0,
      maxCluster: 0,
      entropy: 0,
      spread: 0,
      nearOptimal: 0,
    }
  );
  
  // Trail development: average across all captains in all games
  let totalOwnPlays = 0;
  let totalOtherPlays = 0;
  let totalShieldsDown = 0;
  let totalTurns = 0;
  
  for (const game of gameMetrics) {
    for (const captainMetrics of Object.values(game.trailDevelopment)) {
      totalOwnPlays += captainMetrics.ownTrailPlays;
      totalOtherPlays += captainMetrics.otherTrailPlays;
      totalShieldsDown += captainMetrics.shieldsDownTurns;
      totalTurns += captainMetrics.totalTurns;
    }
  }
  
  return {
    games: n,
    playerCount,
    maxPip,
    objective,
    avgLegalMovesPerTurn: sums.legalMoves / n,
    avgUniqueTrainsPerTurn: sums.uniqueTrains / n,
    avgConstrainedTileFraction: sums.constrainedFraction / n,
    avgUniquePipsInHand: sums.uniquePips / n,
    avgMaxPipCluster: sums.maxCluster / n,
    avgHandEntropy: sums.entropy / n,
    avgMoveValueSpread: sums.spread / n,
    avgNearOptimalFraction: sums.nearOptimal / n,
    avgOwnTrailPlayRate: totalTurns > 0 ? totalOwnPlays / totalTurns : 0,
    avgShieldsDownRate: totalTurns > 0 ? totalShieldsDown / totalTurns : 0,
  };
}
