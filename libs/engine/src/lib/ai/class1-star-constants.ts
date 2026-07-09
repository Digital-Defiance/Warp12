import { generateCoordinateSet } from '../domino/coordinates.js';
import { coordinateKey } from '../types/coordinate.js';
import type { WarpAiAction } from './actions.js';
import type { GoOutRacePhase } from './go-out-race.js';

/** Double-twelve coordinate count (0–0 through 12–12). */
export const CLASS1_STAR_TILE_COUNT = 91;

/** Scalar + one-hot context before tile masks. */
export const CLASS1_STAR_CONTEXT_DIM = 13;

/** One-hot width for {@link WarpAiAction} kinds. */
export const CLASS1_STAR_ACTION_KIND_DIM = 11;

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

export const CLASS1_STAR_DISPLAY_NAME = 'Class I*';

export const CLASS1_STAR_MODEL_VERSION = 1;

export const ACTION_KIND_INDEX: Readonly<Record<WarpAiAction['kind'], number>> =
  {
    chart: 0,
    draw: 1,
    'deploy-beacon': 2,
    'pass-red-alert': 3,
    'pass-turn': 4,
    'all-stop': 5,
    'raise-shields': 6,
    'drop-to-impulse': 7,
    'catch-drop-to-impulse': 8,
    'invoke-continuum-flash': 9,
    'resolve-continuum-wager': 10,
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
