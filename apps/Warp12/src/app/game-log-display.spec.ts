import { describe, expect, it } from 'vitest';

import {
  buildCaptainNameColors,
  splitBodyByNames,
  splitGameLogLine,
} from './game-log-display.js';

describe('splitGameLogLine', () => {
  it('splits timestamp and body', () => {
    expect(
      splitGameLogLine('05:12 - Picard played 9-12 on their own Trail')
    ).toEqual({
      timestamp: '05:12',
      body: 'Picard played 9-12 on their own Trail',
    });
  });
});

describe('splitBodyByNames', () => {
  const names = buildCaptainNameColors(
    { a: 'Picard', b: 'Riker' },
    ['a', 'b']
  );

  it('colorizes captain display names in the body', () => {
    expect(
      splitBodyByNames(
        'Picard played 9-12 on Captain Riker\'s Trail',
        names
      )
    ).toEqual([
      { text: 'Picard', color: names[0]!.color },
      { text: ' played 9-12 on Captain ' },
      { text: 'Riker', color: names[1]!.color },
      { text: '\'s Trail' },
    ]);
  });
});
