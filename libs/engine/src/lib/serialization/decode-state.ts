/**
 * State Snapshot Decoding
 * 
 * Decodes binary-encoded GameState/RoundState back to full objects.
 * Companion to encode-state.ts for match replay with checkpoints.
 */

import type { GameState, RoundState, TableState } from '../types/game-state.js';
import type { Coordinate } from '../types/coordinate.js';
import type { Captain } from '../types/player.js';
import { decodeCoordinate } from './encode-coordinate.js';
import type { GameObjective } from '../types/objective.js';

export interface StateDecodeContext {
  maxPip: number;
  playerIds: readonly string[];
}

/**
 * Decode a round state snapshot from binary.
 */
export function decodeRoundState(
  binary: Uint8Array,
  ctx: StateDecodeContext
): RoundState {
  let offset = 0;

  // Header (8 bytes)
  const version = binary[offset++];
  if (version !== 0x01) {
    throw new Error(`Unsupported round state version: ${version}`);
  }

  const playerCount = binary[offset++];
  const roundNumber = binary[offset++];
  const spacedockValue = binary[offset++];
  const activePlayerIdx = binary[offset++];
  offset++; // Skip unchartedCount (not currently used in decode)
  const flags = binary[offset++];
  offset++; // Reserved byte

  const turnOrder = ctx.playerIds.slice(0, playerCount);
  const activePlayerId = turnOrder[activePlayerIdx];

  // Decode flags
  const redAlertActive = (flags & 0x01) !== 0;
  // subspaceFractureActive flag at (flags & 0x02) is reserved for future use
  const continuumPending = (flags & 0x04) !== 0;
  const roundBlocked = (flags & 0x08) !== 0;
  const allStopRequired = (flags & 0x10) !== 0;
  const allStopDeclared = (flags & 0x20) !== 0;

  // Player hands
  const hands: Record<string, Coordinate[]> = {};
  for (let i = 0; i < playerCount; i++) {
    const handSize = binary[offset++];
    const hand: Coordinate[] = [];
    for (let j = 0; j < handSize; j++) {
      hand.push(decodeCoordinate(binary[offset++], ctx.maxPip));
    }
    hands[turnOrder[i]] = hand;
  }

  // Trails
  const warpTrails: Record<string, any> = {};
  for (let i = 0; i < playerCount; i++) {
    const trailLength = binary[offset++];
    const tiles: any[] = [];
    for (let j = 0; j < trailLength; j++) {
      const coord = decodeCoordinate(binary[offset++], ctx.maxPip);
      tiles.push({
        coordinate: coord,
        index: j,
        playedByOpponent: false,
      });
    }
    const beaconActive = binary[offset++] === 1;
    warpTrails[turnOrder[i]] = {
      tiles,
      distressBeacon: {
        active: beaconActive,
        ownedBy: turnOrder[i],
      },
    };
  }

  // Neutral zone
  const nzLength = binary[offset++];
  const nzTiles: any[] = [];
  for (let i = 0; i < nzLength; i++) {
    const coord = decodeCoordinate(binary[offset++], ctx.maxPip);
    nzTiles.push({
      coordinate: coord,
      index: i,
      playedByOpponent: false,
    });
  }

  // Spacedock (skip coordinate as it's not used in decode)
  offset++; // Skip spacedock coordinate byte
  const spacedockPlacedByIdx = binary[offset++];
  const spacedockPlacedBy = turnOrder[spacedockPlacedByIdx];

  // Subspace fracture
  const fractureLength = binary[offset++];
  let subspaceFracture: any = null;
  if (fractureLength > 0) {
    const stabilizers: any[] = [];
    for (let i = 0; i < fractureLength; i++) {
      const coord = decodeCoordinate(binary[offset++], ctx.maxPip);
      stabilizers.push({
        coordinate: coord,
        index: i,
        playedByOpponent: false,
      });
    }
    subspaceFracture = {
      active: true,
      stabilizers,
      scope: 'own-trail' as const,
      requiredPipValue: spacedockValue,
    };
  }

  // Build table
  const table: TableState = {
    spacedock: {
      value: spacedockValue,
      placedBy: spacedockPlacedBy,
    },
    warpTrails,
    neutralZone: {
      tiles: nzTiles,
    },
    subspaceFracture,
    redAlert: redAlertActive ? {
      active: true,
      anchor: { coordinate: { high: spacedockValue, low: spacedockValue }, index: 0, openValue: spacedockValue },
      responsiblePlayerId: activePlayerId,
      trailPlayerId: activePlayerId,
      passed: false,
    } : null,
  };

  // Build round state (minimal for replay)
  const round: RoundState = {
    roundNumber,
    spacedockValue,
    phase: 'playing',
    activePlayerId,
    turnOrder,
    table,
    unchartedSectors: [], // Not encoded in detail
    sensorGrid: [],
    hands,
    draftState: null,
    allStopRequired,
    allStopDeclared,
    roundWinnerId: null,
    continuumPendingInvoker: continuumPending ? activePlayerId : null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked,
    roundStarterOpening: null,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    playedThisTurn: false,
    drewThisTurn: false,
    maxPip: ctx.maxPip,
  };

  return round;
}

/**
 * Decode a full game state snapshot from binary.
 */
export function decodeGameState(
  binary: Uint8Array,
  ctx: StateDecodeContext,
  captains: readonly Captain[]
): GameState {
  let offset = 0;

  // Campaign metadata (16 bytes)
  const version = binary[offset++];
  if (version !== 0x02) {
    throw new Error(`Unsupported game state version: ${version}`);
  }

  const objectiveByte = binary[offset++];
  const objective: GameObjective = objectiveByte === 1 ? 'go-out' : 'points';

  const warpFactorByte = binary[offset++];
  const maxPip = warpFactorByte === 0 ? 9 : warpFactorByte === 1 ? 12 : warpFactorByte === 2 ? 15 : 18;

  // Scores (4 bytes)
  const updatedCaptains = captains.map((c, i) => ({
    ...c,
    pointsScore: binary[offset++] || 0,
  }));

  // Skip reserved bytes (4-15)
  offset = 16;

  // Decode round state
  const roundBinary = binary.slice(offset);
  const round = decodeRoundState(roundBinary, { ...ctx, maxPip });

  const game: GameState = {
    id: 'decoded',
    phase: 'active',
    captains: updatedCaptains,
    round,
    completedRounds: round.roundNumber - 1,
    modules: {
      subspaceFracture: { enabled: false, scope: 'own-trail' },
      continuum: { enabled: false, activeFlash: null },
      sensorGrid: { enabled: false, gridSize: 4 },
      warpDriveSpool: { enabled: false },
      drafting: { enabled: false, packSize: 15 },
      temporalDebt: { enabled: false, costPerToken: 2 },
      salamanderPenalty: { enabled: false },
      longestTrail: { enabled: false, bonus: -3 },
      doubleDown: { enabled: false, drawCount: 2 },
      temporalInversion: { enabled: false },
      wormholes: { enabled: false },
      squadrons: { enabled: false, squadronSize: 2 },
    },
    houseRules: {
      requireOwnTrailFirst: false,
      neutralZoneAfterAllTrails: false,
      beaconClearsOnAnyPlay: false,
      roundStarterPlaysTwo: false,
      roundStarterOwnTrailOnly: false,
      dropToImpulseCall: false,
      dropToImpulseCatchPenalty: 2,
      allStopCeremony: false,
      passRedAlertWithoutDraw: false,
      manualShieldControl: false,
      doubleZeroScore: 50,
      largeFleetHandSize: 10,
    },
    objective,
    campaignRounds: 10,
    maxPip,
  };

  return game;
}
