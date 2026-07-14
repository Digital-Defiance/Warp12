/**
 * Module Zeta squad rating calibration.
 *
 * Confirms skill ordering survives team play on the dedicated `squadRating`
 * track (shared trails do not collapse Commander > Lieutenant > Ensign).
 * Gate: `SQUADRONS_RATING_CALIBRATED` in `anchors.ts`.
 *
 * Observed (points, Warp 12, 2026-07-13):
 *   Cmdr×2 vs Lt×2     ≈ 62% (FFA heads-up ≈ 64% — same compression)
 *   Cmdr×2 vs Ens×2    ≈ 88% (FFA ≈ 95%)
 * Go-out remains compressed (~50–57%); points is the ship signal.
 *
 * Full report:
 *   yarn calibrate:openskill-squad
 * Quick (100 games / matchup):
 *   yarn calibrate:openskill-squad:quick
 */

import { describe, expect, it } from 'vitest';
import { getWarpSkillProfile, type WarpSkillLevel } from '../ai/skill.js';
import { createWarpAiPlayer } from '../ai/create-warp-ai.js';
import {
  playSelfPlayGame,
  type SelfPlaySeat,
} from '../ai/self-play.js';
import { squadronForPlayer } from '../engine/squadrons.js';
import { DEFAULT_RATING, type PlayerRating } from './types.js';
import { updateTeamRatings, type Team } from './update-team.js';
import { getAIAnchor, SQUADRONS_RATING_CALIBRATED } from './anchors.js';

const REPORT = process.env.SQUAD_OPENSKILL_CALIBRATION_REPORT === '1';
const QUICK = process.env.SQUAD_OPENSKILL_CALIBRATION_QUICK === '1';
const CALIBRATION_GAMES = Number(
  process.env.SQUAD_OPENSKILL_CALIBRATION_GAMES ?? (REPORT ? 200 : QUICK ? 100 : 20)
);
const CALIBRATION_SEED = 42_017;

interface SquadMatchupResult {
  games: number;
  strongSquadWins: number;
  weakSquadWins: number;
  unfinished: number;
  decisiveStrongWinRate: number;
  completed: number;
}

function makeSeats(
  strong: WarpSkillLevel,
  weak: WarpSkillLevel,
  objective: 'go-out' | 'points'
): SelfPlaySeat[] {
  const make = (id: string, level: WarpSkillLevel): SelfPlaySeat => ({
    id,
    displayName: `${level}-${id}`,
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile(level, objective, 4),
      objective,
    }),
  });
  // formSquadrons round-robin: [s1,w1,s2,w2] → strong×2 vs weak×2.
  return [
    make('s1', strong),
    make('w1', weak),
    make('s2', strong),
    make('w2', weak),
  ];
}

function runSquadMatchup(
  strong: WarpSkillLevel,
  weak: WarpSkillLevel,
  objective: 'go-out' | 'points',
  games: number,
  seed: number
): SquadMatchupResult {
  let strongSquadWins = 0;
  let weakSquadWins = 0;
  let unfinished = 0;
  let completed = 0;

  for (let game = 0; game < games; game += 1) {
    const result = playSelfPlayGame({
      seats: makeSeats(strong, weak, objective),
      seed: seed + game,
      objective,
      maxPip: 12,
      modules: { squadrons: true, squadronSize: 2 },
      houseRules: {},
    });

    if (!result.completed || !result.winnerId || !result.finalState.squadrons) {
      unfinished += 1;
      continue;
    }
    completed += 1;

    const winnerSquad = squadronForPlayer(
      result.finalState.squadrons,
      result.winnerId
    );
    if (!winnerSquad) {
      unfinished += 1;
      continue;
    }

    if (winnerSquad.memberIds.includes('s1')) {
      strongSquadWins += 1;
    } else {
      weakSquadWins += 1;
    }
  }

  const decisive = strongSquadWins + weakSquadWins;
  return {
    games,
    strongSquadWins,
    weakSquadWins,
    unfinished,
    decisiveStrongWinRate: decisive > 0 ? strongSquadWins / decisive : 0,
    completed,
  };
}

