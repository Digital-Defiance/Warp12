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
  it('detects Commander seats as needing Omega weights', () => {
    expect(
      rosterNeedsOmegaNet([
        { id: 'ai:lovell', displayName: 'Lovell', skill: 'commander' },
      ])
    ).toBe(true);
    expect(
      rosterNeedsOmegaNet([
        { id: 'ai:lovell', displayName: 'Lovell', skill: 'lieutenant' },
      ])
    ).toBe(false);
  });

  it('creates Omega players for Commander (commander) seats', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
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

    const player = roster.get('ai:lovell');
    expect(player).toBeDefined();
    expect(typeof player?.decideGameActionAsync).toBe('function');
  });

  it('creates heuristic Commander players on exhibition sets without Ω weights', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        skill: 'commander',
      },
    ];
    const roster = buildAiRosterFromConfigs(
      captains,
      'points',
      42,
      2,
      undefined,
      18
    );
    expect(roster.get('ai:lovell')).toBeDefined();
    expect(typeof roster.get('ai:lovell')?.decideGameActionAsync).toBe(
      'function'
    );
  });

  it('throws without weights when Commander officers are aboard', () => {
    expect(() =>
      buildAiRosterFromConfigs(
        [
          {
            id: 'ai:lovell',
            displayName: 'Lovell',
            skill: 'commander',
          },
        ],
        'points',
        42,
        2
      )
    ).toThrow(/Commander \(Ω\) officers require loaded model weights/);
  });

  it('creates heuristic players for Lieutenant / IV', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        skill: 'lieutenant',
      },
    ];
    const roster = buildAiRosterFromConfigs(captains, 'points', 42, 2);
    expect(roster.get('ai:lovell')).toBeDefined();
  });

  it('uses seeded RNG for reproducible Commander play', () => {
    const captains: AiCaptainConfig[] = [
      {
        id: 'ai:lovell',
        displayName: 'Lovell',
        skill: 'commander',
      },
    ];
    const net: OmegaModelWeights = zeroOmega;
    const rosterA = buildAiRosterFromConfigs(captains, 'points', 42, 2, net);
    const rosterB = buildAiRosterFromConfigs(captains, 'points', 42, 2, net);
    const rngA = createSeededRng(42 + 997);
    const rngB = createSeededRng(42 + 997);
    expect(rngA()).toBe(rngB());
    expect(rosterA.get('ai:lovell')).toBeDefined();
    expect(rosterB.get('ai:lovell')).toBeDefined();
  });
});
