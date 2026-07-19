import { describe, expect, it } from 'vitest';

import {
  createZeroOmegaModelWeights,
  type OmegaModelWeights,
} from 'warp12-engine';

import {
  buildAiRosterFromConfigs,
  createLocalGame,
  createSeededRng,
  redealLocalRoundWithSeed,
  rosterNeedsOmegaNet,
} from './create-local-game.js';
import {
  defaultLocalGameConfig,
  type AiCaptainConfig,
} from './local-game-config.js';

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

describe('redealLocalRoundWithSeed', () => {
  it('redeals the current round while preserving scores and round number', () => {
    const config = defaultLocalGameConfig('You', 2);
    const game = createLocalGame(config, 100);
    const withScores = {
      ...game,
      captains: game.captains.map((c, i) =>
        i === 0 ? { ...c, pointsScore: 17 } : c
      ),
      completedRounds: 2,
    };

    const next = redealLocalRoundWithSeed(withScores, 999);

    expect(next.round!.roundNumber).toBe(1);
    expect(next.completedRounds).toBe(2);
    expect(next.captains[0]!.pointsScore).toBe(17);
    expect(next.round!.hands['you']).not.toEqual(withScores.round!.hands['you']);
  });

  it('is deterministic for the same seed', () => {
    const config = defaultLocalGameConfig('You', 2);
    const game = createLocalGame(config, 40);
    const a = redealLocalRoundWithSeed(game, 77);
    const b = redealLocalRoundWithSeed(game, 77);
    expect(a.round!.hands['you']).toEqual(b.round!.hands['you']);
  });
});

describe('createLocalGame go-out campaign + starter', () => {
  it('honors matchStarterIndex for an AI seat', () => {
    const config = {
      ...defaultLocalGameConfig('You', 3),
      objective: 'go-out' as const,
      goOutStructure: 'first-to' as const,
      goOutWinsToWin: 2,
      goOutOvertime: 'force' as const,
      matchStarterIndex: 1,
    };
    const game = createLocalGame(config, 55);
    expect(game.objective).toBe('go-out');
    expect(game.goOutStructure).toBe('first-to');
    expect(game.goOutWinsToWin).toBe(2);
    expect(game.matchStarterIndex).toBe(1);
    expect(game.round?.activePlayerId).toBe(game.captains[1]!.id);
    expect(game.round?.table.spacedock.placedBy).toBe(game.captains[1]!.id);
    expect(game.captains.every((c) => (c.goOutWins ?? 0) === 0)).toBe(true);
  });

  it('starts a fixed-rounds go-out campaign with Spacedock maxPip', () => {
    const config = {
      ...defaultLocalGameConfig('You', 2),
      objective: 'go-out' as const,
      goOutStructure: 'fixed-rounds' as const,
      goOutOvertime: 'offer' as const,
      campaignRounds: 3,
      matchStarterIndex: 0,
    };
    const game = createLocalGame(config, 7);
    expect(game.goOutStructure).toBe('fixed-rounds');
    expect(game.goOutOvertime).toBe('offer');
    expect(game.campaignRounds).toBe(3);
    expect(game.round?.spacedockValue).toBe(12);
    expect(game.phase).toBe('active');
  });
});
