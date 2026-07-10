import type { PlayerRef, Rng, SearchModel } from 'double-eighteen';

export interface IsmctsOptions<TAction = unknown> {
  readonly perspective: PlayerRef;
  readonly rng: Rng;
  /** Wall-clock budget per decision (default 500ms). */
  readonly timeBudgetMs?: number;
  /** Hard cap on MCTS iterations (default 10_000). */
  readonly maxIterations?: number;
  /** UCT / PUCT exploration constant (default √2 for UCT, 1.5 for PUCT). */
  readonly explorationConstant?: number;
  /** Cap legal moves expanded per node. */
  readonly maxBranch?: number;
  /** Max plies during rollout (default 24). 0 = evaluate leaf with no rollout. */
  readonly rolloutDepth?: number;
  /**
   * Rollout move selection (only when `rolloutDepth` > 0):
   * - `heuristic`: search-model ordered best (Commander-grade) — training bootstrap.
   * - `random-opponent`: noisy opponents, best for perspective.
   * - `prior`: sample by {@link actionPrior} when provided, else first action.
   */
  readonly rolloutPolicy?: 'heuristic' | 'random-opponent' | 'prior';
  /**
   * Policy prior P(a|s) for PUCT selection (AlphaZero-style). When set, selection
   * uses PUCT and expansions assign priors from this callback. Without it,
   * selection stays classic UCT. Length of returned array MUST equal `actions`.
   * Values should be ≥ 0 and need not be normalized (we normalize).
   */
  readonly actionPrior?: (
    state: unknown,
    actions: readonly TAction[]
  ) => readonly number[];
}

type ActionPriorFn<TAction> = NonNullable<IsmctsOptions<TAction>['actionPrior']>;

export interface ScoredIsmctsAction<TAction> {
  readonly action: TAction;
  readonly value: number;
  readonly visits: number;
}

interface IsmctsNode<TAction> {
  readonly action: TAction | null;
  visits: number;
  totalReward: number;
  /** Policy prior P(a|s) for this edge; unused for root. */
  prior: number;
  readonly children: Map<string, IsmctsNode<TAction>>;
  untriedActions: TAction[];
  /** Normalized priors parallel to `untriedActions` when PUCT expands lazily. */
  untriedPriors: number[];
}

function limitedActions<TState, TAction>(
  state: TState,
  model: SearchModel<TState, TAction>,
  maxBranch: number,
  actionPrior?: ActionPriorFn<TAction>
): TAction[] {
  let actions: readonly TAction[] = model.legalActions(state);
  if (model.orderActions) {
    actions = model.orderActions(state, actions);
  }
  if (
    actionPrior &&
    Number.isFinite(maxBranch) &&
    actions.length > maxBranch
  ) {
    // Prefer high-prior moves when capping the branch (not heuristic order).
    const raw = actionPrior(state, actions);
    const scored: { action: TAction; prior: number }[] = [];
    for (let index = 0; index < actions.length; index += 1) {
      scored.push({
        action: actions[index]!,
        prior: Math.max(0, raw[index] ?? 0),
      });
    }
    scored.sort((left, right) => right.prior - left.prior);
    return scored.slice(0, maxBranch).map((entry) => entry.action);
  }
  if (Number.isFinite(maxBranch) && actions.length > maxBranch) {
    return actions.slice(0, maxBranch);
  }
  return [...actions];
}

function normalizePriors(raw: readonly number[], count: number): number[] {
  const clipped = Array.from({ length: count }, (_, i) =>
    Math.max(0, raw[i] ?? 0)
  );
  const sum = clipped.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return Array.from({ length: count }, () => 1 / Math.max(1, count));
  }
  return clipped.map((value) => value / sum);
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

/**
 * AlphaZero PUCT: Q + c_puct · P · √N / (1 + n). Unvisited children still get a
 * finite score so the prior can guide first expansion among siblings.
 */
function puctValue(
  node: IsmctsNode<unknown>,
  parentVisits: number,
  explorationConstant: number
): number {
  const exploit = node.visits > 0 ? node.totalReward / node.visits : 0;
  const explore =
    explorationConstant *
    node.prior *
    (Math.sqrt(parentVisits + 1) / (1 + node.visits));
  return exploit + explore;
}

function selectChild<TAction>(
  node: IsmctsNode<TAction>,
  explorationConstant: number,
  usePuct: boolean
): IsmctsNode<TAction> {
  let best: IsmctsNode<TAction> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const child of node.children.values()) {
    const score = usePuct
      ? puctValue(child as IsmctsNode<unknown>, node.visits, explorationConstant)
      : uctValue(child as IsmctsNode<unknown>, node.visits, explorationConstant);
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
  rolloutPolicy: 'heuristic' | 'random-opponent' | 'prior',
  perspective: PlayerRef,
  rng: Rng,
  actionPrior?: ActionPriorFn<TAction>
): number {
  let current = state;
  for (let depth = 0; depth < rolloutDepth; depth++) {
    if (model.isTerminal(current)) {
      break;
    }
    const actions = limitedActions(current, model, maxBranch, actionPrior);
    if (actions.length === 0) {
      break;
    }
    let pick = actions[0];
    if (rolloutPolicy === 'prior' && actionPrior) {
      const priors = normalizePriors(actionPrior(current, actions), actions.length);
      const roll = rng();
      let cumulative = 0;
      for (let i = 0; i < actions.length; i++) {
        cumulative += priors[i];
        if (roll <= cumulative) {
          pick = actions[i];
          break;
        }
      }
    } else if (
      rolloutPolicy === 'random-opponent' &&
      model.currentPlayer(current) !== perspective
    ) {
      pick =
        actions[Math.floor(rng() * Math.min(actions.length, 3))] ?? actions[0];
    }
    current = model.applyAction(current, pick);
  }
  return model.evaluate(current, perspective);
}

