/**
 * State Snapshot Encoding (binary-v2)
 *
 * Encodes GameState/RoundState into compact binary.
 * Coordinates are little-endian u16 (see encode-coordinate.ts).
 *
 * Round header version byte: 0x02 (v2 / 2-byte coords).
 */

import type { GameState, RoundState } from '../types/game-state.js';
import {
  COORDINATE_ENCODED_BYTES,
  writeCoordinate,
} from './encode-coordinate.js';
import { trailKeyFor } from '../engine/squadrons.js';

/** Round-state snapshot wire version (2-byte coordinates). */
export const ROUND_STATE_BINARY_VERSION = 0x02;

export interface StateEncodeContext {
  maxPip: number;
}

/**
 * Encode a round state snapshot to binary.
 */
export function encodeRoundState(
  round: RoundState,
  ctx: StateEncodeContext
): Uint8Array {
  const buffers: Uint8Array[] = [];

  // Header (8 bytes)
  const header = new Uint8Array(8);
  header[0] = ROUND_STATE_BINARY_VERSION;
  header[1] = round.turnOrder.length;
  header[2] = round.roundNumber;
  header[3] = round.spacedockValue;
  header[4] = round.turnOrder.indexOf(round.activePlayerId);
  header[5] = round.unchartedSectors.length;
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

  // Player hands: [handSize:1][coord u16 × n]
  for (const playerId of round.turnOrder) {
    const hand = round.hands[playerId] || [];
    const handBuf = new Uint8Array(1 + hand.length * COORDINATE_ENCODED_BYTES);
    handBuf[0] = hand.length;
    let o = 1;
    for (const tile of hand) {
      o += writeCoordinate(handBuf, o, tile, ctx.maxPip);
    }
    buffers.push(handBuf);
  }

  // Trails: [trailLength:1][coord u16 × n][beacon:1]
  for (const playerId of round.turnOrder) {
    const trail = round.table.warpTrails[trailKeyFor(round, playerId)];
    if (!trail) {
      buffers.push(new Uint8Array([0, 0]));
      continue;
    }
    const trailBuf = new Uint8Array(
      1 + trail.tiles.length * COORDINATE_ENCODED_BYTES + 1
    );
    trailBuf[0] = trail.tiles.length;
    let o = 1;
    for (const tile of trail.tiles) {
      o += writeCoordinate(trailBuf, o, tile.coordinate, ctx.maxPip);
    }
    trailBuf[o] = trail.distressBeacon.active ? 1 : 0;
    buffers.push(trailBuf);
  }

  // Neutral zone: [length:1][coord u16 × n]
  const nzTiles = round.table.neutralZone.tiles;
  const nzBuf = new Uint8Array(1 + nzTiles.length * COORDINATE_ENCODED_BYTES);
  nzBuf[0] = nzTiles.length;
  let nzOff = 1;
  for (const tile of nzTiles) {
    nzOff += writeCoordinate(nzBuf, nzOff, tile.coordinate, ctx.maxPip);
  }
  buffers.push(nzBuf);

  // Spacedock: [coord u16][placedBy index]
  const spacedock = round.table.spacedock;
  const sdBuf = new Uint8Array(COORDINATE_ENCODED_BYTES + 1);
  writeCoordinate(
    sdBuf,
    0,
    { low: spacedock.value, high: spacedock.value },
    ctx.maxPip
  );
  sdBuf[COORDINATE_ENCODED_BYTES] = round.turnOrder.indexOf(
    spacedock.placedBy ?? ''
  );
  buffers.push(sdBuf);

  // Subspace fracture stabilizers
  if (round.table.subspaceFracture) {
    const stabilizers = round.table.subspaceFracture.stabilizers;
    const fracBuf = new Uint8Array(
      1 + stabilizers.length * COORDINATE_ENCODED_BYTES
    );
    fracBuf[0] = stabilizers.length;
    let o = 1;
    for (const tile of stabilizers) {
      o += writeCoordinate(fracBuf, o, tile.coordinate, ctx.maxPip);
    }
    buffers.push(fracBuf);
  } else {
    buffers.push(new Uint8Array([0]));
  }

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

  const meta = new Uint8Array(16);
  meta[0] = 0x02; // Game state version (unchanged envelope)
  meta[1] = game.objective === 'go-out' ? 1 : 0;
  meta[2] =
    game.maxPip === 9 ? 0 : game.maxPip === 12 ? 1 : game.maxPip === 15 ? 2 : 3;
  for (let i = 0; i < Math.min(game.captains.length, 4); i++) {
    meta[3 + i] = game.captains[i].pointsScore || 0;
  }
  for (let i = game.captains.length; i < 4; i++) {
    meta[3 + i] = 0;
  }
  for (let i = 7; i < 16; i++) {
    meta[i] = 0;
  }

  const result = new Uint8Array(meta.length + roundBinary.length);
  result.set(meta, 0);
  result.set(roundBinary, meta.length);
  return result;
}
