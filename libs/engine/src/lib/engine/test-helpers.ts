import { createInitialTable } from '../table/table-state.js';
import {
  normalizeCoordinate,
  type Coordinate,
  type PlacedCoordinate,
} from '../types/coordinate.js';
import type { GameState, RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { resolveHouseRules } from '../types/house-rules.js';
import { resolveModules } from '../types/modules.js';

export const T = normalizeCoordinate;

export const DEFAULT_CAPTAINS = [
  { id: 'a', displayName: 'Alpha', pointsScore: 0 },
  { id: 'b', displayName: 'Beta', pointsScore: 0 },
  { id: 'c', displayName: 'Charlie', pointsScore: 0 },
] as const;

export function placed(
  coordinate: Coordinate,
  index: number,
  openValue: number
): PlacedCoordinate {
  return { coordinate, index, openValue };
}

/** Every unique tile in a double-twelve set that contains `pip`. */
export function allTilesWithPip(pip: number, maxPips = 12): Coordinate[] {
  const tiles: Coordinate[] = [];
  for (let other = 0; other <= maxPips; other++) {
    tiles.push(
      other <= pip ? T(other, pip) : T(pip, other)
    );
  }
  return tiles;
}

export function emptyRoundFields(): Pick<
  RoundState,
  | 'mandatoryPlay'
  | 'pendingRoundWin'
  | 'roundBlocked'
  | 'qPendingInvoker'
  | 'qEffects'
  | 'qGamblePending'
  | 'allStopRequired'
  | 'allStopDeclared'
  | 'roundWinnerId'
  | 'roundStarterOpening'
  | 'dropToImpulseCallPending'
  | 'dropToImpulseCatchable'
  | 'playedThisTurn'
  | 'drewThisTurn'
> {
  return {
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
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    playedThisTurn: false,
    drewThisTurn: false,
  };
}

export function makeRound(
  turnOrder: readonly PlayerId[],
  over: Partial<RoundState> = {}
): RoundState {
  const spacedockValue = over.spacedockValue ?? 12;
  const starter = over.activePlayerId ?? turnOrder[0];
  return {
    roundNumber: over.roundNumber ?? 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: starter,
    turnOrder: [...turnOrder],
    table: createInitialTable([...turnOrder], spacedockValue, starter),
    unchartedSectors: [],
    hands: Object.fromEntries(turnOrder.map((id) => [id, []])),
    ...emptyRoundFields(),
    ...over,
  };
}

export function makeGame(
  round: RoundState,
  over: Partial<GameState> = {}
): GameState {
  return {
    id: 'test',
    phase: 'active',
    objective: 'points',
    campaignRounds: 13,
    completedRounds: 0,
    captains: DEFAULT_CAPTAINS.map((c) => ({ ...c })),
    modules: resolveModules({
      qContinuum: false,
      salamanderPenalty: false,
      subspaceFracture: false,
    }),
    houseRules: resolveHouseRules(),
    round,
    ...over,
  };
}

/** Spread charted tiles across trails and neutral zone for table setup. */
export function chartTilesOnTable(
  round: RoundState,
  tiles: readonly Coordinate[],
  hostPlayerId: PlayerId = round.turnOrder[0]
): RoundState['table'] {
  const table = { ...round.table };
  let index = 0;
  const trailIds = round.turnOrder;

  for (const tile of tiles) {
    const owner = trailIds[index % trailIds.length];
    const trail = table.warpTrails[owner];
    const connecting =
      trail.tiles.length === 0
        ? round.spacedockValue
        : trail.tiles.at(-1)!.openValue;
    const openValue = tile.low === connecting ? tile.high : tile.low;
    table.warpTrails = {
      ...table.warpTrails,
      [owner]: {
        ...trail,
        tiles: [
          ...trail.tiles,
          placed(tile, trail.tiles.length, openValue),
        ],
      },
    };
    index++;
  }

  if (hostPlayerId !== round.table.spacedock.placedBy) {
    table.spacedock = { ...table.spacedock, placedBy: hostPlayerId };
  }

  return table;
}
