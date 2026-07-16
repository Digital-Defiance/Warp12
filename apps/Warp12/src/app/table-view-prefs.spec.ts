import { describe, expect, it, beforeEach } from 'vitest';

import '../test/setup.js';
import {
  DEFAULT_TABLE_OPTIONS,
  readTableOptions,
  writeTableOptions,
} from './table-view-prefs.js';

describe('table-view-prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(readTableOptions()).toEqual(DEFAULT_TABLE_OPTIONS);
  });

  it('persists updated options', () => {
    writeTableOptions({
      layoutStyle: 'linear',
      teachingMode: true,
      captainTailsHud: true,
      captainTailsDisplay: 'domino',
      captainTailsCoordinate: 'tail',
      pipPreset: 'futuristic',
      bridgeSoundsEnabled: false,
    });

    expect(readTableOptions()).toMatchObject({
      layoutStyle: 'linear',
      teachingMode: true,
      captainTailsHud: true,
      captainTailsDisplay: 'domino',
      captainTailsCoordinate: 'tail',
      pipPreset: 'futuristic',
      tileBg: 'dark',
      bridgeSoundsEnabled: false,
    });
  });

  it('defaults and sanitizes the captain tails coordinate readout', () => {
    expect(readTableOptions().captainTailsCoordinate).toBe('full');

    localStorage.setItem(
      'warp12-table-options',
      JSON.stringify({ captainTailsCoordinate: 'sideways' })
    );
    expect(readTableOptions().captainTailsCoordinate).toBe('full');

    writeTableOptions({ captainTailsCoordinate: 'off' });
    expect(readTableOptions().captainTailsCoordinate).toBe('off');
  });

  it('defaults the trail-length badge on and persists toggling it off', () => {
    expect(readTableOptions().captainTailsTrailLength).toBe(true);

    localStorage.setItem(
      'warp12-table-options',
      JSON.stringify({ captainTailsTrailLength: 'nope' })
    );
    expect(readTableOptions().captainTailsTrailLength).toBe(true);

    writeTableOptions({ captainTailsTrailLength: false });
    expect(readTableOptions().captainTailsTrailLength).toBe(false);
  });

  it('defaults Sector Status on and persists toggling it off', () => {
    expect(readTableOptions().sectorStatusHud).toBe(true);

    writeTableOptions({ sectorStatusHud: false });
    expect(readTableOptions().sectorStatusHud).toBe(false);
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(
      'warp12-table-options',
      JSON.stringify({
        layoutStyle: 'diagonal',
        pipPreset: 'invalid',
        holographicTiles: 'yes',
      })
    );

    expect(readTableOptions()).toEqual(DEFAULT_TABLE_OPTIONS);
  });

  it('migrates legacy captain tails keys', () => {
    localStorage.setItem('warp12-captain-tails-hud', 'true');
    localStorage.setItem('warp12-captain-tails-display', 'domino');

    expect(readTableOptions()).toMatchObject({
      captainTailsHud: true,
      captainTailsDisplay: 'domino',
    });
  });
});
