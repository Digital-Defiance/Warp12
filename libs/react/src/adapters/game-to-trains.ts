import type { Coordinate, PlacedCoordinate } from 'warp12-engine';
import { trailsOpenToOthers, type RoundState } from 'warp12-engine';
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

function tileMatchesValue(tile: PlacedCoordinate, value: number): boolean {
  return (
    tile.coordinate.low === value || tile.coordinate.high === value
  );
}

function isDoubleCoordinate(coordinate: PlacedCoordinate['coordinate']): boolean {
  return coordinate.low === coordinate.high;
}

function findBranchAnchorIndex(
  dominoes: DominoValue[],
  coordinate: PlacedCoordinate['coordinate']
): number {
  for (let idx = dominoes.length - 1; idx >= 0; idx -= 1) {
    const domino = dominoes[idx]!;
    if (
      domino.value1 === domino.value2 &&
      (coordinate.low === domino.value1 || coordinate.high === domino.value1)
    ) {
      return idx;
    }
  }
  return -1;
}

function appendFoot(
  feet: Record<number, TrainBranch[]>,
  anchorIdx: number,
  domino: DominoValue
): void {
  feet[anchorIdx] = [...(feet[anchorIdx] ?? []), { dominoes: [domino] }];
}

function appendSideFeet(
  feet: Record<number, TrainBranch[]>,
  anchorIdx: number,
  stabilizers: readonly PlacedCoordinate[],
  pip: number
): void {
  for (const stabilizer of stabilizers) {
    appendFoot(feet, anchorIdx, placedToDomino(stabilizer, pip));
  }
}

/** Walk a trail, branching archived fracture stabilizers off their anchor double. */
function buildTrainLayout(
  tiles: readonly PlacedCoordinate[],
  hubValue: number
): { dominoes: DominoValue[]; feet: Record<number, TrainBranch[]> } {
  let connecting = hubValue;
  const dominoes: DominoValue[] = [];
  const feet: Record<number, TrainBranch[]> = {};
  let i = 0;

  while (i < tiles.length) {
    const tile = tiles[i]!;

    if (!tileMatchesValue(tile, connecting)) {
      const anchorIdx = findBranchAnchorIndex(dominoes, tile.coordinate);
      if (anchorIdx !== -1) {
        const pip = dominoes[anchorIdx]!.value1;
        appendFoot(feet, anchorIdx, placedToDomino(tile, pip));
        i += 1;
        continue;
      }
    }

    dominoes.push(placedToDomino(tile, connecting));

    if (
      isDoubleCoordinate(tile.coordinate) &&
      i + 1 < tiles.length &&
      tileMatchesValue(tiles[i + 1]!, tile.coordinate.low)
    ) {
      const pip = tile.coordinate.low;
      const branchTiles: PlacedCoordinate[] = [];
      let j = i + 1;
      while (
        j < tiles.length &&
        branchTiles.length < 3 &&
        tileMatchesValue(tiles[j]!, pip)
      ) {
        branchTiles.push(tiles[j]!);
        j += 1;
      }
      if (branchTiles.length >= 2) {
        const anchorIdx = dominoes.length - 1;
        appendSideFeet(feet, anchorIdx, branchTiles.slice(0, 2), pip);

        if (branchTiles.length >= 3) {
          const centerStabilizer = branchTiles[2]!;
          dominoes.push(placedToDomino(centerStabilizer, pip));
          connecting = centerStabilizer.openValue;
        } else {
          connecting = tile.openValue;
        }

        i = j;
        continue;
      }
    }

    connecting = tile.openValue;
    i += 1;
  }

  return { dominoes, feet };
}

/** Walk a trail so each tile's value1 faces the hub or previous open end. */
export function tilesToDominoChain(
  tiles: readonly PlacedCoordinate[],
  hubValue: number
): DominoValue[] {
  return buildTrainLayout(tiles, hubValue).dominoes;
}

function findFractureAnchorIndex(
  tiles: readonly PlacedCoordinate[],
  fracture: NonNullable<RoundState['table']['subspaceFracture']>
): number {
  return tiles.findIndex((tile) => tile.index === fracture.anchor.index);
}

