import {
  hasRedAlertPassed,
  isDouble,
  isPipExhausted,
  isRedAlertBlocking,
  isTrueRedAlert,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type FlashEffectKind,
  type RoundState,
} from 'warp12-engine';

import {
  hubSlotsForCaptainCount,
  neutralZoneSlot,
} from '../adapters/game-to-trains.js';

function wasRedAlertPassed(round: RoundState): boolean {
  return hasRedAlertPassed(round.table.redAlert);
}

export type GameLogKind = GameAction['type'] | 'ROUND_STARTED' | 'ROUND_RATINGS';

export type GameLogEffect =
  | 'caution-opened'
  | 'caution-cleared'
  | 'red-alert-opened'
  | 'red-alert-cleared'
  | 'continuum-flash-pending'
  | 'subspace-fracture-opened'
  | 'subspace-fracture-cleared'
  | 'beacon-deployed'
  | 'dead-double'
  | 'round-won'
  | 'round-blocked'
  | 'return-to-warp'
  | 'wormhole-opened';

export interface GameLogRoute {
  readonly kind: ChartRoute['kind'];
  readonly trailCaptainId?: string;
  readonly neutralZone?: boolean;
}

export interface GameLogRosterEntry {
  /** Omit the TEI portion (e.g. online tables, which are not TEI-rated). */
  readonly hideTei?: boolean;
  readonly captainId: string;
  /** TEI grade (e.g. "V67") or null if unrated. */
  readonly tei: string | null;
  readonly tacticalClass?: string;
  /** Fixed opponent reference TEI (solo AI officers). */
  readonly reference?: boolean;
}

