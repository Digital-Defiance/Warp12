import {
  hasRedAlertPassed,
  isDouble,
  isPipExhausted,
  isRedAlertBlocking,
  isTrueRedAlert,
  routeIsOwnTrail,
  summarizeRoundOutcome,
  trailKeyFor,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameModules,
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

export type GameLogKind =
  | GameAction['type']
  | 'ROUND_STARTED'
  | 'ROUND_RATINGS'
  | 'MODULE_LOADOUT'
  | 'DEV_CONSOLE'
  | 'SECTOR_PAUSED'
  | 'SECTOR_RESUMED';


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
  | 'wormhole-opened'
  | 'salamander-swap-noop';

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
  /** END_ROUND: scored under Module Kappa inversion (going out is catastrophic). */
  readonly roundInverted?: boolean;
  /** END_ROUND: captain(s) who won the round in campaign terms (the trophy). */
  readonly roundWinnerIds?: readonly string[];
  readonly nextCaptainId?: string;
  readonly targetCaptainId?: string;
  readonly roundNumber?: number;
  readonly spacedockValue?: number;
  readonly roster?: readonly GameLogRosterEntry[];
  readonly effects: readonly GameLogEffect[];
  /** Module Iota: forced draw triggered by charting a double. */
  readonly doubleDown?: {
    readonly targetCaptainId: string;
    readonly drawCount: number;
  };
  /** For SPOOL_WARP_DRIVE: tiles played (count only, for privacy) */
  readonly spoolDetails?: {
    readonly tilesPlayed: number;
  };
  /** Module Beta: points charged for the held highest double. */
  readonly penaltyPoints?: number;
  /** Module Theta: tiles on the awarded longest trail. */
  readonly trailLength?: number;
  /** Module Eta: Temporal Debt token count charged at scoring. */
  readonly debtTokens?: number;
  /** MODULE_LOADOUT: enabled module labels for this round (parity-aware). */
  readonly moduleLabels?: readonly string[];
  /** SECTOR_PAUSED: optional host note (e.g. missing captain). */
  readonly pauseReason?: string;
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
  /**
   * Optional override for the elapsed-time prefix (default MM:SS).
   * Bridge may pass BrightDate decimal spans when the player prefers them.
   */
  readonly formatElapsed?: (
    entryAtIso: string,
    roundStartedAtMs: number
  ) => string;
  /**
   * Absolute wall / BrightDate stamp for round-begin lines (instead of 00:00 /
   * 0.000nd elapsed).
   */
  readonly formatAbsolute?: (entryAtIso: string) => string;
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
  options: GameLogFormatOptions
): string {
  if (options.formatElapsed) {
    return options.formatElapsed(iso, options.roundStartedAtMs);
  }
  return formatRoundElapsedTime(iso, options.roundStartedAtMs);
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
        parts.push('opening a Wormhole — trail swapped with the Neutral Zone');
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
      // `ref` marks fixed AI OpenSkill anchors (not a provisional/estimate tilde).
      const teiPart =
        tei == null
          ? 'TEI unrated'
          : reference
            ? `ref ${tei}`
            : tei;
      
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
  const time =
    entry.kind === 'ROUND_STARTED' && options.formatAbsolute
      ? options.formatAbsolute(entry.at)
      : formatLogTime(entry.at, options);
  const name = captainLabel(entry.captainId, names);
  const prefix = `${time} - ${name}`;
  const isOwnAction = viewerId && entry.captainId === viewerId;

  switch (entry.kind) {
    case 'ROUND_STARTED':
      return `${time} - Round ${entry.roundNumber ?? '?'} begins · Spacedock ${entry.spacedockValue ?? '?'}`;
    case 'SECTOR_PAUSED':
      return `${time} - Sector paused${entry.pauseReason ? ` · ${entry.pauseReason}` : ''}`;
    case 'SECTOR_RESUMED':
      return `${time} - Sector resumed`;
    case 'DEV_CONSOLE':
      return `${time} - CHEATER — bridge console unlocked`;
    case 'ROUND_RATINGS': {
      const ratings = rosterPhrase(entry.roster, names);
      return ratings ? `${time} - Ratings · ${ratings}` : '';
    }
    case 'MODULE_LOADOUT': {
      const labels = entry.moduleLabels ?? [];
      if (labels.length === 0) {
        return `${time} - Modules · None (core rules only)`;
      }
      return `${time} - Modules · ${labels.join(', ')}`;
    }
    case 'CHART_COORDINATE': {
      const base = `${prefix} charted ${tilePhrase(entry.coordinate)} on ${trailPhrase(entry.route, entry.captainId, names)}${effectsPhrase(entry.effects)}`;
      if (!entry.doubleDown) {
        return base;
      }
      const target = captainLabel(entry.doubleDown.targetCaptainId, names);
      const drawPhrase =
        entry.doubleDown.drawCount === 1
          ? 'draws 1'
          : `draws ${entry.doubleDown.drawCount}`;
      return `${base} → Double Down! ${target} ${drawPhrase}`;
    }
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
      const wentOut = captainLabel(entry.winnerId ?? entry.captainId, names);
      if (entry.roundInverted) {
        const trophy = (entry.roundWinnerIds ?? [])
          .filter((id) => id !== (entry.winnerId ?? entry.captainId))
          .map((id) => captainLabel(id, names));
        const takes =
          trophy.length > 0
            ? ` · ${trophy.join(' & ')} take${trophy.length > 1 ? '' : 's'} the round (held the most)`
            : '';
        return `${time} - ${wentOut} goes out — inverted round, max penalty${takes}`;
      }
      return `${time} - ${wentOut} wins the round`;
    }
    case 'SALAMANDER_PENALTY': {
      const holder = captainLabel(entry.captainId, names);
      const points = entry.penaltyPoints ?? 0;
      const scoredOnId = entry.targetCaptainId ?? entry.captainId;
      if (scoredOnId !== entry.captainId) {
        const scoredOn = captainLabel(scoredOnId, names);
        return `${time} - Salamander Penalty · ${holder}'s highest double swaps to ${scoredOn} · +${points}`;
      }
      if (entry.effects.includes('salamander-swap-noop')) {
        return `${time} - Salamander Penalty · ${holder} holds highest double (already campaign leader; swap no-ops) · +${points}`;
      }
      return `${time} - Salamander Penalty · ${holder} holds highest double · +${points}`;
    }
    case 'LONGEST_TRAIL_BONUS': {
      const who = captainLabel(entry.captainId, names);
      const length = entry.trailLength ?? 0;
      const points = entry.penaltyPoints ?? 0;
      const delta =
        points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
      return `${time} - Longest Trail Bonus · ${who} (${length} tiles) · ${delta}`;
    }
    case 'TEMPORAL_DEBT_PENALTY': {
      const who = captainLabel(entry.captainId, names);
      const tokens = entry.debtTokens ?? 0;
      const points = entry.penaltyPoints ?? 0;
      const delta =
        points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
      return `${time} - Temporal Debt · ${who} (${tokens} token${tokens === 1 ? '' : 's'}) · ${delta}`;
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
    !routeIsOwnTrail(before, action.playerId, action.route) ||
    action.playerId !== before.table.spacedock.placedBy
  ) {
    return false;
  }

  const playerId = action.playerId;
  const trailKey = trailKeyFor(before, playerId);
  const ownTilesBefore = before.table.warpTrails[trailKey]?.tiles.length ?? 0;
  const ownTilesAfter = after.table.warpTrails[trailKey]?.tiles.length ?? 0;
  const beaconBefore =
    before.table.warpTrails[trailKey]?.distressBeacon.active ?? false;
  const beaconAfter =
    after.table.warpTrails[trailKey]?.distressBeacon.active ?? false;

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

  // Module Lambda: engine sets wormholeOpened only when the module is on and a
  // swap actually ran. Do not infer from NZ double + length heuristics — that
  // falsely logged wormholes with Lambda disabled.
  if (playedDeadDouble) {
    effects.push('dead-double');
    if (!before.continuumPendingInvoker && after.continuumPendingInvoker) {
      effects.push('continuum-flash-pending');
    }
    return effects;
  }

  if (after.wormholeOpened === true) {
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
    before.table.warpTrails[trailKeyFor(before, playerId)]?.distressBeacon.active ??
    false;
  const beaconAfter =
    after.table.warpTrails[trailKeyFor(after, playerId)]?.distressBeacon.active ??
    false;

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

/** Module Iota: detect tiles forcibly drawn onto the next captain's hand. */
function detectDoubleDownDraw(
  before: GameState,
  after: GameState,
  action: Extract<GameAction, { type: 'CHART_COORDINATE' }>
): GameLogEntry['doubleDown'] | undefined {
  if (!before.modules.doubleDown?.enabled || !isDouble(action.coordinate)) {
    return undefined;
  }
  const beforeRound = before.round;
  const afterRound = after.round;
  if (!beforeRound || !afterRound) {
    return undefined;
  }

  for (const captainId of afterRound.turnOrder) {
    if (captainId === action.playerId) {
      continue;
    }
    const drawn =
      (afterRound.hands[captainId]?.length ?? 0) -
      (beforeRound.hands[captainId]?.length ?? 0);
    if (drawn > 0) {
      return { targetCaptainId: captainId, drawCount: drawn };
    }
  }
  return undefined;
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
    case 'CHART_COORDINATE': {
      const doubleDown = detectDoubleDownDraw(before, after, action);
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        trainId: trainIdForRoute(afterRound, action.route),
        coordinate: action.coordinate,
        route: routeToLogRoute(action.route),
        effects: chartEffects(beforeRound, afterRound, action),
        ...(doubleDown ? { doubleDown } : {}),
      };
    }
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
    case 'SALAMANDER_PENALTY':
      return {
        at,
        kind: action.type,
        captainId: action.holderId,
        targetCaptainId: action.scoredOnId,
        penaltyPoints: action.points,
        effects: [],
      };
    case 'LONGEST_TRAIL_BONUS':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        trailLength: action.trailLength,
        penaltyPoints: action.points,
        effects: [],
      };
    case 'TEMPORAL_DEBT_PENALTY':
      return {
        at,
        kind: action.type,
        captainId: action.playerId,
        debtTokens: action.tokens,
        penaltyPoints: action.points,
        effects: [],
      };
    case 'END_ROUND': {
      const outcome = summarizeRoundOutcome(after, afterRound);
      return {
        at,
        kind: action.type,
        captainId: action.winnerId ?? '',
        winnerId: action.winnerId,
        roundInverted: outcome.inverted,
        roundWinnerIds: outcome.roundWinnerIds,
        effects: endRoundEffects(afterRound),
      };
    }
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

/** Greek-lettered module labels in canonical display order (Alpha → Lambda). */
const MODULE_LOG_LABELS: readonly {
  readonly key: keyof GameModules;
  readonly label: string;
}[] = [
  { key: 'continuum', label: 'Module Alpha · Continuum' },
  { key: 'salamanderPenalty', label: 'Module Beta · Salamander' },
  { key: 'sensorGrid', label: 'Module Gamma · Sensor Grid' },
  { key: 'warpDriveSpool', label: 'Module Delta · Hot Potato' },
  { key: 'drafting', label: 'Module Epsilon · Drafting' },
  { key: 'squadrons', label: 'Module Zeta · Squadrons' },
  { key: 'temporalDebt', label: 'Module Eta · Temporal Debt' },
  { key: 'longestTrail', label: 'Module Theta · Longest Trail' },
  { key: 'doubleDown', label: 'Module Iota · Double Down' },
  { key: 'temporalInversion', label: 'Module Kappa · Temporal Inversion' },
  { key: 'wormholes', label: 'Module Lambda · Wormholes' },
];

/**
 * Enabled module labels for a round. Module Kappa (Temporal Inversion) is
 * parity-aware: even rounds invert scoring, so the label states whether THIS
 * round is normal or inverted (otherwise players cannot tell if it fired).
 */
export function enabledModuleLabels(
  modules: GameModules,
  roundNumber: number
): string[] {
  const labels: string[] = [];
  for (const { key, label } of MODULE_LOG_LABELS) {
    if (!modules[key]?.enabled) {
      continue;
    }
    if (key === 'temporalInversion') {
      const inverted = roundNumber % 2 === 0;
      labels.push(
        inverted
          ? `${label} (Round ${roundNumber} INVERTED — highest hand wins)`
          : `${label} (Round ${roundNumber} normal — lowest hand wins)`
      );
    } else {
      labels.push(label);
    }
  }
  if (modules.subspaceFracture?.enabled) {
    labels.push(`Subspace Fracture (${modules.subspaceFracture.scope})`);
  }
  return labels;
}

/** Module loadout for a round — parity-aware (see {@link enabledModuleLabels}). */
export function buildModuleLoadoutEntry(
  modules: GameModules,
  roundNumber: number,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'MODULE_LOADOUT',
    captainId: '',
    roundNumber,
    moduleLabels: enabledModuleLabels(modules, roundNumber),
    effects: [],
  };
}

