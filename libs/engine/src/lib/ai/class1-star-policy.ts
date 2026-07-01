import { chooseActionIndex, scoreWithHeuristics, type Rng } from 'doubletwelve';

import type { WarpAiAction } from './actions.js';
import { buildWarpContext, type WarpEvalContext } from './context.js';
import { DEFAULT_WARP_HEURISTICS, type WarpHeuristic } from './heuristics.js';
import type { Class1StarResidualScorer } from './residual-scorer.js';
import { resolveClass1StarScores } from './residual-scorer.js';
import type { WarpSkillProfile } from './skill.js';
import type { WarpAiObservation } from './observation.js';
import type { GoOutTuning } from './go-out-tuning.js';

function heuristicMap(
  heuristics: ReadonlyArray<WarpHeuristic>
): Map<string, WarpHeuristic> {
  return new Map(heuristics.map((heuristic) => [heuristic.id, heuristic]));
}

export function scoreWarpCandidateHeuristic(
  action: WarpAiAction,
  ctx: WarpEvalContext,
  skill: WarpSkillProfile,
  heuristics: ReadonlyArray<WarpHeuristic> = DEFAULT_WARP_HEURISTICS
): number {
  return scoreWithHeuristics(action, ctx, heuristicMap(heuristics), skill);
}

function combineHeuristicAndResidualScores(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[],
  skill: WarpSkillProfile,
  residuals: readonly number[],
  residualScorer: Class1StarResidualScorer,
  heuristics: ReadonlyArray<WarpHeuristic>
): number[] {
  const byId = heuristicMap(heuristics);
  const alpha = residualScorer.alpha;
  return actions.map(
    (action, index) =>
      scoreWithHeuristics(action, ctx, byId, skill) + alpha * (residuals[index] ?? 0)
  );
}

export async function scoreWarpCandidatesWithResidualAsync(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[],
  skill: WarpSkillProfile,
  residualScorer: Class1StarResidualScorer,
  heuristics: ReadonlyArray<WarpHeuristic> = DEFAULT_WARP_HEURISTICS
): Promise<number[]> {
  const residuals = await resolveClass1StarScores(
    residualScorer.scoreCandidates(ctx, actions)
  );
  return combineHeuristicAndResidualScores(
    ctx,
    actions,
    skill,
    residuals,
    residualScorer,
    heuristics
  );
}

export function scoreWarpCandidatesWithResidual(
  ctx: WarpEvalContext,
  actions: readonly WarpAiAction[],
  skill: WarpSkillProfile,
  residualScorer: Class1StarResidualScorer,
  heuristics: ReadonlyArray<WarpHeuristic> = DEFAULT_WARP_HEURISTICS
): number[] {
  const residuals = residualScorer.scoreCandidates(ctx, actions);
  if (residuals instanceof Promise) {
    throw new Error(
      'Class I* residual scorer returned a Promise — use scoreWarpCandidatesWithResidualAsync.'
    );
  }
  return combineHeuristicAndResidualScores(
    ctx,
    actions,
    skill,
    residuals,
    residualScorer,
    heuristics
  );
}

function pickFromScores(
  candidates: readonly WarpAiAction[],
  scores: readonly number[],
  skill: WarpSkillProfile,
  rng: Rng
): WarpAiAction {
  if (skill.blunderRate > 0 && rng() < skill.blunderRate) {
    return candidates[Math.floor(rng() * candidates.length)];
  }
  const index = chooseActionIndex([...scores], skill, rng);
  return candidates[index];
}

export async function pickWarpActionWithResidualAsync(
  obs: WarpAiObservation,
  candidates: readonly WarpAiAction[],
  skill: WarpSkillProfile,
  residualScorer: Class1StarResidualScorer,
  rng: Rng,
  goOutTuning: GoOutTuning,
  heuristics: ReadonlyArray<WarpHeuristic> = DEFAULT_WARP_HEURISTICS
): Promise<WarpAiAction> {
  if (candidates.length === 0) {
    throw new Error('pickWarpActionWithResidual requires at least one candidate.');
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const ctx = buildWarpContext(obs, rng, goOutTuning);
  const scores = await scoreWarpCandidatesWithResidualAsync(
    ctx,
    candidates,
    skill,
    residualScorer,
    heuristics
  );
  return pickFromScores(candidates, scores, skill, rng);
}

export function pickWarpActionWithResidual(
  obs: WarpAiObservation,
  candidates: readonly WarpAiAction[],
  skill: WarpSkillProfile,
  residualScorer: Class1StarResidualScorer,
  rng: Rng,
  goOutTuning: GoOutTuning,
  heuristics: ReadonlyArray<WarpHeuristic> = DEFAULT_WARP_HEURISTICS
): WarpAiAction {
  if (candidates.length === 0) {
    throw new Error('pickWarpActionWithResidual requires at least one candidate.');
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const ctx = buildWarpContext(obs, rng, goOutTuning);
  const scores = scoreWarpCandidatesWithResidual(
    ctx,
    candidates,
    skill,
    residualScorer,
    heuristics
  );
  return pickFromScores(candidates, scores, skill, rng);
}

export async function augmentSearchValuesWithResidualAsync(
  obs: WarpAiObservation,
  scored: readonly { action: WarpAiAction; value: number }[],
  residualScorer: Class1StarResidualScorer,
  rng: Rng,
  goOutTuning: GoOutTuning
): Promise<number[]> {
  const ctx = buildWarpContext(obs, rng, goOutTuning);
  const residuals = await resolveClass1StarScores(
    residualScorer.scoreCandidates(
      ctx,
      scored.map((entry) => entry.action)
    )
  );
  const alpha = residualScorer.alpha;
  return scored.map(
    (entry, index) => entry.value + alpha * (residuals[index] ?? 0)
  );
}

export function augmentSearchValuesWithResidual(
  obs: WarpAiObservation,
  scored: readonly { action: WarpAiAction; value: number }[],
  residualScorer: Class1StarResidualScorer,
  rng: Rng,
  goOutTuning: GoOutTuning
): number[] {
  const ctx = buildWarpContext(obs, rng, goOutTuning);
  const residuals = residualScorer.scoreCandidates(
    ctx,
    scored.map((entry) => entry.action)
  );
  if (residuals instanceof Promise) {
    throw new Error(
      'Class I* residual scorer returned a Promise — use augmentSearchValuesWithResidualAsync.'
    );
  }
  const alpha = residualScorer.alpha;
  return scored.map(
    (entry, index) => entry.value + alpha * (residuals[index] ?? 0)
  );
}
