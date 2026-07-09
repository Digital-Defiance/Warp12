import type { OmegaDenseLayer } from './omega-net.js';

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

export function forwardMlp(
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
