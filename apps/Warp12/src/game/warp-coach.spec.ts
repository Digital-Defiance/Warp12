import { describe, expect, it } from 'vitest';

import { createDemoGame } from './create-demo-game.js';
import { getCoachSuggestion } from './warp-coach.js';

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
