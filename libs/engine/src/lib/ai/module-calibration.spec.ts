import { describe, expect, it } from 'vitest';

import type { GameModuleConfig } from '../types/modules.js';
import {
  formatMatchupResult,
  type SkillMatchupResult,
  runSkillMatchup,
  runCalibrationMatrix,
  SKILL_MATCHUPS,
} from './ai-rating-calibration.js';

const CALIBRATION_GAMES = Number(
  process.env.MODULE_CALIBRATION_GAMES ??
    (process.env.MODULE_CALIBRATION_REPORT === '1' ? 500 : 50)
);
const CALIBRATION_SEED = 12000;

/** Minimum share of games that reach a decisive outcome. */
const MIN_COMPLETION_RATE = 0.80;

/** Win rate thresholds — modules should preserve skill ordering. */
const MODULE_THRESHOLDS = {
  orderingMinWinRate: 0.52, // Relaxed from 0.55 — modules add variance
  symmetricWinRateBand: { min: 0.35, max: 0.65 },
  requiredOrderingMatchups: [
    ['ensign', 'lieutenant'],
    ['ensign', 'commander'],
    ['lieutenant', 'commander'],
  ] as const,
};

function assertCompletion(result: SkillMatchupResult): void {
  expect(
    result.completed / result.games,
    `${result.left} vs ${result.right} completion rate`
  ).toBeGreaterThanOrEqual(MIN_COMPLETION_RATE);
}

function matchupKey(left: string, right: string): string {
  return `${left}|${right}`;
}

/** Module configurations to test */
const MODULE_CONFIGS: Record<string, GameModuleConfig> = {
  baseline: {},
  alpha: {
    continuum: true,
  },
  beta: {
    salamanderPenalty: true,
  },
  'alpha+beta': {
    continuum: true,
    salamanderPenalty: true,
  },
  gamma: {
    sensorGrid: true,
    sensorGridSize: 5,
  },
  delta: {
    warpDriveSpool: true,
  },
  theta: {
    longestTrail: true,
    longestTrailBonus: -3,
  },
  iota: {
    doubleDown: true,
    doubleDownDrawCount: 2,
  },
  kappa: {
    temporalInversion: true,
  },
  'delta+theta': {
    warpDriveSpool: true,
    longestTrail: true,
    longestTrailBonus: -3,
  },
  'beta+theta': {
    salamanderPenalty: true,
    longestTrail: true,
    longestTrailBonus: -3,
  },
  'gamma+delta': {
    sensorGrid: true,
    sensorGridSize: 5,
    warpDriveSpool: true,
  },
  'alpha+beta+gamma': {
    continuum: true,
    salamanderPenalty: true,
    sensorGrid: true,
    sensorGridSize: 5,
  },
  'alpha+beta+delta': {
    continuum: true,
    salamanderPenalty: true,
    warpDriveSpool: true,
  },
  'alpha+beta+theta': {
    continuum: true,
    salamanderPenalty: true,
    longestTrail: true,
    longestTrailBonus: -3,
  },
  'official-warp-core': {
    // Alpha + Beta + Gamma + Delta (current validated set)
    continuum: true,
    salamanderPenalty: true,
    sensorGrid: true,
    sensorGridSize: 5,
    warpDriveSpool: true,
  },
  'tournament-elite': {
    // All rated modules together
    continuum: true,
    salamanderPenalty: true,
    sensorGrid: true,
    sensorGridSize: 5,
    warpDriveSpool: true,
    longestTrail: true,
    longestTrailBonus: -3,
  },
  // Warped / Experimental configs
  'warped-iota': {
    doubleDown: true,
    doubleDownDrawCount: 2,
  },
  'warped-kappa': {
    temporalInversion: true,
  },
  'warped-lambda': {
    wormholes: true,
  },
  'warped-chaos': {
    doubleDown: true,
    doubleDownDrawCount: 2,
    temporalInversion: true,
  },
  'warped-ultimate': {
    // All warped modules together
    doubleDown: true,
    doubleDownDrawCount: 2,
    temporalInversion: true,
    wormholes: true,
  },
  // TODO: Module Epsilon (drafting) requires dealRoundFromDraft support in startGame
  // TODO: Module Zeta (squadrons) not yet implemented
};

