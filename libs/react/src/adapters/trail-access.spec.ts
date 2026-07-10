import { describe, expect, it } from 'vitest';

import type { RoundState } from 'warp12-engine';

import {
  buildTrailSpokeStatuses,
  formatRedAlertStatus,
  formatSectorRedAlertRow,
  isRedAlertFresh,
  shouldIlluminateBridgeRedAlert,
  shouldIlluminateBridgeYellowAlert,
  openTrailCaptainNames,
} from './trail-access';
import { neutralZoneSlot } from './game-to-trains';

const names = {
  alpha: 'Alpha',
  beta: 'Beta',
};

function round(partial: Partial<RoundState> & Pick<RoundState, 'turnOrder'>): RoundState {
  return {
    spacedockValue: 6,
    activePlayerId: 'alpha',
    hands: {},
    unchartedSectors: [],
    phase: 'playing',
    ...partial,
    table: {
      warpTrails: {
        alpha: {
          playerId: 'alpha',
          tiles: [],
          distressBeacon: { active: false },
        },
        beta: {
          playerId: 'beta',
          tiles: [],
          distressBeacon: { active: false },
        },
      },
      neutralZone: { tiles: [] },
      subspaceFracture: null,
      redAlert: null,
      ...partial.table,
    },
  } as RoundState;
}

