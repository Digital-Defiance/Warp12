import { describe, expect, it } from 'vitest';

import { buildAiRosterFromConfigs } from './create-local-game.js';
import {
  resolveClass1StarPlayLookahead,
} from 'warp12-engine';
import type { AiCaptainConfig } from './local-game-config.js';

describe('buildAiRosterFromConfigs', () => {
  it('creates Class I* search players when class1Star is set', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:riker',
        displayName: 'Riker',
        skill: 'commander',
        class1Star: true,
      },
    ];
    const roster = buildAiRosterFromConfigs(captains, 'points', 42, 2);

    const player = roster.get('ai:riker');
    expect(player).toBeDefined();
    expect(typeof player?.decideGameActionAsync).toBe('function');
  });

  it('does not require a neural scorer for Class I* officers', () => {
    expect(() =>
      buildAiRosterFromConfigs(
        [
          {
            id: 'ai:riker',
            displayName: 'Riker',
            skill: 'commander',
            class1Star: true,
          },
        ],
        'points',
        42,
        2
      )
    ).not.toThrow();
  });

  it('routes Class I* to expectimax in 2p points', () => {
    expect(resolveClass1StarPlayLookahead('points', 2).searchEngine).toBe(
      'expectimax'
    );
  });

  it('routes Class I* to ISMCTS in 4p go-out', () => {
    expect(resolveClass1StarPlayLookahead('go-out', 4).searchEngine).toBe(
      'ismcts'
    );
  });
});
