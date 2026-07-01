import {
  createTsResidualScorer,
  createZeroClass1StarModelWeights,
  type Class1StarModelWeights,
  type Class1StarResidualScorer,
} from 'warp12-engine';

import {
  CLASS1_STAR_WEIGHTS_URL,
  type Class1StarModelWeights as AppClass1StarModelWeights,
} from './class1-star-models.js';
import {
  createOrtClass1StarScorer,
  createOrtClass1StarSession,
} from './ort-session.js';

export interface Class1StarScorerLoadResult {
  scorer: Class1StarResidualScorer;
  backend: 'onnx-webnn' | 'onnx-wasm' | 'ts-json' | 'ts-zero';
}

let cachedLoad: Promise<Class1StarScorerLoadResult> | null = null;

function isModelWeights(value: unknown): value is Class1StarModelWeights {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Class1StarModelWeights;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.featureDim === 'number' &&
    Array.isArray(candidate.layers)
  );
}

async function fetchModelWeights(): Promise<{
  weights: Class1StarModelWeights;
  source: 'json' | 'zero';
}> {
  try {
    const response = await fetch(CLASS1_STAR_WEIGHTS_URL);
    if (!response.ok) {
      return { weights: createZeroClass1StarModelWeights(), source: 'zero' };
    }
    const json: unknown = await response.json();
    if (!isModelWeights(json)) {
      return { weights: createZeroClass1StarModelWeights(), source: 'zero' };
    }
    return { weights: json, source: 'json' };
  } catch {
    return { weights: createZeroClass1StarModelWeights(), source: 'zero' };
  }
}

export async function loadClass1StarScorer(): Promise<Class1StarScorerLoadResult> {
  const { weights, source } = await fetchModelWeights();
  const session = await createOrtClass1StarSession();

  if (session) {
    return {
      scorer: createOrtClass1StarScorer(session, weights),
      backend: 'onnx-wasm',
    };
  }

  return {
    scorer: createTsResidualScorer(weights),
    backend: source === 'json' ? 'ts-json' : 'ts-zero',
  };
}

/** Singleton loader — one model fetch per app session. */
export function preloadClass1StarScorer(): Promise<Class1StarScorerLoadResult> {
  if (!cachedLoad) {
    cachedLoad = loadClass1StarScorer();
  }
  return cachedLoad;
}

export type { AppClass1StarModelWeights, Class1StarResidualScorer };
