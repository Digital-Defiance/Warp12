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
import type { GameState } from '../types/game-state.js';
import type { GameModuleConfig } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import { DEFAULT_GAME_OBJECTIVE } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import type { PlayerId } from '../types/player.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import { computeAdvisorStateConcepts } from './advisor-concepts.js';
import { encodeAdvisorPolicyFeatureBatch } from './advisor-encoder.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { buildWarpContext } from './context.js';
import { observe } from './observation.js';
import { warpAiActionKey } from './from-game-action.js';
import type { OmegaModelWeights } from './omega-net.js';
import { omegaSearchVisits } from './omega-search.js';
import { blockedRoundWinner } from './self-play.js';

export interface AdvisorTrajectoryRow {
  readonly features: readonly number[];
  readonly concepts: readonly number[];
  readonly chosen: boolean;
  readonly decisionId: string;
  readonly playerId: PlayerId;
  readonly teacherVisits?: number;
  readonly objective: GameObjective;
  readonly playerCount: number;
  readonly gameIndex: number;
}

export interface CollectAdvisorTrajectoriesOptions {
  games: number;
  /** Class Ω weights used as the search / greedy teacher. */
  net: OmegaModelWeights;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  playerCounts?: readonly number[];
  modules?: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  /** PUCT iterations per decision (default 320). */
  searchIterations?: number;
  searchMaxBranch?: number;
  /** Search leaf — product teacher uses `puct`. */
  searchLeaf?: 'puct' | 'heuristic' | 'value';
  maxSteps?: number;
  progressEvery?: number;
  slice?: { startGameIndex?: number; gameCount?: number };
}

export interface AdvisorTrajectorySink {
  write(rows: readonly AdvisorTrajectoryRow[]): void;
}

export interface CollectAdvisorTrajectoriesResult {
  games: number;
  completedGames: number;
  rows: number;
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

function totalHandTiles(state: GameState): number {
  const round = state.round;
  if (!round) return 0;
  let total = 0;
  for (const hand of Object.values(round.hands)) {
    total += hand.length;
  }
  return total;
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

export function serializeAdvisorTrajectoryRow(row: AdvisorTrajectoryRow): string {
  return JSON.stringify(row);
}

/**
 * Collect advisor training rows: state concepts + candidate features labeled by
 * Ω+ search (PUCT by default). Commander never appears in the teacher.
 */
export function collectAdvisorTrajectoriesToSink(
  options: CollectAdvisorTrajectoriesOptions,
  sink: AdvisorTrajectorySink
): CollectAdvisorTrajectoriesResult {
  const objective = options.objective ?? DEFAULT_GAME_OBJECTIVE;
  const playerCount = options.playerCount ?? 4;
  const baseSeed = options.seed ?? 2026;
  const searchIterations = options.searchIterations ?? 320;
  const searchMaxBranch = options.searchMaxBranch ?? 8;
  const searchLeaf = options.searchLeaf ?? 'puct';
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
        id: 'advisor-collect',
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
    let lastHandTiles = state.round ? totalHandTiles(state) : -1;
    const batch: AdvisorTrajectoryRow[] = [];

    while (state.phase === 'active' && steps < maxSteps) {
      steps++;
      const round = state.round;
      if (!round) break;

      if (round.phase === 'ended') {
        const result = scoreRound(state, round, reshuffle);
        if (!result.ok) break;
        state = result.state;
        stallGuard = 0;
        lastHandTiles = state.round ? totalHandTiles(state) : -1;
        continue;
      }

      if (round.unchartedSectors.length === 0) {
        const tiles = totalHandTiles(state);
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
        lastHandTiles = totalHandTiles(state);
      }

      const playerId = round.activePlayerId;
      const obs = observe(state, playerId);
      if (!obs) break;

      const candidates = warpCandidateGenerator(obs);
      if (candidates.length >= 2) {
        const ctx = buildWarpContext(obs, ctxRng);
        const concepts = Array.from(computeAdvisorStateConcepts(ctx));
        const featuresByCandidate = encodeAdvisorPolicyFeatureBatch(ctx, candidates);

        const visits = omegaSearchVisits(obs, net, {
          iterations: searchIterations,
          rng: decideRng,
          maxBranch: searchMaxBranch,
          useBeliefConstraints: true,
          leaf: searchLeaf,
        });
        const byKey = new Map<string, number>();
        for (const entry of visits) {
          byKey.set(warpAiActionKey(entry.action), entry.visits);
        }
        const teacherVisits = candidates.map(
          (action) => byKey.get(warpAiActionKey(action)) ?? 0
        );
        const totalVisits = teacherVisits.reduce((a, b) => a + b, 0);
        const chosenIndex =
          totalVisits > 0
            ? teacherVisits.indexOf(Math.max(...teacherVisits))
            : 0;

        const decisionId = `${gameIndex}:${steps}`;
        for (let index = 0; index < candidates.length; index++) {
          batch.push({
            features: Array.from(featuresByCandidate[index]),
            concepts,
            chosen: index === chosenIndex,
            decisionId,
            playerId,
            teacherVisits: teacherVisits[index],
            objective,
            playerCount: gamePlayerCount,
            gameIndex,
          });
        }

        const chosen = candidates[chosenIndex] ?? candidates[0];
        const result = applyAction(state, toGameAction(chosen, playerId));
        if (!result.ok) break;
        state = result.state;
        continue;
      }

      const chosen =
        candidates.length === 1
          ? candidates[0]
          : fallbackAction(state, playerId);
      const result = applyAction(state, toGameAction(chosen, playerId));
      if (!result.ok) break;
      state = result.state;
    }

    if (batch.length > 0) {
      sink.write(batch);
      rows += batch.length;
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
        `  ${completedGames}/${gameCount} games, ${rows} rows (advisor, ${objective})`
      );
    }
  }

  return { games: gameCount, completedGames, rows };
}
