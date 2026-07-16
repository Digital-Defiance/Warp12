import {
  handSizeForPlayerCount,
  spacedockValueForRound,
  DEFAULT_LARGE_FLEET_HAND_SIZE,
  DOUBLE_TWELVE_MAX_PIPS,
  clampCampaignRounds,
  defaultCampaignRounds,
  normalizeWarpFactor,
  type LargeFleetHandSize,
} from '../constants/setup.js';
import {
  coordinateKey,
  normalizeCoordinate,
  type Coordinate,
} from '../types/coordinate.js';
import { createInitialTable } from '../table/table-state.js';
import type { CreateGameInput, GameState, RoundState } from '../types/game-state.js';
import type { Captain, PlayerId } from '../types/player.js';
import type { Squadron } from '../types/squadrons.js';
import { formSquadrons } from '../engine/squadrons.js';
import { DEFAULT_GAME_OBJECTIVE } from '../types/objective.js';
import { resolveModules } from '../types/modules.js';
import { resolveHouseRules } from '../types/house-rules.js';
import { applySensorGridToRound } from '../engine/sensor-grid.js';
import {
  executeSyncDraft,
  calculatePackSize,
  initializeDraftState,
} from '../engine/drafting.js';

export function createCaptain(
  id: string,
  displayName: string
): Captain {
  return { id, displayName, pointsScore: 0 };
}

export function createLobbyState(input: CreateGameInput): GameState {
  const maxPip = normalizeWarpFactor(input.maxPip ?? DOUBLE_TWELVE_MAX_PIPS);
  return {
    id: input.id,
    phase: 'lobby',
    captains: input.captains.map((c) => createCaptain(c.id, c.displayName)),
    round: null,
    completedRounds: 0,
    modules: resolveModules(input.modules),
    houseRules: resolveHouseRules(input.houseRules),
    objective: input.objective ?? DEFAULT_GAME_OBJECTIVE,
    maxPip,
    campaignRounds: clampCampaignRounds(
      input.campaignRounds ?? defaultCampaignRounds(maxPip),
      maxPip
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
  readonly maxPip: number;
}

/** Round starter rotates clockwise through turn order (standard multi-trail). */
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
 * Deal a round per standard multi-trail setup: set aside the round Spacedock
 * double before dealing hands; remaining tiles form Uncharted Sectors.
 */
export function dealRoundFromShuffled(input: {
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly roundNumber: number;
  readonly captains: readonly Captain[];
  readonly turnOrder: readonly PlayerId[];
  readonly roundStarterId?: PlayerId;
  /** 7–8 captain hand size (10 default, 11 = Galt/University). */
  readonly largeFleetHandSize?: LargeFleetHandSize;
  /** Double-N max pip for Spacedock descent and hand sizes. */
  readonly maxPip?: number;
}): RoundDealResult {
  const maxPip = normalizeWarpFactor(input.maxPip ?? DOUBLE_TWELVE_MAX_PIPS);
  const spacedockValue = spacedockValueForRound(input.roundNumber, maxPip);
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

  const handSize = handSizeForPlayerCount(
    input.captains.length,
    input.largeFleetHandSize ?? DEFAULT_LARGE_FLEET_HAND_SIZE,
    maxPip
  );
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
    maxPip,
  };
}

/**
 * Deal a round with Module Epsilon drafting: pack-and-pass instead of random deal.
 * Spacedock is still set aside first (same as standard).
 */
export function dealRoundFromDraft(input: {
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly roundNumber: number;
  readonly captains: readonly Captain[];
  readonly turnOrder: readonly PlayerId[];
  readonly roundStarterId?: PlayerId;
  readonly largeFleetHandSize?: LargeFleetHandSize;
  readonly maxPip?: number;
  readonly draftPackSize?: number;
  /** Pick function for each captain (AI or manual). */
  readonly pickFn: (playerId: PlayerId, pack: readonly Coordinate[]) => Coordinate;
}): RoundDealResult {
  const maxPip = normalizeWarpFactor(input.maxPip ?? DOUBLE_TWELVE_MAX_PIPS);
  const spacedockValue = spacedockValueForRound(input.roundNumber, maxPip);
  const spacedockCoordinate = normalizeCoordinate(
    spacedockValue,
    spacedockValue
  );
  const spacedockKey = coordinateKey(spacedockCoordinate);
  const pile = [...input.shuffledCoordinates];

  // Remove spacedock first (same as standard)
  const spacedockIndex = pile.findIndex(
    (coordinate) => coordinateKey(coordinate) === spacedockKey
  );
  if (spacedockIndex === -1) {
    throw new Error(
      `Spacedock coordinate ${spacedockKey} is missing from the shuffled set.`
    );
  }
  pile.splice(spacedockIndex, 1);

  const packSize =
    input.draftPackSize ??
    handSizeForPlayerCount(
      input.captains.length,
      input.largeFleetHandSize ?? DEFAULT_LARGE_FLEET_HAND_SIZE,
      maxPip
    );
  const maxPackFromPile = calculatePackSize(input.captains.length, pile.length);
  const effectivePackSize = Math.min(packSize, maxPackFromPile);

  // Execute synchronous draft
  const { hands, remaining } = executeSyncDraft(
    pile,
    input.turnOrder,
    effectivePackSize,
    input.pickFn,
    Math.min(
      handSizeForPlayerCount(
        input.captains.length,
        input.largeFleetHandSize ?? DEFAULT_LARGE_FLEET_HAND_SIZE,
        maxPip
      ),
      effectivePackSize
    )
  );

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
    unchartedSectors: remaining,
    maxPip,
  };
}

