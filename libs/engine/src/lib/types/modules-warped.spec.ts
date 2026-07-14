import { describe, expect, it } from 'vitest';
import {
  hasWarpedModules,
  resolveModules,
  toModuleConfig,
  warpedModuleKeys,
} from './modules.js';

describe('Warped module helpers', () => {
  it('detects Epsilon, Kappa, and Lambda', () => {
    expect(warpedModuleKeys({ drafting: true })).toEqual(['drafting']);
    expect(warpedModuleKeys({ temporalInversion: true })).toEqual([
      'temporalInversion',
    ]);
    expect(warpedModuleKeys({ wormholes: true })).toEqual(['wormholes']);
    expect(hasWarpedModules({ doubleDown: true })).toBe(false);
    expect(hasWarpedModules({ squadrons: true })).toBe(false);
  });

  it('round-trips resolveModules ↔ toModuleConfig for module flags', () => {
    const config = {
      continuum: true,
      salamanderPenalty: true,
      sensorGrid: true,
      sensorGridSize: 7,
      drafting: true,
      draftingPackSize: 12,
      squadrons: true,
      squadronSize: 3,
      squadronNames: ['Alpha', 'Bravo'] as const,
      doubleDown: true,
      temporalInversion: true,
      wormholes: true,
      subspaceFracture: true,
      subspaceFractureScope: 'all-doubles' as const,
    };
    const roundTripped = toModuleConfig(resolveModules(config));
    expect(roundTripped.continuum).toBe(true);
    expect(roundTripped.sensorGridSize).toBe(7);
    expect(roundTripped.drafting).toBe(true);
    expect(roundTripped.draftingPackSize).toBe(12);
    expect(roundTripped.squadrons).toBe(true);
    expect(roundTripped.squadronSize).toBe(3);
    expect(roundTripped.squadronNames).toEqual(['Alpha', 'Bravo']);
    expect(roundTripped.temporalInversion).toBe(true);
    expect(roundTripped.wormholes).toBe(true);
    expect(roundTripped.subspaceFractureScope).toBe('all-doubles');
  });
});
