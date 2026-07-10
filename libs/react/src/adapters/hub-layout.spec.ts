import { describe, expect, it } from 'vitest';

import {
  hubSlotsForCaptainCount,
  hubTableGeometry,
  neutralZoneSlot,
  spokeBadgeRingDistance,
} from './hub-layout.js';

describe('hub layout', () => {
  it('keeps an 8-spoke floor for small fleets', () => {
    expect(hubSlotsForCaptainCount(4)).toBe(8);
    expect(neutralZoneSlot(8)).toBe(7);
  });

  it('adds a dedicated Neutral Zone arm past 7 captains', () => {
    expect(hubSlotsForCaptainCount(8)).toBe(9);
    expect(hubSlotsForCaptainCount(12)).toBe(13);
    expect(hubSlotsForCaptainCount(18)).toBe(19);
    expect(neutralZoneSlot(13)).toBe(12);
  });

  it('grows the table as spoke count rises', () => {
    const small = hubTableGeometry(4);
    const large = hubTableGeometry(18);
    expect(large.hubSlots).toBeGreaterThan(small.hubSlots);
    expect(large.tableWidth).toBeGreaterThan(small.tableWidth);
    expect(large.startDistance).toBeGreaterThan(small.startDistance);
  });

  it('keeps small-fleet badges near the spacedock', () => {
    const geo = hubTableGeometry(4);
    expect(
      spokeBadgeRingDistance(geo.hubSlots, geo.hubRadius, geo.startDistance)
    ).toBe(geo.hubRadius + 12);
  });

  it('pushes large-fleet badges into the train gap', () => {
    const geo = hubTableGeometry(18);
    const badge = spokeBadgeRingDistance(
      geo.hubSlots,
      geo.hubRadius,
      geo.startDistance
    );
    expect(badge).toBeGreaterThan(geo.hubRadius + 40);
    expect(badge).toBeLessThan(geo.startDistance - 40);
  });
});