/** Dev console unlock — always logged as CHEATER in the sector ticker. */
export function buildDevConsoleUnlockEntry(
  captainId: string,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'DEV_CONSOLE',
    captainId,
    effects: [],
  };
}

export function buildRoundOutcomeEntry(
  round: RoundState,
  at?: string,
  game?: GameState
): GameLogEntry {
  const outcome = game ? summarizeRoundOutcome(game, round) : null;
  return {
    at: at ?? new Date().toISOString(),
    kind: 'END_ROUND',
    captainId: round.roundWinnerId ?? '',
    winnerId: round.roundWinnerId,
    roundInverted: outcome?.inverted ?? false,
    roundWinnerIds: outcome?.roundWinnerIds,
    effects: endRoundEffects(round),
  };
}

/** Public Module Beta line when a highest-double holder is charged at round end. */
export function buildSalamanderPenaltyLogEntry(
  action: Extract<GameAction, { type: 'SALAMANDER_PENALTY' }>,
  at?: string,
  options?: { continuumSwapArmed?: boolean }
): GameLogEntry {
  const swapNoop =
    options?.continuumSwapArmed === true &&
    action.scoredOnId === action.holderId;
  return {
    at: at ?? new Date().toISOString(),
    kind: 'SALAMANDER_PENALTY',
    captainId: action.holderId,
    targetCaptainId: action.scoredOnId,
    penaltyPoints: action.points,
    effects: swapNoop ? ['salamander-swap-noop'] : [],
  };
}

