import { createInitialTable } from '../table/table-state.js';
import {
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import type { RoundState, TableState } from '../types/game-state.js';
import { DEFAULT_MODULES, resolveModules, type GameModules } from '../types/modules.js';
import { DEFAULT_HOUSE_RULES, resolveHouseRules } from '../types/house-rules.js';
import { DEFAULT_GAME_OBJECTIVE, type GameObjective } from '../types/objective.js';
import { DEFAULT_CAMPAIGN_ROUNDS } from '../constants/setup.js';
import type { WarpAiObservation } from './observation.js';

export const N = normalizeCoordinate;

export const TURN = ['a', 'b'] as const;

export const TEST_CAPTAINS = [
  { id: 'a', displayName: 'Alpha', pointsScore: 0 },
  { id: 'b', displayName: 'Beta', pointsScore: 0 },
  { id: 'c', displayName: 'Charlie', pointsScore: 0 },
];

export function makeRound(over: Partial<RoundState>): RoundState {
  const spacedockValue = over.spacedockValue ?? 12;
  const turnOrder = over.turnOrder ?? [...TURN];
  const base: RoundState = {
    roundNumber: 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: 'a',
    turnOrder,
    table: createInitialTable([...turnOrder], spacedockValue, 'a'),
    unchartedSectors: [],
    hands: Object.fromEntries(turnOrder.map((id) => [id, []])),
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
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
    playedThisTurn: false,
    drewThisTurn: false,
  };
  return { ...base, ...over };
}

export function tableWithNeutralOpen(value: number): TableState {
  const base = createInitialTable([...TURN], 12, 'a');
  return {
    ...base,
    neutralZone: {
      tiles: [{ coordinate: N(value, 12), index: 0, openValue: value }],
    },
  };
}

export function tableWithOwnTrail(
  playerId: string,
  trailTile: Coordinate,
  openValue: number
): TableState {
  const base = createInitialTable([...TURN], 12, 'a');
  return {
    ...base,
    warpTrails: {
      ...base.warpTrails,
      [playerId]: {
        playerId,
        tiles: [{ coordinate: trailTile, index: 0, openValue }],
        distressBeacon: { active: false },
      },
    },
  };
}

export function obsFor(
  round: RoundState,
  modules: GameModules = DEFAULT_MODULES,
  objective: GameObjective = DEFAULT_GAME_OBJECTIVE,
  playerId = 'a',
  campaignRounds = DEFAULT_CAMPAIGN_ROUNDS
): WarpAiObservation {
  return {
    round,
    playerId,
    modules,
    houseRules: DEFAULT_HOUSE_RULES,
    objective,
    campaignRounds,
    captains: TEST_CAPTAINS,
  };
}

export function modulesWithQ(): GameModules {
  return resolveModules({ qContinuum: true, salamanderPenalty: true });
}

export const IMPULSE_HOUSE_RULES = resolveHouseRules({ dropToImpulseCall: true });

export function impulseObsFor(
  round: RoundState,
  modules: GameModules = DEFAULT_MODULES,
  objective: GameObjective = DEFAULT_GAME_OBJECTIVE,
  playerId = 'a',
  campaignRounds = DEFAULT_CAMPAIGN_ROUNDS
): WarpAiObservation {
  return {
    ...obsFor(round, modules, objective, playerId, campaignRounds),
    houseRules: IMPULSE_HOUSE_RULES,
  };
}
