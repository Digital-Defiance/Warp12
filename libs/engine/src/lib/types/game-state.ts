import type { Coordinate } from './coordinate.js';
import type { GameObjective } from './objective.js';
import type {
  GoOutOvertimePolicy,
  GoOutStructure,
} from './go-out-campaign.js';
import type { HouseRules, HouseRulesConfig } from './house-rules.js';
import type { PlayerId } from './player.js';
import type { NeutralZone, Spacedock, WarpTrail } from './trails.js';
import type { RedAlert, SubspaceFracture } from './anomalies.js';
import type { GamblePending, RoundEffects } from './continuum.js';
import type { ChartRoute } from './actions.js';

export type GamePhase = 'lobby' | 'active' | 'round-end' | 'complete';

export type RoundPhase = 'setup' | 'drafting' | 'playing' | 'ended';

/**
 * Module Epsilon: Drafting phase state.
 * Captains receive packs of tiles, pick one, and pass the rest clockwise.
 */
export interface DraftState {
  /** Current drafter (picks from their pack, then passes). */
  readonly currentDrafter: PlayerId;
  /** Draft turn order (may differ from play turn order). */
  readonly draftOrder: readonly PlayerId[];
  /** Current pick number (1-based). When pickNumber > packSize, draft ends. */
  readonly pickNumber: number;
  /** Tiles each captain is currently holding (their pack). */
  readonly currentPacks: Readonly<Record<PlayerId, readonly Coordinate[]>>;
  /** Tiles each captain has permanently picked. */
  readonly pickedTiles: Readonly<Record<PlayerId, readonly Coordinate[]>>;
}

export interface TableState {
  readonly spacedock: Spacedock;
  readonly warpTrails: Readonly<Record<PlayerId, WarpTrail>>;
  readonly neutralZone: NeutralZone;
  readonly subspaceFracture: SubspaceFracture | null;
  readonly redAlert: RedAlert | null;
}

export interface RoundState {
  readonly roundNumber: number;
  readonly spacedockValue: number;
  readonly phase: RoundPhase;
  readonly activePlayerId: PlayerId;
  readonly turnOrder: readonly PlayerId[];
  readonly table: TableState;
  readonly unchartedSectors: readonly Coordinate[];
  /** Module Gamma: visible market of tiles for strategic draws. */
  readonly sensorGrid: readonly Coordinate[];
  readonly hands: Readonly<Record<PlayerId, readonly Coordinate[]>>;
  /** Module Epsilon: Draft state when drafting is enabled. */
  readonly draftState: DraftState | null;
  readonly allStopRequired: boolean;
  readonly allStopDeclared: boolean;
  readonly roundWinnerId: PlayerId | null;
  /** Captain who must invoke a Continuum Flash after charting 0-0. */
  readonly continuumPendingInvoker: PlayerId | null;
  /** Active Continuum Flash mechanical effects for this round. */
  readonly continuumEffects: RoundEffects | null;
  /** Awaiting keep/discard after Continuum Wager. */
  readonly continuumWagerPending: GamblePending | null;
  /** After a draw, this tile must be charted immediately if playable. */
  readonly mandatoryPlay: { readonly playerId: PlayerId; readonly coordinate: Coordinate } | null;
  /** Win deferred until a pending Continuum Flash resolves. */
  readonly pendingRoundWin: {
    readonly playerId: PlayerId;
    readonly routeKind: ChartRoute['kind'];
  } | null;
  /** Sector ended with an empty draw pile and no legal charts (no domino winner). */
  readonly roundBlocked: boolean;
  /** Deluxe opening: round starter owes a second chart this turn (opening only). */
  readonly roundStarterOpening: {
    readonly playerId: PlayerId;
  } | null;
  /**
   * Deluxe opening complete for this round. Once true, the starter no longer
   * gets a held turn for a second tile — play two is opening-turn only.
   */
  readonly roundStarterOpeningResolved: boolean;
  /** Voluntary Drop to Impulse declare pending (one coordinate left this turn). */
  readonly dropToImpulseCallPending: PlayerId | null;
  /** Forgot to declare — opponents may catch until the next helm pass. */
  readonly dropToImpulseCatchable: PlayerId | null;
  /** Manual shield control: active captain charted this turn and may toggle shields before passing. */
  readonly playedThisTurn: boolean;
  /** Set after drawing while unable to chart; cleared when helm passes. */
  readonly drewThisTurn: boolean;
  /**
   * Manual shield control: the active captain has already changed their shield
   * state (one open or one close) this turn. Enforces the one-shield-change-
   * per-turn cap. Cleared when helm passes.
   */
  readonly shieldChangedThisTurn?: boolean;
  /**
   * Transient "return to warp" signal: true only on the state produced by a draw
   * that grew an at-impulse hand (length 1 → 2+) while Drop to Impulse is on.
   * Drives the return-to-warp cue/log across all impulse paths (same-turn draw,
   * caught penalty draw, and announced-then-drawn). Reset on the next action.
   */
  readonly returnedToWarp?: boolean;
  /**
   * Engine signal: a wormhole opened (double played on Neutral Zone, trails swapped).
   * Drives the wormhole sound effect. Reset on the next action.
   */
  readonly wormholeOpened?: boolean;
  /**
   * Transient Module Delta signal: spool aborted an unfinished matching double
   * (retrieved to hand; no Red Alert / Fracture left). Drives game-log / feedback.
   * Reset on the next action.
   */
  readonly spoolAbortRetrieve?: boolean;
  /**
   * Double-N max pip for this sector (9 / 12 / 15 / 18). Used for dead-double
   * pip exhaustion. Omit for legacy fixtures (treated as 12).
   */
  readonly maxPip?: number;
  /**
   * Module Delta: Captain currently holding the Hazard Marker (touched NZ last).
   * If they pass while holding it, they get +5 penalty at round end.
   */
  readonly hazardMarkerHolder?: PlayerId | null;
  /**
   * Module Delta: Number of times the current hazard marker holder has passed.
   * Resets when marker transfers. Each pass costs +5 points.
   */
  readonly hazardMarkerPassCount?: number;
  /**
   * Module Eta (Temporal Debt): Track debt tokens per captain from drawing.
   * Each draw from uncharted accumulates +1 debt. Pay costPerToken at round end.
   */
  readonly debtTokens?: Readonly<Record<PlayerId, number>>;
  /**
   * Module Zeta (Squadrons): squad rosters for this round. Present only when
   * the squadrons module is enabled. Drives shared-trail / shared-beacon
   * resolution via `trailKeyFor` (see engine/squadrons.ts). Absent = FFA.
   */
  readonly squadrons?: readonly import('./squadrons.js').Squadron[];
  /**
   * Module Theta (Go-out) Trail Momentum: pending helm reactivation for the
   * captain who first reached personal trail length ≥ 5. Consumed on the next
   * `advanceTurn` instead of passing the helm.
   */
  readonly trailMomentumExtraTurnFor?: PlayerId | null;
  /**
   * Module Kappa (Go-out) Hand Exchange: awaiting give-back choice from the
   * larger hand after a random steal.
   */
  readonly handExchangePending?: {
    readonly largerPlayerId: PlayerId;
    readonly smallerPlayerId: PlayerId;
    readonly takenCoordinate: Coordinate;
  } | null;
}

