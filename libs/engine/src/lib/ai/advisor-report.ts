import { scoreWithHeuristics, type Rng } from 'double-eighteen';

import { applyAction } from '../engine/apply-action.js';
import type { GameAction } from '../types/actions.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';
import type { AdvisorModelWeights } from './advisor-net.js';
import type { OmegaModelWeights } from './omega-net.js';
import { advisorReplaySeed, hashStringSeed, mulberry32 } from './advisor-replay-rng.js';
import { buildWarpContext } from './context.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { createAdvisorPlayer } from './create-advisor-player.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { createOmegaPlayer } from './omega-agent.js';
import {
  computeAdvisorStateConcepts,
  explainAdvisorConcepts,
} from './advisor-concepts.js';
import { explainWarpAiAction } from './explain-action.js';
import { gameActionToWarpAi, warpAiActionKey } from './from-game-action.js';
import { DEFAULT_WARP_HEURISTICS } from './heuristics.js';
import { observe } from './observation.js';
import {
  getAdvisorSkillProfile,
  resolveAdvisorLookahead,
  resolveProfileGoOutTuning,
} from './skill.js';

export type AdvisorMoveStrength = 'strong' | 'reasonable' | 'weak' | 'blunder';

export interface AdvisorActionLogEntry {
  playerId: string;
  action: GameAction;
  ok?: boolean | null;
  source?: 'human' | 'ai' | 'auto';
}

export interface AdvisorMoveReview {
  readonly turnIndex: number;
  readonly playerId: PlayerId;
  readonly played: WarpAiAction;
  readonly strength: AdvisorMoveStrength;
  /** Why the played line is sensible (empty for blunders). */
  readonly reasons: readonly string[];
  /** Top advisor pick when the played move looks weak. */
  readonly advisorPick: WarpAiAction | null;
  readonly advisorReasons: readonly string[];
  readonly playedScore: number;
  readonly bestScore: number;
  readonly candidateCount: number;
}

export interface BuildAdvisorReportOptions {
  roundStartState: GameState;
  entries: readonly AdvisorActionLogEntry[];
  /** Captain ids to review (defaults to human-sourced moves only). */
  focusPlayerIds?: readonly PlayerId[];
  /** When true, include AI/auto moves too. */
  includeAllPlayers?: boolean;
  names?: Readonly<Record<string, string>>;
  maxReasons?: number;
  /**
   * Base seed for replaying the action log — advisor search uses deterministic
   * RNG per turn so rebuilding a report from the same log is stable.
   */
  replayBaseSeed?: number;
  /** Commander neural Ω for advisor picks when reviewing weak lines. */
  omegaNet?: OmegaModelWeights;
  /** Phase B concept advisor — preferred when loaded. */
  advisorWeights?: AdvisorModelWeights;
}

export interface AdvisorReport {
  readonly objective: GameState['objective'];
  readonly reviews: readonly AdvisorMoveReview[];
}

