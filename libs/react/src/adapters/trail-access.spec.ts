import { describe, expect, it } from 'vitest';

import type { RoundState } from 'warp12-engine';

import {
  buildTrailSpokeStatuses,
  formatRedAlertStatus,
  formatSectorRedAlertRow,
  isRedAlertFresh,
  openTrailCaptainNames,
} from './trail-access';
import { NEUTRAL_ZONE_SLOT } from './game-to-trains';

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

    expect(statuses.find((spoke) => spoke.slot === NEUTRAL_ZONE_SLOT)).toMatchObject({
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

  it('shows caution when a double is first charted', () => {
    expect(formatSectorRedAlertRow(roundBase, names)).toEqual({
      label: 'Caution',
      summary: 'A double has been played — 6:6',
      tone: 'caution',
    });
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
        },
      },
    };

    expect(isRedAlertFresh(passed)).toBe(false);
    expect(formatSectorRedAlertRow(passed, names)).toEqual({
      label: 'Red alert',
      summary: 'Alpha · 6:6 · Beta must cover',
      tone: 'alert',
    });
  });

  it('shows red alert after a free pass even though no beacon was deployed', () => {
    // Pass Red Alert without draw/beacon (mayhem) leaves no Distress Beacon,
    // so the beacon heuristic alone would still read "Caution". The explicit
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