export interface GameState {
  readonly id: string;
  readonly phase: GamePhase;
  readonly captains: readonly import('./player.js').Captain[];
  readonly round: RoundState | null;
  readonly completedRounds: number;
  readonly modules: import('./modules.js').GameModules;
  /** Optional house-rule toggles (default standard multi-trail). */
  readonly houseRules: HouseRules;
  /** Fleet victory condition — points campaign vs go-out. */
  readonly objective: GameObjective;
  /**
   * Points campaigns: end after this many rounds.
   * Go-out fixed-rounds: same — play this many Spacedock rounds then compare
   * round wins (overtime if tied).
   */
  readonly campaignRounds: number;
  /**
   * Go-out sector structure. Omit / sudden-death = first empty hand ends the
   * sector (legacy default).
   */
  readonly goOutStructure?: GoOutStructure;
  /** Go-out first-to: round wins required to take the sector. */
  readonly goOutWinsToWin?: number;
  /** Go-out fixed-rounds: overtime policy when win counts tie. */
  readonly goOutOvertime?: GoOutOvertimePolicy;
  /**
   * Index into round turnOrder for the match's round-1 starter. Subsequent
   * rounds rotate clockwise: `(matchStarterIndex + roundNumber - 1) % n`.
   */
  readonly matchStarterIndex?: number;
  /**
   * Fixed-rounds go-out ended tied; waiting for host to accept/decline overtime.
   */
  readonly goOutOvertimePending?: boolean;
  /** Currently playing go-out overtime (Spacedock may wrap past 0-0). */
  readonly goOutInOvertime?: boolean;
  /**
   * Double-N max pip for this sector (9 / 12 / 15 / 18). Omit for legacy
   * double-twelve fixtures (treated as 12).
   */
  readonly maxPip?: number;
  /**
   * Module Zeta (Squadrons): squad rosters for the sector. Present only when
   * the squadrons module is enabled.
   */
  readonly squadrons?: readonly import('./squadrons.js').Squadron[];
  /**
   * Module Theta (Go-out) Trail Momentum: captain who already claimed the
   * once-per-round extra turn (or null/undefined if unclaimed). Cleared when
   * the next round is dealt.
   */
  readonly trailMomentumClaimedBy?: PlayerId | null;
  /**
   * Module Kappa (Go-out) Hand Exchange: true once the first-double trigger
   * has fired this round (whether an exchange ran or was skipped for ties).
   * Cleared when the next round is dealt.
   */
  readonly handExchangeResolved?: boolean;
}

export interface CreateGameInput {
  readonly id: string;
  readonly captains: readonly { id: string; displayName: string }[];
  readonly modules?: import('./modules.js').GameModuleConfig;
  readonly houseRules?: HouseRulesConfig;
  readonly objective?: GameObjective;
  readonly campaignRounds?: number;
  readonly goOutStructure?: GoOutStructure;
  readonly goOutWinsToWin?: number;
  readonly goOutOvertime?: GoOutOvertimePolicy;
  /** Index into captains/turnOrder for round-1 starter (any seat). */
  readonly matchStarterIndex?: number;
  /** Double-N max pip (9 / 12 / 15 / 18). Defaults to 12. */
  readonly maxPip?: number;
}

export interface CreateRoundInput {
  readonly roundNumber: number;
  readonly captains: readonly import('./player.js').Captain[];
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly roundStarterId?: PlayerId;
}
