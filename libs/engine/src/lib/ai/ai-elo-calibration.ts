import type { GameObjective } from '../types/objective.js';
import type { HouseRulesConfig } from '../types/house-rules.js';
import { createWarpAiPlayer } from './create-warp-ai.js';
import { getWarpSkillProfile, resolveWarpLookahead, type WarpSkillLevel, type WarpTableRole } from './skill.js';
import { playSelfPlayGame, runSelfPlayMatch, type SelfPlaySeat } from './self-play.js';

/** Mirrors apps/Warp12 stats-elo AI_OPPONENT_ELO — keep in sync when tuning. */
export const REFERENCE_AI_ELO: Record<WarpSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1200,
  commander: 1400,
};

/** Wider spacing for go-out races (higher variance than points). */
export const GO_OUT_REFERENCE_AI_ELO: Record<WarpSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1250,
  commander: 1500,
};

export function referenceEloForObjective(
  objective: GameObjective
): Record<WarpSkillLevel, number> {
  return objective === 'go-out' ? GO_OUT_REFERENCE_AI_ELO : REFERENCE_AI_ELO;
}

/**
 * Calibration roadmap (see repo todos: readme-elo, paper-elo, elo-per-players):
 * - README: ELO tracks, advisor exclusion, how self-play validates tier ratings
 * - Per player-count (2–8): tune presets so implied ΔELO matches targets at each table size
 * - Optional write-up on ELO-feedback-driven AI skill tiers
 */

export const AI_SKILL_LEVELS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

export type SkillMatchup = readonly [WarpSkillLevel, WarpSkillLevel];

export const SKILL_MATCHUPS: readonly SkillMatchup[] = [
  ['ensign', 'ensign'],
  ['lieutenant', 'lieutenant'],
  ['commander', 'commander'],
  ['ensign', 'lieutenant'],
  ['ensign', 'commander'],
  ['lieutenant', 'commander'],
];

