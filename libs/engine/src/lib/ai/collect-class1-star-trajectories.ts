import { applyAction } from '../engine/apply-action.js';
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
import type { RoundState } from '../types/game-state.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import { warpAiActionKey } from './from-game-action.js';
import { buildWarpContext } from './context.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { createClass1StarPlayer } from './class1-star.js';
import { createWarpAiPlayer, type WarpAiPlayer } from './create-warp-ai.js';
import type { Class1StarResidualScorer } from './residual-scorer.js';
import { scoreWarpCandidateHeuristic } from './class1-star-policy.js';
import { encodeClass1StarFeatures } from './feature-encoder.js';
import { observe } from './observation.js';
import { blockedRoundWinner } from './self-play.js';
import {
  getWarpSkillProfile,
  resolveProfileGoOutTuning,
  resolveWarpLookahead,
  type WarpSkillLevel,
} from './skill.js';

export interface Class1StarTrajectoryRow {
  /** Fixed 303-dim observation + action vector. */
  readonly features: readonly number[];
  /** Commander heuristic score for this candidate (for combined training). */
  readonly heuristicScore: number;
  /** +1 if the acting captain won the game, else -1. */
  readonly label: number;
  readonly objective: GameObjective;
  readonly playerCount: number;
  /** Self-play game index within the collection run. */
  readonly gameIndex: number;
  /** True when this row encodes the action the bot actually played. */
  readonly chosen: boolean;
  /** Groups candidate rows from the same decision (for ranking loss). */
  readonly decisionId: string;
  /** True when this candidate matches Commander's heuristic pick (RL mode). */
  readonly commanderPick?: boolean;
  /** Who acted — RL mode exports Class I* decisions only. */
  readonly actor?: 'class1Star' | 'commander';
}

export type Class1StarCollectMode = 'imitation' | 'rl';

export interface CollectClass1StarTrajectoriesOptions {
  games: number;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  skill?: WarpSkillLevel;
  modules?: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  /** Include sampled non-chosen candidates per decision. */
  includeContrast?: boolean;
  /** Export every legal candidate per decision (required for ranking loss). */
  exportAllCandidates?: boolean;
  maxSteps?: number;
  /** Log progress every N completed games (0 = silent). */
  progressEvery?: number;
  /** imitation = Commander self-play; rl = Class I* vs Commander with regret labels. */
  collectMode?: Class1StarCollectMode;
  /** Required for rl mode — plays Class I* seat in self-play vs Commander. */
  residualScorer?: Class1StarResidualScorer;
  /** Class I* seat in rl mode (default `a`, 2p only). */
  class1StarSeatId?: PlayerId;
}

export interface Class1StarTrajectorySink {
  /** Called once per completed game with all labeled rows for that game. */
  write(rows: readonly Class1StarTrajectoryRow[]): void;
}

export interface CollectClass1StarTrajectoriesResult {
  games: number;
  completedGames: number;
  rows: number;
}

interface PendingDecision {
  readonly playerId: PlayerId;
  readonly rows: Class1StarTrajectoryRow[];
}

