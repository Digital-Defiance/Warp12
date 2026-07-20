import { isDouble, type Coordinate } from '../types/coordinate.js';

import type {
  GameLogEffect,
  GameLogEntry,
  GameLogFormatOptions,
  GameLogRoute,
} from './game-log-types.js';
import { formatRoundElapsedTime } from './game-log-types.js';
import {
  pronounKeepVerb,
  pronounsForCaptain,
  type PronounForms,
} from './pronouns.js';
import { shieldControlPhraseForCaptain } from './shield-control-phrases.js';

/**
 * Stream / overlay digest of the sector log.
 *
 * Voice: ringside peaks with clubhouse restraint — theatrical federation
 * broadcast on highlights only; routine charts and draws stay silent.
 */

const STRUCTURAL_KINDS: ReadonlySet<GameLogEntry['kind']> = new Set([
  'ROUND_STARTED',
  'ROUND_RATINGS',
  'MODULE_LOADOUT',
  'END_ROUND',
  'SALAMANDER_PENALTY',
  'LONGEST_TRAIL_BONUS',
  'TEMPORAL_DEBT_PENALTY',
  'SECTOR_PAUSED',
  'SECTOR_RESUMED',
]);

/** Always worth a callout — ceremony, crisis, or module fireworks. */
const ALWAYS_HIGHLIGHT_KINDS: ReadonlySet<GameLogEntry['kind']> = new Set([
  'ALL_STOP',
  'DROP_TO_IMPULSE',
  'CATCH_DROP_TO_IMPULSE',
  'DEPLOY_DISTRESS_BEACON',
  'RAISE_SHIELDS',
  'INVOKE_CONTINUUM_FLASH',
  'RESOLVE_CONTINUUM_WAGER',
  'SPOOL_WARP_DRIVE',
  'PASS_RED_ALERT',
  'RESOLVE_HAND_EXCHANGE',
  'DESPERATION_DIG',
  'DEV_CONSOLE',
]);

const CHART_HIGHLIGHT_EFFECTS: ReadonlySet<GameLogEffect> = new Set([
  'caution-opened',
  'caution-cleared',
  'red-alert-opened',
  'red-alert-cleared',
  'continuum-flash-pending',
  'subspace-fracture-opened',
  'subspace-fracture-cleared',
  'beacon-deployed',
  'beacon-cleared',
  'dead-double',
  'round-opened',
  'neutral-zone-opened',
  'round-won',
  'round-blocked',
  'wormhole-opened',
  'spool-abort-retrieve',
  'hand-exchange-opened',
  'trail-momentum-claimed',
]);

const DRAW_HIGHLIGHT_EFFECTS: ReadonlySet<GameLogEffect> = new Set([
  'red-alert-opened',
  'return-to-warp',
  'beacon-deployed',
]);

