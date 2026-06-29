import { applyAction, getLegalMoves } from '../engine/apply-action.js';
import { isLegalMove } from '../engine/legal-moves.js';
import { scoreRound } from '../engine/scoring.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { createInitialTable } from '../table/table-state.js';
import {
  coordinateKey,
  coordinatesEqual,
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import type { ChartRoute } from '../types/actions.js';
import type { GameState, RoundState, TableState } from '../types/game-state.js';
import { DEFAULT_MODULES, resolveModules } from '../types/modules.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_GAME_OBJECTIVE, type GameObjective } from '../types/objective.js';

import { createWarpAiPlayer, type WarpAiPlayer } from './create-warp-ai.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import {
  DEFAULT_WARP_HEURISTICS,
  WARP_HEURISTIC_IDS,
  type WarpHeuristic,
} from './heuristics.js';
import { WARP_SKILL_PRESETS, getWarpSkillProfile } from './skill.js';
import type { WarpAiObservation } from './observation.js';

// ---------------------------------------------------------------------------
// Deterministic RNG + small builders
// ---------------------------------------------------------------------------

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

const N = normalizeCoordinate;
const TURN = ['a', 'b'] as const;

const TEST_CAPTAINS = [
  { id: 'a', displayName: 'Alpha', penaltyScore: 0 },
  { id: 'b', displayName: 'Beta', penaltyScore: 0 },
];

function makeRound(over: Partial<RoundState>): RoundState {
  const spacedockValue = over.spacedockValue ?? 12;
  const base: RoundState = {
    roundNumber: 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: [...TURN],
    table: createInitialTable([...TURN], spacedockValue, 'a'),
    unchartedSectors: [],
    hands: { a: [], b: [] },
    dropToImpulseRequired: false,
    dropToImpulseDeclared: false,
    roundWinnerId: null,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
  };
  return { ...base, ...over };
}

function tableWithNeutralOpen(value: number): TableState {
  const base = createInitialTable([...TURN], 12, 'a');
  return {
    ...base,
    neutralZone: {
      tiles: [{ coordinate: N(value, 12), index: 0, openValue: value }],
    },
  };
}

function tableWithOwnTrailOpen(value: number): TableState {
  const base = createInitialTable([...TURN], 12, 'a');
  return {
    ...base,
    warpTrails: {
      ...base.warpTrails,
      a: {
        playerId: 'a',
        tiles: [{ coordinate: N(value, 12), index: 0, openValue: value }],
        distressBeacon: { active: false },
      },
    },
  };
}

function obsFor(
  round: RoundState,
  modules = DEFAULT_MODULES,
  objective: GameObjective = 'penalty'
): WarpAiObservation {
  return {
    round,
    playerId: 'a',
    modules,
    houseRules: DEFAULT_HOUSE_RULES,
    objective,
    campaignRounds: 13,
    captains: TEST_CAPTAINS,
  };
}

function routeKey(route: ChartRoute): string {
  switch (route.kind) {
    case 'warp-trail':
      return `warp:${route.playerId}`;
    case 'red-alert-cover':
      return `cover:${route.trailPlayerId}`;
    default:
      return route.kind;
  }
}

function actionKey(action: WarpAiAction): string {
  return action.kind === 'chart'
    ? `chart:${coordinateKey(action.move.coordinate)}:${routeKey(action.move.route)}`
    : action.kind;
}

const isChartOf = (target: Coordinate) => (action: WarpAiAction): boolean =>
  action.kind === 'chart' && coordinatesEqual(action.move.coordinate, target);

function rate(
  player: WarpAiPlayer,
  obs: WarpAiObservation,
  predicate: (action: WarpAiAction) => boolean,
  trials = 400
): number {
  let hits = 0;
  for (let i = 0; i < trials; i++) {
    if (predicate(player.decide(obs))) hits++;
  }
  return hits / trials;
}

// A full, real, seeded game used by integration tests.
const CAPTAINS = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
  { id: 'c', displayName: 'Gamma' },
  { id: 'd', displayName: 'Delta' },
];

function buildGame(seed: number): GameState {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    mulberry32(seed)
  );
  return startGame({ id: 'sim', captains: CAPTAINS }, { shuffledCoordinates: shuffled });
}

// ---------------------------------------------------------------------------