interface MutableTrajectoryRow {
  features: number[];
  heuristicScore: number;
  label: number;
  objective: GameObjective;
  playerCount: number;
  gameIndex: number;
  chosen: boolean;
  decisionId: string;
  commanderPick?: boolean;
  actor?: 'class1Star' | 'commander';
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

function roundReadyToScore(
  state: GameState,
  round: RoundState
): RoundState {
  if (
    state.objective === 'go-out' &&
    round.phase === 'ended' &&
    round.roundBlocked &&
    !round.roundWinnerId
  ) {
    return {
      ...round,
      roundWinnerId: blockedRoundWinner(round, state),
    };
  }
  return round;
}

function encodeDecisionRows(
  state: GameState,
  playerId: PlayerId,
  chosen: WarpAiAction,
  objective: GameObjective,
  playerCount: number,
  gameIndex: number,
  rng: () => number,
  includeContrast: boolean,
  exportAllCandidates: boolean,
  decisionId: string,
  extras?: {
    commanderBaseline?: WarpAiAction;
    actor?: 'class1Star' | 'commander';
  }
): Class1StarTrajectoryRow[] {
  const obs = observe(state, playerId);
  if (!obs) {
    return [];
  }

  const skill = getWarpSkillProfile('commander', objective, playerCount);
  const tuning = resolveProfileGoOutTuning(skill);
  const ctx = buildWarpContext(obs, rng, tuning);
  const candidates = warpCandidateGenerator(obs);
  const rows: MutableTrajectoryRow[] = [];
  const commanderBaseline = extras?.commanderBaseline;

  for (const action of candidates) {
    const isChosen = warpAiActionKey(action) === warpAiActionKey(chosen);
    if (!isChosen && exportAllCandidates) {
      // include below
    } else if (!isChosen && !includeContrast) {
      continue;
    } else if (!isChosen && includeContrast && rng() > 0.25) {
      continue;
    }

    rows.push({
      features: Array.from(encodeClass1StarFeatures(ctx, action)),
      heuristicScore: scoreWarpCandidateHeuristic(action, ctx, skill),
      label: 0,
      objective,
      playerCount,
      gameIndex,
      chosen: isChosen,
      decisionId,
      ...(commanderBaseline !== undefined
        ? {
            commanderPick:
              warpAiActionKey(action) === warpAiActionKey(commanderBaseline),
          }
        : {}),
      ...(extras?.actor !== undefined ? { actor: extras.actor } : {}),
    });
  }

  return rows;
}

interface CommanderSeat {
  readonly id: PlayerId;
  readonly player: WarpAiPlayer;
}

interface RlSeat extends CommanderSeat {
  readonly commanderRef: WarpAiPlayer;
}

function makeRlSeats(
  objective: GameObjective,
  seed: number,
  residualScorer: Class1StarResidualScorer,
  class1StarSeatId: PlayerId
): RlSeat[] {
  const ids: PlayerId[] = ['a', 'b'];
  const commanderProfile = getWarpSkillProfile('commander', objective, 2);
  const lookahead = resolveWarpLookahead('commander', objective, 2);

  return ids.map((id, index) => {
    const commanderRef = createWarpAiPlayer({
      skill: commanderProfile,
      objective,
      lookahead,
      rng: mulberry32(seed + (index + 1) * 997),
    });
    const player =
      id === class1StarSeatId
        ? createClass1StarPlayer({
            objective,
            playerCount: 2,
            residualScorer,
            rng: mulberry32(seed + (index + 1) * 1997),
          })
        : commanderRef;
    return { id, player, commanderRef };
  });
}

function makeCommanderSeats(
  playerCount: number,
  objective: GameObjective,
  seed: number
): CommanderSeat[] {
  const ids = Array.from({ length: playerCount }, (_, index) =>
    String.fromCharCode(97 + index)
  );
  return ids.map((id, index) => ({
    id,
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('commander', objective, playerCount),
      objective,
      lookahead: resolveWarpLookahead('commander', objective, playerCount),
      rng: mulberry32(seed + (index + 1) * 997),
    }),
  }));
}

