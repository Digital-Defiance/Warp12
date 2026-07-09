import {
  ADVISOR_MODEL_VERSION,
  ADVISOR_POLICY_FEATURE_DIM,
} from './advisor-constants.js';
import type { OmegaDenseLayer } from './omega-net.js';
import { forwardMlp, softmax } from './advisor-net-internals.js';

export type AdvisorDenseLayer = OmegaDenseLayer;

/** Concept-bottleneck advisor — policy head only (state concepts + action features). */
export interface AdvisorModelWeights {
  readonly version: number;
  readonly policyFeatureDim: number;
  readonly policyHiddenSizes: readonly number[];
  readonly policyLayers: readonly AdvisorDenseLayer[];
}

export function forwardAdvisorPolicyLogit(
  features: Float32Array,
  weights: AdvisorModelWeights
): number {
  if (features.length !== weights.policyFeatureDim) {
    throw new Error(
      `Advisor policy feature dim mismatch: buffer ${features.length}, model ${weights.policyFeatureDim}.`
    );
  }
  return forwardMlp(features, weights.policyLayers);
}

export function forwardAdvisorPolicyBatch(
  batch: readonly Float32Array[],
  weights: AdvisorModelWeights
): number[] {
  return batch.map((features) => forwardAdvisorPolicyLogit(features, weights));
}

export { softmax };

function buildZeroLayers(
  inputDim: number,
  hiddenSizes: readonly number[]
): AdvisorDenseLayer[] {
  const layers: AdvisorDenseLayer[] = [];
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

export function createZeroAdvisorModelWeights(
  policyHiddenSizes: readonly number[] = [64, 64]
): AdvisorModelWeights {
  return {
    version: ADVISOR_MODEL_VERSION,
    policyFeatureDim: ADVISOR_POLICY_FEATURE_DIM,
    policyHiddenSizes: [...policyHiddenSizes],
    policyLayers: buildZeroLayers(ADVISOR_POLICY_FEATURE_DIM, policyHiddenSizes),
  };
}

function validateHead(
  layers: readonly AdvisorDenseLayer[],
  inputDim: number,
  hiddenSizes: readonly number[]
): void {
  let expectedIn = inputDim;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const expectedOut =
      i === layers.length - 1 ? 1 : (hiddenSizes[i] ?? layer.outSize);
    if (layer.inSize !== expectedIn || layer.outSize !== expectedOut) {
      throw new Error(
        `Advisor policy layer ${i} shape ${layer.inSize}→${layer.outSize} != expected ${expectedIn}→${expectedOut}.`
      );
    }
    if (layer.weights.length !== layer.inSize * layer.outSize) {
      throw new Error(`Advisor policy layer ${i} weight length mismatch.`);
    }
    if (layer.bias.length !== layer.outSize) {
      throw new Error(`Advisor policy layer ${i} bias length mismatch.`);
    }
    expectedIn = expectedOut;
  }
}

export function validateAdvisorModelWeights(weights: AdvisorModelWeights): void {
  if (weights.version !== ADVISOR_MODEL_VERSION) {
    throw new Error(
      `Unsupported advisor model version ${weights.version}; expected ${ADVISOR_MODEL_VERSION}.`
    );
  }
  if (weights.policyFeatureDim !== ADVISOR_POLICY_FEATURE_DIM) {
    throw new Error(
      `Advisor policyFeatureDim ${weights.policyFeatureDim} != ${ADVISOR_POLICY_FEATURE_DIM}.`
    );
  }
  validateHead(
    weights.policyLayers,
    weights.policyFeatureDim,
    weights.policyHiddenSizes
  );
}