describe('buildTrailSpokeStatuses', () => {
  it('marks neutral zone as open and captains as shields by default', () => {
    const statuses = buildTrailSpokeStatuses(
      round({ turnOrder: ['alpha', 'beta'] }),
      names,
      8
    );

    expect(statuses.find((spoke) => spoke.slot === neutralZoneSlot(8))).toMatchObject({
      state: 'neutral',
      label: 'Neutral',
    });
    expect(statuses.find((spoke) => spoke.captainId === 'alpha')?.state).toBe(
      'shields'
    );
    expect(statuses.find((spoke) => spoke.captainId === 'beta')?.state).toBe(
      'shields'
    );
  });

  it('marks a captain open when their distress beacon is active', () => {
    const statuses = buildTrailSpokeStatuses(
      round({
        turnOrder: ['alpha', 'beta'],
        table: {
          warpTrails: {
            alpha: {
              playerId: 'alpha',
              tiles: [],
              distressBeacon: { active: true },
            },
            beta: {
              playerId: 'beta',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      }),
      names,
      8
    );

    expect(statuses.find((spoke) => spoke.captainId === 'alpha')?.state).toBe(
      'open'
    );
    expect(openTrailCaptainNames(statuses)).toEqual(['Alpha']);
  });

  it('places Neutral Zone on the last arm for 12-captain hubs', () => {
    const turnOrder = Array.from({ length: 12 }, (_, index) => `c${index}`);
    const captainNames = Object.fromEntries(
      turnOrder.map((id) => [id, id.toUpperCase()])
    );
    const statuses = buildTrailSpokeStatuses(
      round({
        turnOrder,
        table: {
          warpTrails: Object.fromEntries(
            turnOrder.map((id) => [
              id,
              {
                playerId: id,
                tiles: [],
                distressBeacon: { active: false },
              },
            ])
          ),
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      }),
      captainNames,
      13
    );

    expect(statuses.find((spoke) => spoke.slot === 12)).toMatchObject({
      state: 'neutral',
      label: 'Neutral',
    });
    expect(statuses.filter((spoke) => spoke.captainId).length).toBe(12);
  });

  it('prefers red alert over open beacon on the same trail', () => {
    const statuses = buildTrailSpokeStatuses(
      round({
        turnOrder: ['alpha', 'beta'],
        table: {
          warpTrails: {
            alpha: {
              playerId: 'alpha',
              tiles: [],
              distressBeacon: { active: true },
            },
            beta: {
              playerId: 'beta',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: {
            active: true,
            trailPlayerId: 'alpha',
            responsiblePlayerId: 'alpha',
            anchor: {
              coordinate: { low: 6, high: 6 },
              index: 0,
              openValue: 6,
            },
          },
        },
      }),
      names,
      8
    );

    expect(statuses.find((spoke) => spoke.captainId === 'alpha')?.state).toBe(
      'red-alert'
    );
    expect(openTrailCaptainNames(statuses)).toEqual([]);
  });
});

describe('formatRedAlertStatus', () => {
  it('names the trail owner and tile when they must cover their own double', () => {
    expect(
      formatRedAlertStatus(
        {
          active: true,
          trailPlayerId: 'alpha',
          responsiblePlayerId: 'alpha',
          anchor: {
            coordinate: { low: 6, high: 6 },
            index: 0,
            openValue: 6,
          },
        },
        names
      )
    ).toBe('Alpha · 6:6');
  });

  it('shows who must cover when the double is on another captain trail', () => {
    expect(
      formatRedAlertStatus(
        {
          active: true,
          trailPlayerId: 'beta',
          responsiblePlayerId: 'alpha',
          anchor: {
            coordinate: { low: 3, high: 3 },
            index: 6,
            openValue: 3,
          },
        },
        names
      )
    ).toBe('Beta · 3:3 · Alpha must cover');
  });
});

describe('formatSectorRedAlertRow', () => {
  const roundBase = {
    spacedockValue: 12,
    turnOrder: ['alpha', 'beta'],
    table: {
      warpTrails: {
        alpha: {
          playerId: 'alpha',
          tiles: [],
          distressBeacon: { active: false },
        },
        beta: {
          playerId: 'beta',
          tiles: [],
          distressBeacon: { active: false },
        },
      },
      neutralZone: { tiles: [] },
      subspaceFracture: null,
      redAlert: {
        active: true,
        trailPlayerId: 'alpha',
        responsiblePlayerId: 'alpha',
        anchor: {
          coordinate: { low: 6, high: 6 },
          index: 0,
          openValue: 6,
        },
      },
    },
  } as RoundState;

  it('shows yellow alert when a double is first charted', () => {
    expect(isRedAlertFresh(roundBase)).toBe(true);
    expect(shouldIlluminateBridgeYellowAlert(roundBase)).toBe(true);
    expect(shouldIlluminateBridgeRedAlert(roundBase)).toBe(false);
    expect(formatSectorRedAlertRow(roundBase, names)).toEqual({
      label: 'Yellow alert',
      summary: 'A double has been played — 6:6',
      tone: 'yellow',
    });
  });

  it('stays yellow alert when unrelated distress beacons are still up', () => {
    const cautionWithBeacons: RoundState = {
      ...roundBase,
      activePlayerId: 'alpha',
      table: {
        ...roundBase.table,
        warpTrails: {
          ...roundBase.table.warpTrails,
          beta: {
            ...roundBase.table.warpTrails.beta,
            distressBeacon: { active: true },
          },
        },
      },
    };

    expect(isRedAlertFresh(cautionWithBeacons)).toBe(true);
    expect(shouldIlluminateBridgeYellowAlert(cautionWithBeacons)).toBe(true);
    expect(shouldIlluminateBridgeRedAlert(cautionWithBeacons)).toBe(false);
    expect(formatSectorRedAlertRow(cautionWithBeacons, names)?.label).toBe(
      'Yellow alert'
    );
  });

  it('shows red alert after someone passes', () => {
    const passed: RoundState = {
      ...roundBase,
      table: {
        ...roundBase.table,
        warpTrails: {
          ...roundBase.table.warpTrails,
          alpha: {
            ...roundBase.table.warpTrails.alpha,
            distressBeacon: { active: true },
          },
        },
        redAlert: {
          ...roundBase.table.redAlert!,
          responsiblePlayerId: 'beta',
          passed: true,
        },
      },
    };

    expect(isRedAlertFresh(passed)).toBe(false);
    expect(shouldIlluminateBridgeYellowAlert(passed)).toBe(false);
    expect(shouldIlluminateBridgeRedAlert(passed)).toBe(true);
    expect(formatSectorRedAlertRow(passed, names)).toEqual({
      label: 'Red alert',
      summary: 'Alpha · 6:6 · Beta must cover',
      tone: 'alert',
    });
  });

  it('shows red alert after a free pass even though no beacon was deployed', () => {
    // Pass Red Alert without draw/beacon (mayhem) leaves no Distress Beacon,
    // so unrelated beacons alone would still read Yellow alert. The explicit
    // `passed` flag keeps the status correct.
    const freePassed: RoundState = {
      ...roundBase,
      table: {
        ...roundBase.table,
        redAlert: {
          ...roundBase.table.redAlert!,
          responsiblePlayerId: 'beta',
          passed: true,
        },
      },
    };

    expect(isRedAlertFresh(freePassed)).toBe(false);
    expect(formatSectorRedAlertRow(freePassed, names)).toEqual({
      label: 'Red alert',
      summary: 'Alpha · 6:6 · Beta must cover',
      tone: 'alert',
    });
  });
});
