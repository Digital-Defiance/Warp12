import {
  isDouble,
  isPipExhausted,
  isRedAlertBlocking,
  isTrueRedAlert,
  nextActivePlayerId,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type QFlashEffectKind,
  type RoundState,
} from 'warp12-engine';

import { NEUTRAL_ZONE_SLOT } from '../adapters/game-to-trains.js';

/** True once someone has passed Red Alert on the active double. */
function wasRedAlertPassed(round: RoundState): boolean {
  const redAlert = round.table.redAlert;
  if (!redAlert?.active || !isTrueRedAlert(round)) {
    return false;
  }

  const responsible = redAlert.responsiblePlayerId;
  if (!responsible) {
    return false;
  }

  for (const [playerId, trail] of Object.entries(round.table.warpTrails)) {
    if (!trail.distressBeacon.active || playerId === responsible) {
      continue;
    }
    if (nextActivePlayerId(round, playerId) === responsible) {
      return true;
    }
  }

  return false;
}

export type GameLogKind = GameAction['type'] | 'ROUND_STARTED';

export type GameLogEffect =
  | 'caution-opened'
  | 'caution-cleared'
  | 'red-alert-opened'
  | 'red-alert-cleared'
  | 'q-flash-pending'
  | 'subspace-fracture-opened'
  | 'subspace-fracture-cleared'
  | 'beacon-deployed'
  | 'dead-double'
  | 'round-won'
  | 'round-blocked';

export interface GameLogRoute {
  readonly kind: ChartRoute['kind'];
  readonly trailCaptainId?: string;
  readonly neutralZone?: boolean;
}

export interface GameLogEntry {
  readonly at: string;
  readonly kind: GameLogKind;
  readonly captainId: string;
  readonly trainId?: number;
  readonly coordinate?: Coordinate;
  readonly route?: GameLogRoute;
  readonly qFlashEffect?: QFlashEffectKind;
  readonly winnerId?: string | null;
  readonly nextCaptainId?: string;
  readonly targetCaptainId?: string;
  readonly roundNumber?: number;
  readonly spacedockValue?: number;
  readonly effects: readonly GameLogEffect[];
}

export interface GameLog {
  append(entry: Omit<GameLogEntry, 'at' | 'effects'> & { at?: string; effects?: readonly GameLogEffect[] }): void;
  snapshot(): readonly GameLogEntry[];
  clear(): void;
}

export interface RoundLogExport {
  readonly exportedAt: string;
  readonly roundNumber: number;
  readonly sectorCode?: string;
  readonly roundStartedAtMs: number;
  readonly entries: readonly GameLogEntry[];
  readonly lines: readonly string[];
}

export interface GameLogFormatOptions {
  readonly roundStartedAtMs: number;
}

