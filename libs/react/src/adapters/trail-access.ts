import {
  hasRedAlertPassed,
  isTrueRedAlert,
  trailsOpenToOthers,
  trailOpenValue,
  neutralZoneOpenValue,
  type RedAlert,
  type RoundState,
} from 'warp12-engine';

import { neutralZoneSlot } from './game-to-trains.js';

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

  const nzSlot = neutralZoneSlot(hubSlots);

  for (let slot = 0; slot < hubSlots; slot += 1) {
    if (slot === nzSlot) {
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

/** True during Yellow alert — engine `redAlert.passed` is not yet set. */
export function isRedAlertFresh(round: RoundState): boolean {
  const redAlert = round.table.redAlert;
  return isTrueRedAlert(round) && !hasRedAlertPassed(redAlert);
}

/** Bridge emergency lighting — amber Yellow alert before the first pass. */
export function shouldIlluminateBridgeYellowAlert(round: RoundState): boolean {
  return isRedAlertFresh(round);
}

/** Bridge emergency lighting — full Red alert after pass. */
export function shouldIlluminateBridgeRedAlert(round: RoundState): boolean {
  return isTrueRedAlert(round) && !isRedAlertFresh(round);
}

export interface SectorRedAlertRow {
  readonly label: string;
  readonly summary: string;
  readonly tone: 'yellow' | 'alert';
}

/** Sector status row for an active Red Alert (Yellow alert on first chart, Red alert after pass). */
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
      label: 'Yellow alert',
      summary: `A double has been played — ${low}:${high}`,
      tone: 'yellow',
    };
  }

  return {
    label: 'Red alert',
    summary: formatRedAlertStatus(redAlert, names),
    tone: 'alert',
  };
}
