import { describe, expect, it } from 'vitest';

import { getSpoolOptions } from '../engine/legal-moves.js';
import { makeGame, makeRound, T } from '../engine/test-helpers.js';
import { createInitialTable } from '../table/table-state.js';
import { resolveModules } from '../types/modules.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { DEFAULT_WARP_HEURISTICS, WARP_HEURISTIC_IDS } from './heuristics.js';
import { observe } from './observation.js';
import { getWarpSkillProfile } from './skill.js';
import { estimateSpoolValue } from './spool-strategy.js';
import { buildWarpContext } from './context.js';

describe('module-aware AI teaching', () => {
  it('offers spool candidates when Module Delta is on', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      // Points mode skips spool when hand ≤ 2 (abort risk outweighs draw).
      hands: {
        a: [T(5, 4), T(3, 2), T(1, 0), T(7, 6)],
        b: [T(6, 6)],
      },
      unchartedSectors: [T(12, 11), T(11, 10), T(10, 9), T(9, 8), T(8, 7)],
      table,
    });
    const state = makeGame(round, {
      modules: resolveModules({ warpDriveSpool: true }),
      objective: 'points',
    });
    const obs = observe(state, 'a')!;
    const candidates = warpCandidateGenerator(obs, { captains: state.captains });
    expect(candidates.some((c) => c.kind === 'spool')).toBe(true);
    expect(getSpoolOptions(state, round, 'a').length).toBeGreaterThan(0);
  });

  it('penalizes spool more when Fracture raises abort risk', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      hands: { a: [T(5, 4), T(3, 2), T(1, 0), T(7, 6)], b: [T(3, 2)] },
      unchartedSectors: [
        T(6, 6),
        T(7, 7),
        T(8, 8),
        T(5, 3),
        T(4, 2),
        T(3, 1),
        T(2, 0),
        T(9, 1),
      ],
      table,
    });
    const base = makeGame(round, {
      modules: resolveModules({ warpDriveSpool: true }),
      objective: 'points',
    });
    const withFracture = makeGame(round, {
      modules: resolveModules({
        warpDriveSpool: true,
        subspaceFracture: true,
        subspaceFractureScope: 'all-doubles',
      }),
      objective: 'points',
    });
    const baseObs = observe(base, 'a')!;
    const fracObs = observe(withFracture, 'a')!;
    expect(estimateSpoolValue(fracObs, 'a')).toBeLessThan(
      estimateSpoolValue(baseObs, 'a')
    );
  });

  it('scores Salamander Surge when opponents have small hands', () => {
    const surge = DEFAULT_WARP_HEURISTICS.find(
      (h) => h.id === WARP_HEURISTIC_IDS.salamanderSurge
    )!;
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      hands: {
        a: [T(12, 12), T(5, 4)],
        b: [T(1, 0)],
      },
      table,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ salamanderPenalty: true }),
      maxPip: 12,
    });
    const obs = observe(state, 'a')!;
    const ctx = buildWarpContext(obs, () => 0.5);
    const score = surge.score(
      {
        kind: 'chart',
        move: {
          coordinate: T(12, 12),
          route: { kind: 'warp-trail', playerId: 'a' },
        },
      },
      ctx
    );
    expect(score).toBeGreaterThan(20);
  });

  it('scores Trail Momentum near length 5 on own trail', () => {
    const momentum = DEFAULT_WARP_HEURISTICS.find(
      (h) => h.id === WARP_HEURISTIC_IDS.trailMomentum
    )!;
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const tiles = [
      { coordinate: T(12, 11), index: 0, openValue: 11 },
      { coordinate: T(11, 10), index: 1, openValue: 10 },
      { coordinate: T(10, 9), index: 2, openValue: 9 },
      { coordinate: T(9, 8), index: 3, openValue: 8 },
    ];
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      hands: { a: [T(8, 7)], b: [T(3, 2)] },
      table: {
        ...table,
        warpTrails: {
          ...table.warpTrails,
          a: { ...table.warpTrails.a, tiles },
        },
      },
    });
    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ longestTrail: true }),
      trailMomentumClaimedBy: null,
    });
    const obs = observe(state, 'a')!;
    expect(obs.trailMomentumClaimedBy).toBeNull();
    const ctx = buildWarpContext(obs, () => 0.5);
    const score = momentum.score(
      {
        kind: 'chart',
        move: {
          coordinate: T(8, 7),
          route: { kind: 'warp-trail', playerId: 'a' },
        },
      },
      ctx
    );
    expect(score).toBe(40);
  });

  it('AI can decide a spool action under Delta', () => {
    const table = createInitialTable(['a', 'b'], 12, 'a');
    const round = makeRound(['a', 'b'], {
      activePlayerId: 'a',
      hands: {
        a: [T(0, 0)], // awkward tile — spool often preferred with large uncharted
        b: [T(6, 5)],
      },
      unchartedSectors: Array.from({ length: 40 }, (_, i) => {
        const low = i % 12;
        const high = Math.min(12, low + 1);
        return T(low, high);
      }),
      table,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      modules: resolveModules({ warpDriveSpool: true, longestTrail: true }),
    });
    const ai = createWarpAiPlayer({
      skill: getWarpSkillProfile(
        'commander',
        'go-out',
        2,
        undefined,
        resolveModules({ warpDriveSpool: true, longestTrail: true })
      ),
      objective: 'go-out',
      rng: () => 0.01,
    });
    const action = ai.decideGameAction(state, 'a');
    expect(action).not.toBeNull();
    // Either chart the 0-0 or spool — both legal; ensure decide does not crash
    // and when spool is chosen it is well-formed.
    if (action?.type === 'SPOOL_WARP_DRIVE') {
      expect(action.route.kind === 'warp-trail' || action.route.kind === 'neutral-zone').toBe(
        true
      );
    }
  });
});
