import { applyAction } from '../engine/apply-action.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { scoreRound } from '../engine/scoring.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { GameModuleConfig } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import { DEFAULT_GAME_OBJECTIVE } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import type { PlayerId } from '../types/player.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { buildWarpContext } from './context.js';
import { observe } from './observation.js';
import { warpAiActionKey } from './from-game-action.js';
import {
  encodeOmegaPolicyFeatures,
  encodeOmegaStateFeatures,
} from './omega-encoder.js';
import {
  forwardOmegaPolicyLogit,
  softmax,
  type OmegaModelWeights,
} from './omega-net.js';
import { omegaSearchVisits } from './omega-search.js';
import { blockedRoundWinner } from './self-play.js';

/**
 * One self-play decision row. Deliberately Commander-free: there is no heuristic
 * score and no Commander-pick reference. The only supervision is `label`, the
 * final game outcome for the acting seat.
 */
export interface OmegaTrajectoryRow {
  /** Policy features (303-dim state + action) for this candidate. */
  readonly features: readonly number[];
  /** True when this candidate is the move the net actually played. */
  readonly chosen: boolean;
  /** Groups all candidate rows from the same decision. */
  readonly decisionId: string;
  /** Acting seat — used to assign the outcome label. */
  readonly playerId: PlayerId;
  /** +1 if the acting seat won the game, else -1. */
  readonly label: number;
  /** State features (195-dim) for the value head; present on the chosen row only. */
  readonly stateFeatures?: readonly number[];
  /**
   * ISMCTS visit count for this candidate (AlphaZero-style policy target).
   * Present only when collected with `searchIterations > 0`; the trainer
   * normalizes visits within a decision into a target distribution.
   */
  readonly searchVisits?: number;
  readonly objective: GameObjective;
  readonly playerCount: number;
  readonly gameIndex: number;
}

export interface CollectOmegaTrajectoriesOptions {
  games: number;
  /** Class Ω weights that generate the self-play games (zero-init = random). */
  net: OmegaModelWeights;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  /**
   * Mixed-table training: if set, each self-play game uses a table size drawn
   * (round-robin by absolute game index) from this list, so one net learns the
   * whole fleet range (3–8) plus optional 2p. Overrides `playerCount`.
   */
  playerCounts?: readonly number[];
  modules?: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  /** Softmax exploration temperature during self-play (default 1). */
  temperature?: number;
  /**
   * If > 0, run value-net-guided ISMCTS at each decision and record per-candidate
   * visit counts as the policy target; the played move is sampled from the visit
   * distribution. 0 (default) = pure REINFORCE on the sampled policy move.
   */
  searchIterations?: number;
  /** ISMCTS max branching factor when searching (default 8). */
  searchMaxBranch?: number;
  /**
   * Search leaf when `searchIterations > 0`. Training bootstrap uses
   * `heuristic`; Path A / advisor teacher should use `puct` or `value`.
   */
  searchLeaf?: 'puct' | 'heuristic' | 'value';
  maxSteps?: number;
  /** Log progress every N completed games (0 = silent). */
  progressEvery?: number;
  /**
   * Shard selection for parallel collection. Games are seeded by absolute game
   * index, so disjoint slices produce disjoint, reproducible data.
   */
  slice?: { startGameIndex?: number; gameCount?: number };
}

export interface OmegaTrajectorySink {
  write(rows: readonly OmegaTrajectoryRow[]): void;
}

export interface CollectOmegaTrajectoriesResult {
  games: number;
  completedGames: number;
  rows: number;
}

interface MutableRow {
  features: number[];
  chosen: boolean;
  decisionId: string;
  playerId: PlayerId;
  label: number;
  stateFeatures?: number[];
  searchVisits?: number;
  objective: GameObjective;
  playerCount: number;
  gameIndex: number;
}

interface PendingDecision {
  readonly playerId: PlayerId;
  /** Round this decision was made in — labels are assigned per round, not per campaign. */
  readonly roundNumber: number;
  readonly rows: MutableRow[];
}

