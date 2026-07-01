import { describe, expect, it } from 'vitest';

import {
  formatShareRoundMessage,
  formatPointsStatLines,
} from './share-round.js';

describe('share-round', () => {
  it('formats points stat lines like the round-end summary', () => {
    expect(formatPointsStatLines([])).toEqual(['No points held this round.']);
    expect(
      formatPointsStatLines([
        { name: 'Worf', points: 12 },
        { name: 'Data', points: 8 },
      ])
    ).toEqual(['Worf: +12 points', 'Data: +8 points']);
  });

  it('includes stats lines in share text', () => {
    const message = formatShareRoundMessage({
      roundNumber: 2,
      headline: 'Picard wins the round',
      statsLines: ['Picard: +12 points'],
    });
    expect(message).toContain('Picard wins the round');
    expect(message).toContain('Picard: +12 points');
    expect(message).toContain('https://warp12.app');
  });

  it('preserves stats in overlay mode messages', () => {
    const message = formatShareRoundMessage({
      roundNumber: 1,
      headline: 'Riker wins the round',
      statsLines: ['Riker: +8 points'],
    });
    expect(message).toContain('Riker: +8 points');
  });

  it('joins headline and stats for share payload', () => {
    const message = formatShareRoundMessage({
      roundNumber: 3,
      headline: 'Sector blocked',
      statsLines: ['Picard: +12 points'],
    });
    expect(message.split('\n')).toEqual(
      expect.arrayContaining([
        'Sector blocked',
        'Picard: +12 points',
        'https://warp12.app',
      ])
    );
  });
});
