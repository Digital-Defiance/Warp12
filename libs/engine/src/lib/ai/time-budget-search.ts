import {
  searchActionValues,
  type Rng,
  type SearchModel,
} from 'double-eighteen';

import type { LookaheadOptions } from './lookahead-options.js';
import { warpAiActionKey } from './from-game-action.js';
import type { WarpAiAction } from './actions.js';

export interface TimeBudgetSearchOptions {
  readonly perspective: string;
  readonly rng: Rng;
  readonly lookahead: LookaheadOptions;
}

function mergeScoredByAction(
  accumulated: Map<string, { action: WarpAiAction; total: number; count: number }>,
  scored: readonly { action: WarpAiAction; value: number }[]
): void {
  for (const entry of scored) {
    const key = warpAiActionKey(entry.action);
    const existing = accumulated.get(key);
    if (existing) {
      existing.total += entry.value;
      existing.count += 1;
    } else {
      accumulated.set(key, {
        action: entry.action,
        total: entry.value,
        count: 1,
      });
    }
  }
}

/**
 * Runs determinized search until `timeBudgetMs` expires, accumulating averaged
 * action values across batches. Falls back to a single pass when no budget set.
 */
export function searchActionValuesWithBudget<TState>(
  rootState: TState,
  model: SearchModel<TState, WarpAiAction>,
  options: TimeBudgetSearchOptions
): { action: WarpAiAction; value: number }[] {
  const { lookahead, perspective, rng } = options;
  const budgetMs = lookahead.timeBudgetMs;

  if (!budgetMs || budgetMs <= 0) {
    return searchActionValues(rootState, model, {
      depth: lookahead.depth ?? 1,
      perspective,
      rng,
      determinizations: lookahead.determinizations ?? 6,
      maxBranch: lookahead.maxBranch ?? 6,
    });
  }

  const deadline = Date.now() + budgetMs;
  const minDet = Math.max(1, lookahead.minDeterminizations ?? 1);
  const maxDet = Math.max(minDet, lookahead.determinizations ?? minDet);
  const accumulated = new Map<
    string,
    { action: WarpAiAction; total: number; count: number }
  >();

  let batchSize = minDet;
  while (Date.now() < deadline) {
    const scored = searchActionValues(rootState, model, {
      depth: lookahead.depth ?? 1,
      perspective,
      rng,
      determinizations: batchSize,
      maxBranch: lookahead.maxBranch ?? 6,
    });
    mergeScoredByAction(accumulated, scored);
    batchSize = Math.min(maxDet, batchSize + 1);
  }

  if (accumulated.size === 0) {
    return searchActionValues(rootState, model, {
      depth: lookahead.depth ?? 1,
      perspective,
      rng,
      determinizations: minDet,
      maxBranch: lookahead.maxBranch ?? 6,
    });
  }

  return [...accumulated.values()].map(({ action, total, count }) => ({
    action,
    value: total / count,
  }));
}