/**
 * Map per-seat round "scores" (lower = better) to a graded reward in [-1, 1]:
 * best seat = +1, worst = -1, linear by competition rank with tie-averaging.
 *
 * Dense (every seat gets a distinct signal, not just the winner), bounded to
 * match the tanh value head, and it reduces to ±1 at 2 players — consistent with
 * the validated 2p binary per-round signal.
 */
function rankRewards(scores: Map<PlayerId, number>): Map<PlayerId, number> {
  const ids = [...scores.keys()];
  const n = ids.length;
  const rewards = new Map<PlayerId, number>();
  if (n <= 1) {
    for (const id of ids) rewards.set(id, 0);
    return rewards;
  }
  const sorted = [...ids].sort((a, b) => scores.get(a)! - scores.get(b)!);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && scores.get(sorted[j + 1])! === scores.get(sorted[i])!) {
      j++;
    }
    const avgRank = (i + 1 + (j + 1)) / 2; // 1-based, tie-averaged
    const reward = 1 - (2 * (avgRank - 1)) / (n - 1);
    for (let k = i; k <= j; k++) rewards.set(sorted[k], reward);
    i = j + 1;
  }
  return rewards;
}

/**
 * Record each seat's graded per-round reward for a just-scored round.
 *
 * For **points**, campaign score is the *sum* of per-round pip totals — rounds
 * are independent (hands re-dealt, no carryover but the score itself), so
 * ranking seats by per-round pip delta is dense and exactly aligned with
 * minimizing the cumulative total. For **go-out**, seats are ranked by remaining
 * tiles (the captain who went out holds 0 → rank 1).
 */
function recordRoundRewards(
  objective: GameObjective,
  endedRound: RoundState,
  stateAfter: GameState,
  prevScores: Map<PlayerId, number>,
  roundRewards: Map<number, Map<PlayerId, number>>
): void {
  const scores = new Map<PlayerId, number>();
  if (objective === 'go-out') {
    for (const id of endedRound.turnOrder) {
      scores.set(id, (endedRound.hands[id] ?? []).length);
    }
  } else {
    for (const captain of stateAfter.captains) {
      scores.set(captain.id, captain.pointsScore - (prevScores.get(captain.id) ?? 0));
    }
  }
  roundRewards.set(endedRound.roundNumber, rankRewards(scores));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function totalHandTiles(round: RoundState): number {
  let total = 0;
  for (const hand of Object.values(round.hands)) {
    total += hand.length;
  }
  return total;
}

function roundReadyToScore(state: GameState, round: RoundState): RoundState {
  if (
    state.objective === 'go-out' &&
    round.phase === 'ended' &&
    round.roundBlocked &&
    !round.roundWinnerId
  ) {
    return { ...round, roundWinnerId: blockedRoundWinner(round, state) };
  }
  return round;
}

function fallbackAction(state: GameState, playerId: PlayerId): WarpAiAction {
  const round = state.round!;
  const houseRules = state.houseRules;
  if (canDrawFromUncharted(round, playerId, houseRules)) {
    return { kind: 'draw' };
  }
  if (canPassRedAlert(round, playerId, { houseRules })) {
    return { kind: 'pass-red-alert' };
  }
  if (canDeployDistressBeacon(round, playerId, { houseRules })) {
    return { kind: 'deploy-beacon' };
  }
  if (canPassTurn(round, playerId, { houseRules })) {
    return { kind: 'pass-turn' };
  }
  return { kind: 'deploy-beacon' };
}

function sampleIndex(probabilities: readonly number[], rng: () => number): number {
  const roll = rng();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (roll <= cumulative) {
      return i;
    }
  }
  return probabilities.length - 1;
}

/**
 * Runs Class Ω self-play — the same network drives every seat, sampling moves
 * from its own policy for exploration — and streams outcome-labeled decision
 * rows to `sink`. This is the pure "be the best you can be" data source: no
 * Commander in the players, the targets, or the labels.
 */
