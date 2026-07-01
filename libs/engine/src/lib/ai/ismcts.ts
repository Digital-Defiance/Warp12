import type { PlayerRef, Rng, SearchModel } from 'doubletwelve';

export interface IsmctsOptions {
  readonly perspective: PlayerRef;
  readonly rng: Rng;
  /** Wall-clock budget per decision (default 500ms). */
  readonly timeBudgetMs?: number;
  /** Hard cap on MCTS iterations (default 10_000). */
  readonly maxIterations?: number;
  /** UCT exploration constant c (default √2). */
  readonly explorationConstant?: number;
  /** Cap legal moves expanded per node. */
  readonly maxBranch?: number;
  /** Max plies during rollout (default 24). */
  readonly rolloutDepth?: number;
  /**
   * Rollout move selection. `heuristic` uses the search model's ordered best
   * action for every seat (Commander-grade playouts). `random-opponent` keeps
   * legacy noisy rollouts for A/B comparison.
   */
  readonly rolloutPolicy?: 'heuristic' | 'random-opponent';
}

export interface ScoredIsmctsAction<TAction> {
  readonly action: TAction;
  readonly value: number;
  readonly visits: number;
}

interface IsmctsNode<TAction> {
  readonly action: TAction | null;
  visits: number;
  totalReward: number;
  readonly children: Map<string, IsmctsNode<TAction>>;
  untriedActions: TAction[];
}

function limitedActions<TState, TAction>(
  state: TState,
  model: SearchModel<TState, TAction>,
  maxBranch: number
): TAction[] {
  let actions = model.legalActions(state);
  if (model.orderActions) {
    actions = model.orderActions(state, actions);
  }
  if (Number.isFinite(maxBranch) && actions.length > maxBranch) {
    actions = actions.slice(0, maxBranch);
  }
  return actions;
}

function uctValue(
  node: IsmctsNode<unknown>,
  parentVisits: number,
  explorationConstant: number
): number {
  if (node.visits === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const exploit = node.totalReward / node.visits;
  const explore =
    explorationConstant * Math.sqrt(Math.log(parentVisits + 1) / node.visits);
  return exploit + explore;
}

function selectChild<TAction>(
  node: IsmctsNode<TAction>,
  explorationConstant: number
): IsmctsNode<TAction> {
  let best: IsmctsNode<TAction> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const child of node.children.values()) {
    const score = uctValue(
      child as IsmctsNode<unknown>,
      node.visits,
      explorationConstant
    );
    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }
  if (!best) {
    throw new Error('ISMCTS selectChild called on node with no children.');
  }
  return best;
}

function rollout<TState, TAction>(
  state: TState,
  model: SearchModel<TState, TAction>,
  maxBranch: number,
  rolloutDepth: number,
  rolloutPolicy: 'heuristic' | 'random-opponent',
  perspective: PlayerRef,
  rng: Rng
): number {
  let current = state;
  for (let depth = 0; depth < rolloutDepth; depth++) {
    if (model.isTerminal(current)) {
      break;
    }
    const actions = limitedActions(current, model, maxBranch);
    if (actions.length === 0) {
      break;
    }
    const pick =
      rolloutPolicy === 'heuristic' ||
      model.currentPlayer(current) === perspective
        ? actions[0]
        : actions[Math.floor(rng() * Math.min(actions.length, 3))] ?? actions[0];
    current = model.applyAction(current, pick);
  }
  return model.evaluate(current, perspective);
}

function createNode<TAction>(action: TAction | null): IsmctsNode<TAction> {
  return {
    action,
    visits: 0,
    totalReward: 0,
    children: new Map(),
    untriedActions: [],
  };
}

/**
 * Information-set MCTS (determinized sampling + shared tree + UCT).
 * Each iteration samples hidden hands, traverses/expands the tree, rollouts,
 * and backpropagates from the perspective player's eval.
 */
export function ismctsSearchActionValues<TState, TAction>(
  rootState: TState,
  model: SearchModel<TState, TAction>,
  options: IsmctsOptions,
  actionKey: (action: TAction) => string
): ScoredIsmctsAction<TAction>[] {
  const maxBranch = options.maxBranch ?? 8;
  const rolloutDepth = options.rolloutDepth ?? 24;
  const rolloutPolicy = options.rolloutPolicy ?? 'heuristic';
  const explorationConstant = options.explorationConstant ?? Math.SQRT2;
  const maxIterations = options.maxIterations ?? 10_000;
  const timeBudgetMs = options.timeBudgetMs ?? 500;
  const deadline = Date.now() + timeBudgetMs;

  const root = createNode<TAction>(null);
  root.untriedActions = limitedActions(rootState, model, maxBranch);

  let iterations = 0;
  while (iterations < maxIterations && Date.now() < deadline) {
    iterations++;

    const world = model.determinize
      ? model.determinize(rootState, options.perspective, options.rng)
      : rootState;

    let state = world;
    let node = root;
    const path: IsmctsNode<TAction>[] = [node];

    while (
      node.untriedActions.length === 0 &&
      node.children.size > 0 &&
      !model.isTerminal(state)
    ) {
      const child = selectChild(node, explorationConstant);
      state = model.applyAction(state, child.action!);
      node = child;
      path.push(node);
    }

    if (!model.isTerminal(state) && node.untriedActions.length > 0) {
      const action = node.untriedActions.pop()!;
      state = model.applyAction(state, action);
      const child = createNode(action);
      node.children.set(actionKey(action), child);
      node = child;
      path.push(node);
    }

    const value = rollout(
      state,
      model,
      maxBranch,
      rolloutDepth,
      rolloutPolicy,
      options.perspective,
      options.rng
    );

    for (const visited of path) {
      visited.visits += 1;
      visited.totalReward += value;
    }
  }

  const rootActions = limitedActions<TState, TAction>(
    rootState,
    model,
    maxBranch
  );
  const scored: ScoredIsmctsAction<TAction>[] = [];

  for (const action of rootActions) {
    const child = root.children.get(actionKey(action));
    if (child && child.visits > 0) {
      scored.push({
        action,
        value: child.totalReward / child.visits,
        visits: child.visits,
      });
    } else {
      scored.push({ action, value: 0, visits: 0 });
    }
  }

  return scored.sort((left, right) => right.value - left.value);
}