function createNode<TAction>(
  action: TAction | null,
  prior = 0
): IsmctsNode<TAction> {
  return {
    action,
    visits: 0,
    totalReward: 0,
    prior,
    children: new Map(),
    untriedActions: [],
    untriedPriors: [],
  };
}

/**
 * Expand every remaining legal action as a child with a policy prior (PUCT).
 * Returns true if any children were added.
 */
function expandAllWithPriors<TState, TAction>(
  node: IsmctsNode<TAction>,
  state: TState,
  maxBranch: number,
  model: SearchModel<TState, TAction>,
  actionKey: (action: TAction) => string,
  actionPrior: ActionPriorFn<TAction>
): boolean {
  if (node.untriedActions.length === 0 && node.children.size === 0) {
    const actions = limitedActions(state, model, maxBranch, actionPrior);
    const priors = normalizePriors(actionPrior(state, actions), actions.length);
    node.untriedActions = actions.slice();
    node.untriedPriors = [...priors];
  }
  if (node.untriedActions.length === 0) {
    return false;
  }
  while (node.untriedActions.length > 0) {
    const action = node.untriedActions.pop()!;
    const prior = node.untriedPriors.pop() ?? 0;
    const key = actionKey(action);
    if (!node.children.has(key)) {
      node.children.set(key, createNode(action, prior));
    }
  }
  return node.children.size > 0;
}

/**
 * Information-set MCTS (determinized sampling + shared tree).
 *
 * Selection: classic UCT, or PUCT when {@link IsmctsOptions.actionPrior} is set
 * (policy-guided expansion — Commander-free when priors come from Omega).
 */
export function ismctsSearchActionValues<TState, TAction>(
  rootState: TState,
  model: SearchModel<TState, TAction>,
  options: IsmctsOptions<TAction>,
  actionKey: (action: TAction) => string
): ScoredIsmctsAction<TAction>[] {
  const maxBranch = options.maxBranch ?? 8;
  const rolloutDepth = options.rolloutDepth ?? 24;
  const rolloutPolicy = options.rolloutPolicy ?? 'heuristic';
  const actionPrior = options.actionPrior;
  const usePuct = actionPrior != null;
  const explorationConstant =
    options.explorationConstant ?? (usePuct ? 1.5 : Math.SQRT2);
  const maxIterations = options.maxIterations ?? 10_000;
  const timeBudgetMs = options.timeBudgetMs ?? 500;
  const deadline = Date.now() + timeBudgetMs;

  const root = createNode<TAction>(null);
  if (usePuct && actionPrior) {
    expandAllWithPriors(
      root,
      rootState,
      maxBranch,
      model,
      actionKey,
      actionPrior
    );
  } else {
    root.untriedActions = limitedActions(
      rootState,
      model,
      maxBranch,
      actionPrior
    );
  }

  let iterations = 0;
  while (iterations < maxIterations && Date.now() < deadline) {
    iterations++;

    const world = model.determinize
      ? model.determinize(rootState, options.perspective, options.rng)
      : rootState;

    let state = world;
    let node = root;
    const path: IsmctsNode<TAction>[] = [node];

    // Selection: only descend when the node is fully expanded.
    // UCT expands lazily (untriedActions); PUCT expand-all clears them first.
    while (
      node.children.size > 0 &&
      node.untriedActions.length === 0 &&
      !model.isTerminal(state)
    ) {
      const child = selectChild(node, explorationConstant, usePuct);
      state = model.applyAction(state, child.action!);
      node = child;
      path.push(node);
    }

    // Expansion
    if (!model.isTerminal(state)) {
      if (usePuct && actionPrior && node.children.size === 0) {
        expandAllWithPriors(
          node,
          state,
          maxBranch,
          model,
          actionKey,
          actionPrior
        );
        if (node.children.size > 0) {
          const child = selectChild(node, explorationConstant, true);
          state = model.applyAction(state, child.action!);
          node = child;
          path.push(node);
        }
      } else if (!usePuct && node.untriedActions.length > 0) {
        const action = node.untriedActions.pop()!;
        state = model.applyAction(state, action);
        const child = createNode(action);
        node.children.set(actionKey(action), child);
        node = child;
        path.push(node);
      }
    }

    const value = rollout(
      state,
      model,
      maxBranch,
      rolloutDepth,
      rolloutPolicy,
      options.perspective,
      options.rng,
      actionPrior
    );

    for (const visited of path) {
      visited.visits += 1;
      visited.totalReward += value;
    }
  }

  const rootActions = limitedActions<TState, TAction>(
    rootState,
    model,
    maxBranch,
    actionPrior
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

  return scored.sort((left, right) => right.visits - left.visits);
}
