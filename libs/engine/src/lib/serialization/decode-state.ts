/**
 * State Snapshot Decoding (binary-v2)
 *
 * Companion to encode-state.ts. Round header version must be 0x02.
 */

import type { GameState, RoundState, TableState } from '../types/game-state.js';
import type { Coordinate, PlacedCoordinate } from '../types/coordinate.js';
import { openValueAfterConnection } from '../types/coordinate.js';
import type { WarpTrail } from '../types/trails.js';
import type { SubspaceFracture } from '../types/anomalies.js';
import type { Captain } from '../types/player.js';
import { COORDINATE_ENCODED_BYTES, readCoordinate } from './encode-coordinate.js';
import { ROUND_STATE_BINARY_VERSION } from './encode-state.js';
import type { GameObjective } from '../types/objective.js';

export interface StateDecodeContext {
  maxPip: number;
  playerIds: readonly string[];
}

/**
 * Rebuild placed coordinates from the raw coordinate list stored in a snapshot.
 * The wire format keeps only each tile's coordinate, so `openValue` must be
 * reconstructed: trails and the Neutral Zone all branch from the central
 * Spacedock double, so the first tile connects to `startConnectingValue` (the
 * spacedock value) and each subsequent tile connects to the previous open end.
 */
function rebuildPlacedTiles(
  coordinates: readonly Coordinate[],
  startConnectingValue: number
): PlacedCoordinate[] {
  const placed: PlacedCoordinate[] = [];
  let connectingValue = startConnectingValue;
  for (let index = 0; index < coordinates.length; index++) {
    const coordinate = coordinates[index];
    const openValue =
      openValueAfterConnection(coordinate, connectingValue) ?? coordinate.high;
    placed.push({ coordinate, index, openValue });
    connectingValue = openValue;
  }
  return placed;
}

/**
 * Decode a round state snapshot from binary.
 */
export function decodeRoundState(
  binary: Uint8Array,
  ctx: StateDecodeContext
): RoundState {
  let offset = 0;

  const version = binary[offset++];
  if (version !== ROUND_STATE_BINARY_VERSION) {
    throw new Error(`Unsupported round state version: ${version}`);
  }

  const playerCount = binary[offset++];
  const roundNumber = binary[offset++];
  const spacedockValue = binary[offset++];
  const activePlayerIdx = binary[offset++];
  offset++; // Skip unchartedCount
  const flags = binary[offset++];
  offset++; // Reserved

  const turnOrder = ctx.playerIds.slice(0, playerCount);
  const activePlayerId = turnOrder[activePlayerIdx];

  const redAlertActive = (flags & 0x01) !== 0;
  const continuumPending = (flags & 0x04) !== 0;
  const roundBlocked = (flags & 0x08) !== 0;
  const allStopRequired = (flags & 0x10) !== 0;
  const allStopDeclared = (flags & 0x20) !== 0;

  const hands: Record<string, Coordinate[]> = {};
  for (let i = 0; i < playerCount; i++) {
    const handSize = binary[offset++];
    const hand: Coordinate[] = [];
    for (let j = 0; j < handSize; j++) {
      const { coordinate, bytesRead } = readCoordinate(binary, offset, ctx.maxPip);
      hand.push(coordinate);
      offset += bytesRead;
    }
    hands[turnOrder[i]] = hand;
  }

  const warpTrails: Record<string, WarpTrail> = {};
  for (let i = 0; i < playerCount; i++) {
    const trailLength = binary[offset++];
    const coordinates: Coordinate[] = [];
    for (let j = 0; j < trailLength; j++) {
      const { coordinate, bytesRead } = readCoordinate(binary, offset, ctx.maxPip);
      coordinates.push(coordinate);
      offset += bytesRead;
    }
    const beaconActive = binary[offset++] === 1;
    warpTrails[turnOrder[i]] = {
      playerId: turnOrder[i],
      tiles: rebuildPlacedTiles(coordinates, spacedockValue),
      distressBeacon: { active: beaconActive },
    };
  }

  const nzLength = binary[offset++];
  const nzCoordinates: Coordinate[] = [];
  for (let i = 0; i < nzLength; i++) {
    const { coordinate, bytesRead } = readCoordinate(binary, offset, ctx.maxPip);
    nzCoordinates.push(coordinate);
    offset += bytesRead;
  }
  const nzTiles = rebuildPlacedTiles(nzCoordinates, spacedockValue);

  // Spacedock coordinate (unused for value — spacedockValue is in header)
  offset += COORDINATE_ENCODED_BYTES;
  const spacedockPlacedByIdx = binary[offset++];
  const spacedockPlacedBy = turnOrder[spacedockPlacedByIdx];

  const fractureLength = binary[offset++];
  let subspaceFracture: SubspaceFracture | null = null;
  if (fractureLength > 0) {
    const stabilizerCoords: Coordinate[] = [];
    for (let i = 0; i < fractureLength; i++) {
      const { coordinate, bytesRead } = readCoordinate(binary, offset, ctx.maxPip);
      stabilizerCoords.push(coordinate);
      offset += bytesRead;
    }
    // The snapshot stores only stabilizer coordinates, not the fracture anchor
    // or its required value, so reconstruct a best-effort anchor: the fracture
    // double sits at the spacedock value.
    const requiredValue = spacedockValue;
    subspaceFracture = {
      active: true,
      anchor: {
        coordinate: { low: requiredValue, high: requiredValue },
        index: 0,
        openValue: requiredValue,
      },
      stabilizers: rebuildPlacedTiles(stabilizerCoords, requiredValue),
      requiredValue,
    };
  }

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
    redAlert: redAlertActive
      ? {
          active: true,
          anchor: {
            coordinate: { high: spacedockValue, low: spacedockValue },
            index: 0,
            openValue: spacedockValue,
          },
          responsiblePlayerId: activePlayerId,
          trailPlayerId: activePlayerId,
          passed: false,
        }
      : null,
  };

  const round: RoundState = {
    roundNumber,
    spacedockValue,
    phase: 'playing',
    activePlayerId,
    turnOrder,
    table,
    unchartedSectors: [],
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

  const version = binary[offset++];
  if (version !== 0x02) {
    throw new Error(`Unsupported game state version: ${version}`);
  }

  const objectiveByte = binary[offset++];
  const objective: GameObjective = objectiveByte === 1 ? 'go-out' : 'points';

  const warpFactorByte = binary[offset++];
  const maxPip =
    warpFactorByte === 0
      ? 9
      : warpFactorByte === 1
        ? 12
        : warpFactorByte === 2
          ? 15
          : 18;

  const updatedCaptains = captains.map((c, i) => ({
    ...c,
    pointsScore: binary[offset++] || 0,
  }));

  offset = 16;

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
