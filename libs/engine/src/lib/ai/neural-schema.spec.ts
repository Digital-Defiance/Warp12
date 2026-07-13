import { describe, expect, it } from 'vitest';

import {
  CLASS1_STAR_FEATURE_DIM,
  CLASS1_STAR_TILE_COUNT,
} from './class1-star-constants.js';
import { OMEGA_STATE_FEATURE_DIM } from './omega-constants.js';
import {
  neuralFeatureSchema,
  neuralWeightsAvailable,
  SHIPPED_NEURAL_FACTORS,
} from './neural-schema.js';

describe('neuralFeatureSchema', () => {
  it('matches shipped Warp 12 Class I* / Ω dims exactly', () => {
    const schema = neuralFeatureSchema(12);
    expect(schema.tileCount).toBe(CLASS1_STAR_TILE_COUNT);
    expect(schema.featureDim).toBe(CLASS1_STAR_FEATURE_DIM);
    expect(schema.stateFeatureDim).toBe(OMEGA_STATE_FEATURE_DIM);
    expect(schema.playerCountDivisor).toBe(8);
    expect(schema.handSizeDivisor).toBe(13);
    expect(schema.spacedockDivisor).toBe(12);
  });

  it('scales tile masks for exhibition factors', () => {
    expect(neuralFeatureSchema(9).tileCount).toBe(55);
    expect(neuralFeatureSchema(15).tileCount).toBe(136);
    expect(neuralFeatureSchema(18).tileCount).toBe(190);
    expect(neuralFeatureSchema(9).featureDim).toBeLessThan(
      CLASS1_STAR_FEATURE_DIM
    );
    expect(neuralFeatureSchema(18).featureDim).toBeGreaterThan(
      CLASS1_STAR_FEATURE_DIM
    );
  });

  it('uses set fleet / hand caps for non-12 context divisors', () => {
    const w9 = neuralFeatureSchema(9);
    expect(w9.playerCountDivisor).toBe(4);
    expect(w9.spacedockDivisor).toBe(9);
    expect(w9.handSizeDivisor).toBe(12);

    const w18 = neuralFeatureSchema(18);
    expect(w18.playerCountDivisor).toBe(18);
    expect(w18.spacedockDivisor).toBe(18);
  });
});

describe('neuralWeightsAvailable', () => {
  it('is independent of TEI — only lists shipped weight factors', () => {
    expect(SHIPPED_NEURAL_FACTORS).toEqual([12]);
    expect(neuralWeightsAvailable(12)).toBe(true);
    expect(neuralWeightsAvailable(9)).toBe(false);
    expect(neuralWeightsAvailable(15)).toBe(false);
    expect(neuralWeightsAvailable(18)).toBe(false);
  });
});
