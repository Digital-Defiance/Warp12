import {
  createZeroOmegaModelWeights,
  validateOmegaModelWeights,
  type GameObjective,
  type OmegaModelWeights,
} from 'warp12-engine';

import { omegaWeightsUrlForObjective } from './omega-models.js';

const cache = new Map<string, Promise<OmegaModelWeights>>();

function isOmegaModelWeights(value: unknown): value is OmegaModelWeights {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as OmegaModelWeights;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.policyFeatureDim === 'number' &&
    Array.isArray(candidate.policyLayers) &&
    Array.isArray(candidate.valueLayers)
  );
}

async function fetchOmegaModelWeights(
  url: string,
  options?: { allowZeroFallback?: boolean }
): Promise<OmegaModelWeights> {
  const allowZero = options?.allowZeroFallback === true;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (allowZero) return createZeroOmegaModelWeights();
      throw new Error(`Failed to load Omega weights (${response.status}): ${url}`);
    }
    const json: unknown = await response.json();
    if (!isOmegaModelWeights(json)) {
      if (allowZero) return createZeroOmegaModelWeights();
      throw new Error(`Invalid Omega weights payload: ${url}`);
    }
    validateOmegaModelWeights(json);
    return json;
  } catch (error) {
    if (allowZero) return createZeroOmegaModelWeights();
    throw error;
  }
}

/** Load Ω weights for an objective. Throws if missing/invalid (rated Commander must not soft-fail to zeros). */
export async function loadOmegaWeights(
  objective: GameObjective = 'points'
): Promise<OmegaModelWeights> {
  const url = omegaWeightsUrlForObjective(objective);
  return fetchOmegaModelWeights(url);
}

/**
 * Singleton loader keyed by objective — one fetch per objective per session.
 * Soft-fail (zeros) is opt-in for demos; rated play uses the throwing path.
 */
export function preloadOmegaWeights(
  objective: GameObjective = 'points',
  options?: { allowZeroFallback?: boolean }
): Promise<OmegaModelWeights> {
  const url = omegaWeightsUrlForObjective(objective);
  const key = `${url}:${options?.allowZeroFallback === true ? 'soft' : 'hard'}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchOmegaModelWeights(url, options);
    cache.set(key, pending);
  }
  return pending;
}
