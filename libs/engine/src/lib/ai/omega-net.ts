import {
  OMEGA_MODEL_VERSION,
  OMEGA_POLICY_FEATURE_DIM,
  OMEGA_POLICY_FEATURE_DIM_V0,
  OMEGA_STATE_FEATURE_DIM,
} from './omega-constants.js';

/** One fully-connected layer (row-major weights: out × in). */
export interface OmegaDenseLayer {
  readonly inSize: number;
  readonly outSize: number;
  /** Length inSize × outSize. */
  readonly weights: readonly number[];
  /** Length outSize. */
  readonly bias: readonly number[];
}

/**
 * Portable JSON weights for the standalone Ω network. Two independent MLP
 * heads share no parameters: a policy head that scores each candidate action and
 * a value head that estimates the acting seat's outcome from the state alone.
 */
export interface OmegaModelWeights {
  readonly version: number;
  readonly policyFeatureDim: number;
  readonly valueFeatureDim: number;
  readonly policyHiddenSizes: readonly number[];
  readonly valueHiddenSizes: readonly number[];
  /** policy: featureDim → hidden… → 1 (raw logit). */
  readonly policyLayers: readonly OmegaDenseLayer[];
  /** value: stateDim → hidden… → 1 (pre-tanh). */
  readonly valueLayers: readonly OmegaDenseLayer[];
}

function relu(value: number): number {
  return value > 0 ? value : 0;
}

function denseForward(
  input: ArrayLike<number>,
  layer: OmegaDenseLayer,
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

function forwardMlp(
  features: ArrayLike<number>,
  layers: readonly OmegaDenseLayer[]
): number {
  if (layers.length === 0) {
    return 0;
  }
  let input: ArrayLike<number> = features;
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const output = new Float32Array(layer.outSize);
    denseForward(input, layer, output);

    const isOutputLayer = layerIndex === layers.length - 1;
    if (isOutputLayer) {
      return output[0] ?? 0;
    }
    for (let i = 0; i < output.length; i++) {
      output[i] = relu(output[i]);
    }
    input = output;
  }
  return 0;
}

/** Raw policy logit for one candidate's feature vector (handles both v0 and v1 dims). */
export function forwardOmegaPolicyLogit(
  features: Float32Array,
  weights: OmegaModelWeights
): number {
  let input = features;
  
  // If model expects v0 (303) but we have v1 (304), convert by removing spool bit
  if (weights.policyFeatureDim === OMEGA_POLICY_FEATURE_DIM_V0 && 
      features.length === OMEGA_POLICY_FEATURE_DIM) {
    input = convertV1FeaturesToV0(features);
  } else if (features.length !== weights.policyFeatureDim) {
    throw new Error(
      `Omega policy feature dim mismatch: buffer ${features.length}, model ${weights.policyFeatureDim}.`
    );
  }
  
  return forwardMlp(input, weights.policyLayers);
}

/**
 * Convert v1 (304-dim) features to v0 (303-dim) by removing the spool action bit.
 * In v0, action kinds were: chart(0), draw(1), deploy-beacon(2), ...
 * In v1, action kinds are: chart(0), spool(1), draw(2), deploy-beacon(3), ...
 * So we need to remove index 1 from the action kind one-hot and shift the rest down.
 */
function convertV1FeaturesToV0(v1Features: Float32Array): Float32Array {
  const v0 = new Float32Array(OMEGA_POLICY_FEATURE_DIM_V0);
  
  // Context + hand mask + placed mask (before action kinds)
  const ACTION_KIND_OFFSET = 13 + 91 * 2; // CLASS1_STAR_CONTEXT_DIM + 2*TILE_COUNT
  
  // Copy everything before action kinds
  v0.set(v1Features.subarray(0, ACTION_KIND_OFFSET));
  
  // Copy action kinds, skipping index 1 (spool)
  const v1ActionStart = ACTION_KIND_OFFSET;
  const v0ActionStart = ACTION_KIND_OFFSET;
  
  // Copy action kind index 0 (chart)
  v0[v0ActionStart] = v1Features[v1ActionStart];
  
  // Copy action kinds 2-11 (draw through resolve-continuum-wager) → indices 1-10 in v0
  for (let i = 0; i < 10; i++) {
    v0[v0ActionStart + 1 + i] = v1Features[v1ActionStart + 2 + i];
  }
  
  // Copy everything after action kinds (coordinate mask + route kind + pip values)
  const v1AfterAction = v1ActionStart + 12; // CLASS1_STAR_ACTION_KIND_DIM
  const v0AfterAction = v0ActionStart + 11; // CLASS1_STAR_ACTION_KIND_DIM_V0
  const remainingSize = 91 + 4 + 2; // TILE_COUNT + ROUTE_KIND_DIM + 2
  
  v0.set(v1Features.subarray(v1AfterAction, v1AfterAction + remainingSize), v0AfterAction);
  
  return v0;
}

