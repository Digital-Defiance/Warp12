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
        { name: 'Yeager', points: 12 },
        { name: 'Data', points: 8 },
      ])
    ).toEqual(['Yeager: +12 points', 'Data: +8 points']);
  });

  it('includes stats lines in share text', () => {
    const message = formatShareRoundMessage({
      roundNumber: 2,
      headline: 'Armstrong wins the round',
      statsLines: ['Armstrong: +12 points'],
    });
    expect(message).toContain('Armstrong wins the round');
    expect(message).toContain('Armstrong: +12 points');
    expect(message).toContain('https://warp.iwdf.org');
  });

  it('preserves stats in overlay mode messages', () => {
    const message = formatShareRoundMessage({
      roundNumber: 1,
      headline: 'Lovell wins the round',
      statsLines: ['Lovell: +8 points'],
    });
    expect(message).toContain('Lovell: +8 points');
  });

  it('joins headline and stats for share payload', () => {
    const message = formatShareRoundMessage({
      roundNumber: 3,
      headline: 'Sector blocked',
      statsLines: ['Armstrong: +12 points'],
    });
    expect(message.split('\n')).toEqual(
      expect.arrayContaining([
        'Sector blocked',
        'Armstrong: +12 points',
        'https://warp.iwdf.org',
      ])
    );
  });
});
