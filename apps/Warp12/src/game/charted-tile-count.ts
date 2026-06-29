import type { RoundState } from 'warp12-engine';

/** Tiles charted on warp trails, neutral zone, and open fracture stabilizers. */
export function countChartedTilesOnTable(round: RoundState): number {
  let count = 0;
  for (const trail of Object.values(round.table.warpTrails)) {
    count += trail.tiles.length;
  }
  count += round.table.neutralZone.tiles.length;
  const fracture = round.table.subspaceFracture;
  if (fracture?.active) {
    count += fracture.stabilizers.length;
  }
  return count;
}