/** Elapsed time since round start, shown as MM:SS (e.g. 05:12). */
export function formatRoundElapsedTime(
  entryAtIso: string,
  roundStartedAtMs: number
): string {
  const elapsedSec = Math.max(
    0,
    Math.floor((new Date(entryAtIso).getTime() - roundStartedAtMs) / 1000)
  );
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function trainIdForCaptain(round: RoundState, captainId: string): number | undefined {
  const index = round.turnOrder.indexOf(captainId);
  return index >= 0 ? index : undefined;
}

function routeToLogRoute(route: ChartRoute): GameLogRoute {
  switch (route.kind) {
    case 'warp-trail':
      return { kind: route.kind, trailCaptainId: route.playerId };
    case 'neutral-zone':
      return { kind: route.kind, neutralZone: true };
    case 'fracture-stabilizer':
      return { kind: route.kind };
    case 'red-alert-cover':
      return {
        kind: route.kind,
        trailCaptainId: route.trailPlayerId,
        neutralZone: route.neutralZone,
      };
  }
}

function trainIdForRoute(round: RoundState, route: ChartRoute): number | undefined {
  switch (route.kind) {
    case 'warp-trail':
      return trainIdForCaptain(round, route.playerId);
    case 'neutral-zone':
      return NEUTRAL_ZONE_SLOT;
    case 'fracture-stabilizer':
      return undefined;
    case 'red-alert-cover':
      return route.trailPlayerId
        ? trainIdForCaptain(round, route.trailPlayerId)
        : route.neutralZone
          ? NEUTRAL_ZONE_SLOT
          : undefined;
  }
}

function formatLogTime(
  iso: string,
  roundStartedAtMs: number
): string {
  return formatRoundElapsedTime(iso, roundStartedAtMs);
}

function captainLabel(
  captainId: string,
  names: Readonly<Record<string, string>>
): string {
  return names[captainId] ?? captainId;
}

function trailPhrase(
  route: GameLogRoute | undefined,
  actorId: string,
  names: Readonly<Record<string, string>>
): string {
  if (!route) {
    return 'the table';
  }
  switch (route.kind) {
    case 'neutral-zone':
      return 'the Neutral Zone';
    case 'warp-trail': {
      const ownerId = route.trailCaptainId ?? '';
      if (ownerId === actorId) {
        return 'their own Trail';
      }
      return `Captain ${captainLabel(ownerId, names)}'s Trail`;
    }
    case 'fracture-stabilizer':
      return 'a Subspace Fracture stabilizer';
    case 'red-alert-cover': {
      if (route.neutralZone) {
        return 'the Neutral Zone';
      }
      const ownerId = route.trailCaptainId ?? '';
      return `Captain ${captainLabel(ownerId, names)}'s Trail`;
    }
  }
}

function tilePhrase(coordinate: Coordinate | undefined): string {
  if (!coordinate) {
    return 'a coordinate';
  }
  if (isDouble(coordinate)) {
    return `a Double ${coordinate.low}-${coordinate.high}`;
  }
  return `a ${coordinate.low}:${coordinate.high}`;
}

function effectsPhrase(effects: readonly GameLogEffect[]): string {
  const parts: string[] = [];
  for (const effect of effects) {
    switch (effect) {
      case 'caution-opened':
        parts.push('causing a Caution Status');
        break;
      case 'caution-cleared':
        parts.push('clearing the Caution Status');
        break;
      case 'red-alert-opened':
        parts.push('causing a Red Alert');
        break;
      case 'red-alert-cleared':
        parts.push('clearing the Red Alert');
        break;
      case 'q-flash-pending':
        parts.push('causing a Q-Flash');
        break;
      case 'subspace-fracture-opened':
        parts.push('opening Subspace Fracture');
        break;
      case 'subspace-fracture-cleared':
        parts.push('clearing the Subspace Fracture');
        break;
      case 'dead-double':
        parts.push('the Double is dead — no cover required');
        break;
      case 'beacon-deployed':
        parts.push('deploying a Distress Beacon');
        break;
      case 'round-won':
        parts.push('winning the round');
        break;
      case 'round-blocked':
        parts.push('blocking the round');
        break;
    }
  }
  if (parts.length === 0) {
    return '';
  }
  return `, ${parts.join(', ')}`;
}

export function formatGameLogLine(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions
): string {
  const time = formatLogTime(entry.at, options.roundStartedAtMs);
  const name = captainLabel(entry.captainId, names);
  const prefix = `${time} - ${name}`;

  switch (entry.kind) {
    case 'ROUND_STARTED':
      return `${time} - Round ${entry.roundNumber ?? '?'} begins · Spacedock ${entry.spacedockValue ?? '?'}`;
    case 'CHART_COORDINATE':
      return `${prefix} played ${tilePhrase(entry.coordinate)} on ${trailPhrase(entry.route, entry.captainId, names)}${effectsPhrase(entry.effects)}`;
    case 'DRAW_FROM_UNCHARTED':
      if (entry.effects.includes('red-alert-opened')) {
        return `${prefix} drew and could not answer the Double${effectsPhrase(entry.effects)}`;
      }
      return `${prefix} drew from Uncharted Sectors${effectsPhrase(entry.effects)}`;
    case 'PASS_RED_ALERT': {
      const nextCaptain = entry.nextCaptainId
        ? captainLabel(entry.nextCaptainId, names)
        : null;
      const toPhrase = nextCaptain ? ` to ${nextCaptain}` : '';
      return `${prefix} passed Red Alert${toPhrase}${effectsPhrase(entry.effects)}`;
    }
    case 'PASS_TURN':
      return `${prefix} passed turn${effectsPhrase(entry.effects)}`;
    case 'DEPLOY_DISTRESS_BEACON':
      return `${prefix} deployed a Distress Beacon${effectsPhrase(entry.effects)}`;
    case 'ALL_STOP':
      return `${prefix} called All Stop!${effectsPhrase(entry.effects)}`;
    case 'DROP_TO_IMPULSE':
      return `${prefix} called Drop to Impulse!${effectsPhrase(entry.effects)}`;
    case 'CATCH_DROP_TO_IMPULSE': {
      const target = entry.targetCaptainId
        ? captainLabel(entry.targetCaptainId, names)
        : 'a captain';
      return `${prefix} caught ${target} for a missed Drop to Impulse${effectsPhrase(entry.effects)}`;
    }
    case 'RETURN_TO_WARP':
      return `${prefix} returned to warp${effectsPhrase(entry.effects)}`;
    case 'INVOKE_Q_FLASH':
      return `${prefix} invoked Q-Flash · ${entry.qFlashEffect?.replaceAll('-', ' ') ?? 'effect'}${effectsPhrase(entry.effects)}`;
    case 'RESOLVE_Q_GAMBLE':
      return `${prefix} resolved Q-Gamble${effectsPhrase(entry.effects)}`;
    case 'END_ROUND': {
      if (entry.effects.includes('round-blocked')) {
        return `${time} - Round blocked — no legal charts remain`;
      }
      const winner = captainLabel(entry.winnerId ?? entry.captainId, names);
      return `${time} - ${winner} wins the round`;
    }
  }
}

export function gameLogEntryToString(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions
): string {
  return formatGameLogLine(entry, names, options);
}

/** Round starter could not play a second own-trail tile (Deluxe opening rule). */
function roundStarterOpeningBeaconDeployed(
  before: RoundState,
  after: RoundState,
  action: Extract<GameAction, { type: 'CHART_COORDINATE' }>
): boolean {
  if (
    action.route.kind !== 'warp-trail' ||
    action.route.playerId !== action.playerId ||
    action.playerId !== before.table.spacedock.placedBy
  ) {
    return false;
  }

  const playerId = action.playerId;
  const ownTilesBefore = before.table.warpTrails[playerId]?.tiles.length ?? 0;
  const ownTilesAfter = after.table.warpTrails[playerId]?.tiles.length ?? 0;
  const beaconBefore =
    before.table.warpTrails[playerId]?.distressBeacon.active ?? false;
  const beaconAfter =
    after.table.warpTrails[playerId]?.distressBeacon.active ?? false;

  return (
    ownTilesBefore === 0 &&
    ownTilesAfter === 1 &&
    !beaconBefore &&
    beaconAfter &&
    before.activePlayerId === playerId &&
    after.activePlayerId !== playerId
  );
}

function fractureJustResolved(
  before: RoundState,
  after: RoundState
): boolean {
  const beforeFracture = before.table.subspaceFracture;
  const afterFracture = after.table.subspaceFracture;
  return (
    beforeFracture?.active === true &&
    afterFracture?.active === false &&
    beforeFracture.stabilizers.length === 2 &&
    (afterFracture?.stabilizers.length ?? 0) === 3
  );
}

function chartEffects(
  before: RoundState,
  after: RoundState,
  action: Extract<GameAction, { type: 'CHART_COORDINATE' }>
): GameLogEffect[] {
  const effects: GameLogEffect[] = [];
  const beforeAlert = before.table.redAlert;
  const afterAlert = after.table.redAlert;
  const beforeFracture = before.table.subspaceFracture;
  const afterFracture = after.table.subspaceFracture;
  const resolvedFracture = fractureJustResolved(before, after);
  const playedDeadDouble =
    isDouble(action.coordinate) &&
    (action.route.kind === 'warp-trail' ||
      action.route.kind === 'neutral-zone') &&
    isPipExhausted(after, action.coordinate.low);

  if (playedDeadDouble) {
    effects.push('dead-double');
    if (!before.qPendingInvoker && after.qPendingInvoker) {
      effects.push('q-flash-pending');
    }
    return effects;
  }

  if (resolvedFracture) {
    effects.push('subspace-fracture-cleared');
    if (beforeAlert?.active && !afterAlert?.active) {
      effects.push('red-alert-cleared');
    }
  } else if (beforeAlert?.active && !afterAlert?.active) {
    effects.push(
      wasRedAlertPassed(before) ? 'red-alert-cleared' : 'caution-cleared'
    );
  } else if (
    isDouble(action.coordinate) &&
    afterAlert?.active &&
    !beforeAlert?.active
  ) {
    if (afterFracture?.active && !beforeFracture?.active) {
      effects.push('red-alert-opened');
    } else {
      effects.push('caution-opened');
    }
  }

  if (!before.qPendingInvoker && after.qPendingInvoker) {
    effects.push('q-flash-pending');
  }

  if (!beforeFracture?.active && afterFracture?.active) {
    effects.push('subspace-fracture-opened');
  }

  if (roundStarterOpeningBeaconDeployed(before, after, action)) {
    effects.push('beacon-deployed');
  }

  return effects;
}

function drawEffects(
  before: RoundState,
  after: RoundState,
  playerId: string
): GameLogEffect[] {
  const wasBlocking = isRedAlertBlocking(before.table.redAlert, playerId);
  const beaconBefore =
    before.table.warpTrails[playerId]?.distressBeacon.active ?? false;
  const beaconAfter =
    after.table.warpTrails[playerId]?.distressBeacon.active ?? false;

  if (wasBlocking && beaconAfter && !beaconBefore) {
    return ['red-alert-opened'];
  }
  return [];
}

function passRedAlertEffects(before: RoundState, after: RoundState): GameLogEffect[] {
  if (
    !wasRedAlertPassed(before) &&
    after.table.redAlert?.active &&
    isTrueRedAlert(after) &&
    wasRedAlertPassed(after)
  ) {
    return ['red-alert-opened'];
  }
  return [];
}

function endRoundEffects(after: RoundState): GameLogEffect[] {
  if (after.roundBlocked) {
    return ['round-blocked'];
  }
  if (after.roundWinnerId) {
    return ['round-won'];
  }
  return [];
}

export function buildGameLogEntry(
  before: GameState,
  after: GameState,
  action: GameAction
): GameLogEntry | null {
  const beforeRound = before.round;
  const afterRound = after.round;
  if (!beforeRound || !afterRound) {
    return null;
  }

  const at = new Date().toISOString();

  switch (action.type) {
    case 'CHART_COORDINATE':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        trainId: trainIdForRoute(afterRound, action.route),
        coordinate: action.coordinate,
        route: routeToLogRoute(action.route),
        effects: chartEffects(beforeRound, afterRound, action),
      };
    case 'DRAW_FROM_UNCHARTED':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: drawEffects(beforeRound, afterRound, action.playerId),
      };
    case 'PASS_RED_ALERT':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        nextCaptainId:
          afterRound.table.redAlert?.responsiblePlayerId ?? undefined,
        effects: passRedAlertEffects(beforeRound, afterRound),
      };
    case 'PASS_TURN':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: [],
      };
    case 'DEPLOY_DISTRESS_BEACON':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: [],
      };
    case 'ALL_STOP':
    case 'DROP_TO_IMPULSE':
    case 'RETURN_TO_WARP':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: [],
      };
    case 'CATCH_DROP_TO_IMPULSE':
      return {
        at,
        kind: action.type,
        captainId: action.challengerId,
        targetCaptainId: action.targetPlayerId,
        effects: [],
      };
    case 'INVOKE_Q_FLASH':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        qFlashEffect: action.effect,
        effects: [],
      };
    case 'RESOLVE_Q_GAMBLE':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: [],
      };
    case 'END_ROUND':
      return {
        at,
        kind: action.type,
        captainId: action.winnerId ?? '',
        winnerId: action.winnerId,
        effects: endRoundEffects(afterRound),
      };
  }
}