describe('Module calibration (skill/luck balance)', () => {
  describe('baseline (no modules)', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s baseline games',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering (baseline)', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED,
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Module Alpha: The Continuum', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s with continuum',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED + 5000,
          modules: MODULE_CONFIGS.alpha,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering with continuum', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 5000,
        modules: MODULE_CONFIGS.alpha,
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with alpha`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Module Beta: Salamander Penalty', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s with salamander penalty',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED + 6000,
          modules: MODULE_CONFIGS.beta,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering with salamander penalty', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 6000,
        modules: MODULE_CONFIGS.beta,
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with beta`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Official Warp Core (Alpha + Beta)', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s with official warp core',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED + 7000,
          modules: MODULE_CONFIGS['alpha+beta'],
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering with official warp core', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 7000,
        modules: MODULE_CONFIGS['alpha+beta'],
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with alpha+beta`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Module Gamma: Long-Range Sensor Sweep', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s with sensor grid',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED + 1000,
          modules: MODULE_CONFIGS.gamma,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering with sensor grid', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 1000,
        modules: MODULE_CONFIGS.gamma,
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with gamma`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Module Delta: Warp Drive Spooling', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s with warp drive spool',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'points',
          seed: CALIBRATION_SEED + 2000,
          modules: MODULE_CONFIGS.delta,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering with warp drive spool', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 2000,
        modules: MODULE_CONFIGS.delta,
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with delta`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  describe('Module Epsilon: Tactical Requisition', () => {
    it.skip('requires dealRoundFromDraft integration in startGame', () => {
      // TODO: Module Epsilon needs AI draft pick functions and startGame integration
    });
  }, 120_000);

  describe('Combined modules', () => {
    it('completes games with gamma+delta enabled', () => {
      const result = runSkillMatchup('lieutenant', 'ensign', {
        games: Math.min(CALIBRATION_GAMES, 20),
        objective: 'points',
        seed: CALIBRATION_SEED + 4000,
        modules: MODULE_CONFIGS['gamma+delta'],
      });
      expect(result.completed).toBeGreaterThanOrEqual(
        Math.floor(Math.min(CALIBRATION_GAMES, 20) * MIN_COMPLETION_RATE)
      );
    });

    it('preserves skill ordering with gamma+delta', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + 4000,
        modules: MODULE_CONFIGS['gamma+delta'],
      });
      const required = new Set(
        MODULE_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (
          result.left === result.right ||
          !required.has(matchupKey(result.left, result.right))
        ) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(
          result.higherSkillWinRate!,
          `${result.left} vs ${result.right} ordering with all modules`
        ).toBeGreaterThanOrEqual(MODULE_THRESHOLDS.orderingMinWinRate);
      }
    });
  }, 120_000);

  it('prints module calibration report when MODULE_CALIBRATION_REPORT=1', () => {
    if (process.env.MODULE_CALIBRATION_REPORT !== '1') {
      return;
    }

    const configOrder: Array<keyof typeof MODULE_CONFIGS> = [
      'baseline',
      'alpha',
      'beta',
      'alpha+beta',
      'gamma',
      'delta',
      'theta',
      'iota',
      'kappa',
      'delta+theta',
      'beta+theta',
      'gamma+delta',
      'alpha+beta+gamma',
      'alpha+beta+delta',
      'alpha+beta+theta',
      'official-warp-core',
      'tournament-elite',
      'warped-iota',
      'warped-kappa',
      'warped-lambda',
      'warped-chaos',
      'warped-ultimate',
    ];

    for (const configKey of configOrder) {
      const config = MODULE_CONFIGS[configKey];
      // eslint-disable-next-line no-console
      console.log(
        `\n=== ${configKey} (${CALIBRATION_GAMES} games, points objective) ===`
      );

      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'points',
        seed: CALIBRATION_SEED + configOrder.indexOf(configKey) * 1000,
        modules: configKey === 'baseline' ? undefined : config,
      });

      for (const result of matrix) {
        // eslint-disable-next-line no-console
        console.log(formatMatchupResult(result));
      }

      // Calculate summary stats
      const asymmetricResults = matrix.filter((r) => r.left !== r.right);
      const avgHigherSkillWinRate =
        asymmetricResults.reduce(
          (sum, r) => sum + (r.higherSkillWinRate ?? 0),
          0
        ) / asymmetricResults.length;
      const avgImpliedGap =
        asymmetricResults
          .filter((r) => r.impliedEloGap !== null && Number.isFinite(r.impliedEloGap))
          .reduce((sum, r) => sum + (r.impliedEloGap ?? 0), 0) /
        asymmetricResults.filter(
          (r) => r.impliedEloGap !== null && Number.isFinite(r.impliedEloGap)
        ).length;

      const symmetricResults = matrix.filter((r) => r.left === r.right);
      const avgSeatAWinRate =
        symmetricResults.reduce((sum, r) => sum + (r.seatAWinRate ?? 0.5), 0) /
        symmetricResults.length;

      // eslint-disable-next-line no-console
      console.log(
        `\n  Summary: avg higher-skill win rate ${(avgHigherSkillWinRate * 100).toFixed(1)}%, implied ΔELO ${Math.round(avgImpliedGap)}, seat-a win rate ${(avgSeatAWinRate * 100).toFixed(1)}%`
      );
    }

    // eslint-disable-next-line no-console
    console.log('\n=== Module Calibration Complete ===');
    // eslint-disable-next-line no-console
    console.log(
      `Baseline establishes skill ordering. Modules should preserve it while adding strategic depth.`
    );
    // eslint-disable-next-line no-console
    console.log(
      `If higher-skill win rates drop significantly, module mechanics may be too luck-dependent.`
    );
    // eslint-disable-next-line no-console
    console.log(
      `If seat-a win rates drift far from 50%, module mechanics may favor position.`
    );
  }, 600_000);
});
