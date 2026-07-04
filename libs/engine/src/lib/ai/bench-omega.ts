import type { GameObjective } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import type { PlayerId } from '../types/player.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { createOmegaPlayer } from './omega-agent.js';
import type { OmegaModelWeights } from './omega-net.js';
import {
  getWarpSkillProfile,
  resolveWarpLookahead,
} from './skill.js';
import { playSelfPlayGame, type SelfPlaySeat } from './self-play.js';

export interface BenchOmegaOptions {
  games: number;
  net: OmegaModelWeights;
  seed?: number;
  objective?: GameObjective;
  playerCount?: number;
  houseRules?: HouseRulesConfig;
  /** Which seat Class Ω occupies (default `a`). Swap to `b` to test symmetry. */
  omegaSeatId?: PlayerId;
}

export interface BenchOmegaResult {
  games: number;
  completed: number;
  objective: GameObjective;
  playerCount: number;
  omegaSeatId: PlayerId;
  omegaWins: number;
  omegaWinRate: number | null;
  /** Implied Elo gap vs Commander from the win rate (null if degenerate). */
  impliedEloGap: number | null;
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

function impliedEloFromWinRate(winRate: number): number | null {
  if (winRate <= 0 || winRate >= 1) {
    return null;
  }
  return 400 * Math.log10(winRate / (1 - winRate));
}

function makeCommanderSeat(
  id: PlayerId,
  displayName: string,
  objective: GameObjective,
  playerCount: number,
  rngSeed: number
): SelfPlaySeat {
  return {
    id,
    displayName,
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('commander', objective, playerCount),
      objective,
      lookahead: resolveWarpLookahead('commander', objective, playerCount),
      rng: mulberry32(rngSeed),
    }),
  };
}

/**
 * Head-to-head: Class Ω (greedy policy) vs Commander seats. Omega takes
 * `omegaSeatId`; every other seat is Commander. Run both seats to cancel any
 * first-mover bias, and sweep player counts / objectives for the promotion gate.
 */
export function benchOmegaVsCommander(
  options: BenchOmegaOptions
): BenchOmegaResult {
  const objective = options.objective ?? 'points';
  const playerCount = options.playerCount ?? 2;
  const baseSeed = options.seed ?? 9001;
  const omegaSeatId = options.omegaSeatId ?? 'a';

  let omegaWins = 0;
  let completed = 0;

  for (let game = 0; game < options.games; game++) {
    const seed = baseSeed + game * 7919;
    const seats: SelfPlaySeat[] = [];
    for (let index = 0; index < playerCount; index++) {
      const id = String.fromCharCode(97 + index);
      if (id === omegaSeatId) {
        seats.push({
          id,
          displayName: 'Class Ω',
          player: createOmegaPlayer({
            net: options.net,
            temperature: 0,
            rng: mulberry32(seed + (index + 1) * 1997),
          }),
        });
      } else {
        seats.push(
          makeCommanderSeat(
            id,
            `Commander-${id}`,
            objective,
            playerCount,
            seed + (index + 1) * 997
          )
        );
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
    if (result.winnerId === omegaSeatId) {
      omegaWins++;
    }
  }

  const omegaWinRate = completed > 0 ? omegaWins / completed : null;

  return {
    games: options.games,
    completed,
    objective,
    playerCount,
    omegaSeatId,
    omegaWins,
    omegaWinRate,
    impliedEloGap:
      omegaWinRate !== null ? impliedEloFromWinRate(omegaWinRate) : null,
  };
}
