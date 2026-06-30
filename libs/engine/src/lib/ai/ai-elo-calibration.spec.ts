import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_PLAYER_COUNTS,
  formatFocusMatchupResult,
  formatMatchupResult,
  GO_OUT_REFERENCE_AI_ELO,
  impliedEloGap,
  REFERENCE_AI_ELO,
  referenceEloForObjective,
  runCalibrationMatrix,
  runFocusMatchup,
  runFourPlayerFocusMatchup,
  runSkillMatchup,
  SKILL_MATCHUPS,
  type SkillMatchupResult,
} from './ai-elo-calibration.js';

const CALIBRATION_GAMES = Number(
  process.env.AI_CALIBRATION_GAMES ??
    (process.env.AI_CALIBRATION_REPORT === '1' ? 200 : 150)
);
const CALIBRATION_SEED = 9001;

/** Minimum share of games that reach a decisive outcome. */
const MIN_COMPLETION_RATE = 0.85;

const PENALTY_THRESHOLDS = {
  orderingMinWinRate: 0.55,
  symmetricWinRateBand: { min: 0.35, max: 0.65 },
  eloAlignmentBand: { min: 0.5, max: 0.92 },
  requiredOrderingMatchups: [
    ['ensign', 'lieutenant'],
    ['ensign', 'commander'],
    ['lieutenant', 'commander'],
  ] as const,
};

const GO_OUT_THRESHOLDS = {
  orderingMinWinRate: 0.55,
  orderingMinWinRateIntermediateAdvanced: 0.52,
  symmetricWinRateBand: { min: 0.4, max: 0.6 },
  fourPlayerFocusMinWinRate: 0.26,
  fourPlayerAdvancedBeatsIntermediateGap: 0.02,
  requiredOrderingMatchups: [
    ['ensign', 'lieutenant'],
    ['ensign', 'commander'],
    ['lieutenant', 'commander'],
  ] as const,
};

const FOUR_PLAYER_FOCUS_MATCHUPS: readonly (readonly [
  SkillMatchupResult['left'],
  SkillMatchupResult['right'],
])[] = [
  ['commander', 'ensign'],
  ['lieutenant', 'ensign'],
  ['commander', 'lieutenant'],
];

const MULTI_PLAYER_FOCUS_MATCHUPS = FOUR_PLAYER_FOCUS_MATCHUPS;

function assertCompletion(result: SkillMatchupResult): void {
  expect(result.completed / result.games).toBeGreaterThanOrEqual(
    MIN_COMPLETION_RATE
  );
}

function matchupKey(left: string, right: string): string {
  return `${left}|${right}`;
}

