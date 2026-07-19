import { describe, expect, it } from 'vitest';

import {
  checkRoundInvariants,
  collectAllRoundCoordinates,
  enumerateLegalActions,
  runRandomGame,
  type InvariantViolation,
  type RandomGameOptions,
} from './random-play-harness.js';
import { coordinateKey, normalizeCoordinate } from '../types/coordinate.js';
import { generateCoordinateSet } from '../domino/coordinates.js';
import { resolveHouseRules } from '../types/house-rules.js';
import { makeRound } from './test-helpers.js';

const EXPECTED_KEYS = new Set(generateCoordinateSet(12).map(coordinateKey));

function summarize(violations: InvariantViolation[]): string {
  return violations
    .slice(0, 8)
    .map((v) => `${v.kind}: ${v.detail}`)
    .join('\n');
}

/**
 * Each preset stresses a different slice of the rules engine. Every one runs
 * through the same conservation/structure invariants on every single action.
 */
const PRESETS: ReadonlyArray<{
  name: string;
  options: Omit<RandomGameOptions, 'seed'>;
}> = [
  {
    name: 'points · 2 captains · no modules',
    options: { captainCount: 2, objective: 'points' },
  },
  {
    name: 'points · 4 captains · Official Warp 12 modules',
    options: {
      captainCount: 4,
      objective: 'points',
      modules: {
        continuum: true,
        salamanderPenalty: true,
        subspaceFracture: false,
      },
      houseRules: { dropToImpulseCall: true, allStopCeremony: true },
    },
  },
  {
    name: 'go-out · 3 captains · Q-Continuum',
    options: {
      captainCount: 3,
      objective: 'go-out',
      modules: { continuum: true, salamanderPenalty: true },
    },
  },
  {
    name: 'go-out · 3 captains · forked modules (Theta/Eta/Kappa/Delta/Beta)',
    options: {
      captainCount: 3,
      objective: 'go-out',
      modules: {
        continuum: true,
        salamanderPenalty: true,
        warpDriveSpool: true,
        longestTrail: true,
        temporalDebt: true,
        temporalInversion: true,
      },
    },
  },
  {
    name: 'points · 5 captains · Subspace Fracture (own trail)',
    options: {
      captainCount: 5,
      objective: 'points',
      modules: {
        subspaceFracture: true,
        subspaceFractureScope: 'own-trail',
      },
    },
  },
  {
    name: 'points · 6 captains · Fracture all doubles',
    options: {
      captainCount: 6,
      objective: 'points',
      modules: { subspaceFracture: true, subspaceFractureScope: 'all-doubles' },
    },
  },
  {
    name: 'go-out · 7 captains · Deluxe house rules',
    options: {
      captainCount: 7,
      objective: 'go-out',
      houseRules: {
        requireOwnTrailFirst: true,
        neutralZoneAfterAllTrails: true,
        beaconClearsOnAnyPlay: true,
        roundStarterPlaysTwo: true,
      },
    },
  },
  {
    name: 'points · 8 captains · manual shields + everything',
    options: {
      captainCount: 8,
      objective: 'points',
      modules: {
        continuum: true,
        salamanderPenalty: true,
        subspaceFracture: true,
        subspaceFractureScope: 'all-captains',
      },
      houseRules: {
        manualShieldControl: true,
        dropToImpulseCall: true,
        passRedAlertWithoutDraw: true,
        allStopCeremony: true,
      },
    },
  },
  {
    name: 'points · 4 captains · Module Zeta squadrons (2×2)',
    options: {
      captainCount: 4,
      objective: 'points',
      modules: { squadrons: true, squadronSize: 2 },
    },
  },
  {
    name: 'go-out · 6 captains · Module Zeta squadrons (2×3)',
    options: {
      captainCount: 6,
      objective: 'go-out',
      modules: { squadrons: true, squadronSize: 3 },
    },
  },
  {
    name: 'points · 6 captains · Zeta squadrons + Official Warp modules',
    options: {
      captainCount: 6,
      objective: 'points',
      modules: {
        squadrons: true,
        squadronSize: 2,
        continuum: true,
        salamanderPenalty: true,
      },
      houseRules: { dropToImpulseCall: true, allStopCeremony: true },
    },
  },
];

