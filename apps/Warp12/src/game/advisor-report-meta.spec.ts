import { describe, expect, it } from 'vitest';

import { CLASS1_STAR_DISPLAY_NAME } from 'warp12-engine';

import { tableOpponentLabelForAdvisor } from './advisor-report-meta.js';
import type { LocalGameConfig } from './local-game-config.js';

describe('tableOpponentLabelForAdvisor', () => {
  const base: LocalGameConfig = {
    humanId: 'you',
    humanName: 'Picard',
    playerCount: 4,
    objective: 'points',
    campaignRounds: 3,
    modules: {},
    aiCaptains: [
      { id: 'a', displayName: 'Riker', skill: 'commander', class1Star: true },
      { id: 'b', displayName: 'Troi', skill: 'commander', class1Star: true },
    ],
  };

  it('labels an all Class I* roster', () => {
    expect(tableOpponentLabelForAdvisor(base)).toContain(CLASS1_STAR_DISPLAY_NAME);
  });

  it('labels mixed rosters', () => {
    expect(
      tableOpponentLabelForAdvisor({
        ...base,
        aiCaptains: [
          { id: 'a', displayName: 'Riker', skill: 'commander', class1Star: true },
          { id: 'b', displayName: 'Troi', skill: 'commander' },
        ],
      })
    ).toContain('mixed');
  });
});
