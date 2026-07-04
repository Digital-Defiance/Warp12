import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOUSE_RULES,
  resolveHouseRules,
} from './house-rules.js';

describe('resolveHouseRules', () => {
  it('returns standard Mexican Train defaults when config is empty', () => {
    expect(resolveHouseRules()).toEqual(DEFAULT_HOUSE_RULES);
  });

  it('enables each optional rule independently', () => {
    expect(
      resolveHouseRules({ requireOwnTrailFirst: true }).requireOwnTrailFirst
    ).toBe(true);
    expect(
      resolveHouseRules({ neutralZoneAfterAllTrails: true })
        .neutralZoneAfterAllTrails
    ).toBe(true);
    expect(
      resolveHouseRules({ beaconClearsOnAnyPlay: true }).beaconClearsOnAnyPlay
    ).toBe(true);
    expect(
      resolveHouseRules({ roundStarterPlaysTwo: true }).roundStarterPlaysTwo
    ).toBe(true);
    expect(resolveHouseRules({ dropToImpulseCall: true }).dropToImpulseCall).toBe(
      true
    );
    expect(
      resolveHouseRules({ allStopCeremony: false }).allStopCeremony
    ).toBe(false);
    expect(
      resolveHouseRules({ passRedAlertWithoutDraw: true })
        .passRedAlertWithoutDraw
    ).toBe(true);
    expect(
      resolveHouseRules({ manualShieldControl: true }).manualShieldControl
    ).toBe(true);
  });

  it('normalizes Drop to Impulse catch penalty to 1 or 2 only', () => {
    expect(
      resolveHouseRules({ dropToImpulseCatchPenalty: 2 }).dropToImpulseCatchPenalty
    ).toBe(2);
    expect(
      resolveHouseRules({ dropToImpulseCatchPenalty: 1 }).dropToImpulseCatchPenalty
    ).toBe(1);
    expect(
      resolveHouseRules({ dropToImpulseCatchPenalty: 99 as 1 | 2 })
        .dropToImpulseCatchPenalty
    ).toBe(1);
  });

  it('defaults double-blank scoring to the tournament-standard 50', () => {
    expect(resolveHouseRules().doubleZeroScore).toBe(50);
  });

  it('normalizes double-blank score to 0, 25, or 50 only', () => {
    expect(resolveHouseRules({ doubleZeroScore: 0 }).doubleZeroScore).toBe(0);
    expect(resolveHouseRules({ doubleZeroScore: 25 }).doubleZeroScore).toBe(25);
    expect(resolveHouseRules({ doubleZeroScore: 50 }).doubleZeroScore).toBe(50);
    expect(
      resolveHouseRules({ doubleZeroScore: 99 as 0 | 25 | 50 }).doubleZeroScore
    ).toBe(50);
  });
});
