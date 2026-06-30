/**
 * Turns on "gaming it out": instead of scoring the current options with
 * heuristics, the bot simulates each move forward with the engine, samples the
 * hidden hands/draw a few times, and looks `depth` plies ahead. More expensive,
 * but it reasons about consequences (e.g. setting up an opponent to go out).
 */
export interface LookaheadOptions {
  /** Plies to search, including the bot's own move (>= 1). */
  depth: number;
  /** Hidden-world samples per move for imperfect-information averaging (default 6). */
  determinizations?: number;
  /** Cap candidate moves expanded per node, best-first (default 6). */
  maxBranch?: number;
}
