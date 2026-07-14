import { applyAction } from '../engine/apply-action.js';
import { scoreRound } from '../engine/scoring.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { GameObjective } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import type { PlayerId } from '../types/player.js';
import { createClass1StarPlayer } from './class1-star.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import type { Class1StarResidualScorer } from './residual-scorer.js';
import { blockedRoundWinner } from './self-play.js';
import {
  getWarpSkillProfile,
  resolveWarpLookahead,
} from './skill.js';
import {
  playSelfPlayGame,
  type SelfPlaySeat,
} from './self-play.js';
import { observe } from './observation.js';
import { toGameAction } from './actions.js';
import { warpAiActionKey } from './from-game-action.js';

export interface BenchClass1StarOptions {
  games: number;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  houseRules?: HouseRulesConfig;
  residualScorer: Class1StarResidualScorer;
}

export interface BenchClass1StarResult {
  games: number;
  completed: number;
  class1StarWins: number;
  commanderWins: number;
  class1StarWinRate: number | null;
}

export interface Class1StarAgreementResult {
  samples: number;
  /** Fraction of decisions where Class I* picks the same move as Commander. */
  commanderAgreementRate: number;
  /** Fraction where Class I* differs from Commander. */
  decisionFlipRate: number;
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

/** Compare Class I* vs Commander picks on identical observations (seat a). */
export function measureClass1StarCommanderAgreement(
  options: BenchClass1StarOptions & { maxSamples?: number }
): Class1StarAgreementResult {
  const objective = options.objective ?? 'go-out';
  const playerCount = options.playerCount ?? 2;
  const baseSeed = options.seed ?? 9001;
  const maxSamples = options.maxSamples ?? 5000;
  const playerId: PlayerId = 'a';

  const class1Star = createClass1StarPlayer({
    objective,
    playerCount,
    residualScorer: options.residualScorer,
    rng: mulberry32(baseSeed + 997),
  });
  const commander = createWarpAiPlayer({
    skill: getWarpSkillProfile('commander', objective, playerCount),
    objective,
    lookahead: resolveWarpLookahead('commander', objective, playerCount),
    rng: mulberry32(baseSeed + 1997),
  });

  let samples = 0;
  let agreements = 0;

  for (let game = 0; game < options.games && samples < maxSamples; game++) {
    const seed = baseSeed + game * 7919;
    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      mulberry32(seed)
    );
    const captains = Array.from({ length: playerCount }, (_, index) => ({
      id: String.fromCharCode(97 + index),
      displayName: String.fromCharCode(97 + index),
    }));

    let state = startGame(
      {
        id: 'class1-star-agreement',
        captains,
        modules: {},
        houseRules: options.houseRules,
        objective,
      },
      { shuffledCoordinates: shuffled }
    );

    const reshuffle = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    let stallGuard = 0;
    let lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
    let steps = 0;

    while (
      state.phase === 'active' &&
      steps < 20000 &&
      samples < maxSamples
    ) {
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
          continue;
        }
      } else {
        stallGuard = 0;
        lastHandTiles = totalHandTiles(round);
      }

      if (round.activePlayerId === playerId) {
        const obs = observe(state, playerId);
        if (obs) {
          const starPick = class1Star.decide(obs);
          const commanderPick = commander.decide(obs);
          if (
            warpAiActionKey(starPick) === warpAiActionKey(commanderPick)
          ) {
            agreements++;
          }
          samples++;
        }
      }

      const active = round.activePlayerId;
      const actor =
        active === playerId
          ? class1Star
          : createWarpAiPlayer({
              skill: getWarpSkillProfile('commander', objective, playerCount),
              objective,
              lookahead: resolveWarpLookahead(
                'commander',
                objective,
                playerCount
              ),
              rng: mulberry32(seed + steps),
            });
      const obs = observe(state, active);
      if (!obs) break;
      const chosen = actor.decide(obs);
      const result = applyAction(state, toGameAction(chosen, active));
      if (!result.ok) break;
      state = result.state;
    }
  }

  return {
    samples,
    commanderAgreementRate: samples > 0 ? agreements / samples : 0,
    decisionFlipRate: samples > 0 ? 1 - agreements / samples : 0,
  };
}

/** Head-to-head win rate: Class I* (seat a) vs Commander (seat b). */
export function benchClass1StarVsCommander(
  options: BenchClass1StarOptions
): BenchClass1StarResult {
  const objective = options.objective ?? 'go-out';
  const playerCount = options.playerCount ?? 2;
  const baseSeed = options.seed ?? 9001;
  let class1StarWins = 0;
  let commanderWins = 0;
  let completed = 0;

  for (let game = 0; game < options.games; game++) {
    const seed = baseSeed + game * 7919;
    const seats: SelfPlaySeat[] = [
      {
        id: 'a',
        displayName: 'Class I*',
        player: createClass1StarPlayer({
          objective,
          playerCount,
          residualScorer: options.residualScorer,
          rng: mulberry32(seed + 997),
        }),
      },
      {
        id: 'b',
        displayName: 'Commander',
        player: createWarpAiPlayer({
          skill: getWarpSkillProfile('commander', objective, playerCount),
          objective,
          lookahead: resolveWarpLookahead('commander', objective, playerCount),
          rng: mulberry32(seed + 1997),
        }),
      },
    ];

    if (playerCount > 2) {
      for (let index = 2; index < playerCount; index++) {
        const id = String.fromCharCode(97 + index);
        seats.push({
          id,
          displayName: `Commander-${id}`,
          player: createWarpAiPlayer({
            skill: getWarpSkillProfile('commander', objective, playerCount),
            objective,
            lookahead: resolveWarpLookahead('commander', objective, playerCount),
            rng: mulberry32(seed + (index + 1) * 997),
          }),
        });
      }
    }

    const result = playSelfPlayGame({
      seats,
      seed,
      objective,
      houseRules: options.houseRules,
    });

    if (!result.completed || result.winnerId === null) {
      continue;
    }
    completed++;
    if (result.winnerId === 'a') {
      class1StarWins++;
    } else if (result.winnerId === 'b') {
      commanderWins++;
    }
  }

  return {
    games: options.games,
    completed,
    class1StarWins,
    commanderWins,
    class1StarWinRate: completed > 0 ? class1StarWins / completed : null,
  };
}