export function forwardOmegaPolicyBatch(
  batch: readonly Float32Array[],
  weights: OmegaModelWeights
): number[] {
  return batch.map((features) => forwardOmegaPolicyLogit(features, weights));
}

/** Value estimate in [-1, 1] (tanh) for the acting seat from the state prefix. */
export function forwardOmegaValue(
  stateFeatures: Float32Array,
  weights: OmegaModelWeights
): number {
  if (stateFeatures.length !== weights.valueFeatureDim) {
    throw new Error(
      `Omega value feature dim mismatch: buffer ${stateFeatures.length}, model ${weights.valueFeatureDim}.`
    );
  }
  return Math.tanh(forwardMlp(stateFeatures, weights.valueLayers));
}

/** Numerically stable softmax over candidate logits with a temperature. */
export function softmax(logits: readonly number[], temperature = 1): number[] {
  const t = temperature > 0 ? temperature : 1e-6;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of logits) {
    if (value > max) max = value;
  }
  const exps = logits.map((value) => Math.exp((value - max) / t));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
}

function buildZeroLayers(
  inputDim: number,
  hiddenSizes: readonly number[]
): OmegaDenseLayer[] {
  const layers: OmegaDenseLayer[] = [];
  let inSize = inputDim;
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
  return layers;
}

/**
 * Zero-initialized network: every policy logit is 0 → uniform action
 * distribution → uniform-random play. This is the honest "from scratch" starting
 * point for self-play. It has never seen Commander and never will.
 */
export function createZeroOmegaModelWeights(
  policyHiddenSizes: readonly number[] = [256, 256],
  valueHiddenSizes: readonly number[] = [256, 128]
): OmegaModelWeights {
  return {
    version: OMEGA_MODEL_VERSION,
    policyFeatureDim: OMEGA_POLICY_FEATURE_DIM,
    valueFeatureDim: OMEGA_STATE_FEATURE_DIM,
    policyHiddenSizes: [...policyHiddenSizes],
    valueHiddenSizes: [...valueHiddenSizes],
    policyLayers: buildZeroLayers(OMEGA_POLICY_FEATURE_DIM, policyHiddenSizes),
    valueLayers: buildZeroLayers(OMEGA_STATE_FEATURE_DIM, valueHiddenSizes),
  };
}

function validateHead(
  layers: readonly OmegaDenseLayer[],
  inputDim: number,
  hiddenSizes: readonly number[],
  head: 'policy' | 'value'
): void {
  let expectedIn = inputDim;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const expectedOut =
      i === layers.length - 1 ? 1 : (hiddenSizes[i] ?? layer.outSize);
    if (layer.inSize !== expectedIn || layer.outSize !== expectedOut) {
      throw new Error(
        `Omega ${head} layer ${i} shape ${layer.inSize}→${layer.outSize} != expected ${expectedIn}→${expectedOut}.`
      );
    }
    if (layer.weights.length !== layer.inSize * layer.outSize) {
      throw new Error(`Omega ${head} layer ${i} weight length mismatch.`);
    }
    if (layer.bias.length !== layer.outSize) {
      throw new Error(`Omega ${head} layer ${i} bias length mismatch.`);
    }
    expectedIn = expectedOut;
  }
}

export function validateOmegaModelWeights(weights: OmegaModelWeights): void {
  if (weights.version !== OMEGA_MODEL_VERSION) {
    throw new Error(
      `Unsupported Omega model version ${weights.version}; expected ${OMEGA_MODEL_VERSION}.`
    );
  }
  // Accept both v0 (303 dims, before spool) and v1 (304 dims, with spool)
  const isV0 = weights.policyFeatureDim === OMEGA_POLICY_FEATURE_DIM_V0;
  const isV1 = weights.policyFeatureDim === OMEGA_POLICY_FEATURE_DIM;
  if (!isV0 && !isV1) {
    throw new Error(
      `Omega policyFeatureDim ${weights.policyFeatureDim} is neither ${OMEGA_POLICY_FEATURE_DIM_V0} (v0) nor ${OMEGA_POLICY_FEATURE_DIM} (v1).`
    );
  }
  if (weights.valueFeatureDim !== OMEGA_STATE_FEATURE_DIM) {
    throw new Error(
      `Omega valueFeatureDim ${weights.valueFeatureDim} != ${OMEGA_STATE_FEATURE_DIM}.`
    );
  }
  validateHead(
    weights.policyLayers,
    weights.policyFeatureDim,
    weights.policyHiddenSizes,
    'policy'
  );
  validateHead(
    weights.valueLayers,
    weights.valueFeatureDim,
    weights.valueHiddenSizes,
    'value'
  );
}