export function collectOmegaTrajectoriesToSink(
  options: CollectOmegaTrajectoriesOptions,
  sink: OmegaTrajectorySink
): CollectOmegaTrajectoriesResult {
  const objective = options.objective ?? DEFAULT_GAME_OBJECTIVE;
  const playerCount = options.playerCount ?? 2;
  const baseSeed = options.seed ?? 2026;
  const temperature = options.temperature ?? 1;
  const searchIterations = options.searchIterations ?? 0;
  const searchMaxBranch = options.searchMaxBranch ?? 8;
  const searchLeaf = options.searchLeaf ?? 'heuristic';
  const progressEvery = options.progressEvery ?? 0;
  const net = options.net;

  const startGameIndex = options.slice?.startGameIndex ?? 0;
  const gameCount = options.slice?.gameCount ?? options.games;
  const endGameIndex = startGameIndex + gameCount;

  let completedGames = 0;
  let rows = 0;

  for (let gameIndex = startGameIndex; gameIndex < endGameIndex; gameIndex++) {
    const seed = baseSeed + gameIndex * 7919;
    const decideRng = mulberry32(seed ^ 0x51ed270b);
    const ctxRng = mulberry32(seed ^ 0xabc123);
    const pending: PendingDecision[] = [];

    // Mixed-table: pick this game's size round-robin by absolute index (shard-safe).
    const gamePlayerCount =
      options.playerCounts && options.playerCounts.length > 0
        ? options.playerCounts[gameIndex % options.playerCounts.length]
        : playerCount;

    const captains = Array.from({ length: gamePlayerCount }, (_, index) => {
      const id = String.fromCharCode(97 + index);
      return { id, displayName: id };
    });

    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      mulberry32(seed)
    );

    let state = startGame(
      {
        id: 'omega-collect',
        captains,
        modules: options.modules,
        houseRules: options.houseRules,
        objective,
      },
      { shuffledCoordinates: shuffled }
    );

    const maxSteps = options.maxSteps ?? 20000;
    const reshuffle = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    let steps = 0;
    let stallGuard = 0;
    let lastHandTiles = state.round ? totalHandTiles(state.round) : -1;

    // Per-round credit assignment: graded reward per seat for each round, and a
    // running snapshot of cumulative scores to compute per-round deltas.
    const roundRewards = new Map<number, Map<PlayerId, number>>();
    let prevScores = new Map<PlayerId, number>(
      state.captains.map((c) => [c.id, c.pointsScore])
    );

    while (state.phase === 'active' && steps < maxSteps) {
      steps++;
      const round = state.round;
      if (!round) break;

      if (round.phase === 'ended') {
        const endedRound = roundReadyToScore(state, round);
        const result = scoreRound(state, endedRound, reshuffle);
        if (!result.ok) break;
        state = result.state;
        recordRoundRewards(objective, endedRound, state, prevScores, roundRewards);
        prevScores = new Map(state.captains.map((c) => [c.id, c.pointsScore]));
        stallGuard = 0;
        lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
        continue;
      }

      if (round.unchartedSectors.length === 0) {
        const tiles = totalHandTiles(round);
        stallGuard = tiles === lastHandTiles ? stallGuard + 1 : 0;
        lastHandTiles = tiles;
        if (stallGuard >= gamePlayerCount * 2) {
          state = {
            ...state,
            round: {
              ...round,
              phase: 'ended',
              roundWinnerId: blockedRoundWinner(round, state),
              allStopDeclared: true,
              allStopRequired: false,
            },
          };
          stallGuard = 0;
          continue;
        }
      } else {
        stallGuard = 0;
        lastHandTiles = totalHandTiles(round);
      }

      const playerId = round.activePlayerId;
      const obs = observe(state, playerId);
      if (!obs) break;

      const candidates = warpCandidateGenerator(obs);
      let chosen: WarpAiAction;

      if (candidates.length === 0) {
        chosen = fallbackAction(state, playerId);
      } else if (candidates.length === 1) {
        chosen = candidates[0];
      } else {
        const ctx = buildWarpContext(obs, ctxRng);
        const featuresByCandidate = candidates.map((action) =>
          encodeOmegaPolicyFeatures(ctx, action)
        );

        // Search-guided target (AlphaZero-style) when enabled, else pure policy.
        let searchVisitsByCandidate: number[] | null = null;
        if (searchIterations > 0) {
          const visits = omegaSearchVisits(obs, net, {
            iterations: searchIterations,
            rng: decideRng,
            maxBranch: searchMaxBranch,
            useBeliefConstraints: true,
            leaf: searchLeaf,
          });
          const byKey = new Map<string, number>();
          for (const v of visits) byKey.set(warpAiActionKey(v.action), v.visits);
          const counts = candidates.map(
            (action) => byKey.get(warpAiActionKey(action)) ?? 0
          );
          if (counts.reduce((a, b) => a + b, 0) > 0) {
            searchVisitsByCandidate = counts;
          }
        }

        let chosenIndex: number;
        if (searchVisitsByCandidate) {
          // Self-play move = sample proportional to visit counts (temperature 0 = argmax).
          if (temperature <= 0) {
            chosenIndex = searchVisitsByCandidate.indexOf(
              Math.max(...searchVisitsByCandidate)
            );
          } else {
            const total = searchVisitsByCandidate.reduce((a, b) => a + b, 0);
            chosenIndex = sampleIndex(
              searchVisitsByCandidate.map((v) => v / total),
              decideRng
            );
          }
        } else {
          const logits = featuresByCandidate.map((features) =>
            forwardOmegaPolicyLogit(features, net)
          );
          chosenIndex =
            temperature <= 0
              ? logits.indexOf(Math.max(...logits))
              : sampleIndex(softmax(logits, temperature), decideRng);
        }
        chosen = candidates[chosenIndex];

        const stateFeatures = Array.from(encodeOmegaStateFeatures(ctx));
        const decisionId = `${gameIndex}:${steps}`;
        const decisionRows: MutableRow[] = candidates.map((action, index) => ({
          features: Array.from(featuresByCandidate[index]),
          chosen: index === chosenIndex,
          decisionId,
          playerId,
          label: 0,
          ...(index === chosenIndex ? { stateFeatures } : {}),
          ...(searchVisitsByCandidate
            ? { searchVisits: searchVisitsByCandidate[index] }
            : {}),
          objective,
          playerCount: gamePlayerCount,
          gameIndex,
        }));
        pending.push({ playerId, roundNumber: round.roundNumber, rows: decisionRows });
      }

      const result = applyAction(state, toGameAction(chosen, playerId));
      if (!result.ok) break;
      state = result.state;
    }

    // Label each decision by its ROUND's graded reward (dense, correctly-aligned
    // credit) rather than the far-off campaign winner. Decisions whose round
    // never scored (incomplete final round) are dropped.
    const labeled: OmegaTrajectoryRow[] = [];
    for (const decision of pending) {
      const rewards = roundRewards.get(decision.roundNumber);
      if (!rewards) continue;
      const label = rewards.get(decision.playerId);
      if (label === undefined) continue;
      for (const row of decision.rows) {
        labeled.push({ ...row, label });
      }
    }
    if (labeled.length > 0) {
      sink.write(labeled);
      rows += labeled.length;
    }
    if (state.phase === 'complete') {
      completedGames++;
    }
    if (
      progressEvery > 0 &&
      completedGames > 0 &&
      (completedGames % progressEvery === 0 || completedGames === gameCount)
    ) {
      console.log(
        `  ${completedGames}/${gameCount} games, ${rows} rows (omega, ${objective})`
      );
    }
  }

  return { games: gameCount, completedGames, rows };
}

export function serializeOmegaTrajectoryRow(row: OmegaTrajectoryRow): string {
  return JSON.stringify(row);
}
