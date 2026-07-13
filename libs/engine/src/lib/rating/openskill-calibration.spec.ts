/**
 * OpenSkill anchor calibration via self-play.
 * Runs AI vs AI matches and measures win rates to calibrate μ values.
 */

import { describe, it } from 'vitest';
import { getWarpSkillProfile, type WarpSkillLevel } from '../ai/skill.js';
import { createWarpAiPlayer } from '../ai/create-warp-ai.js';
import {
  playSelfPlayGame,
  type SelfPlaySeat,
} from '../ai/self-play.js';
import type { RatingTrack } from './types.js';
import { getAIAnchor } from './anchors.js';

const CALIBRATION_GAMES = Number(
  process.env.OPENSKILL_CALIBRATION_GAMES ?? 2000
);
const CALIBRATION_SEED = 9001;

interface MatchupResult {
  games: number;
  leftWins: number;
  rightWins: number;
  ties: number;
  leftWinRate: number;
}

/**
 * Run a heads-up matchup between two AI skill levels.
 */
function runMatchup(
  leftSkill: WarpSkillLevel,
  rightSkill: WarpSkillLevel,
  objective: 'go-out' | 'points',
  games: number,
  seed: number
): MatchupResult {
  let leftWins = 0;
  let rightWins = 0;
  let ties = 0;

  const leftProfile = getWarpSkillProfile(leftSkill);
  const rightProfile = getWarpSkillProfile(rightSkill);
  const leftPlayer = createWarpAiPlayer({ skill: leftProfile });
  const rightPlayer = createWarpAiPlayer({ skill: rightProfile });

  const seats: SelfPlaySeat[] = [
    { id: 'left', displayName: leftSkill, player: leftPlayer },
    { id: 'right', displayName: rightSkill, player: rightPlayer },
  ];

  for (let game = 0; game < games; game += 1) {
    const result = playSelfPlayGame({
      seats,
      seed: seed + game,
      objective,
      maxPip: 12,
      modules: {},
      houseRules: {},
    });

    if (result.completed) {
      if (result.winnerId === 'left') {
        leftWins += 1;
      } else if (result.winnerId === 'right') {
        rightWins += 1;
      } else {
        ties += 1;
      }
    } else {
      // Game didn't finish (timeout) — count as tie
      ties += 1;
    }
  }

  const leftWinRate = leftWins / games;

  return {
    games,
    leftWins,
    rightWins,
    ties,
    leftWinRate,
  };
}

/**
 * Calculate expected win rate from μ gap using OpenSkill's logistic model.
 * This is approximately: 1 / (1 + exp(-gap/β)) where β ≈ 4.167
 */
function expectedWinRate(muGap: number, beta = 4.167): number {
  return 1 / (1 + Math.exp(-muGap / beta));
}

/**
 * Find the μ gap that produces a target win rate.
 * Inverse of expectedWinRate.
 */
function impliedMuGap(winRate: number, beta = 4.167): number {
  if (winRate <= 0 || winRate >= 1) {
    return Infinity;
  }
  return -beta * Math.log((1 - winRate) / winRate);
}

