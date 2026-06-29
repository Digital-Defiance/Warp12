import { searchActionValues } from 'doubletwelve';
import { applyAction } from '../engine/apply-action.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { createInitialTable } from '../table/table-state.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { DEFAULT_GAME_OBJECTIVE } from '../types/objective.js';

import { createWarpAiPlayer } from './create-warp-ai.js';
import { getWarpSkillProfile } from './skill.js';
import {
  createWarpSearchModel,
  observationToState,
} from './search-model.js';
import type { WarpAiObservation } from './observation.js';

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

function makeRound(over: Partial<RoundState>): RoundState {
  const base: RoundState = {
    roundNumber: 1,
    spacedockValue: 12,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder: [...TURN],
    table: createInitialTable([...TURN], 12, 'a'),
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

const TEST_CAPTAINS = [
  { id: 'a', displayName: 'Alpha', penaltyScore: 0 },
  { id: 'b', displayName: 'Beta', penaltyScore: 0 },
];

const obsFor = (round: RoundState): WarpAiObservation => ({
  round,
  playerId: 'a',
  modules: DEFAULT_MODULES,
  houseRules: DEFAULT_HOUSE_RULES,
  objective: DEFAULT_GAME_OBJECTIVE,
  campaignRounds: 13,
  captains: TEST_CAPTAINS,
});

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

describe('warp search model', () => {
  const model = createWarpSearchModel();

  it('values a going-out move decisively (gaming out the score)', () => {
    // Last tile in hand, playable on the open-12 trail → charting it wins.
    const round = makeRound({ hands: { a: [N(5, 12)], b: [N(1, 1)] } });
    const scored = searchActionValues(observationToState(obsFor(round)), model, {
      depth: 1,
      perspective: 'a',
      rng: mulberry32(1),
      determinizations: 1,
    });
    const best = Math.max(...scored.map((s) => s.value));
    expect(best).toBeGreaterThanOrEqual(10000);
  });

  it('does not hallucinate a win when more tiles remain', () => {
    const round = makeRound({ hands: { a: [N(5, 12), N(3, 11)], b: [N(1, 1)] } });
    const scored = searchActionValues(observationToState(obsFor(round)), model, {
      depth: 1,
      perspective: 'a',
      rng: mulberry32(1),
      determinizations: 1,
    });
    const best = Math.max(...scored.map((s) => s.value));
    expect(best).toBeLessThan(1000);
  });

  it('determinize keeps my hand and table, resampling opponents from the unseen pool', () => {
    const round = makeRound({
      hands: { a: [N(5, 12)], b: [N(2, 3), N(4, 4)] },
      unchartedSectors: [N(0, 0)],
    });
    const world = model.determinize!(
      observationToState(obsFor(round)),
      'a',
      mulberry32(9)
    );

    // My hand is untouched and the opponent's hand *count* is preserved...
    expect(world.round!.hands['a']).toEqual([N(5, 12)]);
    expect(world.round!.hands['b']).toHaveLength(2);

    // ...and opponents + pile partition the unseen pool (91 tiles, minus the
    // 12-12 spacedock and my 5-12 = 89), with no tile duplicated or leaked.
    const dealt = [...world.round!.hands['b'], ...world.round!.unchartedSectors];
    expect(world.round!.hands['b'].length + world.round!.unchartedSectors.length).toBe(89);
    const keys = new Set(dealt.map((c) => `${c.low}-${c.high}`));
    expect(keys.size).toBe(dealt.length);
    expect(keys.has('5-12')).toBe(false);
    expect(keys.has('12-12')).toBe(false);
  });
});

describe('createWarpAiPlayer with lookahead', () => {
  it('prefers going out when a winning move is available', () => {
    const round = makeRound({
      // Two legal plays: 5-12 empties the hand (win); 3-12 does not.
      hands: { a: [N(5, 12)], b: [N(1, 1)] },
    });
    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced'),
      lookahead: { depth: 2, determinizations: 4 },
      rng: mulberry32(2),
    });
    const action = player.decide(obsFor(round));
    expect(action.kind).toBe('chart');
  });

  it('returns only legal actions and is deterministic for a seed', () => {
    const state = buildGame(7);
    const round = state.round!;
    const obs: WarpAiObservation = {
      round,
      playerId: round.activePlayerId,
      modules: state.modules,
      objective: state.objective,
      campaignRounds: state.campaignRounds,
      captains: state.captains,
    };

    const make = () =>
      createWarpAiPlayer({
        skill: getWarpSkillProfile('advanced'),
        lookahead: { depth: 2, determinizations: 4, maxBranch: 5 },
        rng: mulberry32(123),
      });

    const a = make().decideGameAction(state, round.activePlayerId);
    const b = make().decideGameAction(state, round.activePlayerId);
    expect(a).toEqual(b);

    const result = applyAction(state, a!);
    expect(result.ok).toBe(true);
  });
});