export interface GameLogEntry {
  readonly at: string;
  readonly kind: GameLogKind;
  readonly captainId: string;
  readonly trainId?: number;
  readonly coordinate?: Coordinate;
  readonly route?: GameLogRoute;
  readonly flashEffect?: FlashEffectKind;
  readonly winnerId?: string | null;
  readonly nextCaptainId?: string;
  readonly targetCaptainId?: string;
  readonly roundNumber?: number;
  readonly spacedockValue?: number;
  readonly roster?: readonly GameLogRosterEntry[];
  readonly effects: readonly GameLogEffect[];
  /** For SPOOL_WARP_DRIVE: tiles played (count only, for privacy) */
  readonly spoolDetails?: {
    readonly tilesPlayed: number;
  };
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
  const nzSlot = neutralZoneSlot(hubSlotsForCaptainCount(round.turnOrder.length));
  switch (route.kind) {
    case 'warp-trail':
      return trainIdForCaptain(round, route.playerId);
    case 'neutral-zone':
      return nzSlot;
    case 'fracture-stabilizer':
      return undefined;
    case 'red-alert-cover':
      return route.trailPlayerId
        ? trainIdForCaptain(round, route.trailPlayerId)
        : route.neutralZone
          ? nzSlot
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
        parts.push('raising Yellow alert');
        break;
      case 'caution-cleared':
        parts.push('clearing Yellow alert');
        break;
      case 'red-alert-opened':
        parts.push('causing a Red Alert');
        break;
      case 'red-alert-cleared':
        parts.push('clearing the Red Alert');
        break;
      case 'continuum-flash-pending':
        parts.push('causing a Continuum Flash');
        break;
      case 'subspace-fracture-opened':
        parts.push('opening Subspace Fracture');
        break;
      case 'subspace-fracture-cleared':
        parts.push('clearing the Subspace Fracture');
        break;
      case 'wormhole-opened':
        parts.push('opening a Wormhole — trails inverted');
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

function rosterPhrase(
  roster: readonly GameLogRosterEntry[] | undefined,
  names: Readonly<Record<string, string>>
): string {
  if (!roster?.length) {
    return '';
  }
  return roster
    .map(({ captainId, tei, tacticalClass, reference, hideTei }) => {
      const name = captainLabel(captainId, names);
      const classPart = tacticalClass ? ` · ${tacticalClass}` : '';
      // Online tables are not TEI-rated — show captain classes only.
      if (hideTei) {
        return `${name}${classPart}`;
      }
      
      // Format TEI grade
      const teiPart = tei == null 
        ? 'TEI unrated' 
        : reference ? `~${tei}` : tei;
      
      return `${name} ${teiPart}${classPart}`;
    })
    .join(' · ');
}

export function formatGameLogLine(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions,
  viewerId?: string,
  ownHandSizeAfter?: number
): string {
  const time = formatLogTime(entry.at, options.roundStartedAtMs);
  const name = captainLabel(entry.captainId, names);
  const prefix = `${time} - ${name}`;
  const isOwnAction = viewerId && entry.captainId === viewerId;

  switch (entry.kind) {
    case 'ROUND_STARTED':
      return `${time} - Round ${entry.roundNumber ?? '?'} begins · Spacedock ${entry.spacedockValue ?? '?'}`;
    case 'ROUND_RATINGS': {
      const ratings = rosterPhrase(entry.roster, names);
      return ratings ? `${time} - Ratings · ${ratings}` : '';
    }
    case 'CHART_COORDINATE':
      return `${prefix} played ${tilePhrase(entry.coordinate)} on ${trailPhrase(entry.route, entry.captainId, names)}${effectsPhrase(entry.effects)}`;
    case 'DRAW_FROM_UNCHARTED':
      if (entry.effects.includes('red-alert-opened')) {
        return `${prefix} drew and could not answer the Double${effectsPhrase(entry.effects)}`;
      }
      if (entry.effects.includes('return-to-warp')) {
        return `${prefix} drew from Uncharted Sectors — returned to warp${effectsPhrase(entry.effects.filter((e) => e !== 'return-to-warp'))}`;
      }
      return `${prefix} drew from Uncharted Sectors${effectsPhrase(entry.effects)}`;
    case 'SPOOL_WARP_DRIVE': {
      const details = entry.spoolDetails;
      if (details && details.tilesPlayed > 0) {
        const parts: string[] = [];
        parts.push(`played ${details.tilesPlayed} tile${details.tilesPlayed !== 1 ? 's' : ''}`);
        
        // Privacy: Only show what was drawn to hand if viewing your own action
        // AND we have the post-spool hand size to compute it from
        if (isOwnAction && ownHandSizeAfter !== undefined) {
          const tilesSentToHand = details.tilesPlayed > 0 ? ownHandSizeAfter : 0;
          if (tilesSentToHand > 0) {
            parts.push(`drew ${tilesSentToHand} to hand`);
          }
        }
        
        return `${prefix} engaged warp drive on ${trailPhrase(entry.route, entry.captainId, names)} (${parts.join(', ')})${effectsPhrase(entry.effects)}`;
      }
      return `${prefix} engaged warp drive on ${trailPhrase(entry.route, entry.captainId, names)}${effectsPhrase(entry.effects)}`;
    }
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
      const returned =
        entry.effects.includes('return-to-warp')
          ? ` — ${target} returned to warp`
          : '';
      return `${prefix} caught ${target} for a missed Drop to Impulse${returned}${effectsPhrase(entry.effects.filter((e) => e !== 'return-to-warp'))}`;
    }
    case 'RAISE_SHIELDS':
      return `${prefix} raised shields${effectsPhrase(entry.effects)}`;
    case 'INVOKE_CONTINUUM_FLASH':
      return `${prefix} invoked Continuum Flash · ${entry.flashEffect?.replaceAll('-', ' ') ?? 'effect'}${effectsPhrase(entry.effects)}`;
    case 'RESOLVE_CONTINUUM_WAGER':
      return `${prefix} resolved Q-Gamble${effectsPhrase(entry.effects)}`;
    case 'END_ROUND': {
      if (entry.effects.includes('round-blocked')) {
        return `${time} - Round blocked — no legal charts remain`;
      }
      const winner = captainLabel(entry.winnerId ?? entry.captainId, names);
      return `${time} - ${winner} wins the round`;
    }
  }
  // TypeScript exhaustiveness check - should never reach here
  return `${time} - Unknown action`;
}

export function gameLogEntryToString(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions,
  viewerId?: string,
  ownHandSizeAfter?: number
): string {
  return formatGameLogLine(entry, names, options, viewerId, ownHandSizeAfter);
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

  // Module Lambda: Detect wormhole (trail swap)
  const beforeNzLength = before.table.neutralZone.tiles.length;
  const afterNzLength = after.table.neutralZone.tiles.length;
  const beforeTrailLength = before.table.warpTrails[action.playerId]?.tiles.length ?? 0;
  const afterTrailLength = after.table.warpTrails[action.playerId]?.tiles.length ?? 0;
  const wormholeOpened = 
    isDouble(action.coordinate) &&
    action.route.kind === 'neutral-zone' &&
    // After wormhole: player's trail contains the double they just played
    // and NZ contains their old trail (or is empty if they had no trail)
    Math.abs((afterTrailLength - beforeNzLength - 1)) < 2 && // Allow for rounding/edge cases
    Math.abs((afterNzLength - beforeTrailLength)) < 2;

  if (playedDeadDouble) {
    effects.push('dead-double');
    if (!before.continuumPendingInvoker && after.continuumPendingInvoker) {
      effects.push('continuum-flash-pending');
    }
    return effects;
  }

  if (wormholeOpened) {
    effects.push('wormhole-opened');
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

  if (!before.continuumPendingInvoker && after.continuumPendingInvoker) {
    effects.push('continuum-flash-pending');
  }

  if (!beforeFracture?.active && afterFracture?.active) {
    effects.push('subspace-fracture-opened');
  }

  if (roundStarterOpeningBeaconDeployed(before, after, action)) {
    effects.push('beacon-deployed');
  }

  return effects;
}

/**
 * Return to warp is signalled by the engine on the state produced by the draw
 * (covers every impulse path: same-turn, caught penalty, and announced-then-
 * drawn — which leaves no drop-to-impulse flag set).
 */
function returnedToWarpFromImpulse(after: RoundState): boolean {
  return after.returnedToWarp === true;
}

function drawEffects(
  before: RoundState,
  after: RoundState,
  playerId: string
): GameLogEffect[] {
  const effects: GameLogEffect[] = [];
  const wasBlocking = isRedAlertBlocking(before.table.redAlert, playerId);
  const beaconBefore =
    before.table.warpTrails[playerId]?.distressBeacon.active ?? false;
  const beaconAfter =
    after.table.warpTrails[playerId]?.distressBeacon.active ?? false;

  if (wasBlocking && beaconAfter && !beaconBefore) {
    effects.push('red-alert-opened');
  }
  if (returnedToWarpFromImpulse(after)) {
    effects.push('return-to-warp');
  }
  return effects;
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

function catchDropToImpulseEffects(after: RoundState): GameLogEffect[] {
  if (returnedToWarpFromImpulse(after)) {
    return ['return-to-warp'];
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

export function buildAutoAllStopLogEntry(
  before: GameState,
  after: GameState,
  action: GameAction
): GameLogEntry | null {
  const beforeRound = before.round;
  const afterRound = after.round;
  if (!beforeRound || !afterRound) {
    return null;
  }
  if (action.type !== 'CHART_COORDINATE') {
    return null;
  }
  if (afterRound.phase !== 'ended' || !afterRound.roundWinnerId) {
    return null;
  }
  if (!afterRound.allStopRequired || !afterRound.allStopDeclared) {
    return null;
  }
  if (beforeRound.allStopDeclared) {
    return null;
  }

  return {
    at: new Date().toISOString(),
    kind: 'ALL_STOP',
    captainId: afterRound.roundWinnerId,
    effects: [],
  };
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
    case 'SPOOL_WARP_DRIVE': {
      // Calculate tiles played from before/after state
      const route = action.route;
      let tilesPlayed = 0;
      
      if (route.kind === 'warp-trail') {
        const beforeTrail = beforeRound.table.warpTrails[route.playerId];
        const afterTrail = afterRound.table.warpTrails[route.playerId];
        tilesPlayed = (afterTrail?.tiles.length ?? 0) - (beforeTrail?.tiles.length ?? 0);
      } else if (route.kind === 'neutral-zone') {
        tilesPlayed = afterRound.table.neutralZone.tiles.length - beforeRound.table.neutralZone.tiles.length;
      }
      
      // SECURITY: Do NOT store tilesSentToHand - it's private info that would be
      // synced to all clients. Only store tilesPlayed count.
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        trainId: trainIdForRoute(afterRound, action.route),
        route: routeToLogRoute(action.route),
        effects: [],
        spoolDetails: {
          tilesPlayed,
        },
      };
    }
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
    case 'RAISE_SHIELDS':
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
        effects: catchDropToImpulseEffects(afterRound),
      };
    case 'INVOKE_CONTINUUM_FLASH':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        flashEffect: action.effect,
        effects: [],
      };
    case 'RESOLVE_CONTINUUM_WAGER':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        effects: [],
      };
    case 'PICK_FROM_PACK':
      // Draft picks aren't logged to the game log (they happen before playing phase)
      return null;
    case 'END_ROUND':
      return {
        at,
        kind: action.type,
        captainId: action.winnerId ?? '',
        winnerId: action.winnerId,
        effects: endRoundEffects(afterRound),
      };
  }
  // TypeScript exhaustiveness check - should never reach here
  return null;
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

export function buildRoundRatingsEntry(
  roster: readonly GameLogRosterEntry[],
  roundNumber: number,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'ROUND_RATINGS',
    captainId: '',
    roundNumber,
    roster,
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
  options: { sectorCode?: string; exportedAt?: string; roundStartedAtMs: number; viewerId?: string }
): RoundLogExport {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  const formatOptions = { roundStartedAtMs: options.roundStartedAtMs };
  return {
    exportedAt,
    roundNumber,
    sectorCode: options?.sectorCode,
    roundStartedAtMs: options.roundStartedAtMs,
    entries,
    lines: entries.map((entry) => formatGameLogLine(entry, names, formatOptions, options.viewerId)),
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