export function createRoundStateFromDeal(
  deal: RoundDealResult,
  squadrons?: readonly Squadron[]
): RoundState {
  return {
    roundNumber: deal.roundNumber,
    spacedockValue: deal.spacedockValue,
    phase: 'playing',
    activePlayerId: deal.spacedockPlacedBy,
    turnOrder: deal.turnOrder,
    table: createInitialTable(
      deal.turnOrder,
      deal.spacedockValue,
      deal.spacedockPlacedBy,
      squadrons
    ),
    ...(squadrons ? { squadrons } : {}),
    unchartedSectors: [...deal.unchartedSectors],
    sensorGrid: [], // Initialized when Module Gamma is enabled
    hands: { ...deal.hands },
    draftState: null, // No drafting in standard deal
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    continuumPendingInvoker: null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    roundStarterOpeningResolved: false,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    playedThisTurn: false,
    drewThisTurn: false,
    maxPip: deal.maxPip,
  };
}

/**
 * Create a round state with drafting enabled (Module Epsilon).
 * Round starts in 'drafting' phase with empty hands.
 */
export function createRoundStateWithDraft(input: {
  readonly roundNumber: number;
  readonly captains: readonly Captain[];
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly turnOrder: readonly PlayerId[];
  readonly roundStarterId?: PlayerId;
  readonly maxPip?: number;
  readonly largeFleetHandSize?: LargeFleetHandSize;
  /** Preferred pack size; capped at the warp-set hand size so drafts end cleanly. */
  readonly packSize?: number;
  readonly squadrons?: readonly Squadron[];
}): RoundState {
  const maxPip = normalizeWarpFactor(input.maxPip ?? DOUBLE_TWELVE_MAX_PIPS);
  const spacedockValue = spacedockValueForRound(input.roundNumber, maxPip);
  const spacedockCoordinate = normalizeCoordinate(
    spacedockValue,
    spacedockValue
  );
  const spacedockKey = coordinateKey(spacedockCoordinate);
  const pile = [...input.shuffledCoordinates];

  // Remove spacedock first
  const spacedockIndex = pile.findIndex(
    (coordinate) => coordinateKey(coordinate) === spacedockKey
  );
  if (spacedockIndex === -1) {
    throw new Error(
      `Spacedock coordinate ${spacedockKey} is missing from the shuffled set.`
    );
  }
  pile.splice(spacedockIndex, 1);

  const spacedockPlacedBy =
    input.roundStarterId ??
    roundStarterForRound(input.turnOrder, input.roundNumber);

  // Packs must equal the deal hand size: isDraftComplete drains packs to empty,
  // so maximizing pack size (floor(available/players)) would draft oversized hands
  // and leave uncharted empty — which falsely tripped self-play stall guards.
  const handSize = handSizeForPlayerCount(
    input.turnOrder.length,
    input.largeFleetHandSize ?? DEFAULT_LARGE_FLEET_HAND_SIZE,
    maxPip
  );
  const maxPackFromPile = calculatePackSize(input.turnOrder.length, pile.length);
  const packSize = Math.min(
    input.packSize ?? handSize,
    handSize,
    maxPackFromPile
  );

  // Initialize draft state
  const draftState = initializeDraftState(
    input.turnOrder,
    pile,
    packSize
  );

  // Calculate remaining tiles after draft packs are distributed
  const tilesInPacks = packSize * input.turnOrder.length;
  const remaining = pile.slice(tilesInPacks);

  // Initialize empty hands (will be filled during draft)
  const emptyHands: Record<string, Coordinate[]> = {};
  input.turnOrder.forEach((id) => {
    emptyHands[id] = [];
  });

  return {
    roundNumber: input.roundNumber,
    spacedockValue,
    phase: 'drafting',
    activePlayerId: draftState.currentDrafter,
    turnOrder: input.turnOrder,
    table: createInitialTable(
      input.turnOrder,
      spacedockValue,
      spacedockPlacedBy,
      input.squadrons
    ),
    ...(input.squadrons ? { squadrons: input.squadrons } : {}),
    unchartedSectors: remaining,
    sensorGrid: [],
    hands: emptyHands,
    draftState,
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    continuumPendingInvoker: null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    roundStarterOpeningResolved: false,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    playedThisTurn: false,
    drewThisTurn: false,
    maxPip,
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
  let lobby = createLobbyState(input);

  // Module Zeta: form squadrons and use interleaved (bridge) seating.
  let squadrons: readonly Squadron[] | undefined;
  let turnOrder = lobby.captains.map((c) => c.id);
  if (lobby.modules.squadrons.enabled) {
    const formed = formSquadrons(
      turnOrder,
      lobby.modules.squadrons.squadronSize,
      lobby.modules.squadrons.squadronNames,
      lobby.modules.squadrons.squadronRosters
    );
    squadrons = formed.squadrons;
    turnOrder = [...formed.turnOrder];
    const squadByMember = new Map<PlayerId, string>();
    for (const squad of squadrons) {
      for (const memberId of squad.memberIds) {
        squadByMember.set(memberId, squad.id);
      }
    }
    lobby = {
      ...lobby,
      squadrons,
      captains: lobby.captains.map((c) => ({
        ...c,
        squadronId: squadByMember.get(c.id),
      })),
    };
  }

  // Module Epsilon: Drafting
  if (lobby.modules.drafting.enabled) {
    const draftRound = createRoundStateWithDraft({
      shuffledCoordinates: deal.shuffledCoordinates,
      roundNumber: 1,
      captains: lobby.captains,
      turnOrder,
      roundStarterId: deal.roundStarterId,
      maxPip: lobby.maxPip,
      largeFleetHandSize: lobby.houseRules.largeFleetHandSize,
      packSize: lobby.modules.drafting.packSize,
      squadrons,
    });

    let roundWithModules = draftRound;

    // Module Delta: Initialize hazard marker with round starter
    if (lobby.modules.warpDriveSpool.enabled) {
      const starterId = deal.roundStarterId ?? roundStarterForRound(turnOrder, 1);
      roundWithModules = {
        ...roundWithModules,
        hazardMarkerHolder: starterId,
        hazardMarkerPassCount: 0,
      };
    }

    // Module Eta: Initialize debt tokens for all captains
    if (lobby.modules.temporalDebt.enabled) {
      const debtTokens: Record<string, number> = {};
      for (const captain of lobby.captains) {
        debtTokens[captain.id] = 0;
      }
      roundWithModules = {
        ...roundWithModules,
        debtTokens,
      };
    }

    return {
      ...lobby,
      phase: 'active',
      round: roundWithModules,
    };
  }

  // Standard deal (no drafting)
  const roundDeal = dealRoundFromShuffled({
    shuffledCoordinates: deal.shuffledCoordinates,
    roundNumber: 1,
    captains: lobby.captains,
    turnOrder,
    roundStarterId: deal.roundStarterId,
    largeFleetHandSize: lobby.houseRules.largeFleetHandSize,
    maxPip: lobby.maxPip,
  });

  const baseRound = createRoundStateFromDeal(roundDeal, squadrons);
  let roundWithModules = applySensorGridToRound(baseRound, lobby.modules);

  // Module Delta: Initialize hazard marker with round starter
  if (lobby.modules.warpDriveSpool.enabled) {
    roundWithModules = {
      ...roundWithModules,
      hazardMarkerHolder: roundDeal.spacedockPlacedBy,
      hazardMarkerPassCount: 0,
    };
  }

  // Module Eta: Initialize debt tokens for all captains
  if (lobby.modules.temporalDebt.enabled) {
    const debtTokens: Record<string, number> = {};
    for (const captain of lobby.captains) {
      debtTokens[captain.id] = 0;
    }
    roundWithModules = {
      ...roundWithModules,
      debtTokens,
    };
  }

  return {
    ...lobby,
    phase: 'active',
    round: roundWithModules,
  };
}

/** Gather every coordinate from a finished round for the next shuffle. */
export function collectRoundCoordinatesForRecycle(
  round: RoundState
): Coordinate[] {
  const recycled: Coordinate[] = [...round.unchartedSectors];

  // Collect sensor grid tiles (Module Gamma)
  if (round.sensorGrid) {
    recycled.push(...round.sensorGrid);
  }

  // Collect continuum wager tiles (Module Alpha)
  if (round.continuumWagerPending) {
    recycled.push(...round.continuumWagerPending.options);
  }

  // Module Epsilon: Collect any tiles remaining in draft packs AND
  // tiles already picked but not yet promoted to hands (incomplete draft).
  if (round.draftState) {
    for (const pack of Object.values(round.draftState.currentPacks)) {
      recycled.push(...pack);
    }
    for (const picked of Object.values(round.draftState.pickedTiles)) {
      recycled.push(...picked);
    }
  }

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
