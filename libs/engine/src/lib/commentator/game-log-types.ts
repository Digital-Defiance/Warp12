import type { ChartRoute } from '../types/actions.js';
import type { Coordinate } from '../types/coordinate.js';
import type { FlashEffectKind } from '../types/continuum.js';
import type { GameAction } from '../types/actions.js';
import type { PronounForms } from './pronouns.js';

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
  | 'beacon-cleared'
  | 'dead-double'
  | 'round-opened'
  | 'neutral-zone-opened'
  | 'round-won'
  | 'round-blocked'
  | 'return-to-warp'
  | 'wormhole-opened'
  | 'salamander-swap-noop'
  | 'spool-abort-retrieve'
  | 'hand-exchange-opened'
  | 'trail-momentum-claimed';

export interface GameLogRoute {
  readonly kind: ChartRoute['kind'];
  readonly trailCaptainId?: string;
  readonly neutralZone?: boolean;
  /**
   * Module Zeta: actor charted their shared squadron trail whose canonical
   * trail key is a squadmate (not their own captain id).
   */
  readonly squadronTrail?: boolean;
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
  /**
   * Module Beta (Go-out) Salamander Surge — opponents draw after maxPip
   * double. Public count only (no tile identities).
   */
  readonly salamanderSurge?: {
    readonly opponentDraws: number;
  };
  /**
   * Module Delta · Hot Potato — public outcome only (no tile identities).
   * Chart to Neutral Zone picks up the marker; pass while holding penalizes.
   */
  readonly hotPotato?: {
    readonly taken?: true;
    /** Go-out: tiles drawn on pass while holding. */
    readonly passDraws?: number;
    /** Points: +5 stack incremented on pass while holding. */
    readonly passPenalty?: true;
    /** Go-out: pools empty — skip next turn instead of drawing. */
    readonly skipNext?: true;
  };
  /** For SPOOL_WARP_DRIVE: public counts only (no tile identities). */
  readonly spoolDetails?: {
    readonly tilesPlayed: number;
    /** Drawn tiles that went to hand (mismatch and/or retrieved unfinished double). */
    readonly tilesToHand: number;
    /** True when an unfinished matching double was retrieved — no RA / Fracture left. */
    readonly abortedUnfinishedDouble?: boolean;
  };
  /**
   * Module Kappa (Go-out) Hand Exchange — public captains only (no tile
   * identities for the steal or give-back).
   */
  readonly handExchange?: {
    readonly largerCaptainId: string;
    readonly smallerCaptainId: string;
  };
  /**
   * Module Eta (Go-out) Desperation Dig — public outcome only (no tile IDs).
   */
  readonly desperationDig?: {
    /** How many coordinates were drawn from Uncharted (0–3). */
    readonly draws: number;
    /** True when one drawn coordinate was auto-charted. */
    readonly charted: boolean;
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

export interface GameLogFormatOptions {
  readonly roundStartedAtMs: number;
  /**
   * Optional override for the elapsed-time prefix (default MM:SS).
   */
  readonly formatElapsed?: (entryAtIso: string, roundStartedAtMs: number) => string;
  /**
   * Optional absolute clock formatter (e.g. BrightDate) for ROUND_STARTED.
   */
  readonly formatAbsolute?: (iso: string) => string;
  /**
   * When false, commentator lines omit the elapsed/absolute time prefix
   * (e.g. `05:12 - …`). Fleet console lines always keep timestamps.
   * Default true.
   */
  readonly includeElapsedPrefix?: boolean;
  /**
   * Per-captain pronouns for trail / momentum copy. Missing seats default to
   * they/them/their.
   */
  readonly pronouns?: Readonly<Record<string, PronounForms>>;
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
