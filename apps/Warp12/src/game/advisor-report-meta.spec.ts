import { describe, expect, it } from 'vitest';

import { tableOpponentLabelForAdvisor } from './advisor-report-meta.js';
import type { LocalGameConfig } from './local-game-config.js';
import { defaultLocalGameConfig } from './local-game-config.js';

describe('tableOpponentLabelForAdvisor', () => {
  const base = defaultLocalGameConfig('Armstrong', 3);

  it('labels Class II when the top seat is commander', () => {
    expect(tableOpponentLabelForAdvisor(base)).toMatch(/Class II|Cls II/);
  });

  it('labels Class III for lieutenant-only fleets', () => {
    const config: LocalGameConfig = {
      ...base,
      aiCaptains: base.aiCaptains.map((ai) => ({
        ...ai,
        skill: 'lieutenant' as const,
      })),
    };
    expect(tableOpponentLabelForAdvisor(config)).toMatch(/Class III|Cls III/);
  });
});