function logMatchup(
  label: string,
  result: SquadMatchupResult
): void {
  console.log(`\n=== ${label} ===`);
  console.log(
    `Games=${result.games} completed=${result.completed} unfinished=${result.unfinished}`
  );
  console.log(
    `Strong squad wins=${result.strongSquadWins} weak wins=${result.weakSquadWins}`
  );
  console.log(
    `Strong win rate (decisive): ${(result.decisiveStrongWinRate * 100).toFixed(1)}%`
  );
  console.log(
    `SQUADRONS_RATING_CALIBRATED (shipped): ${SQUADRONS_RATING_CALIBRATED}`
  );
}

describe('OpenSkill Squad (Module Zeta) calibration', () => {
  it('ships with SQUADRONS_RATING_CALIBRATED enabled for the squad track', () => {
    expect(SQUADRONS_RATING_CALIBRATED).toBe(true);
  });

  it('updateTeamRatings assigns individual credit within a winning squad', () => {
    const veteran: PlayerRating = {
      mu: 35,
      sigma: 3,
      matches: 80,
    };
    const newcomer: PlayerRating = { ...DEFAULT_RATING };
    const opposition: PlayerRating = getAIAnchor('points', 'lieutenant');

    const teams: Team[] = [
      {
        teamId: 'winners',
        rank: 1,
        members: [
          { playerId: 'vet', rating: veteran },
          { playerId: 'rook', rating: newcomer },
        ],
      },
      {
        teamId: 'losers',
        rank: 2,
        members: [
          { playerId: 'opp1', rating: opposition },
          { playerId: 'opp2', rating: opposition },
        ],
      },
    ];

    const updated = updateTeamRatings(teams);
    const vet = updated.get('vet')!;
    const rook = updated.get('rook')!;
    expect(vet.mu).toBeGreaterThan(veteran.mu - 0.01);
    expect(rook.mu).toBeGreaterThan(newcomer.mu);
    expect(rook.mu - newcomer.mu).toBeGreaterThan(vet.mu - veteran.mu);
    expect(vet.sigma).toBeLessThan(veteran.sigma);
    expect(rook.sigma).toBeLessThan(newcomer.sigma);
  });

  it('Commander 2v2 beats Ensign 2v2 (points skill ordering smoke)', () => {
    const games = REPORT || QUICK ? Math.min(CALIBRATION_GAMES, 80) : 20;
    const result = runSquadMatchup(
      'commander',
      'ensign',
      'points',
      games,
      CALIBRATION_SEED
    );
    if (REPORT || QUICK) {
      logMatchup('Squad OpenSkill: points 2v2 Cmdr vs Ens', result);
    }
    expect(result.completed).toBeGreaterThan(games * 0.85);
    // Wide μ gap; team play still leaves clear separation.
    expect(result.decisiveStrongWinRate).toBeGreaterThan(0.7);
  }, 180_000);

  it('prints Cmdr vs Lt points report when calibration env is set', () => {
    if (!REPORT && !QUICK) {
      return;
    }
    const result = runSquadMatchup(
      'commander',
      'lieutenant',
      'points',
      CALIBRATION_GAMES,
      CALIBRATION_SEED + 10_000
    );
    logMatchup('Squad OpenSkill: points 2v2 Cmdr vs Lt', result);
    expect(result.completed).toBeGreaterThan(CALIBRATION_GAMES * 0.85);
    // Matches FFA compression (~60%); require ordering, not FFA 76% target.
    expect(result.decisiveStrongWinRate).toBeGreaterThan(0.55);
  }, 600_000);

  it('prints go-out report when SQUAD_OPENSKILL_CALIBRATION_REPORT=1', () => {
    if (!REPORT) {
      return;
    }
    const result = runSquadMatchup(
      'commander',
      'ensign',
      'go-out',
      CALIBRATION_GAMES,
      CALIBRATION_SEED + 20_000
    );
    logMatchup('Squad OpenSkill: go-out 2v2 Cmdr vs Ens', result);
    expect(result.decisiveStrongWinRate).toBeGreaterThan(0.5);
  }, 300_000);
});