export function buildRoundStartedEntry(
  round: RoundState,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'ROUND_STARTED',
    captainId: '',
    roundNumber: round.roundNumber,
    spacedockValue: round.spacedockValue,
    effects: [],
  };
}

export function buildRoundOutcomeEntry(
  round: RoundState,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'END_ROUND',
    captainId: round.roundWinnerId ?? '',
    winnerId: round.roundWinnerId,
    effects: endRoundEffects(round),
  };
}

export function buildRoundLogExport(
  entries: readonly GameLogEntry[],
  roundNumber: number,
  names: Readonly<Record<string, string>>,
  options: { sectorCode?: string; exportedAt?: string; roundStartedAtMs: number }
): RoundLogExport {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  const formatOptions = { roundStartedAtMs: options.roundStartedAtMs };
  return {
    exportedAt,
    roundNumber,
    sectorCode: options?.sectorCode,
    roundStartedAtMs: options.roundStartedAtMs,
    entries,
    lines: entries.map((entry) => formatGameLogLine(entry, names, formatOptions)),
  };
}

export function createGameLog(): GameLog {
  const entries: GameLogEntry[] = [];

  return {
    append(entry) {
      entries.push({
        ...entry,
        at: entry.at ?? new Date().toISOString(),
        effects: entry.effects ?? [],
      });
    },
    snapshot() {
      return [...entries];
    },
    clear() {
      entries.length = 0;
    },
  };
}