/** Public Module Theta line when a captain earns the longest-trail bonus. */
export function buildLongestTrailBonusLogEntry(
  action: Extract<GameAction, { type: 'LONGEST_TRAIL_BONUS' }>,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'LONGEST_TRAIL_BONUS',
    captainId: action.playerId,
    trailLength: action.trailLength,
    penaltyPoints: action.points,
    effects: [],
  };
}

/** Public Module Eta line when Temporal Debt is charged at round end. */
export function buildTemporalDebtPenaltyLogEntry(
  action: Extract<GameAction, { type: 'TEMPORAL_DEBT_PENALTY' }>,
  at?: string
): GameLogEntry {
  return {
    at: at ?? new Date().toISOString(),
    kind: 'TEMPORAL_DEBT_PENALTY',
    captainId: action.playerId,
    debtTokens: action.tokens,
    penaltyPoints: action.points,
    effects: [],
  };
}

export function buildRoundLogExport(
  entries: readonly GameLogEntry[],
  roundNumber: number,
  names: Readonly<Record<string, string>>,
  options: {
    sectorCode?: string;
    exportedAt?: string;
    roundStartedAtMs: number;
    viewerId?: string;
    formatElapsed?: GameLogFormatOptions['formatElapsed'];
    formatAbsolute?: GameLogFormatOptions['formatAbsolute'];
  }
): RoundLogExport {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  const formatOptions: GameLogFormatOptions = {
    roundStartedAtMs: options.roundStartedAtMs,
    formatElapsed: options.formatElapsed,
    formatAbsolute: options.formatAbsolute,
  };
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
