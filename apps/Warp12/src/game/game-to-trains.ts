import type { Coordinate, PlacedCoordinate } from '@warp12/Warp12-lib';
import { trailsOpenToOthers, type RoundState } from '@warp12/Warp12-lib';
import type { TrainBranch, TrainData } from 'doubletwelve';
import type { DominoValue } from 'doubletwelve';

/** Hub arm reserved for the Neutral Zone (8-spoke layout). */
export const NEUTRAL_ZONE_SLOT = 7;

/** Map engine placement to domino halves with value1 toward the connecting end. */
export function placedToDomino(
  placed: PlacedCoordinate,
  connectValue?: number
): DominoValue {
  const { coordinate } = placed;

  if (connectValue !== undefined) {
    if (coordinate.low === connectValue) {
      return { value1: coordinate.low, value2: coordinate.high };
    }
    if (coordinate.high === connectValue) {
      return { value1: coordinate.high, value2: coordinate.low };
    }
  }

  const { openValue } = placed;
  const connectEnd =
    coordinate.low === openValue ? coordinate.high : coordinate.low;

  return { value1: connectEnd, value2: openValue };
}

/** Walk a trail so each tile's value1 faces the hub or previous open end. */
export function tilesToDominoChain(
  tiles: readonly PlacedCoordinate[],
  hubValue: number
): DominoValue[] {
  let connecting = hubValue;
  const chain: DominoValue[] = [];

  for (const tile of tiles) {
    const domino = placedToDomino(tile, connecting);
    chain.push(domino);
    connecting = tile.openValue;
  }

  return chain;
}

function stabilizerFeet(
  round: RoundState,
  trailPlayerId: string
): Record<number, TrainBranch[]> | undefined {
  const fracture = round.table.subspaceFracture;
  if (!fracture || fracture.stabilizers.length === 0) {
    return undefined;
  }

  const trail = round.table.warpTrails[trailPlayerId];
  const anchorIndex = trail.tiles.findIndex(
    (tile) => tile.index === fracture.anchor.index
  );

  if (anchorIndex === -1) {
    return undefined;
  }

  const sideToes = fracture.stabilizers.slice(0, 2).map((stabilizer) => ({
    dominoes: [
      placedToDomino(stabilizer, fracture.requiredValue),
    ],
  }));

  if (sideToes.length === 0) {
    return undefined;
  }

  return { [anchorIndex]: sideToes };
}

export function gameStateToTrains(
  round: RoundState,
  hubSlots = 8
): TrainData[] {
  const trains: TrainData[] = [];
  const hubValue = round.spacedockValue;
  const slotByCaptain = new Map(
    round.turnOrder.map((captainId, index) => [captainId, index])
  );

  for (const captainId of round.turnOrder) {
    const slot = slotByCaptain.get(captainId)!;
    const trail = round.table.warpTrails[captainId];
    let dominoes = tilesToDominoChain(trail.tiles, hubValue);
    const fracture = round.table.subspaceFracture;

    if (
      fracture &&
      fracture.stabilizers.length >= 3 &&
      round.turnOrder.find((id) =>
        round.table.warpTrails[id].tiles.some(
          (tile) => tile.index === fracture.anchor.index
        )
      ) === captainId
    ) {
      const anchorIndex = fracture.anchor.index;
      const centerTile = fracture.stabilizers[2];
      const before = dominoes.slice(0, anchorIndex + 1);
      const center = placedToDomino(centerTile, fracture.requiredValue);
      const after = tilesToDominoChain(
        trail.tiles.slice(anchorIndex + 1),
        centerTile.openValue
      );
      dominoes = [...before, center, ...after];
    }

    trains.push({
      playerId: slot,
      isPublic: trailsOpenToOthers(round, captainId),
      dominoes,
      feet: stabilizerFeet(round, captainId),
    });
  }

  if (round.table.neutralZone.tiles.length > 0 || hubSlots > round.turnOrder.length) {
    trains.push({
      playerId: NEUTRAL_ZONE_SLOT,
      isPublic: true,
      dominoes: tilesToDominoChain(round.table.neutralZone.tiles, hubValue),
    });
  }

  return trains;
}

export function coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
  return a.low === b.low && a.high === b.high;
}

export function routeLabel(
  route: import('@warp12/Warp12-lib').ChartRoute,
  captainNames: Readonly<Record<string, string>>
): string {
  switch (route.kind) {
    case 'warp-trail':
      return `Warp trail · ${captainNames[route.playerId] ?? route.playerId}`;
    case 'neutral-zone':
      return 'Neutral zone';
    case 'fracture-stabilizer':
      return 'Stabilize fracture';
    case 'red-alert-cover':
      return `Cover red alert · ${captainNames[route.trailPlayerId] ?? route.trailPlayerId}`;
  }
}