export interface SkillMatchupResult {
  objective: GameObjective;
  left: WarpSkillLevel;
  right: WarpSkillLevel;
  games: number;
  completed: number;
  wins: Record<string, number>;
  /** First-seat win rate for symmetric same-skill matchups. */
  seatAWinRate: number | null;
  /** Win rate for the higher-rated skill (asymmetric matchups only). */
  higherSkillWinRate: number | null;
  /** Implied ELO gap from observed higher-skill win rate. */
  impliedEloGap: number | null;
  /** Expected higher-skill win rate from REFERENCE_AI_ELO spacing. */
  expectedHigherSkillWinRate: number | null;
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

function seatRng(game: number, seat: number, seed: number): () => number {
  return mulberry32(seed + game * 31 + seat);
}

export function expectedWinRate(playerElo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

export function impliedEloGap(higherSkillWinRate: number): number {
  if (higherSkillWinRate <= 0 || higherSkillWinRate >= 1) {
    return Number.NaN;
  }
  return 400 * Math.log10(higherSkillWinRate / (1 - higherSkillWinRate));
}

function skillRank(skill: WarpSkillLevel, objective: GameObjective): number {
  return referenceEloForObjective(objective)[skill];
}

function makeSeat(
  skill: WarpSkillLevel,
  id: string,
  objective: GameObjective,
  game: number,
  seatIndex: number,
  seed: number,
  playerCount: number,
  tableRole?: WarpTableRole
): SelfPlaySeat {
  return {
    id,
    displayName: skill,
    player: createWarpAiPlayer({
      skill: getWarpSkillProfile(skill, objective, playerCount, tableRole),
      objective,
      lookahead: resolveWarpLookahead(skill, objective, playerCount),
      rng: seatRng(game, seatIndex + 1, seed),
    }),
  };
}

export function makeHeadToHeadSeats(
  left: WarpSkillLevel,
  right: WarpSkillLevel,
  objective: GameObjective,
  game: number,
  seed: number
): SelfPlaySeat[] {
  const playerCount = 2;
  const leftId = left === right ? 'a' : left;
  const rightId = left === right ? 'b' : right;
  const specs =
    game % 2 === 0
      ? [
          { skill: left, id: leftId },
          { skill: right, id: rightId },
        ]
      : [
          { skill: right, id: rightId },
          { skill: left, id: leftId },
        ];

  return specs.map((spec, index) =>
    makeSeat(spec.skill, spec.id, objective, game, index, seed, playerCount)
  );
}

export interface CalibrationRunOptions {
  games: number;
  objective: GameObjective;
  seed?: number;
  houseRules?: HouseRulesConfig;
}

export function runSkillMatchup(
  left: WarpSkillLevel,
  right: WarpSkillLevel,
  options: CalibrationRunOptions
): SkillMatchupResult {
  const seed = options.seed ?? 4242;
  const match = runSelfPlayMatch(
    (game) => makeHeadToHeadSeats(left, right, options.objective, game, seed),
    {
      games: options.games,
      seed,
      objective: options.objective,
      houseRules: options.houseRules,
    }
  );

  const wins = { ...match.wins };

  const leftRank = skillRank(left, options.objective);
  const rightRank = skillRank(right, options.objective);
  const symmetric = leftRank === rightRank;

  let seatAWinRate: number | null = null;
  let higherSkillWinRate: number | null = null;
  let impliedGap: number | null = null;
  let expectedHigherSkillWinRate: number | null = null;

  if (symmetric && match.completed > 0) {
    const decisive = (wins.a ?? 0) + (wins.b ?? 0);
    seatAWinRate = decisive > 0 ? (wins.a ?? 0) / decisive : null;
  } else if (!symmetric && match.completed > 0) {
    const higher = leftRank > rightRank ? left : right;
    const lower = leftRank > rightRank ? right : left;
    higherSkillWinRate = (wins[higher] ?? 0) / match.completed;
    impliedGap = impliedEloGap(higherSkillWinRate);
    const reference = referenceEloForObjective(options.objective);
    expectedHigherSkillWinRate = expectedWinRate(
      reference[lower],
      reference[higher]
    );
  }

  return {
    objective: options.objective,
    left,
    right,
    games: options.games,
    completed: match.completed,
    wins,
    seatAWinRate,
    higherSkillWinRate,
    impliedEloGap: impliedGap,
    expectedHigherSkillWinRate,
  };
}

export function runCalibrationMatrix(
  options: CalibrationRunOptions
): SkillMatchupResult[] {
  return SKILL_MATCHUPS.map(([left, right]) =>
    runSkillMatchup(left, right, options)
  );
}

export const CALIBRATION_PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
export type CalibrationPlayerCount = (typeof CALIBRATION_PLAYER_COUNTS)[number];

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index}`);
}

/** One captain at `focus` skill vs the rest at `opponents` — rotates focus seat each game. */
export function makeFocusSeats(
  playerCount: number,
  focus: WarpSkillLevel,
  opponents: WarpSkillLevel,
  objective: GameObjective,
  game: number,
  seed: number
): SelfPlaySeat[] {
  const ids = playerIds(playerCount);
  const focusIndex = game % playerCount;
  return ids.map((id, index) =>
    makeSeat(
      index === focusIndex ? focus : opponents,
      id,
      objective,
      game,
      index,
      seed,
      playerCount,
      index === focusIndex ? 'focus' : 'opponent'
    )
  );
}

/** One captain at `focus` skill vs three at `opponents` — rotates focus seat each game. */
export function makeFourPlayerFocusSeats(
  focus: WarpSkillLevel,
  opponents: WarpSkillLevel,
  objective: GameObjective,
  game: number,
  seed: number
): SelfPlaySeat[] {
  return makeFocusSeats(4, focus, opponents, objective, game, seed);
}

export interface FocusMatchupResult {
  objective: GameObjective;
  playerCount: number;
  focus: WarpSkillLevel;
  opponents: WarpSkillLevel;
  games: number;
  completed: number;
  focusWins: number;
  focusWinRate: number;
}

export type FourPlayerFocusResult = FocusMatchupResult;

export function runFocusMatchup(
  playerCount: number,
  focus: WarpSkillLevel,
  opponents: WarpSkillLevel,
  options: CalibrationRunOptions
): FocusMatchupResult {
  const seed = options.seed ?? 4242;
  const ids = playerIds(playerCount);
  let completed = 0;
  let focusWins = 0;

  for (let game = 0; game < options.games; game++) {
    const seats = makeFocusSeats(
      playerCount,
      focus,
      opponents,
      options.objective,
      game,
      seed
    );
    const result = playSelfPlayGame({
      seats,
      seed: seed + game * 7919,
      objective: options.objective,
      houseRules: options.houseRules,
      maxSteps: 40000 + playerCount * 5000,
    });
    if (!result.completed || !result.winnerId) {
      continue;
    }
    completed++;
    const focusId = ids[game % playerCount];
    if (result.winnerId === focusId) {
      focusWins++;
    }
  }

  return {
    objective: options.objective,
    playerCount,
    focus,
    opponents,
    games: options.games,
    completed,
    focusWins,
    focusWinRate: completed > 0 ? focusWins / completed : 0,
  };
}

export function runFourPlayerFocusMatchup(
  focus: WarpSkillLevel,
  opponents: WarpSkillLevel,
  options: CalibrationRunOptions
): FourPlayerFocusResult {
  return runFocusMatchup(4, focus, opponents, options);
}

export function formatFocusMatchupResult(result: FocusMatchupResult): string {
  const rate = (result.focusWinRate * 100).toFixed(1);
  const randomBaseline = ((1 / result.playerCount) * 100).toFixed(1);
  return `${result.focus} vs ${result.playerCount - 1}× ${result.opponents} (${result.objective}, ${result.playerCount}p): focus wins ${result.focusWins}/${result.completed} (${rate}%, random ${randomBaseline}%)`;
}

export function formatFourPlayerFocusResult(result: FourPlayerFocusResult): string {
  return formatFocusMatchupResult(result);
}

export function formatMatchupResult(result: SkillMatchupResult): string {
  const label = `${result.left} vs ${result.right} (${result.objective})`;
  if (result.left === result.right) {
    const winsA = result.wins.a ?? 0;
    const winsB = result.wins.b ?? 0;
    const decisive = winsA + winsB;
    const rate =
      result.seatAWinRate !== null
        ? (result.seatAWinRate * 100).toFixed(1)
        : '—';
    return `${label}: seat-a wins ${winsA}/${decisive} (${rate}%)`;
  }

  const higher =
    skillRank(result.left, result.objective) >= skillRank(result.right, result.objective)
      ? result.left
      : result.right;
  const wins = result.wins[higher] ?? 0;
  const rate =
    result.completed > 0 ? ((wins / result.completed) * 100).toFixed(1) : '—';
  const expectedHigher =
    result.expectedHigherSkillWinRate !== null
      ? ((1 - result.expectedHigherSkillWinRate) * 100).toFixed(1)
      : '—';
  const gap =
    result.impliedEloGap !== null && Number.isFinite(result.impliedEloGap)
      ? Math.round(result.impliedEloGap)
      : '—';

  return `${label}: ${higher} wins ${wins}/${result.completed} (${rate}%, implied ΔELO ${gap}, expected ${expectedHigher}%)`;
}