export interface ReviewAdvisorMoveOptions {
  readonly names?: Readonly<Record<string, string>>;
  readonly maxReasons?: number;
  readonly replaySeed?: number;
  /** Commander neural Ω for advisor picks (phase A — explain Ω line). */
  readonly omegaNet?: OmegaModelWeights;
  /** Phase B concept advisor — preferred when loaded. */
  readonly advisorWeights?: AdvisorModelWeights;
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function defaultReplayBaseSeed(state: GameState): number {
  return hashStringSeed(state.id);
}

function scoreCandidates(
  state: GameState,
  playerId: PlayerId
): { action: WarpAiAction; score: number }[] {
  const obs = observe(state, playerId);
  if (!obs) {
    return [];
  }

  const playerCount = obs.captains.length;
  const skill = getAdvisorSkillProfile(state.objective, playerCount);
  const tuning = resolveProfileGoOutTuning(skill);
  const byId = new Map(
    DEFAULT_WARP_HEURISTICS.map(
      (heuristic) => [heuristic.id, heuristic] as const
    )
  );
  const ctx = buildWarpContext(obs, () => 0.5, tuning);
  const candidates = warpCandidateGenerator(obs);

  return candidates.map((action) => ({
    action,
    score: scoreWithHeuristics(action, ctx, byId, skill),
  }));
}

function scoreActionAtState(
  state: GameState,
  playerId: PlayerId,
  action: WarpAiAction
): number {
  const obs = observe(state, playerId);
  if (!obs) {
    return 0;
  }
  const playerCount = obs.captains.length;
  const skill = getAdvisorSkillProfile(state.objective, playerCount);
  const tuning = resolveProfileGoOutTuning(skill);
  const byId = new Map(
    DEFAULT_WARP_HEURISTICS.map(
      (heuristic) => [heuristic.id, heuristic] as const
    )
  );
  const ctx = buildWarpContext(obs, () => 0.5, tuning);
  return scoreWithHeuristics(action, ctx, byId, skill);
}

function classifyMoveStrength(
  playedScore: number,
  bestScore: number,
  rank: number,
  candidateCount: number
): AdvisorMoveStrength {
  if (candidateCount <= 1) {
    return 'reasonable';
  }

  const gap = bestScore - playedScore;
  const relativeGap = bestScore > 0 ? gap / bestScore : gap;

  if (rank === 0 && gap <= Math.max(0.5, bestScore * 0.02)) {
    return 'strong';
  }
  if (relativeGap >= 0.38 || gap >= 28 || rank >= 3) {
    return 'blunder';
  }
  if (rank <= 1 && relativeGap <= 0.12) {
    return 'strong';
  }
  if (relativeGap <= 0.22) {
    return 'reasonable';
  }
  return 'weak';
}

function advisorPickAtState(
  state: GameState,
  playerId: PlayerId,
  rng: Rng,
  options?: { omegaNet?: OmegaModelWeights; advisorWeights?: AdvisorModelWeights }
): WarpAiAction | null {
  const obs = observe(state, playerId);
  if (!obs) {
    return null;
  }

  if (options?.advisorWeights) {
    return createAdvisorPlayer({ weights: options.advisorWeights, rng }).decide(obs)
      ?.action ?? null;
  }

  if (options?.omegaNet) {
    return createOmegaPlayer({ net: options.omegaNet, rng }).decide(obs);
  }

  const playerCount = obs.captains.length;
  const coach = createWarpAiPlayer({
    skill: getAdvisorSkillProfile(state.objective, playerCount),
    objective: state.objective,
    lookahead: resolveAdvisorLookahead(),
    rng,
  });

  return coach.decide(obs);
}

function shouldReviewEntry(
  entry: AdvisorActionLogEntry,
  options: BuildAdvisorReportOptions
): boolean {
  if (entry.ok === false || entry.action.type === 'END_ROUND') {
    return false;
  }
  if (options.includeAllPlayers) {
    return true;
  }
  if (options.focusPlayerIds && options.focusPlayerIds.length > 0) {
    return options.focusPlayerIds.includes(entry.playerId);
  }
  return entry.source === 'human';
}

export function reviewAdvisorMove(
  state: GameState,
  playerId: PlayerId,
  played: WarpAiAction,
  options?: ReviewAdvisorMoveOptions
): AdvisorMoveReview | null {
  const scored = scoreCandidates(state, playerId);
  if (scored.length === 0) {
    return null;
  }

  scored.sort((left, right) => right.score - left.score);
  const playedKey = warpAiActionKey(played);
  const rank = scored.findIndex(
    (entry) => warpAiActionKey(entry.action) === playedKey
  );
  const playedScore =
    rank >= 0
      ? scored[rank]!.score
      : scoreActionAtState(state, playerId, played);
  const effectiveRank = rank >= 0 ? rank : scored.length;
  const best = scored[0]!;
  const strength = classifyMoveStrength(
    playedScore,
    best.score,
    effectiveRank,
    scored.length
  );
  const maxReasons = options?.maxReasons ?? 3;
  const names = options?.names ?? {};
  const replayRng =
    options?.replaySeed !== undefined
      ? mulberry32(options.replaySeed)
      : Math.random;

  const advisorPick =
    strength === 'blunder' || strength === 'weak'
      ? advisorPickAtState(state, playerId, replayRng, {
          advisorWeights: options?.advisorWeights,
          omegaNet: options?.omegaNet,
        })
      : warpAiActionKey(best.action) === playedKey
        ? null
        : best.action;

  const reasons =
    strength === 'blunder'
      ? []
      : explainWarpAiAction(state, playerId, played, { names, maxReasons });

  const advisorReasons =
    advisorPick && warpAiActionKey(advisorPick) !== playedKey
      ? options?.advisorWeights
        ? (() => {
            const obs = observe(state, playerId);
            if (!obs) return [];
            const ctx = buildWarpContext(obs, replayRng);
            return explainAdvisorConcepts(computeAdvisorStateConcepts(ctx), {
              maxReasons,
            });
          })()
        : explainWarpAiAction(state, playerId, advisorPick, {
            names,
            maxReasons,
          })
      : [];

  return {
    turnIndex: 0,
    playerId,
    played,
    strength,
    reasons,
    advisorPick:
      advisorPick && warpAiActionKey(advisorPick) !== playedKey
        ? advisorPick
        : null,
    advisorReasons,
    playedScore,
    bestScore: best.score,
    candidateCount: scored.length,
  };
}

/** Replay a round and review focus-player moves with the tactical advisor. */
export function buildAdvisorReport(
  options: BuildAdvisorReportOptions
): AdvisorReport {
  let state = cloneState(options.roundStartState);
  const reviews: AdvisorMoveReview[] = [];
  let turnIndex = 0;
  const replayBaseSeed =
    options.replayBaseSeed ?? defaultReplayBaseSeed(options.roundStartState);

  for (const entry of options.entries) {
    if (!shouldReviewEntry(entry, options)) {
      const skipped = applyAction(state, entry.action);
      if (skipped.ok) {
        state = skipped.state;
      }
      continue;
    }

    const played = gameActionToWarpAi(entry.action, entry.playerId);
    if (!played) {
      const result = applyAction(state, entry.action);
      if (result.ok) {
        state = result.state;
      }
      continue;
    }

    const review = reviewAdvisorMove(state, entry.playerId, played, {
      names: options.names,
      maxReasons: options.maxReasons,
      replaySeed: advisorReplaySeed(replayBaseSeed, turnIndex, entry.playerId),
      advisorWeights: options.advisorWeights,
      omegaNet: options.omegaNet,
    });
    if (review) {
      reviews.push({ ...review, turnIndex: turnIndex++ });
    }

    const result = applyAction(state, entry.action);
    if (result.ok) {
      state = result.state;
    }
  }

  return {
    objective: options.roundStartState.objective,
    reviews,
  };
}
