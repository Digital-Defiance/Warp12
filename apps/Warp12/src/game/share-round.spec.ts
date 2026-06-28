import { describe, expect, it } from 'vitest';

import {
  buildShareRoundFilename,
  computeLogoOverlayLayout,
  formatPenaltyStatLines,
  formatShareRoundMessage,
  mergeContentBounds,
  statsOverlayLines,
  TABLE_CAPTURE_HEIGHT,
  TABLE_CAPTURE_WIDTH,
} from './share-round.js';

describe('share-round', () => {
  it('builds a stable filename from sector, round, and timestamp', () => {
    expect(
      buildShareRoundFilename(
        { roundNumber: 7, headline: 'Picard wins the round', sectorCode: 'NX01' },
        '2026-06-27T15:04:05.000Z'
      )
    ).toBe('warp12-NX01-round-7-2026-06-27-15-04-05.png');
  });

  it('marks overlay filenames', () => {
    expect(
      buildShareRoundFilename(
        { roundNumber: 1, headline: 'Worf wins the round' },
        '2026-06-27T15:04:05.000Z',
        'overlay'
      )
    ).toBe('warp12-round-1-overlay-2026-06-27-15-04-05.png');
  });

  it('formats penalty stat lines like the round-end summary', () => {
    expect(formatPenaltyStatLines([])).toEqual(['No penalty tiles held.']);
    expect(
      formatPenaltyStatLines([
        { name: 'Worf', points: 12 },
        { name: 'Data', points: 8 },
      ])
    ).toEqual(['Worf: +12 penalty', 'Data: +8 penalty']);
  });

  it('builds overlay stat lines with round context', () => {
    expect(
      statsOverlayLines({
        roundNumber: 3,
        headline: 'Worf wins the round',
        subtitle: 'Round complete.',
        statsLines: ['Picard: +12 penalty'],
      })
    ).toEqual([
      'Round 3',
      'Worf wins the round',
      'Round complete.',
      'Picard: +12 penalty',
    ]);
  });

  it('builds share message text with headline, narrative, and stats', () => {
    expect(
      formatShareRoundMessage({
        roundNumber: 1,
        headline: 'Worf wins the round',
        subtitle: 'Worf charts the final coordinate — round 1 complete.',
        statsLines: ['Picard: +12 penalty'],
      })
    ).toBe(
      [
        'Worf wins the round',
        'Worf charts the final coordinate — round 1 complete.',
        'Picard: +12 penalty',
        'https://warp12.app',
      ].join('\n')
    );
  });

  it('expands capture bounds when dominoes extend past the table edge', () => {
    const bounds = mergeContentBounds(
      TABLE_CAPTURE_WIDTH,
      TABLE_CAPTURE_HEIGHT,
      [
        { left: -40, top: 350, right: 20, bottom: 470 },
        { left: 1180, top: 120, right: 1260, bottom: 240 },
      ]
    );

    expect(bounds.x).toBeLessThan(0);
    expect(bounds.width).toBeGreaterThan(TABLE_CAPTURE_WIDTH);
    expect(bounds.height).toBeGreaterThanOrEqual(TABLE_CAPTURE_HEIGHT);
  });

  it('sizes the logo overlay relative to the board width', () => {
    const layout = computeLogoOverlayLayout(2400);
    expect(layout.padding).toBeGreaterThanOrEqual(16);
    expect(layout.logoWidth).toBeLessThanOrEqual(480);
    expect(layout.logoHeight).toBeGreaterThan(0);
    expect(layout.logoWidth + layout.padding * 2).toBeLessThan(2400);
  });
});
