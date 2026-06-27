import {
  trailsOpenToOthers,
  trailOpenValue,
  type RoundState,
} from '@warp12/Warp12-lib';

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
        connectValue: trailOpenValue(
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
