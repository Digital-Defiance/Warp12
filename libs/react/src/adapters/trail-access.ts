import {
  isTrueRedAlert,
  trailsOpenToOthers,
  trailOpenValue,
  neutralZoneOpenValue,
  type RedAlert,
  type RoundState,
} from 'warp12-engine';

import { NEUTRAL_ZONE_SLOT } from './game-to-trains.js';

export type TrailAccessState = 'open' | 'shields' | 'neutral' | 'red-alert';

export interface TrailSpokeStatus {
  readonly slot: number;
  readonly captainId: string | null;
  readonly label: string;
  readonly state: TrailAccessState;
  readonly connectValue: number;
}

/** Whether other captains may chart on this warp trail. */
export function isWarpTrailOpenToOthers(
  round: RoundState,
  captainId: string
): boolean {
  return trailsOpenToOthers(round, captainId);
}

export function buildTrailSpokeStatuses(
  round: RoundState,
  names: Readonly<Record<string, string>>,
  hubSlots: number
): TrailSpokeStatus[] {
  const slotByCaptain = new Map(
    round.turnOrder.map((captainId, index) => [captainId, index])
  );
  const statuses: TrailSpokeStatus[] = [];

  for (let slot = 0; slot < hubSlots; slot += 1) {
    if (slot === NEUTRAL_ZONE_SLOT) {
      statuses.push({
        slot,
        captainId: null,
        label: 'Neutral',
        state: 'neutral',
        connectValue: neutralZoneOpenValue(
          round.table.neutralZone,
          round.spacedockValue
        ),
      });
      continue;
    }

    const captainId = round.turnOrder.find(
      (id) => slotByCaptain.get(id) === slot
    );
    if (!captainId) {
      continue;
    }

    const trail = round.table.warpTrails[captainId];
    const connectValue = trailOpenValue(trail, round.spacedockValue);
    const redAlertTrail =
      round.table.redAlert?.active &&
      round.table.redAlert.trailPlayerId === captainId;

    let state: TrailAccessState = 'shields';
    if (redAlertTrail) {
      state = 'red-alert';
    } else if (isWarpTrailOpenToOthers(round, captainId)) {
      state = 'open';
    }

    statuses.push({
      slot,
      captainId,
      label: names[captainId] ?? captainId,
      state,
      connectValue,
    });
  }

  return statuses;
}

export function openTrailCaptainNames(
  statuses: readonly TrailSpokeStatus[]
): string[] {
  return statuses
    .filter((spoke) => spoke.state === 'open' && spoke.captainId)
    .map((spoke) => spoke.label);
}

/** Human-readable Red Alert line for HUDs (trail owner, tile, who must cover). */
export function formatRedAlertStatus(
  redAlert: RedAlert,
  names: Readonly<Record<string, string>>
): string {
  const { low, high } = redAlert.anchor.coordinate;
  const tile = `${low}:${high}`;

  if (redAlert.neutralZone) {
    const responsible =
      names[redAlert.responsiblePlayerId ?? ''] ?? 'Next captain';
    return `${tile} on Neutral zone · ${responsible} must cover`;
  }

  const trailOwner =
    names[redAlert.trailPlayerId] ?? redAlert.trailPlayerId;
  const responsibleId = redAlert.responsiblePlayerId;

  if (!responsibleId || responsibleId === redAlert.trailPlayerId) {
    return `${trailOwner} · ${tile}`;
  }

  const responsible = names[responsibleId] ?? responsibleId;
  return `${trailOwner} · ${tile} · ${responsible} must cover`;
}

/** True while the double is newly charted and no one has passed Red Alert yet. */
export function isRedAlertFresh(round: RoundState): boolean {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active || !isTrueRedAlert(round)) {
    return false;
  }

  // Authoritative once the engine records the first pass. The beacon heuristic
  // below is a fallback for legacy states without the flag (and covers a free
  // pass that leaves no beacon behind).
  if (redAlert.passed === true) {
    return false;
  }

  const responsible = redAlert.responsiblePlayerId;
  for (const [playerId, trail] of Object.entries(round.table.warpTrails)) {
    if (trail.distressBeacon.active && playerId !== responsible) {
      return false;
    }
  }
  return true;
}

export interface SectorRedAlertRow {
  readonly label: string;
  readonly summary: string;
  readonly tone: 'caution' | 'alert';
}

/** Sector status row for an active Red Alert (Caution on first chart, Red alert after pass). */
export function formatSectorRedAlertRow(
  round: RoundState,
  names: Readonly<Record<string, string>>
): SectorRedAlertRow | null {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active || !isTrueRedAlert(round)) {
    return null;
  }

  if (isRedAlertFresh(round)) {
    const { low, high } = redAlert.anchor.coordinate;
    return {
      label: 'Caution',
      summary: `A double has been played — ${low}:${high}`,
      tone: 'caution',
    };
  }

  return {
    label: 'Red alert',
    summary: formatRedAlertStatus(redAlert, names),
    tone: 'alert',
  };
}
