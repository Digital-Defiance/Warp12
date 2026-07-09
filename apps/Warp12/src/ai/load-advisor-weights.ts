import {
  createZeroAdvisorModelWeights,
  validateAdvisorModelWeights,
  type AdvisorModelWeights,
} from 'warp12-engine';

const cache = new Map<string, Promise<AdvisorModelWeights | null>>();

function isAdvisorModelWeights(value: unknown): value is AdvisorModelWeights {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as AdvisorModelWeights;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.policyFeatureDim === 'number' &&
    Array.isArray(candidate.policyLayers)
  );
}

async function fetchAdvisorModelWeights(url: string): Promise<AdvisorModelWeights | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const json: unknown = await response.json();
    if (!isAdvisorModelWeights(json)) {
      return null;
    }
    validateAdvisorModelWeights(json);
    return json;
  } catch {
    return null;
  }
}

/** Load phase-B advisor weights when shipped; returns null if missing. */
export async function loadAdvisorWeights(
  url = '/models/advisor-v1.json'
): Promise<AdvisorModelWeights | null> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetchAdvisorModelWeights(url);
    cache.set(url, pending);
  }
  return pending;
}

export function preloadAdvisorWeights(
  url = '/models/advisor-v1.json'
): Promise<AdvisorModelWeights | null> {
  return loadAdvisorWeights(url);
}

export function clearAdvisorWeightsCacheForTests(): void {
  cache.clear();
}

export { createZeroAdvisorModelWeights };
