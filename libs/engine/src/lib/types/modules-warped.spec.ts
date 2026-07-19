import { describe, expect, it } from 'vitest';
import {
  hasWarpedModules,
  isModuleAvailableForObjective,
  MODULE_OBJECTIVE_GATES,
  moduleClearPatchForObjective,
  resolveModules,
  sanitizeModuleConfigForObjective,
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

  it('gates modules via MODULE_OBJECTIVE_GATES (not hard-coded branches)', () => {
    expect(
      MODULE_OBJECTIVE_GATES.some(
        (gate) => gate.key === 'drafting' && gate.objectiveOnly === 'points'
      )
    ).toBe(true);
    expect(isModuleAvailableForObjective('drafting', 'points')).toBe(true);
    expect(isModuleAvailableForObjective('drafting', 'go-out')).toBe(false);
    expect(moduleClearPatchForObjective('go-out')).toMatchObject({
      drafting: false,
    });
    expect(moduleClearPatchForObjective('points')).toEqual({});
  });

  it('strips gated modules under the wrong objective (RULES §VI)', () => {
    expect(
      sanitizeModuleConfigForObjective(
        { drafting: true, continuum: true },
        'go-out'
      )
    ).toEqual({ drafting: false, continuum: true });
    expect(
      resolveModules(
        sanitizeModuleConfigForObjective({ drafting: true }, 'go-out')
      ).drafting.enabled
    ).toBe(false);
    expect(
      sanitizeModuleConfigForObjective({ drafting: true }, 'points').drafting
    ).toBe(true);
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