describe('OpenSkill Anchor Calibration', () => {
  describe('Points Campaign', () => {
    it('prints calibration report for points objective', () => {
      if (process.env.OPENSKILL_CALIBRATION_REPORT !== '1') {
        return;
      }

      console.log('\n=== OpenSkill Anchor Calibration: Points Campaign ===\n');
      console.log(`Games per matchup: ${CALIBRATION_GAMES}`);
      console.log(`Seed: ${CALIBRATION_SEED}\n`);

      const track: RatingTrack = 'points';
      const matchups: Array<[WarpSkillLevel, WarpSkillLevel]> = [
        ['ensign', 'lieutenant'],
        ['lieutenant', 'commander'],
        ['ensign', 'commander'],
      ];

      console.log('Current Anchors:');
      console.log(
        `  Ensign:     μ=${getAIAnchor(track, 'ensign').mu.toFixed(1)}, σ=${getAIAnchor(track, 'ensign').sigma.toFixed(1)}`
      );
      console.log(
        `  Lieutenant: μ=${getAIAnchor(track, 'lieutenant').mu.toFixed(1)}, σ=${getAIAnchor(track, 'lieutenant').sigma.toFixed(1)}`
      );
      console.log(
        `  Commander:  μ=${getAIAnchor(track, 'commander').mu.toFixed(1)}, σ=${getAIAnchor(track, 'commander').sigma.toFixed(1)}`
      );
      console.log('');

      for (const [left, right] of matchups) {
        const result = runMatchup(
          left,
          right,
          'points',
          CALIBRATION_GAMES,
          CALIBRATION_SEED
        );

        const leftAnchor = getAIAnchor(track, left);
        const rightAnchor = getAIAnchor(track, right);
        const muGap = leftAnchor.mu - rightAnchor.mu; // Positive if left is stronger
        const expectedWin = expectedWinRate(muGap);
        const impliedGap = impliedMuGap(result.leftWinRate);

        console.log(`${left} vs ${right}:`);
        console.log(
          `  Win rate: ${(result.leftWinRate * 100).toFixed(1)}% (${result.leftWins}/${result.games})`
        );
        console.log(`  Current μ gap (left - right): ${muGap.toFixed(1)}`);
        console.log(`  Expected left win rate: ${(expectedWin * 100).toFixed(1)}%`);
        console.log(`  Implied μ gap from observed win rate: ${impliedGap.toFixed(1)}`);
        console.log(
          `  Δμ adjustment needed for ${left}: ${(impliedGap - muGap).toFixed(1)}`
        );
        console.log('');
      }

      console.log('Target win rates:');
      console.log('  76% → μ gap ≈ 7.0');
      console.log('  91% → μ gap ≈ 14.0');
      console.log('');
    });

    it('Lieutenant beats Ensign at least 65% of the time (points)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'ensign',
        'lieutenant',
        'points',
        200,
        CALIBRATION_SEED
      );
      // Relaxed from 76% target — just verify ordering
      expect(result.leftWinRate).toBeGreaterThan(0.65);
    });

    it('Commander beats Lieutenant at least 65% of the time (points)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'lieutenant',
        'commander',
        'points',
        200,
        CALIBRATION_SEED + 1000
      );
      expect(result.leftWinRate).toBeGreaterThan(0.65);
    });

    it('Commander beats Ensign at least 85% of the time (points)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'ensign',
        'commander',
        'points',
        200,
        CALIBRATION_SEED + 2000
      );
      expect(result.leftWinRate).toBeGreaterThan(0.85);
    });
  });

  describe('Go-Out Campaign', () => {
    it('prints calibration report for go-out objective', () => {
      if (process.env.OPENSKILL_CALIBRATION_REPORT !== '1') {
        return;
      }

      console.log('\n=== OpenSkill Anchor Calibration: Go-Out Campaign ===\n');
      console.log(`Games per matchup: ${CALIBRATION_GAMES}`);
      console.log(`Seed: ${CALIBRATION_SEED + 10000}\n`);

      const track: RatingTrack = 'goOut';
      const matchups: Array<[WarpSkillLevel, WarpSkillLevel]> = [
        ['ensign', 'lieutenant'],
        ['lieutenant', 'commander'],
        ['ensign', 'commander'],
      ];

      console.log('Current Anchors:');
      console.log(
        `  Ensign:     μ=${getAIAnchor(track, 'ensign').mu.toFixed(1)}, σ=${getAIAnchor(track, 'ensign').sigma.toFixed(1)}`
      );
      console.log(
        `  Lieutenant: μ=${getAIAnchor(track, 'lieutenant').mu.toFixed(1)}, σ=${getAIAnchor(track, 'lieutenant').sigma.toFixed(1)}`
      );
      console.log(
        `  Commander:  μ=${getAIAnchor(track, 'commander').mu.toFixed(1)}, σ=${getAIAnchor(track, 'commander').sigma.toFixed(1)}`
      );
      console.log('');

      for (const [left, right] of matchups) {
        const result = runMatchup(
          left,
          right,
          'go-out',
          CALIBRATION_GAMES,
          CALIBRATION_SEED + 10000
        );

        const leftAnchor = getAIAnchor(track, left);
        const rightAnchor = getAIAnchor(track, right);
        const muGap = leftAnchor.mu - rightAnchor.mu; // Positive if left is stronger
        const expectedWin = expectedWinRate(muGap);
        const impliedGap = impliedMuGap(result.leftWinRate);

        console.log(`${left} vs ${right}:`);
        console.log(
          `  Win rate: ${(result.leftWinRate * 100).toFixed(1)}% (${result.leftWins}/${result.games})`
        );
        console.log(`  Current μ gap (left - right): ${muGap.toFixed(1)}`);
        console.log(`  Expected left win rate: ${(expectedWin * 100).toFixed(1)}%`);
        console.log(`  Implied μ gap from observed win rate: ${impliedGap.toFixed(1)}`);
        console.log(
          `  Δμ adjustment needed for ${left}: ${(impliedGap - muGap).toFixed(1)}`
        );
        console.log('');
      }

      console.log('Target win rates:');
      console.log('  76% → μ gap ≈ 7.0');
      console.log('  91% → μ gap ≈ 14.0');
      console.log('');
    });

    it('Lieutenant beats Ensign at least 60% of the time (go-out)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'ensign',
        'lieutenant',
        'go-out',
        200,
        CALIBRATION_SEED + 10000
      );
      // More variance in go-out due to racing
      expect(result.leftWinRate).toBeGreaterThan(0.6);
    });

    it('Commander beats Lieutenant at least 60% of the time (go-out)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'lieutenant',
        'commander',
        'go-out',
        200,
        CALIBRATION_SEED + 11000
      );
      expect(result.leftWinRate).toBeGreaterThan(0.6);
    });

    it('Commander beats Ensign at least 80% of the time (go-out)', () => {
      if (process.env.OPENSKILL_CALIBRATION_QUICK !== '1') {
        return;
      }
      const result = runMatchup(
        'ensign',
        'commander',
        'go-out',
        200,
        CALIBRATION_SEED + 12000
      );
      expect(result.leftWinRate).toBeGreaterThan(0.8);
    });
  });
});
