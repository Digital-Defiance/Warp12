import { describe, expect, it } from 'vitest';

import {
  createZeroOmegaModelWeights,
  type OmegaModelWeights,
} from 'warp12-engine';

import {
  buildAiRosterFromConfigs,
  createSeededRng,
  rosterNeedsOmegaNet,
} from './create-local-game.js';
import type { AiCaptainConfig } from './local-game-config.js';

const zeroOmega = createZeroOmegaModelWeights();

describe('buildAiRosterFromConfigs', () => {
  it('detects Class II seats as needing Omega weights', () => {
    expect(
      rosterNeedsOmegaNet([
        { id: 'ai:riker', displayName: 'Riker', skill: 'commander' },
      ])
    ).toBe(true);
    expect(
      rosterNeedsOmegaNet([
        { id: 'ai:riker', displayName: 'Riker', skill: 'lieutenant' },
      ])
    ).toBe(false);
  });

  it('creates Omega players for Class II (commander) seats', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:riker',
        displayName: 'Riker',
        skill: 'commander',
      },
    ];
    const roster = buildAiRosterFromConfigs(
      captains,
      'points',
      42,
      2,
      zeroOmega
    );

    const player = roster.get('ai:riker');
    expect(player).toBeDefined();
    expect(typeof player?.decideGameActionAsync).toBe('function');
  });

  it('throws without weights when Class II officers are aboard', () => {
    expect(() =>
      buildAiRosterFromConfigs(
        [
          {
            id: 'ai:riker',
            displayName: 'Riker',
            skill: 'commander',
          },
        ],
        'points',
        42,
        2
      )
    ).toThrow(/Class II \(Ω\) officers require loaded model weights/);
  });

  it('creates heuristic players for Class III / IV', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:riker',
        displayName: 'Riker',
        skill: 'lieutenant',
      },
    ];
    const roster = buildAiRosterFromConfigs(captains, 'points', 42, 2);
    expect(roster.get('ai:riker')).toBeDefined();
  });

  it('uses seeded RNG for reproducible Class II play', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:riker',
        displayName: 'Riker',
        skill: 'commander',
      },
    ];
    const net: OmegaModelWeights = zeroOmega;
    const rosterA = buildAiRosterFromConfigs(captains, 'points', 42, 2, net);
    const rosterB = buildAiRosterFromConfigs(captains, 'points', 42, 2, net);
    const rngA = createSeededRng(42 + 997);
    const rngB = createSeededRng(42 + 997);
    expect(rngA()).toBe(rngB());
    expect(rosterA.get('ai:riker')).toBeDefined();
    expect(rosterB.get('ai:riker')).toBeDefined();
  });
});
