import { describe, expect, it } from 'vitest';

import {
  buildCaptainNameColors,
  splitBodyByNames,
  splitGameLogLine,
} from './game-log-display.js';

describe('splitGameLogLine', () => {
  it('splits timestamp and body', () => {
    expect(
      splitGameLogLine('05:12 - Armstrong played 9-12 on their own Trail')
    ).toEqual({
      timestamp: '05:12',
      body: 'Armstrong played 9-12 on their own Trail',
    });
  });
});

describe('splitBodyByNames', () => {
  const names = buildCaptainNameColors(
    { a: 'Armstrong', b: 'Lovell' },
    ['a', 'b']
  );

  it('colorizes captain display names in the body', () => {
    expect(
      splitBodyByNames(
        'Armstrong played 9-12 on Captain Lovell\'s Trail',
        names
      )
    ).toEqual([
      { text: 'Armstrong', color: names[0]!.color },
      { text: ' played 9-12 on Captain ' },
      { text: 'Lovell', color: names[1]!.color },
      { text: '\'s Trail' },
    ]);
  });
});
