import { scoreRound } from '../engine/scoring.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { createInitialTable } from '../table/table-state.js';
import { normalizeCoordinate } from '../types/coordinate.js';
import type { RoundState } from '../types/game-state.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';

import {
  createWarpSearchModel,
  observationToState,
  warpLeafEvalGoOut,
  warpLeafEvalPenalty,
} from './search-model.js';
import type { WarpAiObservation } from './observation.js';
import { getWarpSkillProfile } from './skill.js';
import { createWarpAiPlayer } from './create-warp-ai.js';

const N = normalizeCoordinate;

function makeEndedRound(winnerId: string): RoundState {
  return {
    roundNumber: 1,
    spacedockValue: 12,
    phase: 'ended',
    activePlayerId: winnerId,
    turnOrder: ['a', 'b'],
    table: createInitialTable(['a', 'b'], 12, 'a'),
    unchartedSectors: [],
    hands: { a: [], b: [N(6, 6), N(3, 4)] },
    allStopRequired: false,
    allStopDeclared: true,
    roundWinnerId: winnerId,
    qPendingInvoker: null,
    qEffects: null,
    qGamblePending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
  };
}

describe('game objective', () => {
  it('go-out scoring ends the campaign after one round', () => {
    const captains = [
      { id: 'a', displayName: 'Alpha' },
      { id: 'b', displayName: 'Beta' },
    ];
    const shuffled = shuffleCoordinates(generateCoordinateSet(12), () => 0.5);
    const state = startGame(
      { id: 'go-out', captains, objective: 'go-out' },
      { shuffledCoordinates: shuffled }
    );

    const round = makeEndedRound('a');
    const result = scoreRound({ ...state, round }, round);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('complete');
      expect(result.state.completedRounds).toBe(1);
      expect(result.state.captains.every((c) => c.penaltyScore === 0)).toBe(
        true
      );
    }
  });

  it('search leaf eval prefers emptying hand in go-out mode', () => {
    const playing: WarpAiObservation = {
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'playing',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        table: createInitialTable(['a', 'b'], 12, 'a'),
        unchartedSectors: [],
        hands: {
          a: [N(5, 12)],
          b: [N(9, 9), N(8, 8), N(7, 7)],
        },
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        qPendingInvoker: null,
        qEffects: null,
        qGamblePending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
      },
      playerId: 'a',
      modules: DEFAULT_MODULES,
      houseRules: DEFAULT_HOUSE_RULES,
      objective: 'go-out',
      campaignRounds: 13,
      captains: [
        { id: 'a', displayName: 'Alpha', penaltyScore: 0 },
        { id: 'b', displayName: 'Beta', penaltyScore: 0 },
      ],
    };

    const ended: WarpAiObservation = {
      ...playing,
      round: {
        ...playing.round,
        phase: 'ended',
        roundWinnerId: 'a',
        hands: { a: [], b: [N(9, 9)] },
      },
    };

    const playingState = observationToState(playing);
    const endedState = observationToState(ended);

    expect(warpLeafEvalGoOut(playingState, 'a')).toBeGreaterThan(
      warpLeafEvalGoOut(playingState, 'b')
    );
    expect(warpLeafEvalGoOut(endedState, 'a')).toBeGreaterThan(9000);
  });

  it('penalty leaf eval still weights pip totals', () => {
    const obs: WarpAiObservation = {
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'playing',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        table: createInitialTable(['a', 'b'], 12, 'a'),
        unchartedSectors: [],
        hands: {
          a: [N(12, 12)],
          b: [N(0, 1)],
        },
        allStopRequired: false,
        allStopDeclared: false,
        roundWinnerId: null,
        qPendingInvoker: null,
        qEffects: null,
        qGamblePending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
      },
      playerId: 'a',
      modules: DEFAULT_MODULES,
      houseRules: DEFAULT_HOUSE_RULES,
      objective: 'penalty',
      campaignRounds: 13,
      captains: [
        { id: 'a', displayName: 'Alpha', penaltyScore: 0 },
        { id: 'b', displayName: 'Beta', penaltyScore: 0 },
      ],
    };

    const state = observationToState(obs);
    // Holding 12-12 is worse than holding 0-1 under penalty scoring.
    expect(warpLeafEvalPenalty(state, 'a')).toBeLessThan(
      warpLeafEvalPenalty(state, 'b')
    );
  });

  it('go-out skill profile enables go-out-win heuristic', () => {
    const profile = getWarpSkillProfile('advanced', 'go-out');
    expect(profile.enabled.has('go-out-win')).toBe(true);
    expect(profile.enabled.has('dump-pips')).toBe(false);
  });

  it('createWarpAiPlayer respects objective on observations from game state', () => {
    const captains = [{ id: 'a', displayName: 'A' }];
    const shuffled = shuffleCoordinates(generateCoordinateSet(12), () => 0.3);
    const state = startGame(
      { id: 'x', captains: [...captains, { id: 'b', displayName: 'B' }], objective: 'go-out' },
      { shuffledCoordinates: shuffled }
    );
    expect(state.objective).toBe('go-out');

    const player = createWarpAiPlayer({
      skill: getWarpSkillProfile('advanced', 'go-out'),
      objective: 'go-out',
      rng: () => 0,
    });
    expect(player.decideGameAction(state, state.round!.activePlayerId)).not.toBeNull();
  });

  it('createWarpSearchModel builds for each objective', () => {
    expect(createWarpSearchModel('penalty').evaluate).toBeDefined();
    expect(createWarpSearchModel('go-out').evaluate).toBeDefined();
  });
});
