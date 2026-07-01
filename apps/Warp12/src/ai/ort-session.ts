import * as ort from 'onnxruntime-web';

import {
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_MODEL_INPUT,
  CLASS1_STAR_MODEL_OUTPUT,
  CLASS1_STAR_ONNX_URL,
  type Class1StarModelWeights,
  type Class1StarResidualScorer,
} from './class1-star-models.js';
import {
  createTsResidualScorer,
  encodeClass1StarFeatureBatch,
  type WarpAiAction,
  type WarpEvalContext,
} from 'warp12-engine';

export interface OrtClass1StarSessionOptions {
  modelUrl?: string;
  executionProviders?: ort.InferenceSession.SessionOptions['executionProviders'];
}

let wasmPathsConfigured = false;

function configureOrtWasmPaths(): void {
  if (wasmPathsConfigured) {
    return;
  }
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  ort.env.wasm.wasmPaths = `${base}ort/`;
  wasmPathsConfigured = true;
}

function defaultExecutionProviders(): ort.InferenceSession.SessionOptions['executionProviders'] {
  return ['webnn', 'wasm'];
}

function extractBatchOutput(
  result: ort.InferenceSession.OnnxValueMapType
): Float32Array {
  const tensor = result[CLASS1_STAR_MODEL_OUTPUT];
  if (!tensor || !(tensor instanceof ort.Tensor)) {
    throw new Error('Class I* ONNX output tensor missing.');
  }
  const data = tensor.data;
  if (!(data instanceof Float32Array)) {
    throw new Error('Class I* ONNX output must be float32.');
  }
  return data;
}

export function createOrtClass1StarScorer(
  session: ort.InferenceSession,
  weights: Class1StarModelWeights
): Class1StarResidualScorer {
  const tsFallback = createTsResidualScorer(weights);

  const scoreCandidates = async (
    ctx: WarpEvalContext,
    actions: readonly WarpAiAction[]
  ): Promise<number[]> => {
    if (actions.length === 0) {
      return [];
    }

    try {
      const batch = encodeClass1StarFeatureBatch(ctx, actions);
      const flat = new Float32Array(batch.length * CLASS1_STAR_FEATURE_DIM);
      for (let index = 0; index < batch.length; index++) {
        flat.set(batch[index], index * CLASS1_STAR_FEATURE_DIM);
      }

      const input = new ort.Tensor('float32', flat, [
        batch.length,
        CLASS1_STAR_FEATURE_DIM,
      ]);
      const result = await session.run({ [CLASS1_STAR_MODEL_INPUT]: input });
      const output = extractBatchOutput(result);
      return Array.from(output.slice(0, actions.length));
    } catch (error) {
      console.warn('Class I* ORT inference failed; using TS fallback.', error);
      const fallback = tsFallback.scoreCandidates(ctx, actions);
      return fallback instanceof Promise ? await fallback : fallback;
    }
  };

  return {
    inference: 'async',
    alpha: weights.alpha,
    scoreCandidate(ctx, action) {
      return scoreCandidates(ctx, [action]).then((scores) => scores[0] ?? 0);
    },
    scoreCandidates,
  };
}

export async function createOrtClass1StarSession(
  options: OrtClass1StarSessionOptions = {}
): Promise<ort.InferenceSession | null> {
  configureOrtWasmPaths();
  const modelUrl = options.modelUrl ?? CLASS1_STAR_ONNX_URL;

  try {
    const response = await fetch(modelUrl, { method: 'HEAD' });
    if (!response.ok) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return await ort.InferenceSession.create(modelUrl, {
      executionProviders:
        options.executionProviders ?? defaultExecutionProviders(),
    });
  } catch (error) {
    console.warn('Class I* ORT session unavailable.', error);
    return null;
  }
}

export type { WarpAiAction, WarpEvalContext };
