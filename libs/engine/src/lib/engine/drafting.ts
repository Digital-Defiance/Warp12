import type { Coordinate } from '../types/coordinate.js';
import type { DraftState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';

/**
 * Calculate pack size for drafting based on player count and available tiles.
 * Formula: floor(availableTiles / playerCount)
 * 
 * Example for W12 with 4 players:
 * - Total tiles: 91
 * - Spacedock removed: 90
 * - Pack size: floor(90 / 4) = 22 tiles per pack
 * - Total dealt: 22 * 4 = 88 tiles (2 remain in uncharted)
 */
export function calculatePackSize(
  playerCount: number,
  availableTiles: number
): number {
  if (playerCount === 0) return 0;
  return Math.floor(availableTiles / playerCount);
}

/**
 * Initialize draft state from shuffled coordinates.
 * Distributes tiles into packs, one per captain.
 */
export function initializeDraftState(
  captainIds: readonly PlayerId[],
  shuffledTiles: readonly Coordinate[],
  packSize: number
): DraftState {
  const currentPacks: Record<string, Coordinate[]> = {};
  const pickedTiles: Record<string, Coordinate[]> = {};

  // Distribute packs
  captainIds.forEach((id, index) => {
    const start = index * packSize;
    const end = start + packSize;
    currentPacks[id] = shuffledTiles.slice(start, end);
    pickedTiles[id] = [];
  });

  return {
    currentDrafter: captainIds[0],
    draftOrder: [...captainIds],
    pickNumber: 1,
    currentPacks,
    pickedTiles,
  };
}

/**
 * Process a pick: move tile from pack to picked, pass pack clockwise.
 * Returns updated draft state and remaining uncharted tiles.
 */
export function processDraftPick(
  state: DraftState,
  playerId: PlayerId,
  coordinate: Coordinate
): DraftState {
  const pack = state.currentPacks[playerId];
  if (!pack) {
    throw new Error(`No pack for player ${playerId}`);
  }

  // Remove picked tile from pack
  const pickedIndex = pack.findIndex(
    (c) => c.low === coordinate.low && c.high === coordinate.high
  );
  if (pickedIndex === -1) {
    throw new Error('Coordinate not in pack');
  }

  const newPack = [...pack.slice(0, pickedIndex), ...pack.slice(pickedIndex + 1)];

  // Add to picked tiles
  const newPickedTiles = {
    ...state.pickedTiles,
    [playerId]: [...state.pickedTiles[playerId], coordinate],
  };

  // Pass packs clockwise (each captain gets the pack from their right)
  const newCurrentPacks: Record<string, readonly Coordinate[]> = {};
  state.draftOrder.forEach((id) => {
    if (id === playerId) {
      // Current drafter gets their reduced pack
      newCurrentPacks[id] = newPack;
    } else {
      // Others keep their packs (will rotate after everyone picks)
      newCurrentPacks[id] = state.currentPacks[id];
    }
  });

  // Advance to next drafter
  const currentIndex = state.draftOrder.indexOf(playerId);
  const nextIndex = (currentIndex + 1) % state.draftOrder.length;
  const nextDrafter = state.draftOrder[nextIndex];

  // If we've completed a full round, rotate packs and increment pick number
  const completedRound = nextIndex === 0;
  let finalPacks: Readonly<Record<string, readonly Coordinate[]>> = newCurrentPacks;
  let finalPickNumber = state.pickNumber;

  if (completedRound) {
    // Rotate packs clockwise: each captain gets the pack from their right
    const rotatedPacks: Record<string, readonly Coordinate[]> = {};
    state.draftOrder.forEach((id, index) => {
      const rightIndex =
        (index + state.draftOrder.length - 1) % state.draftOrder.length;
      const rightId = state.draftOrder[rightIndex];
      rotatedPacks[id] = newCurrentPacks[rightId];
    });
    finalPacks = rotatedPacks;
    finalPickNumber = state.pickNumber + 1;
  }

  return {
    ...state,
    currentDrafter: nextDrafter,
    pickNumber: finalPickNumber,
    currentPacks: finalPacks,
    pickedTiles: newPickedTiles,
  };
}

/**
 * Check if drafting is complete (all tiles picked or packs empty).
 */
export function isDraftComplete(state: DraftState): boolean {
  // Draft is complete when all packs are empty
  return Object.values(state.currentPacks).every((pack) => pack.length === 0);
}

/**
 * Collect all remaining tiles from packs (returns to uncharted after draft).
 */
export function collectRemainingTiles(state: DraftState): Coordinate[] {
  const remaining: Coordinate[] = [];
  Object.values(state.currentPacks).forEach((pack) => {
    remaining.push(...pack);
  });
  return remaining;
}

/**
 * Execute a synchronous draft for AI/local games (all picks happen immediately).
 * Used when initializing a game offline where all captains are AI or local.
 * 
 * Pack-and-pass draft:
 * - Each player gets an initial pack of N tiles
 * - In each round, every player picks 1 tile from their current pack
 * - Packs rotate clockwise after each round (not after each individual pick)
 * - Continues until desired hand size is reached
 * 
 * @param availableTiles - Pool of tiles after spacedock removal
 * @param playerOrder - Draft/turn order
 * @param packSize - Tiles per pack (should be >= desired hand size)
 * @param pickFn - Function that picks a tile from a pack for each player
 * @param desiredHandSize - Tiles each captain keeps (defaults to packSize when omitted)
 * @returns Final hands and remaining uncharted tiles
 */
export function executeSyncDraft(
  availableTiles: readonly Coordinate[],
  playerOrder: readonly PlayerId[],
  packSize: number,
  pickFn: (playerId: PlayerId, pack: readonly Coordinate[]) => Coordinate,
  desiredHandSize?: number
): {
  hands: Readonly<Record<PlayerId, readonly Coordinate[]>>;
  remaining: Coordinate[];
} {
  const tiles = [...availableTiles];
  
  // Initialize packs and hands
  const currentPacks: Record<string, Coordinate[]> = {};
  const hands: Record<string, Coordinate[]> = {};
  
  // Distribute initial packs
  playerOrder.forEach((id, index) => {
    const start = index * packSize;
    const end = start + packSize;
    currentPacks[id] = tiles.slice(start, end);
    hands[id] = [];
  });
  
  // Any tiles that didn't fit into packs go directly to uncharted
  const tilesInPacks = packSize * playerOrder.length;
  const leftoverTiles = tiles.slice(tilesInPacks);
  
  const targetHandSize = desiredHandSize ?? packSize;
  
  // Execute picks until each player has desired hand size
  for (let round = 0; round < targetHandSize; round++) {
    // Each player picks one tile in this round
    for (const playerId of playerOrder) {
      const pack = currentPacks[playerId];
      
      if (pack.length === 0) {
        // No more tiles in this pack, stop drafting
        break;
      }
      
      // Let the pick function choose a tile
      const picked = pickFn(playerId, pack);
      
      // Remove picked tile from pack
      const pickedIndex = pack.findIndex(
        (c) => c.low === picked.low && c.high === picked.high
      );
      if (pickedIndex === -1) {
        throw new Error('Coordinate not in pack');
      }
      pack.splice(pickedIndex, 1);
      
      // Add to hand
      hands[playerId].push(picked);
    }
    
    // After everyone has picked, rotate packs clockwise
    // Each captain gets the pack from their right
    const tempPacks: Record<string, Coordinate[]> = {};
    playerOrder.forEach((id, index) => {
      const rightIndex = (index + playerOrder.length - 1) % playerOrder.length;
      const rightId = playerOrder[rightIndex];
      tempPacks[id] = currentPacks[rightId];
    });
    Object.assign(currentPacks, tempPacks);
  }
  
  // Collect remaining tiles from all packs + leftover tiles
  const remaining: Coordinate[] = [...leftoverTiles];
  playerOrder.forEach((id) => {
    remaining.push(...currentPacks[id]);
  });
  
  return { hands, remaining };
}

