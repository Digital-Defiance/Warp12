import { hubTrainStartDistance } from 'double-eighteen';

/** Default 8-spoke Neutral Zone arm (legacy double-12 tables). */
export const NEUTRAL_ZONE_SLOT = 7;

/** DominoHub / DoubleEighteen standard tile width. */
export const HUB_DOMINO_WIDTH = 60;

/** Spacedock ring radius — DominoHub's visual hub is ~120px; this floors train start. */
export const HUB_RING_RADIUS = 80;

/**
 * Hub arms for a fleet: one spoke per captain plus a dedicated Neutral Zone arm.
 * Floored at 8 so small fleets keep the familiar double-12 geometry.
 */
export function hubSlotsForCaptainCount(captainCount: number): number {
  return Math.max(8, captainCount + 1);
}

/** Neutral Zone always occupies the last hub arm. */
export function neutralZoneSlot(hubSlots: number): number {
  return hubSlots - 1;
}

export function hubSlotsForRound(turnOrderLength: number): number {
  return hubSlotsForCaptainCount(turnOrderLength);
}

export interface HubTableGeometry {
  readonly hubSlots: number;
  readonly tableWidth: number;
  readonly tableHeight: number;
  readonly centerX: number;
  readonly centerY: number;
  /** Spacedock ring radius passed to DominoHub. */
  readonly hubRadius: number;
  /** Distance from center to first train tile. */
  readonly startDistance: number;
}

/**
 * Distance from hub center to trail-status badge centers.
 * Small fleets stay just outside the spacedock; large fleets push into the
 * empty ring before trains so icons don't pile onto the hub.
 */
export function spokeBadgeRingDistance(
  hubSlots: number,
  hubRadius: number,
  startDistance: number
): number {
  const minPadding = 12;
  const trainClearance = 52;
  const minArcGap = 36;
  const minDistance = hubRadius + minPadding;
  const maxDistance = Math.max(minDistance, startDistance - trainClearance);
  const arcDistance = (minArcGap * hubSlots) / (2 * Math.PI);
  if (hubSlots <= 10) {
    return Math.min(maxDistance, Math.max(minDistance, arcDistance));
  }
  const gap = Math.max(0, startDistance - hubRadius);
  const midGap = hubRadius + gap * 0.42;
  return Math.min(maxDistance, Math.max(minDistance, arcDistance, midGap));
}

/**
 * Grow the canvas so trains clear the viewport edge as spoke count rises.
 * Tile size stays DominoHub's 60px; density is managed by startDistance.
 */
export function hubTableGeometry(
  captainCount: number,
  layoutStyle: 'offset' | 'linear' = 'offset'
): HubTableGeometry {
  const hubSlots = hubSlotsForCaptainCount(captainCount);
  const hubRadius = HUB_RING_RADIUS;
  const startDistance = hubTrainStartDistance(
    hubSlots,
    hubRadius,
    HUB_DOMINO_WIDTH,
    layoutStyle
  );
  // Room for ~5–6 tiles beyond the start ring before the canvas edge.
  const extent = Math.ceil(startDistance + HUB_DOMINO_WIDTH * 6);
  const tableWidth = Math.max(1200, extent * 2);
  const tableHeight = Math.max(800, extent * 2);

  return {
    hubSlots,
    tableWidth,
    tableHeight,
    centerX: tableWidth / 2,
    centerY: tableHeight / 2,
    hubRadius,
    startDistance,
  };
}
