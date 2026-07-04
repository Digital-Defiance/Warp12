import { handSizeForPlayerCount, spacedockValueForRound, DEFAULT_CAMPAIGN_ROUNDS, clampCampaignRounds } from '../constants/setup.js';
import {
  coordinateKey,
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import { createInitialTable } from '../table/table-state.js';
import type { CreateGameInput, GameState, RoundState } from '../types/game-state.js';
import type { Captain, PlayerId } from '../types/player.js';
import { DEFAULT_GAME_OBJECTIVE } from '../types/objective.js';
import { resolveModules } from '../types/modules.js';
import { resolveHouseRules } from '../types/house-rules.js';

export function createCaptain(
  id: string,
  displayName: string
): Captain {
  return { id, displayName, pointsScore: 0 };
}

export function createLobbyState(input: CreateGameInput): GameState {
  return {
    id: input.id,
    phase: 'lobby',
    captains: input.captains.map((c) => createCaptain(c.id, c.displayName)),
    round: null,
    completedRounds: 0,
    modules: resolveModules(input.modules),
    houseRules: resolveHouseRules(input.houseRules),
    objective: input.objective ?? DEFAULT_GAME_OBJECTIVE,
    campaignRounds: clampCampaignRounds(
      input.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS
    ),
  };
}

export interface RoundDealResult {
  readonly roundNumber: number;
  readonly captains: readonly Captain[];
  readonly turnOrder: readonly PlayerId[];
  readonly spacedockValue: number;
  readonly spacedockPlacedBy: PlayerId;
  readonly hands: Readonly<Record<PlayerId, readonly Coordinate[]>>;
  readonly unchartedSectors: readonly Coordinate[];
}

/** Round starter rotates clockwise through turn order (standard Mexican Train). */
export function roundStarterForRound(
  turnOrder: readonly PlayerId[],
  roundNumber: number
): PlayerId {
  if (turnOrder.length === 0) {
    throw new RangeError('Turn order must include at least one captain.');
  }
  return turnOrder[(roundNumber - 1) % turnOrder.length];
}

/**
 * Deal a round per standard Mexican Train setup: set aside the round Spacedock
 * double before dealing hands; remaining tiles form Uncharted Sectors.
 */
export function dealRoundFromShuffled(input: {
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly roundNumber: number;
  readonly captains: readonly Captain[];
  readonly turnOrder: readonly PlayerId[];
  readonly roundStarterId?: PlayerId;
}): RoundDealResult {
  const spacedockValue = spacedockValueForRound(input.roundNumber);
  const spacedockCoordinate = normalizeCoordinate(
    spacedockValue,
    spacedockValue
  );
  const spacedockKey = coordinateKey(spacedockCoordinate);
  const pile = [...input.shuffledCoordinates];

  const spacedockIndex = pile.findIndex(
    (coordinate) => coordinateKey(coordinate) === spacedockKey
  );
  if (spacedockIndex === -1) {
    throw new Error(
      `Spacedock coordinate ${spacedockKey} is missing from the shuffled set.`
    );
  }
  pile.splice(spacedockIndex, 1);

  const handSize = handSizeForPlayerCount(input.captains.length);
  const hands: Record<string, Coordinate[]> = {};

  for (const captain of input.captains) {
    hands[captain.id] = pile.splice(0, handSize);
  }

  const spacedockPlacedBy =
    input.roundStarterId ??
    roundStarterForRound(input.turnOrder, input.roundNumber);

  return {
    roundNumber: input.roundNumber,
    captains: input.captains,
    turnOrder: input.turnOrder,
    spacedockValue,
    spacedockPlacedBy,
    hands,
    unchartedSectors: pile,
  };
}

export function createRoundStateFromDeal(deal: RoundDealResult): RoundState {
  return {
    roundNumber: deal.roundNumber,
    spacedockValue: deal.spacedockValue,
    phase: 'playing',
    activePlayerId: deal.spacedockPlacedBy,
    turnOrder: deal.turnOrder,
    table: createInitialTable(
      deal.turnOrder,
      deal.spacedockValue,
      deal.spacedockPlacedBy
    ),
    unchartedSectors: [...deal.unchartedSectors],
    hands: { ...deal.hands },
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

/** @deprecated Use dealRoundFromShuffled — Spacedock is set aside before dealing. */
export interface DealRoundInput {
  roundNumber: number;
  captains: readonly Captain[];
  shuffledCoordinates: readonly Coordinate[];
  spacedockPlacedBy: PlayerId;
  turnOrder: readonly PlayerId[];
  table: ReturnType<typeof createInitialTable>;
}

/** @deprecated Use dealRoundFromShuffled + createRoundStateFromDeal. */
export function createRoundState(input: DealRoundInput): RoundState {
  const deal = dealRoundFromShuffled({
    shuffledCoordinates: input.shuffledCoordinates,
    roundNumber: input.roundNumber,
    captains: input.captains,
    turnOrder: input.turnOrder,
    roundStarterId: input.spacedockPlacedBy,
  });
  return createRoundStateFromDeal(deal);
}

export interface StartGameInput {
  shuffledCoordinates: readonly Coordinate[];
  /** Round-one starter; defaults to the first captain in turn order. */
  roundStarterId?: PlayerId;
}

export function startGame(
  input: CreateGameInput,
  deal: StartGameInput
): GameState {
  const lobby = createLobbyState(input);
  const turnOrder = lobby.captains.map((c) => c.id);
  const roundDeal = dealRoundFromShuffled({
    shuffledCoordinates: deal.shuffledCoordinates,
    roundNumber: 1,
    captains: lobby.captains,
    turnOrder,
    roundStarterId: deal.roundStarterId,
  });

  return {
    ...lobby,
    phase: 'active',
    round: createRoundStateFromDeal(roundDeal),
  };
}

/** Gather every coordinate from a finished round for the next shuffle. */
export function collectRoundCoordinatesForRecycle(
  round: RoundState
): Coordinate[] {
  const recycled: Coordinate[] = [...round.unchartedSectors];

  for (const playerId of round.turnOrder) {
    recycled.push(...(round.hands[playerId] ?? []));
  }

  for (const trail of Object.values(round.table.warpTrails)) {
    for (const placed of trail.tiles) {
      recycled.push(placed.coordinate);
    }
  }

  for (const placed of round.table.neutralZone.tiles) {
    recycled.push(placed.coordinate);
  }

  const fracture = round.table.subspaceFracture;
  if (fracture) {
    for (const placed of fracture.stabilizers) {
      recycled.push(placed.coordinate);
    }
  }

  recycled.push(
    normalizeCoordinate(round.spacedockValue, round.spacedockValue)
  );

  return recycled;
}

/** @deprecated Spacedock is set aside before dealing; use roundStarterForRound instead. */
export function findSpacedockHolder(
  hands: Readonly<Record<PlayerId, readonly Coordinate[]>>,
  spacedockValue: number
): PlayerId | null {
  const key = coordinateKey(
    normalizeCoordinate(spacedockValue, spacedockValue)
  );
  for (const [playerId, hand] of Object.entries(hands)) {
    if (hand.some((coordinate) => coordinateKey(coordinate) === key)) {
      return playerId;
    }
  }
  return null;
}