describe('engine fuzz — tile conservation & structural invariants', () => {
  // Keep the seed count high enough to exercise thousands of actions per
  // preset while staying well within a unit-test time budget.
  const GAMES_PER_PRESET = 40;

  for (const preset of PRESETS) {
    it(
      `holds all invariants over random games: ${preset.name}`,
      () => {
        let totalSteps = 0;
        let anyCompleted = false;

      for (let i = 0; i < GAMES_PER_PRESET; i++) {
        const result = runRandomGame({ ...preset.options, seed: 1000 + i * 31 });
        totalSteps += result.steps;
        anyCompleted ||= result.completed;

        if (result.violations.length > 0) {
          throw new Error(
            `Invariant violated in "${preset.name}" seed ${1000 + i * 31} ` +
              `after ${result.steps} steps:\n${summarize(result.violations)}`
          );
        }
        expect(result.deadlock).toBe(false);
      }

      // Sanity: the harness actually drove real games (not a no-op).
      expect(totalSteps).toBeGreaterThan(GAMES_PER_PRESET * 20);
      expect(anyCompleted).toBe(true);
      },
      30000 // 30 second timeout
    );
  }
});

describe('engine fuzz — games terminate', () => {
  it('every preset completes at least one full game inside the step cap', () => {
    for (const preset of PRESETS) {
      const completedSeeds: number[] = [];
      for (let i = 0; i < 20; i++) {
        const seed = 55 + i * 101;
        const result = runRandomGame({
          ...preset.options,
          seed,
          maxSteps: 40000,
        });
        expect(result.violations).toEqual([]);
        if (result.completed) completedSeeds.push(seed);
      }
      expect(
        completedSeeds.length,
        `no game completed for preset "${preset.name}"`
      ).toBeGreaterThan(0);
    }
  }, 60000);
});

describe('collectAllRoundCoordinates', () => {
  it('accounts for the full double-twelve set at deal time', () => {
    const result = runRandomGame({
      captainCount: 4,
      objective: 'points',
      seed: 7,
      maxSteps: 1,
    });
    const round = result.finalState.round;
    expect(round).not.toBeNull();
    if (!round) return;

    const all = collectAllRoundCoordinates(round);
    expect(all).toHaveLength(91);
    const keys = new Set(
      all.map((c) => coordinateKey(normalizeCoordinate(c.low, c.high)))
    );
    expect(keys.size).toBe(91);
    expect([...keys].sort()).toEqual([...EXPECTED_KEYS].sort());
  });
});

describe('checkRoundInvariants — catches injected corruption', () => {
  it('flags a duplicated tile', () => {
    const round = makeRound(['a', 'b'], {
      hands: { a: [normalizeCoordinate(1, 2)], b: [normalizeCoordinate(1, 2)] },
    });
    const state = {
      id: 't',
      phase: 'active' as const,
      objective: 'points' as const,
      campaignRounds: 13,
      completedRounds: 0,
      captains: [
        { id: 'a', displayName: 'a', pointsScore: 0 },
        { id: 'b', displayName: 'b', pointsScore: 0 },
      ],
      modules: runRandomGame({ captainCount: 2, seed: 1, maxSteps: 1 })
        .finalState.modules,
      houseRules: resolveHouseRules(),
      round,
    };
    const violations = checkRoundInvariants(state, round);
    expect(violations.some((v) => v.kind === 'tile-duplicate')).toBe(true);
    expect(violations.some((v) => v.kind === 'tile-missing')).toBe(true);
  });
});

describe('enumerateLegalActions', () => {
  it('offers only in-turn chart/draw options at the opening', () => {
    const result = runRandomGame({
      captainCount: 3,
      objective: 'points',
      seed: 3,
      maxSteps: 1,
    });
    const round = result.finalState.round;
    expect(round).not.toBeNull();
    if (!round) return;

    const actions = enumerateLegalActions(
      result.finalState,
      round,
      resolveHouseRules()
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      if ('playerId' in action) {
        expect(action.playerId).toBe(round.activePlayerId);
      }
    }
  });
});
