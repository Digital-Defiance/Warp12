import type { Coordinate, RoundState } from 'warp12-engine';
import { createInitialTable } from 'warp12-engine';
import type { TrainData } from 'double-eighteen';
import {
  gameStateToTrains,
  hubTableGeometry,
  buildTrailSpokeStatuses,
  type TrailSpokeStatus,
} from 'warp12-react';

const CAPTAIN_NAMES = [
  'Armstrong',
  'Lovell',
  'Earhart',
  'Yeager',
  'Gagarin',
  'Ride',
  'Glenn',
  'Collins',
  'Aldrin',
  'Shepard',
  'Tereshkova',
  'Leonov',
  'Jemison',
  'Hadfield',
  'Pesquet',
  'Williams',
  'Whitson',
  'Kelly',
] as const;

function tile(
  low: number,
  high: number,
  index: number,
  openValue: number
): {
  coordinate: Coordinate;
  index: number;
  openValue: number;
} {
  return { coordinate: { low, high }, index, openValue };
}

/** Seeded short trails + Neutral Zone for visual hub approval. */
export function buildHubHarnessRound(
  captainCount: number,
  maxPip: number
): RoundState {
  const turnOrder = CAPTAIN_NAMES.slice(0, captainCount).map(
    (_, index) => `c${index}`
  );
  const starter = turnOrder[0]!;
  const spacedockValue = maxPip;
  const table = createInitialTable(turnOrder, spacedockValue, starter);

  const warpTrails = { ...table.warpTrails };
  for (const [index, captainId] of turnOrder.entries()) {
    const trail = warpTrails[captainId]!;
    const pip = Math.max(0, maxPip - (index % (maxPip + 1)));
    const next = pip === 0 ? Math.min(1, maxPip) : Math.max(0, pip - 1);
    warpTrails[captainId] = {
      ...trail,
      distressBeacon: { active: index % 3 === 1 },
      tiles: [
        tile(spacedockValue, pip, 0, pip),
        tile(pip, next, 1, next),
      ],
    };
  }

  const nzOpen = Math.max(0, maxPip - 2);
  const neutralZone = {
    tiles: [
      tile(spacedockValue, nzOpen, 0, nzOpen),
      tile(nzOpen, Math.max(0, nzOpen - 1), 1, Math.max(0, nzOpen - 1)),
    ],
  };

  return {
    roundNumber: 1,
    spacedockValue,
    phase: 'playing',
    activePlayerId: starter,
    turnOrder,
    table: {
      ...table,
      warpTrails,
      neutralZone,
      subspaceFracture: null,
      redAlert: null,
    },
    unchartedSectors: [],
    hands: Object.fromEntries(turnOrder.map((id) => [id, []])),
    allStopRequired: false,
    allStopDeclared: false,
    roundWinnerId: null,
    continuumPendingInvoker: null,
    continuumEffects: null,
    continuumWagerPending: null,
    mandatoryPlay: null,
    pendingRoundWin: null,
    roundBlocked: false,
    roundStarterOpening: null,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    playedThisTurn: false,
    drewThisTurn: false,
  };
}

export function hubHarnessCaptainNames(
  captainCount: number
): Record<string, string> {
  return Object.fromEntries(
    CAPTAIN_NAMES.slice(0, captainCount).map((name, index) => [
      `c${index}`,
      name,
    ])
  );
}

export interface HubHarnessScene {
  readonly round: RoundState;
  readonly trains: TrainData[];
  readonly spokes: TrailSpokeStatus[];
  readonly names: Record<string, string>;
  readonly geometry: ReturnType<typeof hubTableGeometry>;
}

export function buildHubHarnessScene(
  captainCount: number,
  maxPip: number,
  layoutStyle: 'offset' | 'linear' = 'offset'
): HubHarnessScene {
  const round = buildHubHarnessRound(captainCount, maxPip);
  const geometry = hubTableGeometry(captainCount, layoutStyle);
  const names = hubHarnessCaptainNames(captainCount);
  return {
    round,
    trains: gameStateToTrains(round, geometry.hubSlots),
    spokes: buildTrailSpokeStatuses(round, names, geometry.hubSlots),
    names,
    geometry,
  };
}
