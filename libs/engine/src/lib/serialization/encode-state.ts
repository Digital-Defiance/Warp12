/**
 * State Snapshot Encoding
 * 
 * Encodes GameState/RoundState into compact binary format (~300 bytes).
 * Useful for match replay with checkpoints (Option A).
 * 
 * Format:
 * - Header: 8 bytes (version, flags, player count, etc.)
 * - Players: variable (coordinates in hands)
 * - Table: variable (trails, spacedock, fractures)
 * - Metadata: variable (scores, round number, etc.)
 * 
 * Total: ~200-400 bytes depending on game state complexity
 */

import type { GameState, RoundState } from '../types/game-state.js';
import { encodeCoordinate } from './encode-coordinate.js';

export interface StateEncodeContext {
  maxPip: number;
}

/**
 * Encode a round state snapshot to binary.
 * ~300 bytes for typical mid-game state.
 */
export function encodeRoundState(
  round: RoundState,
  ctx: StateEncodeContext
): Uint8Array {
  const buffers: Uint8Array[] = [];

  // Header (8 bytes)
  const header = new Uint8Array(8);
  header[0] = 0x01; // Version
  header[1] = round.turnOrder.length; // Player count
  header[2] = round.roundNumber;
  header[3] = round.spacedockValue;
  header[4] = round.turnOrder.indexOf(round.activePlayerId); // Active player index
  header[5] = round.unchartedSectors.length; // Remaining tiles
  // Flags byte
  let flags = 0;
  if (round.table.redAlert) flags |= 0x01;
  if (round.table.subspaceFracture) flags |= 0x02;
  if (round.continuumPendingInvoker) flags |= 0x04;
  if (round.roundBlocked) flags |= 0x08;
  if (round.allStopRequired) flags |= 0x10;
  if (round.allStopDeclared) flags |= 0x20;
  header[6] = flags;
  header[7] = 0; // Reserved
  buffers.push(header);

  // Player hands (variable length)
  // Format: [handSize: 1 byte][coords...] for each player
  for (const playerId of round.turnOrder) {
    const hand = round.hands[playerId] || [];
    const handBuf = new Uint8Array(1 + hand.length);
    handBuf[0] = hand.length;
    for (let i = 0; i < hand.length; i++) {
      handBuf[i + 1] = encodeCoordinate(hand[i], ctx.maxPip);
    }
    buffers.push(handBuf);
  }

  // Trails (variable length)
  // Format: [trailLength: 1 byte][coords...][beacon: 1 byte] for each player
  for (const playerId of round.turnOrder) {
    const trail = round.table.warpTrails[playerId];
    if (!trail) {
      buffers.push(new Uint8Array([0, 0])); // Empty trail, no beacon
      continue;
    }
    const trailBuf = new Uint8Array(1 + trail.tiles.length + 1);
    trailBuf[0] = trail.tiles.length;
    for (let i = 0; i < trail.tiles.length; i++) {
      trailBuf[i + 1] = encodeCoordinate(trail.tiles[i].coordinate, ctx.maxPip);
    }
    trailBuf[trailBuf.length - 1] = trail.distressBeacon.active ? 1 : 0;
    buffers.push(trailBuf);
  }

  // Neutral zone
  const nzTiles = round.table.neutralZone.tiles;
  const nzBuf = new Uint8Array(1 + nzTiles.length);
  nzBuf[0] = nzTiles.length;
  for (let i = 0; i < nzTiles.length; i++) {
    nzBuf[i + 1] = encodeCoordinate(nzTiles[i].coordinate, ctx.maxPip);
  }
  buffers.push(nzBuf);

  // Spacedock
  const spacedock = round.table.spacedock;
  const sdBuf = new Uint8Array(2);
  // Spacedock is always a double, so low = high = value
  sdBuf[0] = encodeCoordinate({ low: spacedock.value, high: spacedock.value }, ctx.maxPip);
  sdBuf[1] = round.turnOrder.indexOf(spacedock.placedBy ?? '');
  buffers.push(sdBuf);

  // Subspace fracture stabilizers (if active)
  if (round.table.subspaceFracture) {
    const stabilizers = round.table.subspaceFracture.stabilizers;
    const fracBuf = new Uint8Array(1 + stabilizers.length);
    fracBuf[0] = stabilizers.length;
    for (let i = 0; i < stabilizers.length; i++) {
      fracBuf[i + 1] = encodeCoordinate(stabilizers[i].coordinate, ctx.maxPip);
    }
    buffers.push(fracBuf);
  } else {
    buffers.push(new Uint8Array([0]));
  }

  // Concatenate all buffers
  const totalSize = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

/**
 * Encode a full game state snapshot.
 * Includes round state + campaign metadata.
 */
export function encodeGameState(
  game: GameState,
  ctx: StateEncodeContext
): Uint8Array {
  if (!game.round) {
    throw new Error('Cannot encode game state without active round');
  }

  const roundBinary = encodeRoundState(game.round, ctx);
  
  // Campaign metadata (16 bytes)
  const meta = new Uint8Array(16);
  meta[0] = 0x02; // Game state version
  meta[1] = game.objective === 'go-out' ? 1 : 0;
  meta[2] = game.maxPip === 9 ? 0 : game.maxPip === 12 ? 1 : game.maxPip === 15 ? 2 : 3;
  // Scores - for initial states, captains have pointsScore property
  // For active games, scores would be computed from completed rounds
  // Here we just store captain scores (4 bytes for up to 4 players)
  for (let i = 0; i < Math.min(game.captains.length, 4); i++) {
    meta[3 + i] = game.captains[i].pointsScore || 0;
  }
  // Pad remaining score slots
  for (let i = game.captains.length; i < 4; i++) {
    meta[3 + i] = 0;
  }
  // Reserved
  for (let i = 7; i < 16; i++) {
    meta[i] = 0;
  }

  // Concatenate meta + round
  const result = new Uint8Array(meta.length + roundBinary.length);
  result.set(meta, 0);
  result.set(roundBinary, meta.length);
  return result;
}
