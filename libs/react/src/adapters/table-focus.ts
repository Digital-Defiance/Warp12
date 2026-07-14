import type { RoundState } from 'warp12-engine';
import { trailKeyFor } from 'warp12-engine';
import {
  computeTrainTree,
  flattenSegments,
  hubTrainStartDistance,
} from 'double-eighteen';

import { gameStateToTrains, neutralZoneSlot } from './game-to-trains.js';

/** Must match DominoHub / DoubleEighteen's standard tile width. */
const DOMINO_WIDTH = 60;

export type ChartSite =
  | { kind: 'warp-trail'; captainId: string; tileIndex: number }
  | { kind: 'neutral-zone'; tileIndex: number }
  | { kind: 'fracture-stabilizer'; trailPlayerId: string };

export interface TableFocusPoint {
  x: number;
  y: number;
  key: string;
}

export interface TableFocusOptions {
  round: RoundState;
  site: ChartSite;
  layoutStyle: 'offset' | 'linear';
  centerX: number;
  centerY: number;
  hubRadius: number;
  hubSlots: number;
}

/** Detect where a new coordinate was charted between two round snapshots. */
export function detectNewChart(
  previous: RoundState | null,
  next: RoundState
): ChartSite | null {
  if (!previous || previous.roundNumber !== next.roundNumber) {
    return null;
  }

  const prevFracture = previous.table.subspaceFracture;
  const nextFracture = next.table.subspaceFracture;
  if (
    nextFracture &&
    (prevFracture?.stabilizers.length ?? 0) < nextFracture.stabilizers.length
  ) {
    for (const captainId of next.turnOrder) {
      // Module Zeta: read the shared squad trail via trailKeyFor — a
      // squadmate who isn't the trail's canonical owner has no entry keyed
      // by their own id, which would otherwise crash on trail.tiles below.
      const trail = next.table.warpTrails[trailKeyFor(next, captainId)];
      if (
        trail?.tiles.some((tile) => tile.index === nextFracture.anchor.index)
      ) {
        return { kind: 'fracture-stabilizer', trailPlayerId: captainId };
      }
    }
  }

  const prevNeutral = previous.table.neutralZone.tiles.length;
  const nextNeutral = next.table.neutralZone.tiles.length;
  if (nextNeutral > prevNeutral) {
    return { kind: 'neutral-zone', tileIndex: nextNeutral - 1 };
  }

  // Module Zeta: compare by the shared trail's canonical key, not raw
  // captainId — a non-owner squadmate has no entry under their own id (always
  // 0,0), so raw-id comparison would misattribute every shared-trail chart to
  // the trailKey owner's seat and pan the camera to the wrong hub position.
  // We still report the trailKey owner as `captainId` (detectNewChart can't
  // see which squadmate actually acted from a snapshot diff alone) — the pan
  // target is at least a real, consistent seat for that squad rather than
  // silently missing the change.
  const seenTrailKeys = new Set<string>();
  for (const captainId of next.turnOrder) {
    const trailKey = trailKeyFor(next, captainId);
    if (seenTrailKeys.has(trailKey)) {
      continue;
    }
    seenTrailKeys.add(trailKey);
    const prevLen = previous.table.warpTrails[trailKey]?.tiles.length ?? 0;
    const nextLen = next.table.warpTrails[trailKey]?.tiles.length ?? 0;
    if (nextLen > prevLen) {
      return {
        kind: 'warp-trail',
        captainId: trailKey,
        tileIndex: nextLen - 1,
      };
    }
  }

  return null;
}

function trainSlotOrigin(
  slot: number,
  hubSlots: number,
  centerX: number,
  centerY: number,
  hubRadius: number,
  layoutStyle: 'offset' | 'linear'
): { startX: number; startY: number; angle: number } {
  const angle = (slot * 360) / hubSlots;
  const radians = (angle * Math.PI) / 180;
  const startDistance = hubTrainStartDistance(
    hubSlots,
    hubRadius,
    DOMINO_WIDTH,
    layoutStyle
  );
  return {
    startX: centerX + startDistance * Math.cos(radians),
    startY: centerY + startDistance * Math.sin(radians),
    angle,
  };
}

export function computeTableFocusPoint(
  options: TableFocusOptions
): TableFocusPoint | null {
  const trains = gameStateToTrains(options.round, options.hubSlots);
  const { site, layoutStyle, centerX, centerY, hubRadius, hubSlots } = options;

  let slot: number;
  let tileIndex: number | null;

  switch (site.kind) {
    case 'warp-trail':
      slot = options.round.turnOrder.indexOf(site.captainId);
      tileIndex = site.tileIndex;
      break;
    case 'neutral-zone':
      slot = neutralZoneSlot(hubSlots);
      tileIndex = site.tileIndex;
      break;
    case 'fracture-stabilizer':
      slot = options.round.turnOrder.indexOf(site.trailPlayerId);
      tileIndex = null;
      break;
    default:
      return null;
  }

  if (slot < 0) {
    return null;
  }

  const train = trains.find((entry) => entry.playerId === slot);
  if (!train) {
    return null;
  }

  const origin = trainSlotOrigin(
    slot,
    hubSlots,
    centerX,
    centerY,
    hubRadius,
    layoutStyle
  );
  const layout = flattenSegments(
    computeTrainTree({
      startX: origin.startX,
      startY: origin.startY,
      angle: origin.angle,
      branch: { dominoes: train.dominoes, feet: train.feet },
      layoutStyle,
    })
  );

  const entry =
    tileIndex != null && tileIndex >= 0
      ? layout[tileIndex] ?? layout.at(-1)
      : layout.at(-1);

  if (!entry) {
    return null;
  }

  const key =
    site.kind === 'warp-trail'
      ? `warp:${site.captainId}:${site.tileIndex}`
      : site.kind === 'neutral-zone'
        ? `neutral:${site.tileIndex}`
        : `fracture:${site.trailPlayerId}:${options.round.table.subspaceFracture?.stabilizers.length ?? 0}`;

  return { x: entry.x, y: entry.y, key };
}

/** Pan offset so content point sits at the viewport center at the given scale. */
export function panToCenterContentPoint(
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
  contentX: number,
  contentY: number
): { x: number; y: number } {
  return {
    x: viewportWidth / 2 - contentX * scale,
    y: viewportHeight / 2 - contentY * scale,
  };
}
