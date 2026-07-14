import { createWarpAiPlayer } from './create-warp-ai.js';
import { getWarpSkillProfile } from './skill.js';
import {
  playSelfPlayGame,
  runSelfPlayMatch,
  type SelfPlaySeat,
} from './self-play.js';

// Heads-up advanced ('adv') vs beginner ('beg'), seats keyed by skill so
// aggregates compare skill directly. Seat order alternates each game to cancel
// any first-mover (Spacedock) advantage.
function seatsAdvVsBeginner(game: number): SelfPlaySeat[] {
  const adv: SelfPlaySeat = {
    id: 'adv',
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('commander'),
      rng: mulberrySeed(game, 1),
    }),
  };
  const beg: SelfPlaySeat = {
    id: 'beg',
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('ensign'),
      rng: mulberrySeed(game, 2),
    }),
  };
  return game % 2 === 0 ? [adv, beg] : [beg, adv];
}

function seatsLookaheadVsBeginner(game: number): SelfPlaySeat[] {
  const smart: SelfPlaySeat = {
    id: 'adv',
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('commander'),
      lookahead: { depth: 2, determinizations: 4, maxBranch: 5 },
      rng: mulberrySeed(game, 1),
    }),
  };
  const beg: SelfPlaySeat = {
    id: 'beg',
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile('ensign'),
      rng: mulberrySeed(game, 2),
    }),
  };
  return game % 2 === 0 ? [smart, beg] : [beg, smart];
}


function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mulberrySeed = (game: number, seat: number) =>
  mulberry32(1000 + game * 31 + seat);

describe('self-play harness', () => {
  // Full AI campaigns (and especially lookahead) routinely exceed Vitest's 5s default.
  it(
    'is deterministic for a fixed seed and seeded players',
    () => {
      const run = () =>
        playSelfPlayGame({ seats: seatsAdvVsBeginner(0), seed: 42 });
      const first = run();
      const second = run();
      expect(second.points).toEqual(first.points);
      expect(second.winnerId).toBe(first.winnerId);
      expect(second.completedRounds).toBe(first.completedRounds);
    },
    30_000
  );

  it(
    'a lookahead captain beats a greedy beginner heads-up',
    () => {
      // The decisive demonstration of "getting good": the lookahead player games
      // the real objective out by simulation, rather than trusting hand-rules.
      const match = runSelfPlayMatch(seatsLookaheadVsBeginner, {
        games: 10,
        seed: 7,
      });

      expect(match.completed).toBe(10);
      expect(match.wins['adv'] ?? 0).toBeGreaterThan(match.wins['beg'] ?? 0);
      expect(match.points['adv'] ?? 0).toBeLessThan(match.points['beg'] ?? 0);
    },
    120_000
  );

  it(
    'lookahead captains play full, legal games to a tally',
    () => {
      const seats: SelfPlaySeat[] = ['a', 'b'].map((id, index) => ({
        id,
        player: createWarpAiPlayer({
          skill: getWarpSkillProfile('commander'),
          lookahead: { depth: 2, determinizations: 3, maxBranch: 5 },
          rng: mulberry32(500 + index),
        }),
      }));

      const result = playSelfPlayGame({ seats, seed: 11, maxSteps: 30000 });
      // A round resolved means only-legal play reached someone going out.
      expect(result.completedRounds).toBeGreaterThanOrEqual(1);
    },
    60_000
  );

  it(
    'plays twenty seeded 4-captain games without illegal moves',
    () => {
      const captainIds = ['a', 'b', 'c', 'd'] as const;

      for (let game = 0; game < 20; game++) {
        const seats: SelfPlaySeat[] = captainIds.map((id, index) => ({
          id,
          player: createWarpAiPlayer({
            skill: getWarpSkillProfile('commander'),
            rng: mulberry32(game * 100 + index + 1),
          }),
        }));

        const result = playSelfPlayGame({
          seats,
          seed: 2000 + game * 997,
          maxSteps: 30000,
        });

        expect(result.steps).toBeLessThan(30000);
        expect(result.completedRounds).toBeGreaterThanOrEqual(1);
      }
    },
    120_000
  );

  it(
    'never finishes go-out with a null winner once the match completes',
    () => {
      for (let game = 0; game < 20; game++) {
        const result = playSelfPlayGame({
          seats: seatsAdvVsBeginner(game),
          seed: 5000 + game,
          objective: 'go-out',
        });
        if (result.completed) {
          expect(result.winnerId).not.toBeNull();
        }
      }
    },
    60_000
  );

  it(
    'completes Warp 9 Module Epsilon campaigns without losing Spacedock tiles',
    () => {
      // Regression: stall guard + incomplete draft recycle dropped pickedTiles,
      // then round 2 threw "Spacedock coordinate 8-8 is missing".
      const seats: SelfPlaySeat[] = ['p0', 'p1'].map((id, index) => ({
        id,
        player: createWarpAiPlayer({
          skill: getWarpSkillProfile('commander', 'points', 2),
          rng: mulberry32(9000 + index),
          objective: 'points',
        }),
      }));

      const result = playSelfPlayGame({
        seats,
        seed: 42,
        maxPip: 9,
        modules: { drafting: true },
        maxSteps: 30000,
      });

      expect(result.completed).toBe(true);
      expect(result.completedRounds).toBe(10);
    },
    30_000
  );
});
