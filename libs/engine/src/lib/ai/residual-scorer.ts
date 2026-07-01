import {
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_MODEL_VERSION,
} from './class1-star-constants.js';
import {
  encodeClass1StarFeatureBatch,
  encodeClass1StarFeatures,
} from './feature-encoder.js';
import type { WarpAiAction } from './actions.js';
import type { WarpEvalContext } from './context.js';

/** One fully-connected layer (row-major weights: out × in). */
export interface Class1StarDenseLayer {
  readonly inSize: number;
  readonly outSize: number;
  /** Length inSize × outSize */
  readonly weights: readonly number[];
  /** Length outSize */
  readonly bias: readonly number[];
}

/** Portable JSON weights artifact (TS fallback + ONNX export source). */
export interface Class1StarModelWeights {
  readonly version: number;
  readonly featureDim: number;
  readonly hiddenSizes: readonly number[];
  /** Scales residual before adding to heuristic score. */
  readonly alpha: number;
  readonly layers: readonly Class1StarDenseLayer[];
}

export interface Class1StarResidualScorer {
  /** `async` when backed by ONNX Runtime Web; default sync TS matmul. */
  readonly inference?: 'sync' | 'async';
  readonly alpha: number;
  scoreCandidate(
    ctx: WarpEvalContext,
    action: WarpAiAction
  ): Class1StarScore;
  scoreCandidates(
    ctx: WarpEvalContext,
    actions: readonly WarpAiAction[]
  ): Class1StarScoreBatch;
}

export type Class1StarScore = number | Promise<number>;
export type Class1StarScoreBatch = number[] | Promise<number[]>;

export function isClass1StarScoreAsync(
  value: Class1StarScore | Class1StarScoreBatch
): value is Promise<number> | Promise<number[]> {
  return (
    value != null &&
    typeof (value as Promise<unknown>).then === 'function'
  );
}

export async function resolveClass1StarScores(
  value: Class1StarScoreBatch
): Promise<number[]> {
  return isClass1StarScoreAsync(value) ? await value : value;
}

function relu(value: number): number {
  return value > 0 ? value : 0;
}

function denseForward(
  input: Float32Array,
  layer: Class1StarDenseLayer,
  out: Float32Array
): void {
  for (let o = 0; o < layer.outSize; o++) {
    let sum = layer.bias[o] ?? 0;
    const rowOffset = o * layer.inSize;
    for (let i = 0; i < layer.inSize; i++) {
      sum += (layer.weights[rowOffset + i] ?? 0) * input[i];
    }
    out[o] = sum;
  }
}

export function forwardClass1StarModel(
  features: Float32Array,
  weights: Class1StarModelWeights
): number {
  if (features.length !== weights.featureDim) {
    throw new Error(
      `Feature dim mismatch: buffer ${features.length}, model ${weights.featureDim}.`
    );
  }

  let input = features;
  const scratch: Float32Array[] = weights.layers.map((layer) =>
    new Float32Array(layer.outSize)
  );

  for (let layerIndex = 0; layerIndex < weights.layers.length; layerIndex++) {
    const layer = weights.layers[layerIndex];
    const output = scratch[layerIndex];
    denseForward(input, layer, output);

    const isOutputLayer = layerIndex === weights.layers.length - 1;
    if (!isOutputLayer) {
      for (let i = 0; i < output.length; i++) {
        output[i] = relu(output[i]);
      }
      input = output;
    } else {
      return output[0] ?? 0;
    }
  }

  return 0;
}

export function forwardClass1StarBatch(
  batch: readonly Float32Array[],
  weights: Class1StarModelWeights
): number[] {
  return batch.map((features) => forwardClass1StarModel(features, weights));
}

function validateModelWeights(weights: Class1StarModelWeights): void {
  if (weights.version !== CLASS1_STAR_MODEL_VERSION) {
    throw new Error(
      `Unsupported Class I* model version ${weights.version}; expected ${CLASS1_STAR_MODEL_VERSION}.`
    );
  }
  if (weights.featureDim !== CLASS1_STAR_FEATURE_DIM) {
    throw new Error(
      `Class I* model featureDim ${weights.featureDim} != ${CLASS1_STAR_FEATURE_DIM}.`
    );
  }

  let expectedIn = weights.featureDim;
  for (let i = 0; i < weights.layers.length; i++) {
    const layer = weights.layers[i];
    const expectedOut =
      i === weights.layers.length - 1
        ? 1
        : (weights.hiddenSizes[i] ?? layer.outSize);

    if (layer.inSize !== expectedIn || layer.outSize !== expectedOut) {
      throw new Error(
        `Class I* layer ${i} shape ${layer.inSize}→${layer.outSize} != expected ${expectedIn}→${expectedOut}.`
      );
    }
    if (layer.weights.length !== layer.inSize * layer.outSize) {
      throw new Error(`Class I* layer ${i} weight length mismatch.`);
    }
    if (layer.bias.length !== layer.outSize) {
      throw new Error(`Class I* layer ${i} bias length mismatch.`);
    }
    expectedIn = expectedOut;
  }
}

/** Build a synchronous CPU scorer from exported JSON weights. */
export function createTsResidualScorer(
  weights: Class1StarModelWeights
): Class1StarResidualScorer {
  validateModelWeights(weights);

  return {
    inference: 'sync',
    alpha: weights.alpha,
    scoreCandidate(ctx, action) {
      const features = encodeClass1StarFeatures(ctx, action);
      return forwardClass1StarModel(features, weights);
    },
    scoreCandidates(ctx, actions) {
      const batch = encodeClass1StarFeatureBatch(ctx, actions);
      return forwardClass1StarBatch(batch, weights);
    },
  };
}

/** Zero-initialized v0 model — residual always 0 (Commander-equivalent picks). */
export function createZeroClass1StarModelWeights(
  hiddenSizes: readonly number[] = [128, 128]
): Class1StarModelWeights {
  const layers: Class1StarDenseLayer[] = [];
  let inSize = CLASS1_STAR_FEATURE_DIM;

  for (const hidden of hiddenSizes) {
    layers.push({
      inSize,
      outSize: hidden,
      weights: new Array(inSize * hidden).fill(0),
      bias: new Array(hidden).fill(0),
    });
    inSize = hidden;
  }

  layers.push({
    inSize,
    outSize: 1,
    weights: new Array(inSize).fill(0),
    bias: [0],
  });

  return {
    version: CLASS1_STAR_MODEL_VERSION,
    featureDim: CLASS1_STAR_FEATURE_DIM,
    hiddenSizes,
    alpha: 1,
    layers,
  };
}
