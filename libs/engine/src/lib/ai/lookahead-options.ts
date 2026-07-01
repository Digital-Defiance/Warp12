/**
 * Turns on "gaming it out": instead of scoring the current options with
 * heuristics, the bot simulates each move forward with the engine, samples the
 * hidden hands/draw a few times, and looks `depth` plies ahead. More expensive,
 * but it reasons about consequences (e.g. setting up an opponent to go out).
 */
export interface LookaheadOptions {
  /** Plies to search, including the bot's own move (>= 1). Required for expectimax; optional for ISMCTS. */
  depth?: number;
  /** Hidden-world samples per move for imperfect-information averaging (default 6). */
  determinizations?: number;
  /** Cap candidate moves expanded per node, best-first (default 6). */
  maxBranch?: number;
  /** Rejection-sample hidden hands for mandatory-play and blocked-pile consistency. */
  useBeliefConstraints?: boolean;
  /** When set, keep searching until this wall-clock budget (ms) is exhausted. */
  timeBudgetMs?: number;
  /** Minimum determinizations per batch when using `timeBudgetMs`. */
  minDeterminizations?: number;
  /** Search backend — `ismcts` for UCT tree; `expectimax` for fixed-depth determinized minimax. */
  searchEngine?: 'expectimax' | 'ismcts';
  /** ISMCTS iterations cap when `searchEngine` is `ismcts`. */
  ismctsMaxIterations?: number;
  /** UCT exploration constant when `searchEngine` is `ismcts`. */
  ismctsExplorationConstant?: number;
  /** Rollout depth plies when `searchEngine` is `ismcts`. */
  ismctsRolloutDepth?: number;
}
