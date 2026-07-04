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
import {
  encodeOmegaPolicyFeatures,
  encodeOmegaStateFeatures,
} from './omega-encoder.js';
import {
  forwardOmegaPolicyLogit,
  softmax,
  type OmegaModelWeights,
} from './omega-net.js';
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
  modules?: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  /** Softmax exploration temperature during self-play (default 1). */
  temperature?: number;
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
  objective: GameObjective;
  playerCount: number;
  gameIndex: number;
}

interface PendingDecision {
  readonly playerId: PlayerId;
  readonly rows: MutableRow[];
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

function resolveWinnerId(state: GameState): PlayerId | null {
  if (state.phase !== 'complete') {
    return null;
  }
  if (state.objective === 'go-out') {
    const round = state.round;
    return (
      round?.roundWinnerId ?? (round ? blockedRoundWinner(round, state) : null)
    );
  }
  let winnerId: PlayerId | null = null;
  let bestPoints = Number.POSITIVE_INFINITY;
  for (const captain of state.captains) {
    if (captain.pointsScore < bestPoints) {
      bestPoints = captain.pointsScore;
      winnerId = captain.id;
    }
  }
  return winnerId;
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

    const captains = Array.from({ length: playerCount }, (_, index) => {
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

    while (state.phase === 'active' && steps < maxSteps) {
      steps++;
      const round = state.round;
      if (!round) break;

      if (round.phase === 'ended') {
        const result = scoreRound(state, roundReadyToScore(state, round), reshuffle);
        if (!result.ok) break;
        state = result.state;
        stallGuard = 0;
        lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
        continue;
      }

      if (round.unchartedSectors.length === 0) {
        const tiles = totalHandTiles(round);
        stallGuard = tiles === lastHandTiles ? stallGuard + 1 : 0;
        lastHandTiles = tiles;
        if (stallGuard >= playerCount * 2) {
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
        const logits = featuresByCandidate.map((features) =>
          forwardOmegaPolicyLogit(features, net)
        );
        const probabilities = softmax(logits, temperature);
        const chosenIndex =
          temperature <= 0
            ? logits.indexOf(Math.max(...logits))
            : sampleIndex(probabilities, decideRng);
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
          objective,
          playerCount,
          gameIndex,
        }));
        pending.push({ playerId, rows: decisionRows });
      }

      const result = applyAction(state, toGameAction(chosen, playerId));
      if (!result.ok) break;
      state = result.state;
    }

    const winnerId = resolveWinnerId(state);
    if (winnerId !== null) {
      const labeled: OmegaTrajectoryRow[] = [];
      for (const decision of pending) {
        const label = decision.playerId === winnerId ? 1 : -1;
        for (const row of decision.rows) {
          labeled.push({ ...row, label });
        }
      }
      if (labeled.length > 0) {
        sink.write(labeled);
        rows += labeled.length;
      }
      completedGames++;
      if (
        progressEvery > 0 &&
        (completedGames % progressEvery === 0 || completedGames === gameCount)
      ) {
        console.log(
          `  ${completedGames}/${gameCount} games, ${rows} rows (omega, ${objective})`
        );
      }
    }
  }

  return { games: gameCount, completedGames, rows };
}

export function serializeOmegaTrajectoryRow(row: OmegaTrajectoryRow): string {
  return JSON.stringify(row);
}
