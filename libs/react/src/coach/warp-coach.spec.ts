import { describe, expect, it } from 'vitest';

import { createDemoGame } from 'warp12-engine';
import { getCoachSuggestion, formatCoachSuggestion } from './warp-coach.js';

describe('getCoachSuggestion', () => {
  it('returns move plus heuristic advice bullets', () => {
    const game = createDemoGame(42);
    const round = game.round;
    expect(round).toBeTruthy();

    const suggestion = getCoachSuggestion(game, round!.activePlayerId);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.reasons.length).toBeGreaterThan(0);
  });
});

describe('formatCoachSuggestion', () => {
  it('labels All Stop for a Neutral Zone win', () => {
    expect(
      formatCoachSuggestion({ kind: 'all-stop' }, { a: 'Alpha' })
    ).toBe('All Stop! · Neutral Zone win');
  });

  it('labels All Stop for All Stop! echo', () => {
    expect(
      formatCoachSuggestion(
        { kind: 'all-stop' },
        { a: 'Alpha' },
        { allStopEcho: true }
      )
    ).toBe('All Stop! · round win pending');
  });

  it('labels Drop to Impulse and catch actions', () => {
    expect(formatCoachSuggestion({ kind: 'drop-to-impulse' }, {})).toBe(
      'Drop to Impulse! · one coordinate left'
    );
    expect(
      formatCoachSuggestion(
        { kind: 'catch-drop-to-impulse', targetPlayerId: 'b' },
        { b: 'Beta' }
      )
    ).toBe('Catch Drop to Impulse · Beta');
  });
});
