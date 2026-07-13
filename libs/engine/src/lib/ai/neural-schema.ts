import {
  normalizeWarpFactor,
  warpSetProfile,
  type WarpFactor,
} from '../constants/warp-set.js';
import {
  CLASS1_STAR_ACTION_KIND_DIM,
  CLASS1_STAR_CONTEXT_DIM,
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_ROUTE_KIND_DIM,
  CLASS1_STAR_TILE_COUNT,
} from './class1-star-constants.js';
import { OMEGA_STATE_FEATURE_DIM } from './omega-constants.js';

/**
 * Factors that currently ship Ω / Class I* / advisor weights.
 * Independent of TEI (which is Warp 12–only by product rule).
 */
export const SHIPPED_NEURAL_FACTORS = [12] as const satisfies readonly WarpFactor[];

export type ShippedNeuralFactor = (typeof SHIPPED_NEURAL_FACTORS)[number];

/** True when browser/host can load neural officers for this set. */
export function neuralWeightsAvailable(maxPip: number): boolean {
  const factor = normalizeWarpFactor(maxPip);
  return (SHIPPED_NEURAL_FACTORS as readonly number[]).includes(factor);
}

/**
 * Layout shared by Class I* / Ω policy vectors. Tile-mask width = set size;
 * Warp 12 v1 freezes context divisors at historical values (8 / 13 / 12).
 */
export interface NeuralFeatureSchema {
  readonly maxPip: WarpFactor;
  readonly tileCount: number;
  readonly contextDim: typeof CLASS1_STAR_CONTEXT_DIM;
  readonly actionKindDim: typeof CLASS1_STAR_ACTION_KIND_DIM;
  readonly routeKindDim: typeof CLASS1_STAR_ROUTE_KIND_DIM;
  /** Full policy feature width (state + action). */
  readonly featureDim: number;
  /** Value-head prefix (context + hand mask + placed mask). */
  readonly stateFeatureDim: number;
  /** Context scalar divisors — do not change for shipped Warp 12 v1 weights. */
  readonly playerCountDivisor: number;
  readonly handSizeDivisor: number;
  readonly spacedockDivisor: number;
  readonly schemaVersion: number;
}

function featureDimForTileCount(tileCount: number): number {
  return (
    CLASS1_STAR_CONTEXT_DIM +
    tileCount * 2 +
    CLASS1_STAR_ACTION_KIND_DIM +
    tileCount +
    CLASS1_STAR_ROUTE_KIND_DIM +
    2
  );
}

function stateFeatureDimForTileCount(tileCount: number): number {
  return CLASS1_STAR_CONTEXT_DIM + tileCount * 2;
}

/**
 * Feature geometry for a Warp factor. Use when training or loading per-set nets.
 * Shipped Warp 12 weights require {@link neuralFeatureSchema}(12) exactly.
 */
export function neuralFeatureSchema(maxPip: number): NeuralFeatureSchema {
  const profile = warpSetProfile(maxPip);
  const { maxPip: factor, tileCount, maxPlayers, handSizeByPlayerCount } =
    profile;

  if (factor === 12) {
    return {
      maxPip: 12,
      tileCount: CLASS1_STAR_TILE_COUNT,
      contextDim: CLASS1_STAR_CONTEXT_DIM,
      actionKindDim: CLASS1_STAR_ACTION_KIND_DIM,
      routeKindDim: CLASS1_STAR_ROUTE_KIND_DIM,
      featureDim: CLASS1_STAR_FEATURE_DIM,
      stateFeatureDim: OMEGA_STATE_FEATURE_DIM,
      // Frozen for omega-v1 / Class I* v1 — not maxPlayers / max hand.
      playerCountDivisor: 8,
      handSizeDivisor: 13,
      spacedockDivisor: 12,
      schemaVersion: 1,
    };
  }

  const maxHand = Math.max(...Object.values(handSizeByPlayerCount));
  return {
    maxPip: factor,
    tileCount,
    contextDim: CLASS1_STAR_CONTEXT_DIM,
    actionKindDim: CLASS1_STAR_ACTION_KIND_DIM,
    routeKindDim: CLASS1_STAR_ROUTE_KIND_DIM,
    featureDim: featureDimForTileCount(tileCount),
    stateFeatureDim: stateFeatureDimForTileCount(tileCount),
    playerCountDivisor: maxPlayers,
    handSizeDivisor: maxHand,
    spacedockDivisor: factor,
    schemaVersion: 1,
  };
}