function stabilizerFeet(
  fracture: NonNullable<RoundState['table']['subspaceFracture']>,
  anchorIndex: number
): Record<number, TrainBranch[]> | undefined {
  const sideToes = fracture.stabilizers.slice(0, 2).map((stabilizer) => ({
    dominoes: [placedToDomino(stabilizer, fracture.requiredValue)],
  }));

  if (sideToes.length === 0) {
    return undefined;
  }

  return { [anchorIndex]: sideToes };
}

function dominoIndexForTileAnchor(
  tiles: readonly PlacedCoordinate[],
  hubValue: number,
  anchorTileIndex: number
): number {
  const { dominoes } = buildTrainLayout(
    tiles.slice(0, anchorTileIndex + 1),
    hubValue
  );
  return dominoes.length - 1;
}

function layoutFromTiles(
  tiles: readonly PlacedCoordinate[],
  hubValue: number,
  fracture?: RoundState['table']['subspaceFracture'] | null,
  anchorCaptain?: string
): { dominoes: DominoValue[]; feet?: Record<number, TrainBranch[]> } {
  const { dominoes, feet: archivedFeet } = buildTrainLayout(tiles, hubValue);
  const feet: Record<number, TrainBranch[]> = { ...archivedFeet };

  if (!fracture?.active) {
    return Object.keys(feet).length > 0 ? { dominoes, feet } : { dominoes };
  }

  const anchorTileIndex = findFractureAnchorIndex(tiles, fracture);
  if (anchorTileIndex === -1) {
    return Object.keys(feet).length > 0 ? { dominoes, feet } : { dominoes };
  }

  if (
    anchorCaptain !== undefined &&
    fracture.trailCaptainId !== undefined &&
    fracture.trailCaptainId !== anchorCaptain
  ) {
    return Object.keys(feet).length > 0 ? { dominoes, feet } : { dominoes };
  }

  const anchorDominoIndex = dominoIndexForTileAnchor(
    tiles,
    hubValue,
    anchorTileIndex
  );
  const activeFeet = stabilizerFeet(fracture, anchorDominoIndex);
  if (activeFeet) {
    const merged = feet[anchorDominoIndex] ?? [];
    feet[anchorDominoIndex] = [...merged, ...activeFeet[anchorDominoIndex]!];
  }

  return Object.keys(feet).length > 0 ? { dominoes, feet } : { dominoes };
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
  const fracture = round.table.subspaceFracture;

  for (const captainId of round.turnOrder) {
    const slot = slotByCaptain.get(captainId)!;
    const trail = round.table.warpTrails[captainId];
    const fractureOnTrail =
      fracture && !fracture.neutralZone && fracture.trailCaptainId === captainId
        ? fracture
        : null;
    const { dominoes, feet } = layoutFromTiles(
      trail.tiles,
      hubValue,
      fractureOnTrail,
      captainId
    );

    trains.push({
      playerId: slot,
      isPublic: trailsOpenToOthers(round, captainId),
      dominoes,
      feet,
    });
  }

  if (round.table.neutralZone.tiles.length > 0 || hubSlots > round.turnOrder.length) {
    const fractureOnNz = fracture?.neutralZone ? fracture : null;
    const { dominoes, feet } = layoutFromTiles(
      round.table.neutralZone.tiles,
      hubValue,
      fractureOnNz
    );

    trains.push({
      playerId: NEUTRAL_ZONE_SLOT,
      isPublic: true,
      dominoes,
      feet,
    });
  }

  return trains;
}

export function coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
  return a.low === b.low && a.high === b.high;
}

export function routeLabel(
  route: import('warp12-engine').ChartRoute,
  captainNames: Readonly<Record<string, string>>
): string {
  switch (route.kind) {
    case 'warp-trail':
      return `Warp trail · ${captainNames[route.playerId] ?? route.playerId}`;
    case 'neutral-zone':
      return 'Neutral zone';
    case 'fracture-stabilizer':
      return 'Stabilize fracture';
    case 'red-alert-cover': {
      if (route.neutralZone) {
        return 'Cover red alert · Neutral zone';
      }
      const trailId = route.trailPlayerId ?? 'fleet';
      return `Cover red alert · ${captainNames[trailId] ?? trailId}`;
    }
  }
}