function captainLabel(
  captainId: string,
  names: Readonly<Record<string, string>>
): string {
  return names[captainId] ?? captainId;
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

function tilePhrase(coordinate: Coordinate | undefined): string {
  if (!coordinate) {
    return 'a coordinate';
  }
  if (isDouble(coordinate)) {
    return `Double ${coordinate.low}-${coordinate.high}`;
  }
  return `${coordinate.low}:${coordinate.high}`;
}

/** Opening callout: "a 12:5" / "Double 5-5". */
function openingTilePhrase(coordinate: Coordinate | undefined): string {
  if (!coordinate) {
    return 'a coordinate';
  }
  if (isDouble(coordinate)) {
    return `Double ${coordinate.low}-${coordinate.high}`;
  }
  return `a ${coordinate.low}:${coordinate.high}`;
}

function trailPhrase(
  route: GameLogRoute | undefined,
  actorId: string,
  names: Readonly<Record<string, string>>,
  pronouns?: Readonly<Record<string, PronounForms>>
): string {
  if (!route) {
    return 'the table';
  }
  switch (route.kind) {
    case 'neutral-zone':
      return 'the Neutral Zone';
    case 'fracture-stabilizer':
      return 'a Fracture Stabilizer';
    case 'red-alert-cover':
      if (route.neutralZone) {
        return 'the Neutral Zone';
      }
      if (route.trailCaptainId) {
        return `Captain ${captainLabel(route.trailCaptainId, names)}'s Trail`;
      }
      return 'a trail under Red Alert';
    case 'warp-trail': {
      const forms = pronounsForCaptain(actorId, pronouns);
      if (route.squadronTrail) {
        return `${forms.possessive} squadron Trail`;
      }
      const ownerId = route.trailCaptainId ?? '';
      if (ownerId === actorId) {
        return `${forms.possessive} own Trail`;
      }
      return `Captain ${captainLabel(ownerId, names)}'s Trail`;
    }
    default:
      return 'the table';
  }
}

function momentumKeepConn(captainId: string, pronouns?: Readonly<Record<string, PronounForms>>): string {
  const forms = pronounsForCaptain(captainId, pronouns);
  return `Trail Momentum — ${forms.subject} ${pronounKeepVerb(forms)} the conn!`;
}

function hasChartHighlightExtras(entry: GameLogEntry): boolean {
  return Boolean(
    entry.hotPotato?.taken ||
      entry.doubleDown ||
      entry.salamanderSurge ||
      entry.handExchange
  );
}

function effectsIntersect(
  effects: readonly GameLogEffect[],
  interesting: ReadonlySet<GameLogEffect>
): boolean {
  return effects.some((effect) => interesting.has(effect));
}

/**
 * Whether this entry earns a ringside callout.
 * Routine charts, draws, and passes stay off-mic.
 */
export function isCommentatorHighlight(entry: GameLogEntry): boolean {
  if (STRUCTURAL_KINDS.has(entry.kind) || ALWAYS_HIGHLIGHT_KINDS.has(entry.kind)) {
    return true;
  }

  switch (entry.kind) {
    case 'CHART_COORDINATE':
      return (
        effectsIntersect(entry.effects, CHART_HIGHLIGHT_EFFECTS) ||
        hasChartHighlightExtras(entry)
      );
    case 'DRAW_FROM_UNCHARTED':
    case 'SENSOR_SWEEP':
      return effectsIntersect(entry.effects, DRAW_HIGHLIGHT_EFFECTS);
    case 'PASS_TURN':
      return Boolean(
        entry.hotPotato?.passDraws ||
          entry.hotPotato?.passPenalty ||
          entry.hotPotato?.skipNext ||
          effectsIntersect(entry.effects, CHART_HIGHLIGHT_EFFECTS)
      );
    default:
      return false;
  }
}

function joinBeats(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(' ');
}

function chartEffectCallouts(
  effects: readonly GameLogEffect[],
  captainId: string,
  pronouns?: Readonly<Record<string, PronounForms>>
): readonly string[] {
  const beats: string[] = [];
  for (const effect of effects) {
    switch (effect) {
      case 'caution-opened':
        beats.push('Yellow alert!');
        break;
      case 'caution-cleared':
        beats.push('Yellow alert cleared!');
        break;
      case 'red-alert-opened':
        beats.push('Red Alert — the Double sits uncovered!');
        break;
      case 'red-alert-cleared':
        beats.push('And the Red Alert is answered!');
        break;
      case 'continuum-flash-pending':
        beats.push('A Continuum Flash erupts!');
        break;
      case 'subspace-fracture-opened':
        beats.push('Subspace Fracture opens!');
        break;
      case 'subspace-fracture-cleared':
        beats.push('Fracture closed!');
        break;
      case 'wormhole-opened':
        beats.push('Wormhole! Trail and Neutral Zone swap!');
        break;
      case 'beacon-deployed':
        beats.push('Distress Beacon live — trail open!');
        break;
      case 'beacon-cleared':
        beats.push('Shields up — Distress Beacon cleared!');
        break;
      case 'dead-double':
        beats.push('That Double is dead — no cover required!');
        break;
      case 'round-opened':
        // Lead line carries the opening beat ("opens with…").
        break;
      case 'neutral-zone-opened':
        // Lead line carries the NZ opening beat.
        break;
      case 'round-won':
        beats.push('Round clinched!');
        break;
      case 'round-blocked':
        beats.push('The table is blocked!');
        break;
      case 'hand-exchange-opened':
        beats.push('Hand Exchange!');
        break;
      case 'trail-momentum-claimed':
        beats.push(momentumKeepConn(captainId, pronouns));
        break;
      case 'spool-abort-retrieve':
        beats.push('Unfinished double retrieved — no Red Alert!');
        break;
      default:
        break;
    }
  }
  return beats;
}

/**
 * Theatrical federation broadcast line for a highlight entry.
 * Returns empty string when the entry is not a highlight (caller may skip).
 */
export function formatCommentatorLine(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions
): string {
  if (!isCommentatorHighlight(entry)) {
    return '';
  }

  const time =
    entry.kind === 'ROUND_STARTED' && options.formatAbsolute
      ? options.formatAbsolute(entry.at)
      : formatLogTime(entry.at, options);
  const name = captainLabel(entry.captainId, names);
  const withElapsed = (body: string): string =>
    options.includeElapsedPrefix === false ? body : `${time} - ${body}`;

  let body = '';
  switch (entry.kind) {
    case 'ROUND_STARTED':
      body = `Round ${entry.roundNumber ?? '?'} is underway — Spacedock ${entry.spacedockValue ?? '?'}! The fleet is live!`;
      break;
    case 'SECTOR_PAUSED':
      body = `Hold everything — sector paused${entry.pauseReason ? ` · ${entry.pauseReason}` : ''}.`;
      break;
    case 'SECTOR_RESUMED':
      body = `And we're back — sector resumed!`;
      break;
    case 'DEV_CONSOLE':
      body = `Bridge console unlocked — somebody's rewriting the script!`;
      break;
    case 'ROUND_RATINGS': {
      const roster = entry.roster;
      if (!roster?.length) {
        return '';
      }
      const labels = roster
        .map((row) => captainLabel(row.captainId, names))
        .join(', ');
      body = `The captains take their marks — ${labels}.`;
      break;
    }
    case 'MODULE_LOADOUT': {
      const labels = entry.moduleLabels ?? [];
      if (labels.length === 0) {
        body = `Modules? None — core rules only. Pure Warp.`;
        break;
      }
      body = `Module loadout locked in — ${labels.join(', ')}!`;
      break;
    }
    case 'CHART_COORDINATE': {
      const tile = tilePhrase(entry.coordinate);
      const trail = trailPhrase(
        entry.route,
        entry.captainId,
        names,
        options.pronouns
      );
      const openedRound = entry.effects.includes('round-opened');
      const openedNeutralZone = entry.effects.includes('neutral-zone-opened');
      // Prefer detailed Hand Exchange beat over the bare effect callout.
      const effectBeats = chartEffectCallouts(
        entry.handExchange
          ? entry.effects.filter((e) => e !== 'hand-exchange-opened')
          : entry.effects,
        entry.captainId,
        options.pronouns
      );
      const beats = [...effectBeats];
      if (entry.hotPotato?.taken) {
        beats.push('Takes the Hot Potato!');
      }
      if (entry.doubleDown) {
        const target = captainLabel(entry.doubleDown.targetCaptainId, names);
        const n = entry.doubleDown.drawCount;
        beats.push(
          n === 1
            ? `Double Down! ${target} draws 1!`
            : `Double Down! ${target} draws ${n}!`
        );
      }
      if (entry.salamanderSurge) {
        const n = entry.salamanderSurge.opponentDraws;
        beats.push(
          n === 1
            ? 'Salamander Surge! The fleet draws 1!'
            : `Salamander Surge! The fleet draws ${n}!`
        );
      }
      if (entry.handExchange) {
        const larger = captainLabel(entry.handExchange.largerCaptainId, names);
        const smaller = captainLabel(entry.handExchange.smallerCaptainId, names);
        beats.push(`Hand Exchange! ${larger} takes from ${smaller}!`);
      }
      const openingTile = openingTilePhrase(entry.coordinate);
      const lead = openedRound
        ? `${name} opens with ${openingTile} on ${trail}!`
        : openedNeutralZone
          ? `${name} opens the Neutral Zone with ${openingTile}!`
          : beats.length > 0
            ? `${name} charts ${tile} on ${trail}!`
            : `${name} charts ${tile} on ${trail}.`;
      body = `${joinBeats([lead, ...beats])}`;
      break;
    }
    case 'DRAW_FROM_UNCHARTED':
      if (entry.effects.includes('red-alert-opened')) {
        body = `${name} draws — and cannot answer the Double! Red Alert!`;
        break;
      }
      if (entry.effects.includes('return-to-warp')) {
        body = `${name} draws from Uncharted Sectors — back to warp!`;
        break;
      }
      if (entry.effects.includes('beacon-deployed')) {
        body = `${name} draws and deploys a Distress Beacon — trail open!`;
        break;
      }
      body = `${name} draws from Uncharted Sectors.`;
      break;
    case 'SENSOR_SWEEP': {
      const swept = entry.coordinate
        ? ` ${tilePhrase(entry.coordinate)}`
        : '';
      if (entry.effects.includes('red-alert-opened')) {
        body = `${name} sensor-sweeps${swept} — cannot answer the Double! Red Alert!`;
        break;
      }
      if (entry.effects.includes('return-to-warp')) {
        body = `${name} sensor-sweeps${swept} — returned to warp!`;
        break;
      }
      body = `${name} sensor-sweeps${swept} from the Sensor Grid.`;
      break;
    }
    case 'DESPERATION_DIG':
      if (entry.desperationDig?.charted) {
        body = `Desperation Dig! ${name} strikes and charts!`;
        break;
      }
      body = `Desperation Dig — ${name} comes up empty!`;
      break;
    case 'RESOLVE_HAND_EXCHANGE': {
      const partner = entry.targetCaptainId
        ? captainLabel(entry.targetCaptainId, names)
        : 'the lightest hand';
      body = `Hand Exchange complete — ${name} with ${partner}!`;
      break;
    }
    case 'SPOOL_WARP_DRIVE': {
      const trail = trailPhrase(
        entry.route,
        entry.captainId,
        names,
        options.pronouns
      );
      const details = entry.spoolDetails;
      const extras: string[] = [];
      if (details && details.tilesPlayed > 0) {
        extras.push(
          `${details.tilesPlayed} tile${details.tilesPlayed === 1 ? '' : 's'} away`
        );
      }
      if (
        details &&
        details.tilesToHand > 0 &&
        !entry.effects.includes('spool-abort-retrieve')
      ) {
        extras.push(
          `${details.tilesToHand} to hand`
        );
      }
      const detailText =
        extras.length > 0 ? ` (${extras.join(', ')})` : '';
      const abort = entry.effects.includes('spool-abort-retrieve')
        ? ' Unfinished double retrieved — no Red Alert!'
        : '';
      const momentum = entry.effects.includes('trail-momentum-claimed')
        ? ` ${momentumKeepConn(entry.captainId, options.pronouns)}`
        : '';
      body = `${name} engages warp drive on ${trail}${detailText}!${abort}${momentum}`;
      break;
    }
    case 'PASS_RED_ALERT': {
      const next = entry.nextCaptainId
        ? captainLabel(entry.nextCaptainId, names)
        : null;
      const toPhrase = next ? ` — over to ${next}` : '';
      body = `${name} passes Red Alert${toPhrase}! The pressure moves on!`;
      break;
    }
    case 'PASS_TURN': {
      const potato = entry.hotPotato;
      if (potato?.passDraws != null && potato.passDraws > 0) {
        body = `${name} passes holding the Hot Potato — draws ${potato.passDraws}!`;
        break;
      }
      if (potato?.skipNext) {
        body = `${name} passes holding the Hot Potato — skips the next turn!`;
        break;
      }
      if (potato?.passPenalty) {
        body = `${name} passes holding the Hot Potato — five points on the board!`;
        break;
      }
      body = `${name} passes.`;
      break;
    }
    case 'DEPLOY_DISTRESS_BEACON': {
      const beat = shieldControlPhraseForCaptain(
        'deploy',
        'present',
        entry.captainId,
        entry.at,
        options.pronouns
      );
      body = `${name} ${beat} — trail open!`;
      break;
    }
    case 'ALL_STOP':
      body = `All Stop! ${name} empties the hand — what a finish!`;
      break;
    case 'DROP_TO_IMPULSE':
      body = `Drop to Impulse! ${name} sounds the alarm!`;
      break;
    case 'CATCH_DROP_TO_IMPULSE': {
      const target = entry.targetCaptainId
        ? captainLabel(entry.targetCaptainId, names)
        : 'a captain';
      const returned = entry.effects.includes('return-to-warp')
        ? ` ${target} returns to warp!`
        : '';
      body = `Caught! ${name} tags ${target} for a missed Drop to Impulse!${returned}`;
      break;
    }
    case 'RAISE_SHIELDS': {
      const beat = shieldControlPhraseForCaptain(
        'raise',
        'present',
        entry.captainId,
        entry.at,
        options.pronouns
      );
      body = `${name} ${beat} — trail secured!`;
      break;
    }
    case 'INVOKE_CONTINUUM_FLASH': {
      const effect = entry.flashEffect?.replaceAll('-', ' ') ?? 'effect';
      body = `Continuum Flash! ${name} invokes ${effect}!`;
      break;
    }
    case 'RESOLVE_CONTINUUM_WAGER':
      body = `Q-Gamble resolved — ${name} settles the Continuum wager!`;
      break;
    case 'END_ROUND': {
      if (entry.effects.includes('round-blocked')) {
        body = `Round blocked — no legal charts remain! The table freezes!`;
        break;
      }
      const wentOut = captainLabel(entry.winnerId ?? entry.captainId, names);
      if (entry.roundInverted) {
        const trophy = (entry.roundWinnerIds ?? [])
          .filter((id) => id !== (entry.winnerId ?? entry.captainId))
          .map((id) => captainLabel(id, names));
        const takes =
          trophy.length > 0
            ? ` ${trophy.join(' & ')} take${trophy.length > 1 ? '' : 's'} the round with the heaviest hand!`
            : '';
        body = `Inverted round! ${wentOut} goes out — maximum penalty!${takes}`;
        break;
      }
      body = `${wentOut} takes the round!`;
      break;
    }
    case 'SALAMANDER_PENALTY': {
      const holder = captainLabel(entry.captainId, names);
      const points = entry.penaltyPoints ?? 0;
      const scoredOnId = entry.targetCaptainId ?? entry.captainId;
      if (scoredOnId !== entry.captainId) {
        const scoredOn = captainLabel(scoredOnId, names);
        body = `Salamander Penalty! ${holder}'s highest double swaps to ${scoredOn} — +${points}!`;
        break;
      }
      if (entry.effects.includes('salamander-swap-noop')) {
        body = `Salamander Penalty! ${holder} already leads — swap no-ops · +${points}!`;
        break;
      }
      body = `Salamander Penalty! ${holder} holds the highest double · +${points}!`;
      break;
    }
    case 'LONGEST_TRAIL_BONUS': {
      const who = captainLabel(entry.captainId, names);
      const length = entry.trailLength ?? 0;
      const points = entry.penaltyPoints ?? 0;
      const delta =
        points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
      body = `Longest Trail Bonus! ${who} stretches ${length} tiles · ${delta}!`;
      break;
    }
    case 'TEMPORAL_DEBT_PENALTY': {
      const who = captainLabel(entry.captainId, names);
      const tokens = entry.debtTokens ?? 0;
      const points = entry.penaltyPoints ?? 0;
      const delta =
        points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
      body = `Temporal Debt comes due! ${who} · ${tokens} token${tokens === 1 ? '' : 's'} · ${delta}!`;
      break;
    }
  }

  return body ? withElapsed(body) : '';
}

/** Digest the log to ringside highlight lines (empty lines omitted). */
export function formatCommentatorLogLines(
  entries: readonly GameLogEntry[],
  names: Readonly<Record<string, string>>,
  options: GameLogFormatOptions
): string[] {
  const lines: string[] = [];
  for (const entry of entries) {
    const line = formatCommentatorLine(entry, names, options);
    if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

/** Words that must never appear in commentator copy (tone / brand guard). */
export const COMMENTATOR_BANNED_PHRASES = [
  'dump',
  'dumps',
  'dumped',
  'huge dump',
  'sucks',
  'screwed',
  'kill',
  'killed',
  'crush',
  'crushed',
  'destroy',
  'destroyed',
  'owned',
  'pwned',
] as const;

export function commentatorLineIsSane(line: string): boolean {
  const lower = line.toLowerCase();
  return !COMMENTATOR_BANNED_PHRASES.some((phrase) => lower.includes(phrase));
}
