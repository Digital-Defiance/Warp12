import { describe, expect, it } from 'vitest';

import {
  buildCaptainNameColors,
  splitBodyByNames,
  splitCoordinateTokens,
  splitGameLogLine,
  splitTeiTokens,
} from './game-log-display.js';

describe('splitGameLogLine', () => {
  it('splits timestamp and body', () => {
    expect(
      splitGameLogLine('05:12 - Armstrong charted 9-12 on their own Trail')
    ).toEqual({
      timestamp: '05:12',
      body: 'Armstrong charted 9-12 on their own Trail',
    });
  });

  it('splits a BrightDate decimal duration prefix', () => {
    expect(splitGameLogLine('3.611md - Armstrong charted 9-12')).toEqual({
      timestamp: '3.611md',
      body: 'Armstrong charted 9-12',
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
        'Armstrong charted 9-12 on Captain Lovell\'s Trail',
        names
      )
    ).toEqual([
      { text: 'Armstrong', color: names[0]!.color },
      { text: ' charted 9-12 on Captain ' },
      { text: 'Lovell', color: names[1]!.color },
      { text: '\'s Trail' },
    ]);
  });

  it('parses TEI cells inside ratings bodies', () => {
    expect(
      splitBodyByNames('Ratings · Armstrong I15 · Lovell ref C27', names)
    ).toEqual([
      { text: 'Ratings · ' },
      { text: 'Armstrong', color: names[0]!.color },
      { text: ' ' },
      { text: 'I15', tei: { grade: 'I', score: '15', reference: false } },
      { text: ' · ' },
      { text: 'Lovell', color: names[1]!.color },
      { text: ' ' },
      { text: 'ref C27', tei: { grade: 'C', score: '27', reference: true } },
    ]);
  });

  it('parses pip-colored coordinates beside captain names', () => {
    expect(
      splitBodyByNames(
        'Armstrong charted a 12:7 on Captain Lovell\'s Trail',
        names
      )
    ).toEqual([
      { text: 'Armstrong', color: names[0]!.color },
      { text: ' charted a ' },
      {
        text: '12:7',
        coordinate: {
          left: 12,
          right: 7,
          separator: ':',
          doubleLabel: false,
        },
      },
      { text: ' on Captain ' },
      { text: 'Lovell', color: names[1]!.color },
      { text: '\'s Trail' },
    ]);
  });
});

describe('splitTeiTokens', () => {
  it('marks reference anchors with ref prefix', () => {
    expect(splitTeiTokens('Chen ref I40 · Commander')).toEqual([
      { text: 'Chen ' },
      { text: 'ref I40', tei: { grade: 'I', score: '40', reference: true } },
      { text: ' · Commander' },
    ]);
  });
});

describe('splitCoordinateTokens', () => {
  it('parses colon coordinates', () => {
    expect(splitCoordinateTokens('charted a 5:12 on their own Trail')).toEqual([
      { text: 'charted a ' },
      {
        text: '5:12',
        coordinate: {
          left: 5,
          right: 12,
          separator: ':',
          doubleLabel: false,
        },
      },
      { text: ' on their own Trail' },
    ]);
  });

  it('parses Double N-N coordinates', () => {
    expect(
      splitCoordinateTokens('charted a Double 0-0 on the Neutral Zone')
    ).toEqual([
      { text: 'charted a ' },
      {
        text: 'Double 0-0',
        coordinate: {
          left: 0,
          right: 0,
          separator: '-',
          doubleLabel: true,
        },
      },
      { text: ' on the Neutral Zone' },
    ]);
  });

  it('ignores bare hyphen pairs without Double', () => {
    expect(splitCoordinateTokens('charted 9-12')).toEqual([
      { text: 'charted 9-12' },
    ]);
  });
});