function resolveWinnerId(state: GameState): PlayerId | null {
  if (state.phase !== 'complete') {
    return null;
  }
  if (state.objective === 'go-out') {
    const round = state.round;
    return (
      round?.roundWinnerId ??
      (round ? blockedRoundWinner(round, state) : null)
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

function labelPending(
  pending: PendingDecision[],
  winnerId: PlayerId
): Class1StarTrajectoryRow[] {
  const labeled: Class1StarTrajectoryRow[] = [];
  for (const decision of pending) {
    const label = decision.playerId === winnerId ? 1 : -1;
    for (const row of decision.rows) {
      labeled.push({ ...row, label });
    }
  }
  return labeled;
}

/** Serialize one trajectory row as a JSON Lines record. */
export function serializeClass1StarTrajectoryRow(
  row: Class1StarTrajectoryRow
): string {
  return JSON.stringify(row);
}

/**
 * Runs Commander self-play and streams state–action rows labeled by final win/loss.
 * Writes one batch per completed game so points runs do not exhaust the Node heap.
 */
export function collectClass1StarTrajectoriesToSink(
  options: CollectClass1StarTrajectoriesOptions,
  sink: Class1StarTrajectorySink
): CollectClass1StarTrajectoriesResult {
  const objective = options.objective ?? DEFAULT_GAME_OBJECTIVE;
  const playerCount = options.playerCount ?? 2;
  const baseSeed = options.seed ?? 2026;
  const includeContrast = options.includeContrast ?? false;
  const exportAllCandidates = options.exportAllCandidates ?? true;
  const progressEvery = options.progressEvery ?? 0;
  const collectMode = options.collectMode ?? 'imitation';
  const class1StarSeatId = options.class1StarSeatId ?? 'a';

  if (collectMode === 'rl') {
    if (!options.residualScorer) {
      throw new Error('RL collection requires a Class I* residualScorer.');
    }
    if (playerCount !== 2) {
      throw new Error('RL collection currently supports 2-player games only.');
    }
  }

  let completedGames = 0;
  let rows = 0;

  for (let gameIndex = 0; gameIndex < options.games; gameIndex++) {
    const seed = baseSeed + gameIndex * 7919;
    const encodeRng = mulberry32(seed ^ 0xabc123);
    const pending: PendingDecision[] = [];

    const rlSeats =
      collectMode === 'rl'
        ? makeRlSeats(
            objective,
            seed,
            options.residualScorer!,
            class1StarSeatId
          )
        : null;
    const seats = rlSeats ?? makeCommanderSeats(playerCount, objective, seed);
    const byId = new Map(seats.map((seat) => [seat.id, seat.player] as const));
    const commanderRefById = rlSeats
      ? new Map(rlSeats.map((seat) => [seat.id, seat.commanderRef] as const))
      : null;

    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      mulberry32(seed)
    );

    let state = startGame(
      {
        id: 'class1-star-collect',
        captains: seats.map((seat) => ({
          id: seat.id,
          displayName: seat.id,
        })),
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
        const roundToScore = roundReadyToScore(state, round);
        const result = scoreRound(state, roundToScore, reshuffle);
        if (!result.ok) break;
        state = result.state;
        stallGuard = 0;
        lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
        continue;
      }

      if (round.phase === 'drafting') {
        stallGuard = 0;
        lastHandTiles = totalHandTiles(round);
      } else if (round.unchartedSectors.length === 0) {
        const tiles = totalHandTiles(round);
        stallGuard = tiles === lastHandTiles ? stallGuard + 1 : 0;
        lastHandTiles = tiles;
        if (stallGuard >= seats.length * 2) {
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
      const player = byId.get(playerId);
      const obs = observe(state, playerId);
      if (!player || !obs) {
        break;
      }

      const chosen = player.decide(obs);
      const decisionId = `${gameIndex}:${steps}`;
      const exportDecision =
        collectMode === 'imitation' || playerId === class1StarSeatId;
      if (exportDecision) {
        const commanderRef = commanderRefById?.get(playerId);
        const decisionRows = encodeDecisionRows(
          state,
          playerId,
          chosen,
          objective,
          playerCount,
          gameIndex,
          encodeRng,
          includeContrast,
          exportAllCandidates,
          decisionId,
          collectMode === 'rl' && commanderRef
            ? {
                commanderBaseline: commanderRef.decide(obs),
                actor: 'class1Star',
              }
            : undefined
        );
        if (decisionRows.length > 0) {
          pending.push({ playerId, rows: decisionRows });
        }
      }

      const action = toGameAction(chosen, playerId);
      const result = applyAction(state, action);
      if (!result.ok) break;
      state = result.state;
    }

    const winnerId = resolveWinnerId(state);
    if (winnerId !== null) {
      const labeled = labelPending(pending, winnerId);
      if (labeled.length > 0) {
        sink.write(labeled);
        rows += labeled.length;
      }
      completedGames++;
      if (
        progressEvery > 0 &&
        (completedGames % progressEvery === 0 || completedGames === options.games)
      ) {
        console.log(
          `  ${completedGames}/${options.games} games, ${rows} rows (${objective}${collectMode === 'rl' ? ', rl' : ''})`
        );
      }
    }
  }

  return {
    games: options.games,
    completedGames,
    rows,
  };
}

/**
 * Runs Commander self-play and emits state–action rows labeled by final win/loss.
 * Used offline to train the Class I* residual (coach path is unaffected).
 * For large points collections prefer {@link collectClass1StarTrajectoriesToSink}.
 */
export function collectClass1StarTrajectories(
  options: CollectClass1StarTrajectoriesOptions
): Class1StarTrajectoryRow[] {
  const allRows: Class1StarTrajectoryRow[] = [];
  collectClass1StarTrajectoriesToSink(options, {
    write(gameRows) {
      allRows.push(...gameRows);
    },
  });
  return allRows;
}

/** Serialize rows as JSON Lines for the Python trainer. */
export function formatClass1StarTrajectoryJsonl(
  rows: readonly Class1StarTrajectoryRow[]
): string {
  return rows.map((row) => serializeClass1StarTrajectoryRow(row)).join('\n');
}
