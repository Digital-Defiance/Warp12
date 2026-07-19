import { generateCoordinateSet } from '../domino/coordinates.js';
import { coordinateKey } from '../types/coordinate.js';
import type { WarpAiAction } from './actions.js';
import type { GoOutRacePhase } from './go-out-race.js';

/** Double-twelve coordinate count (0–0 through 12–12). */
export const CLASS1_STAR_TILE_COUNT = 91;

/** Scalar + one-hot context before tile masks. */
export const CLASS1_STAR_CONTEXT_DIM = 13;

/** One-hot width for {@link WarpAiAction} kinds (current schema). */
export const CLASS1_STAR_ACTION_KIND_DIM = 12;

/** Legacy v0 action kind dimension (before spool was added). */
export const CLASS1_STAR_ACTION_KIND_DIM_V0 = 11;

/** One-hot width for chart route kinds. */
export const CLASS1_STAR_ROUTE_KIND_DIM = 4;

/** Fixed feature width for Class I* residual models (v1 schema). */
export const CLASS1_STAR_FEATURE_DIM =
  CLASS1_STAR_CONTEXT_DIM +
  CLASS1_STAR_TILE_COUNT * 2 +
  CLASS1_STAR_ACTION_KIND_DIM +
  CLASS1_STAR_TILE_COUNT +
  CLASS1_STAR_ROUTE_KIND_DIM +
  2;

/** Legacy v0 feature width (before spool action was added). */
export const CLASS1_STAR_FEATURE_DIM_V0 =
  CLASS1_STAR_CONTEXT_DIM +
  CLASS1_STAR_TILE_COUNT * 2 +
  CLASS1_STAR_ACTION_KIND_DIM_V0 +
  CLASS1_STAR_TILE_COUNT +
  CLASS1_STAR_ROUTE_KIND_DIM +
  2;

export const CLASS1_STAR_DISPLAY_NAME = 'Class I*';

export const CLASS1_STAR_MODEL_VERSION = 1;

export const ACTION_KIND_INDEX: Readonly<Record<WarpAiAction['kind'], number>> =
  {
    chart: 0,
    spool: 1,
    draw: 2,
    /** Alias draw slot — keep Class I* v1 width stable. */
    'desperation-dig': 2,
    'deploy-beacon': 3,
    'pass-red-alert': 4,
    'pass-turn': 5,
    'all-stop': 6,
    'raise-shields': 7,
    'drop-to-impulse': 8,
    'catch-drop-to-impulse': 9,
    'invoke-continuum-flash': 10,
    'resolve-continuum-wager': 11,
    /** Alias wager-resolve slot — keep Class I* v1 width stable. */
    'resolve-hand-exchange': 11,
    /** Out-of-band for draft; feature encoder clamps to DIM. */
    'pick-from-pack': 12,
  };

export const RACE_PHASE_INDEX: Readonly<Record<GoOutRacePhase, number>> = {
  build: 0,
  sprint: 1,
  defensive: 2,
};

/** Canonical tile index for coordinate masks (stable across train + inference). */
export const CLASS1_STAR_TILE_INDEX: ReadonlyMap<string, number> = new Map(
  generateCoordinateSet(12).map((coordinate, index) => [
    coordinateKey(coordinate),
    index,
  ])
);

export function tileIndexForKey(key: string): number | undefined {
  return CLASS1_STAR_TILE_INDEX.get(key);
}