describe('warpCandidateGenerator', () => {
  it('only proposes engine-legal chart moves', () => {
    const state = buildGame(7);
    const round = state.round!;
    const playerId = round.activePlayerId;
    const candidates = warpCandidateGenerator({
      round,
      playerId,
      modules: state.modules,
      objective: state.objective,
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      if (candidate.kind !== 'chart') continue;
      expect(
        isLegalMove(
          round,
          playerId,
          candidate.move.coordinate,
          candidate.move.route
        )
      ).toBe(true);
    }
  });

  it('returns one chart candidate per legal move when plays exist', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(9, 12)], b: [] } });
    const candidates = warpCandidateGenerator(obsFor(round));
    const moves = getLegalMoves(round, 'a');
    expect(candidates).toHaveLength(moves.length);
    expect(candidates.every((c) => c.kind === 'chart')).toBe(true);
  });

  it('falls back to drawing when nothing is playable and the pile has tiles', () => {
    const round = makeRound({
      hands: { a: [N(1, 2)], b: [] },
      unchartedSectors: [N(3, 4)],
    });
    expect(getLegalMoves(round, 'a')).toHaveLength(0);
    expect(warpCandidateGenerator(obsFor(round))).toEqual([{ kind: 'draw' }]);
  });

  it('deploys a beacon when stuck and the pile is empty', () => {
    const round = makeRound({
      hands: { a: [N(1, 2)], b: [] },
      unchartedSectors: [],
    });
    expect(warpCandidateGenerator(obsFor(round))).toEqual([
      { kind: 'deploy-beacon' },
    ]);
  });

  it('forces the round winner to drop to impulse when required', () => {
    const round = makeRound({
      hands: { a: [N(1, 2)], b: [] },
      dropToImpulseRequired: true,
      dropToImpulseDeclared: false,
      roundWinnerId: 'a',
    });
    expect(warpCandidateGenerator(obsFor(round))).toEqual([
      { kind: 'drop-to-impulse' },
    ]);
  });
});

describe('toGameAction', () => {
  it('lowers every AI action kind to its engine action', () => {
    expect(
      toGameAction({ kind: 'chart', move: { coordinate: N(5, 12), route: { kind: 'neutral-zone' } } }, 'a')
    ).toEqual({
      type: 'CHART_COORDINATE',
      playerId: 'a',
      coordinate: N(5, 12),
      route: { kind: 'neutral-zone' },
    });
    expect(toGameAction({ kind: 'draw' }, 'a')).toEqual({
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'a',
    });
    expect(toGameAction({ kind: 'deploy-beacon' }, 'a')).toEqual({
      type: 'DEPLOY_DISTRESS_BEACON',
      playerId: 'a',
    });
    expect(toGameAction({ kind: 'pass-red-alert' }, 'a')).toEqual({
      type: 'PASS_RED_ALERT',
      playerId: 'a',
    });
    expect(toGameAction({ kind: 'drop-to-impulse' }, 'a')).toEqual({
      type: 'DROP_TO_IMPULSE',
      playerId: 'a',
    });
  });
});

describe('createWarpAiPlayer — skill spectrum', () => {
  // Two legal plays differing only in pip weight: 9-12 (21) vs 5-12 (17).
  const round = makeRound({ hands: { a: [N(5, 12), N(9, 12)], b: [] } });
  const heavy = N(9, 12);

  it('advanced almost always dumps the heavier tile; beginner is erratic', () => {
    const advanced = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(11),
    });
    const beginner = createWarpAiPlayer({
      skill: getWarpSkillProfile('beginner'),
      rng: mulberry32(11),
    });

    const advancedHeavy = rate(advanced, obsFor(round), isChartOf(heavy));
    const beginnerHeavy = rate(beginner, obsFor(round), isChartOf(heavy));

    expect(advancedHeavy).toBeGreaterThan(0.95);
    expect(advancedHeavy).toBeGreaterThan(beginnerHeavy + 0.2);
  });

  it('every decision is one of the generated candidates', () => {
    const advanced = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(3),
    });
    const legal = new Set(
      warpCandidateGenerator(obsFor(round)).map(actionKey)
    );
    for (let i = 0; i < 200; i++) {
      expect(legal.has(actionKey(advanced.decide(obsFor(round))))).toBe(true);
    }
  });
});

describe('createWarpAiPlayer — RULES.md tactics', () => {
  it('advanced avoids triggering a Red Alert it cannot cover', () => {
    // Own trail open at 12; only 12-matcher is the 12-12 double itself (no cover).
    // A safe 4-7 play exists on the Neutral Zone (open at 4).
    const round = makeRound({
      table: tableWithNeutralOpen(4),
      hands: { a: [N(12, 12), N(4, 7)], b: [] },
    });
    const danger = N(12, 12);

    const advanced = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(21),
    });
    const beginner = createWarpAiPlayer({
      skill: getWarpSkillProfile('beginner'),
      rng: mulberry32(21),
    });

    const advancedDanger = rate(advanced, obsFor(round), isChartOf(danger));
    const beginnerDanger = rate(beginner, obsFor(round), isChartOf(danger));

    expect(advancedDanger).toBeLessThan(0.05);
    expect(beginnerDanger).toBeGreaterThan(0.4);
  });

  it('Salamander dump heuristic applies from round 2 onward', () => {
    const salamander = DEFAULT_WARP_HEURISTICS.find(
      (heuristic) => heuristic.id === WARP_HEURISTIC_IDS.salamanderDump
    )!;
    const action: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: N(12, 12),
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    };
    const modules = resolveModules({ salamanderPenalty: true });
    const round1 = makeRound({ hands: { a: [N(12, 12)], b: [] } });
    const round2 = makeRound({
      roundNumber: 2,
      spacedockValue: 11,
      hands: { a: [N(12, 12)], b: [] },
    });
    const ctx = (round: ReturnType<typeof makeRound>) => ({
      obs: obsFor(round, modules),
      hand: round.hands.a ?? [],
      unseen: [] as Coordinate[],
      rng: mulberry32(1),
    });

    expect(salamander.score(action, ctx(round1))).toBe(0);
    expect(salamander.score(action, ctx(round2))).toBe(50);
  });

  it('Q-Continuum module makes advanced value playing the 0-0', () => {
    // Own trail open at 0: 0-0 (0 pips, normally ignored) vs 0-9 (9 pips).
    const round = makeRound({
      table: tableWithOwnTrailOpen(0),
      hands: { a: [N(0, 0), N(0, 9)], b: [] },
    });
    const qFlash = N(0, 0);

    const withModule = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(44),
    });
    const without = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(44),
    });

    const enabledRate = rate(
      withModule,
      obsFor(round, resolveModules({ qContinuum: true })),
      isChartOf(qFlash)
    );
    const disabledRate = rate(
      without,
      obsFor(round, DEFAULT_MODULES),
      isChartOf(qFlash)
    );

    expect(enabledRate).toBeGreaterThan(0.95);
    expect(disabledRate).toBeLessThan(0.05);
  });
});