describe('AI ELO calibration (self-play)', () => {
  it('reference ratings are spaced 200 points apart (penalty) and 250 (go-out)', () => {
    expect(REFERENCE_AI_ELO.lieutenant - REFERENCE_AI_ELO.ensign).toBe(
      200
    );
    expect(REFERENCE_AI_ELO.commander - REFERENCE_AI_ELO.lieutenant).toBe(
      200
    );
    expect(
      GO_OUT_REFERENCE_AI_ELO.lieutenant - GO_OUT_REFERENCE_AI_ELO.ensign
    ).toBe(250);
    expect(
      GO_OUT_REFERENCE_AI_ELO.commander - GO_OUT_REFERENCE_AI_ELO.lieutenant
    ).toBe(250);
    expect(referenceEloForObjective('penalty')).toBe(REFERENCE_AI_ELO);
    expect(referenceEloForObjective('go-out')).toBe(GO_OUT_REFERENCE_AI_ELO);
  });

  it('implied ELO gap matches a 76% win rate near 200 points', () => {
    expect(impliedEloGap(0.76)).toBeGreaterThan(170);
    expect(impliedEloGap(0.76)).toBeLessThan(230);
  });

  describe('penalty objective', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s heads-up games',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'penalty',
          seed: CALIBRATION_SEED,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering in asymmetric matchups', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'penalty',
        seed: CALIBRATION_SEED,
      });
      const required = new Set(
        PENALTY_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (result.left === result.right || !required.has(matchupKey(result.left, result.right))) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
        expect(result.higherSkillWinRate!).toBeGreaterThanOrEqual(
          PENALTY_THRESHOLDS.orderingMinWinRate
        );
      }
    });

    it('same-skill matchups stay near even', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'penalty',
        seed: CALIBRATION_SEED,
      });

      for (const result of matrix) {
        if (result.left !== result.right) {
          continue;
        }
        expect(result.seatAWinRate).not.toBeNull();
        expect(result.seatAWinRate!).toBeGreaterThanOrEqual(
          PENALTY_THRESHOLDS.symmetricWinRateBand.min
        );
        expect(result.seatAWinRate!).toBeLessThanOrEqual(
          PENALTY_THRESHOLDS.symmetricWinRateBand.max
        );
      }
    });

    it('observed win rates align with fixed opponent ELO spacing', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'penalty',
        seed: CALIBRATION_SEED,
      });

      for (const result of matrix) {
        if (result.left === result.right || result.higherSkillWinRate === null) {
          continue;
        }
        expect(result.higherSkillWinRate).toBeGreaterThanOrEqual(
          PENALTY_THRESHOLDS.eloAlignmentBand.min
        );
        expect(result.higherSkillWinRate).toBeLessThanOrEqual(
          PENALTY_THRESHOLDS.eloAlignmentBand.max
        );
      }
    });
  }, 120_000);

  describe('go-out objective', () => {
    it.each(SKILL_MATCHUPS)(
      'completes %s vs %s heads-up games',
      (left, right) => {
        const result = runSkillMatchup(left, right, {
          games: CALIBRATION_GAMES,
          objective: 'go-out',
          seed: CALIBRATION_SEED,
        });
        assertCompletion(result);
      },
      120_000
    );

    it('preserves skill ordering in key heads-up matchups', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'go-out',
        seed: CALIBRATION_SEED,
      });
      const required = new Set(
        GO_OUT_THRESHOLDS.requiredOrderingMatchups.map(([left, right]) =>
          matchupKey(left, right)
        )
      );

      for (const result of matrix) {
        assertCompletion(result);
        if (result.left === result.right || !required.has(matchupKey(result.left, result.right))) {
          continue;
        }
        expect(result.higherSkillWinRate).not.toBeNull();
          expect(result.higherSkillWinRate!).toBeGreaterThanOrEqual(
            result.left === 'lieutenant' && result.right === 'commander'
              ? GO_OUT_THRESHOLDS.orderingMinWinRateIntermediateAdvanced
              : GO_OUT_THRESHOLDS.orderingMinWinRate
          );
      }
    });

    it('same-skill heads-up matchups stay near even', () => {
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'go-out',
        seed: CALIBRATION_SEED,
      });

      for (const result of matrix) {
        if (result.left !== result.right) {
          continue;
        }
        expect(result.seatAWinRate).not.toBeNull();
        expect(result.seatAWinRate!).toBeGreaterThanOrEqual(
          GO_OUT_THRESHOLDS.symmetricWinRateBand.min
        );
        expect(result.seatAWinRate!).toBeLessThanOrEqual(
          GO_OUT_THRESHOLDS.symmetricWinRateBand.max
        );
      }
    });

    it.each(FOUR_PLAYER_FOCUS_MATCHUPS)(
      '4-player focus %s vs 3× %s wins often enough',
      (focus, opponents) => {
        const result = runFourPlayerFocusMatchup(focus, opponents, {
          games: CALIBRATION_GAMES,
          objective: 'go-out',
          seed: CALIBRATION_SEED,
        });
        expect(result.completed / result.games).toBeGreaterThanOrEqual(
          MIN_COMPLETION_RATE
        );
        expect(result.focusWinRate).toBeGreaterThanOrEqual(
          GO_OUT_THRESHOLDS.fourPlayerFocusMinWinRate
        );
      },
      120_000
    );

    it('advanced focus beats intermediate focus at 4 players', () => {
      const advanced = runFourPlayerFocusMatchup('commander', 'ensign', {
        games: CALIBRATION_GAMES,
        objective: 'go-out',
        seed: CALIBRATION_SEED,
      });
      const intermediate = runFourPlayerFocusMatchup('lieutenant', 'ensign', {
        games: CALIBRATION_GAMES,
        objective: 'go-out',
        seed: CALIBRATION_SEED,
      });
      expect(advanced.focusWinRate).toBeGreaterThanOrEqual(
        intermediate.focusWinRate - 1e-9
      );
    });
  });

  it('completes games with Drop to Impulse house rule enabled', () => {
    const result = runSkillMatchup('lieutenant', 'ensign', {
      games: 8,
      objective: 'penalty',
      seed: 4242,
      houseRules: { dropToImpulseCall: true },
    });
    expect(result.completed).toBeGreaterThanOrEqual(Math.floor(8 * MIN_COMPLETION_RATE));
  });

  it('prints a calibration report when AI_CALIBRATION_REPORT=1', () => {
    if (process.env.AI_CALIBRATION_REPORT !== '1') {
      return;
    }

    for (const objective of ['penalty', 'go-out'] as const) {
      // eslint-disable-next-line no-console
      console.log(`\n=== ${objective} (${CALIBRATION_GAMES} games) ===`);
      const matrix = runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective,
        seed: CALIBRATION_SEED,
      });
      for (const result of matrix) {
        // eslint-disable-next-line no-console
        console.log(formatMatchupResult(result));
      }
      if (objective === 'go-out') {
        for (const playerCount of CALIBRATION_PLAYER_COUNTS) {
          if (playerCount <= 2) {
            continue;
          }
          // eslint-disable-next-line no-console
          console.log(`\n--- ${playerCount}-player focus (go-out) ---`);
          for (const [focus, opponents] of MULTI_PLAYER_FOCUS_MATCHUPS) {
            // eslint-disable-next-line no-console
            console.log(
              formatFocusMatchupResult(
                runFocusMatchup(playerCount, focus, opponents, {
                  games: CALIBRATION_GAMES,
                  objective: 'go-out',
                  seed: CALIBRATION_SEED,
                })
              )
            );
          }
        }
      }
    }

    if (process.env.AI_CALIBRATION_DROP_TO_IMPULSE === '1') {
      // eslint-disable-next-line no-console
      console.log('\n=== Drop to Impulse (penalty sanity check) ===');
      for (const result of runCalibrationMatrix({
        games: CALIBRATION_GAMES,
        objective: 'penalty',
        seed: CALIBRATION_SEED,
        houseRules: { dropToImpulseCall: true },
      })) {
        // eslint-disable-next-line no-console
        console.log(formatMatchupResult(result));
      }
    }
  }, 120_000);
});