describe('createWarpAiPlayer — control flow & determinism', () => {
  it('drops to impulse through decideGameAction when obligated', () => {
    const round = makeRound({
      hands: { a: [N(1, 2)], b: [] },
      dropToImpulseRequired: true,
      roundWinnerId: 'a',
    });
    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      rng: mulberry32(1),
    });
    expect(player.decide(obsFor(round)).kind).toBe('drop-to-impulse');
  });

  it('decideGameAction returns null when there is no active round', () => {
    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('beginner'),
      rng: mulberry32(1),
    });
    const noRound: GameState = {
      id: 'x',
      phase: 'lobby',
      captains: [],
      round: null,
      completedRounds: 0,
      modules: DEFAULT_MODULES,
      objective: 'penalty',
    };
    expect(player.decideGameAction(noRound, 'a')).toBeNull();
  });

  it('produces identical decisions for identical seeds', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(9, 12)], b: [] } });
    const decisions = (): string[] => {
      const player = createWarpAiPlayer({
        skill: getWarpSkillProfile('intermediate'),
        rng: mulberry32(2024),
      });
      return Array.from({ length: 15 }, () =>
        actionKey(player.decide(obsFor(round)))
      );
    };
    expect(decisions()).toEqual(decisions());
  });
});

describe('createWarpAiPlayer — extensibility', () => {
  it('honors an injected custom heuristic that reshapes preferences', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(9, 12)], b: [] } });

    const forceNeutral: WarpHeuristic = {
      id: 'force-neutral',
      score: (action) =>
        action.kind === 'chart' && action.move.route.kind === 'neutral-zone'
          ? 1000
          : 0,
    };

    const base = WARP_SKILL_PRESETS.advanced;
    const player = createWarpAiPlayer({
      skill: {
        ...base,
        enabled: new Set([...base.enabled, forceNeutral.id]),
        weights: { ...base.weights, [forceNeutral.id]: 1 },
      },
      heuristics: [...DEFAULT_WARP_HEURISTICS, forceNeutral],
      rng: mulberry32(9),
    });

    const action = player.decide(obsFor(round));
    expect(action.kind).toBe('chart');
    if (action.kind === 'chart') {
      expect(action.move.route.kind).toBe('neutral-zone');
    }
  });

  it('accepts a custom candidate generator (house rules)', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(9, 12)], b: [] } });
    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      generateCandidates: () => [{ kind: 'draw' }],
      rng: mulberry32(1),
    });
    expect(player.decide(obsFor(round))).toEqual({ kind: 'draw' });
  });
});

describe('createWarpAiPlayer — full self-play integration', () => {
  it('drives a complete 4-captain game with only legal actions', () => {
    let state = buildGame(7);
    const players: Record<string, WarpAiPlayer> = {};
    CAPTAINS.forEach((captain, index) => {
      players[captain.id] = createWarpAiPlayer({
        skill: getWarpSkillProfile('advanced'),
        rng: mulberry32(100 + index),
      });
    });

    let steps = 0;
    while (state.phase === 'active' && steps++ < 20000) {
      const round = state.round!;

      if (round.phase === 'ended') {
        // Rounds are tallied via scoreRound (the engine gates out END_ROUND
        // once a round has ended); this advances to the next round or finishes.
        const result = scoreRound(state, round);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        state = result.state;
        continue;
      }

      const playerId = round.activePlayerId;
      const action = players[playerId].decideGameAction(state, playerId);
      expect(action).not.toBeNull();
      const result = applyAction(state, action!);
      if (!result.ok) {
        throw new Error(
          `illegal AI action at step ${steps}: ${JSON.stringify(action)} -> ${result.violation}`
        );
      }
      expect(result.ok).toBe(true);
      state = result.state;
    }

    expect(state.completedRounds).toBeGreaterThanOrEqual(1);
  });
});
