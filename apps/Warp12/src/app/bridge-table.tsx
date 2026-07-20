import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  buildAdvisorReport,
  canRaiseShieldsByCharting,
  canRaiseShieldsManually,
  captainNameMap,
  createDemoGame,
  formatViolation,
  getLegalMoves,
  handPoints,
  countActiveDistressBeacons,
  countDoublesOnTable,
  trailOpenValue,
  trailKeyFor,
  pickBalancedTile,
  type ActionResult,
  type AdvisorActionLogEntry,
  type AdvisorMoveReview,
  type AdvisorReport,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type LegalMove,
  type RoundState,
  type WarpAiPlayer,
  type AdvisorModelWeights,
  type OmegaModelWeights,
  toModuleConfig,
  salamanderPenaltyAction,
  longestTrailBonusActions,
  temporalDebtPenaltyActions,
  explainRoundPoints,
  summarizeRoundOutcome,
  EMPTY_Q_ROUND_EFFECTS,
  pendingResolutionActorId,
  type RoundPointBreakdown,
  type RoundPointLine,
} from 'warp12-engine';
import { resolveHelmControls } from '../game/helm-controls.js';
import { roundEndHeadline, roundEndTitle } from './round-end-summary.js';
import {
  buildRoundEndScoreRows,
  sortRoundEndScoreRows,
} from './round-end-scoreboard.js';
import {
  doubleDownNoticeFromEntry,
  formatDoubleDownFeedback,
  formatModuleFeedbackFromLogEntry,
  formatSpoolFeedback,
  type DoubleDownNotice,
} from '../game/module-feedback.js';
import { DominoHub, DominoTile, DominoThemeProvider } from 'double-eighteen-react';
import {
  coachActionKind,
  coachChartMove,
  coordinatesEqual,
  createActionLog,
  createGameLog,
  buildAutoAllStopLogEntry,
  buildGameLogEntry,
  buildRoundLogExport,
  buildRoundOutcomeEntry,
  buildSalamanderPenaltyLogEntry,
  buildLongestTrailBonusLogEntry,
  buildTemporalDebtPenaltyLogEntry,
  buildModuleLoadoutEntry,
  buildRoundRatingsEntry,
  buildRoundStartedEntry,
  buildDevConsoleUnlockEntry,
  type GameLogEntry,
  type GameLogRosterEntry,
  formatGameLogLine,
  gameStateToTrains,
  buildTrailSpokeStatuses,
  hubTableGeometry,
  computeTableFocusPoint,
  detectNewChart,
  formatSectorRedAlertRow,
  shouldIlluminateBridgeRedAlert,
  shouldIlluminateBridgeYellowAlert,
  getCoachSuggestion,
  openTrailCaptains,
  playerIdForAction,
  routeLabel,
  coordinateKey,
  displayCoordinateValues,
  useHandLayout,
  summarizeAdvisorPerformance,
  campaignAdvisorPlainText,
  type ActionLogSource,
  type AdvisorPerformanceSummary,
  type CoachSuggestion,
  type TableFocusPoint,
  type TrailAccessState,
  formatCommentatorLine,
} from 'warp12-react';
import { downloadDebugExport } from '../game/debug-export.js';
import { deliverBlob } from '../game/deliver-file.js';
import {
  appendMatchDebugAction,
  appendMatchDebugRoundSnapshot,
  createEmptyMatchDebugRecording,
  disableMatchDebugRecording,
  enableMatchDebugRecording,
  matchDebugExportPayload,
  shouldResetMatchDebugOnRound,
  type MatchDebugRecording,
} from '../game/match-debug-recording.js';
import {
  buildRoundLogFilename,
  downloadRoundLog,
  downloadRoundLogJson,
} from '../game/save-round-log.js';
import {
  canUseSystemShare,
  deliverPendingRoundImage,
  deliverRoundImage,
  formatPointsStatLines,
  RoundImageShareGestureError,
  type PendingRoundImageShare,
  type ShareRoundDelivery,
  type ShareRoundImageMode,
  type ShareRoundMetadata,
} from '../game/share-round.js';
import type { LocalGameConfig } from '../game/local-game-config';
import { isPassAndPlay, isRatedLocalGame, neuralAiSupported } from '../game/local-game-config';
import { redealLocalRoundWithSeed } from '../game/create-local-game.js';
import {
  suggestConsoleHumanAction,
  type ConsolePlayMode,
} from '../game/local-game-console-play.js';
import {
  consoleUnlockVoidsTei,
  DEV_CONSOLE_UNLOCK_COMMAND,
  publishAdminToolsLoaded,
} from '../game/local-game-dev-console.js';
import { userHasAdminRole } from '../firebase/warp-auth-roles.js';

/** Bumps each Bridge console effect run; deferred cleanup skips superseded gens. */
let bridgeDevConsoleEffectGen = 0;
import type { FirestoreCaptain, FirestoreRoundMove } from '../firebase/schema.js';
import { useGameSoundEffects } from '../game/use-game-sounds.js';
import { useBridgeAmbience } from '../game/use-bridge-ambience.js';
import { countChartedTilesOnTable } from '../game/charted-tile-count.js';
import {
  resolveCoachIndicator,
  type CoachIndicator,
  type CoachPresence,
} from '../firebase/coach-presence';
import { isFirebaseConfigured } from '../firebase/config.js';
import {
  applyMatchAction,
  createMatchRoundReshuffle,
  extractHumanActions,
} from '../game/verify-local-ai-replay.js';
import { ratedMatchCheckInUrl } from '../firebase/auth-actions.js';
import { preloadAdvisorWeights } from '../ai/load-advisor-weights.js';
import { preloadOmegaWeights } from '../ai/load-omega-weights.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import {
  createCommentatorAudioPlayer,
  synthesizeCommentatorSpeech,
  type SynthesizeCommentatorSpeechInput,
} from '../firebase/synthesize-commentator-speech.js';
import { createCommentatorTtsQueue } from '../game/commentator-tts-queue.js';
import {
  classifyLocalAiMatchOpponent,
  classifyLocalAiMatchSkill,
  humanWonLocalMatch,
} from '../game/local-match-stats.js';
import { tableOpponentLabelForAdvisor } from '../game/advisor-report-meta.js';
import { useCaptainProfile } from '../game/use-captain-profile.js';
import { resolveTtsNameMap } from '../game/captain-speak-as.js';
import {
  buildLocalRosterTei,
  buildOnlineRosterClasses,
  rosterHasTacticalClasses,
} from '../game/roster-elo.js';
import {
  buildCaptainTacticalClassAbbrevById,
  buildCaptainTacticalClassLabelById,
} from '../game/captain-tactical-class.js';
import {
  sectorWinnerName,
} from '../game/sector-outcome.js';
import { isAiCaptainId } from '../game/ai-captain.js';
import {
  ratedObjective,
  reportLocalAiMatch,
  reportOnlineMatch,
  type LocalAiMatchReport,
  type OnlineHumanSelfReport,
} from '../firebase/stats-service.js';
import {
  onlineMatchRatingEligibility,
  onlineRatingWarning,
  onlineUnratedNotice,
} from '../firebase/human-tei.js';
import { isNetworkAvailable } from '../game/offline-match-queue.js';
import { CampaignCompleteOverlay } from './campaign-complete-overlay.js';
import {
  deriveCampaignPointsHistory,
  type CampaignRoundPoints,
} from './campaign-points-history.js';
import {
  createWarpDominoTheme,
  WARP_PIP_COLORS,
  WARP_TILE_SURFACE,
  warpPalette,
} from 'warp12-theme';
import { useBridgeFocus, useTableSession } from './bridge-focus-context';
import { EdgeTailRail } from './edge-tail-rail';
import { isCompactLayoutTier, shouldNudgePortraitForSummary } from './layout-tier';
import { useLayoutTier, useLayoutTierState } from './layout-tier-context';
import { PortraitLockOverlay } from './portrait-lock-overlay';
import { useBridgeHeaderActionRegistration } from './bridge-header-actions-context';
import { useGameAudio } from './game-audio-context';
import { FloatingCoachPanel } from './floating-coach-panel';
import { CaptainTailsHud } from './captain-tails-hud';
import { DraftPhase } from './draft-phase';
import styles from './bridge-table.module.scss';
import {
  ContinuumOrb,
  ContinuumFlashPanel,
  ContinuumWagerPanel,
  HandExchangePanel,
} from './flash-panel.js';
import { TrailSpokeIndicators } from './trail-spoke-indicators';
import spokeStyles from './trail-spoke-indicators.module.scss';
import {
  TableViewport,
  nextLogVisibilityMode,
  type LogVisibilityMode,
} from './table-viewport';
import {
  logModeToScope,
  readLogVisibilityMode,
  scopeToLogMode,
  writeLogVisibilityMode,
  type GameLogScope,
} from './log-visibility-prefs.js';
import {
  COMMENTATOR_TICKER_MAX_LINES,
  filterGameLogLines,
  takeRecentLogLines,
} from './game-log-filter.js';
import {
  COMMENTARY_OVERLAY_PATH,
  COMMENTATOR_CHANNEL,
  isCommentatorBroadcastMessage,
  openCommentaryOverlayWindow,
  publishCommentatorSnapshot,
} from './commentator-broadcast.js';
import {
  HAND_COMPANION_CHANNEL,
  handCompanionChannelForSeat,
  isHandCompanionInboundMessage,
  openCouchHandWindows,
  openLocalHandCompanionWindow,
  publishHandCompanionRoster,
  publishHandCompanionSnapshot,
  redactGameForSeat,
} from './hand-companion-broadcast.js';
import {
  companionListenChannels,
  isCompanionHandoffEnabled,
  resolveCompanionHumanSeats,
  resolveFollowCompanionSeatId,
  shouldAcceptCompanionAction,
  shouldAcceptCompanionHandoffReady,
} from './hand-companion-bridge.js';
import { useAnnounce } from '../a11y/live-announcer.js';
import { TableOptionsDialog } from './table-options-dialog';
import { SectorSettingsDialog } from './sector-settings-dialog';
import { sanitizeAutoFollowReturnDelayMs } from './follow-snap-back.js';
import { ConfirmDialog } from './confirm-dialog';
import { HostLeaveSectorDialog } from './host-leave-sector-dialog';
import { useCampaignCompleteSplashEgg } from './use-campaign-complete-splash-egg';
import { RoundImageActions } from './round-image-actions';
import { SectorStatusHud } from './sector-status-hud';
import { SectorStatusHolo } from './sector-status-holo';
import { SensorGridHud } from './sensor-grid-hud';
import { GameLogTicker } from './game-log-ticker';
import { GameLogDialog } from './game-log-dialog';
import { StreamSetupDialog } from './stream-setup-dialog.js';
import { AdvisorReportDialog } from './advisor-report-dialog.js';
import { sectorHandUrl } from '../game/sector-invite-urls.js';
import { buildCaptainNameColors } from './game-log-display';
import { formatDisplayTime, formatElapsedLogTime } from './display-time.js';
import {
  useBridgeHeaderStatusRegistration,
  type BridgeRatingState,
} from './bridge-header-status-context';
import {
  LOG_FONT_SCALE_FACTOR,
  readTableOptions,
  resolveSectorStatusHud,
  sanitizeFollowFocusNorm,
  writeTableOptions,
} from './table-view-prefs';

const HAND_TILE_WIDTH = 36;
const HAND_TILE_HEIGHT = 72;
const HAND_TILE_WIDTH_COMPACT = 24;
const HAND_TILE_HEIGHT_COMPACT = 48;

function canShowInHandPenalty(
  captainId: string,
  handOwnerId: string
): boolean {
  return captainId === handOwnerId;
}

function formatPointsScoreLine(
  captainId: string,
  campaignScore: number,
  round: RoundState | null | undefined,
  hand: readonly Coordinate[] | undefined,
  options: {
    handOwnerId: string;
    salamanderEnabled: boolean;
    doubleZeroScore: import('warp12-engine').DoubleZeroScore;
    maxPip: number;
  }
): string {
  // Lowest displayed score is zero; the raw total can dip negative (Longest
  // Trail tiebreak credit) but that's only used for ranking, never shown.
  const campaign = `${Math.max(0, campaignScore)} campaign`;
  if (
    !round ||
    !canShowInHandPenalty(captainId, options.handOwnerId) ||
    hand === undefined
  ) {
    return campaign;
  }

  const inHand = handPoints(
    hand,
    options.salamanderEnabled,
    round.roundNumber,
    options.doubleZeroScore,
    options.maxPip
  );
  return `${campaign} · ${inHand} in hand`;
}

function roundEndContinueLabel(
  game: GameState,
  round: RoundState
): string {
  if (game.objective === 'points' && round.roundNumber < game.campaignRounds) {
    return `Deal round ${round.roundNumber + 1}`;
  }
  return 'Score round';
}

function formatSignedPoints(points: number): string {
  return `${points < 0 ? '−' : '+'}${Math.abs(points)}`;
}

/**
 * Render a module note, drawing its "× N" multiplier as its own accented glyph.
 * The receipt inherits the federation display font, which has no U+00D7, so a
 * plain `×` in the note string renders as invisible tofu ("1 token  2"). We
 * split it out and paint our own coloured × in a font that actually has it.
 */
function ReceiptNote({ note }: { note: string }) {
  const parts = note.split(/\s*\u00d7\s*/);
  if (parts.length < 2) {
    return <>{note}</>;
  }
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className={styles.receiptTimes} aria-label="times">
              ×
            </span>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Plain-language explanation for a scored module line, shown on hover so the
 * "why" behind each adjustment is discoverable without cluttering the receipt.
 * Values (bonus size, cost/token, pass count) already live in the row's note.
 */
function roundPointLineTooltip(
  kind: RoundPointLine['kind']
): string | undefined {
  switch (kind) {
    case 'inversionBaseline':
      return 'Temporal Inversion (Module Kappa): on an inverted round the highest hand wins. Everyone starts at the round\u2019s top hand (shown here), then each tile you kept subtracts its pips — so the biggest hand nets zero and going out (you kept nothing) takes the full baseline.';
    case 'longestTrail':
      return 'Longest Trail (Module Theta): the captain(s) with the longest personal warp trail this round earn this pip bonus. Ties share it.';
    case 'temporalDebt':
      return 'Temporal Debt (Module Eta): debt tokens accrued during the round are charged at the shown cost per token when the round is scored.';
    case 'hazardMarker':
      return 'Hazard Marker (Module Delta): passing your turn while holding the hazard marker adds a pip penalty for each pass this round.';
    case 'salamanderSwapIn':
      return "Salamander (Module Sigma): the round's highest double was swapped to you, so you take its pip value as a penalty.";
    default:
      return undefined;
  }
}

interface ReceiptTipAnchor {
  x: number;
  y: number;
  above: boolean;
}

/**
 * Shared hover/focus tooltip state. Positions off the triggering event's
 * `currentTarget` (element-agnostic) and closes on Escape so the tip stays
 * dismissable per WCAG 1.4.13 (Content on Hover or Focus).
 */
function usePortalTip() {
  const [tip, setTip] = useState<ReceiptTipAnchor | null>(null);
  const openTip = useCallback((event: { currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const above = rect.top > 96;
    setTip({
      x: rect.left + rect.width / 2,
      y: above ? rect.top - 6 : rect.bottom + 6,
      above,
    });
  }, []);
  const closeTip = useCallback(() => setTip(null), []);
  useEffect(() => {
    if (!tip) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTip(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tip]);
  return { tip, openTip, closeTip };
}

/**
 * The floating tooltip bubble itself. Portaled to `document.body` (fixed
 * position) so it escapes the round-end panel's overflow clipping, and marked
 * `aria-hidden` because the accessible text is carried on the anchor
 * (aria-label / aria-describedby) — this keeps it purely visual for sighted
 * pointer/keyboard users without double-announcing to screen readers.
 */
function PortalTipBubble({
  text,
  tip,
}: {
  text: string;
  tip: ReceiptTipAnchor | null;
}) {
  if (!tip || typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <span
      aria-hidden
      className={styles.receiptTip}
      data-above={tip.above ? 'true' : undefined}
      style={{ left: tip.x, top: tip.y }}
    >
      {text}
    </span>,
    document.body
  );
}

/**
 * Icon/marker anchor (e.g. 🏆 winner, ✋ emptied hand) with a portal tooltip.
 * The `text` doubles as the accessible name via role="img" + aria-label, so
 * screen readers announce it and the visual tip is a mouse/keyboard nicety.
 */
function PortalTip({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children: ReactNode;
}) {
  const { tip, openTip, closeTip } = usePortalTip();
  return (
    <span
      className={className}
      role="img"
      aria-label={text}
      tabIndex={0}
      onPointerEnter={openTip}
      onPointerLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      {children}
      <PortalTipBubble text={text} tip={tip} />
    </span>
  );
}

/**
 * One module-adjustment row in the receipt, with a portal-rendered hover/focus
 * tooltip explaining the rule. The row keeps its visible label as its accessible
 * name and links the rule text via `aria-describedby` (a visually-hidden span),
 * so screen readers get both. Native `title` is avoided (unreliable in the Tauri
 * webviews) and a CSS tooltip would be clipped by the panel's overflow.
 */
function ReceiptModRow({
  label,
  note,
  points,
  tooltip,
}: {
  label: string;
  note?: string;
  points: number;
  tooltip?: string;
}) {
  const tipId = useId();
  const { tip, openTip, closeTip } = usePortalTip();

  const interactive = tooltip
    ? {
        onPointerEnter: openTip,
        onPointerLeave: closeTip,
        onFocus: openTip,
        onBlur: closeTip,
        tabIndex: 0,
        'aria-describedby': tipId,
      }
    : {};

  return (
    <li className={styles.receiptMod} {...interactive}>
      <span className={styles.receiptModLabel}>
        {label}
        {note && (
          <span className={styles.receiptModNote}>
            {' · '}
            <ReceiptNote note={note} />
          </span>
        )}
      </span>
      <span className={styles.receiptModPts}>{formatSignedPoints(points)}</span>
      {tooltip && (
        <>
          <span id={tipId} className={styles.srOnly}>
            {tooltip}
          </span>
          <PortalTipBubble text={tooltip} tip={tip} />
        </>
      )}
    </li>
  );
}

/**
 * The "+N ▾" points cell that toggles the score-breakdown receipt. Keeps the
 * points value as its accessible name and describes the toggle affordance via a
 * portal tooltip + visually-hidden `aria-describedby` text.
 */
function ScoreBreakdownButton({
  pointsLabel,
  isExpanded,
  detailId,
  onToggle,
}: {
  pointsLabel: string;
  isExpanded: boolean;
  detailId: string;
  onToggle: () => void;
}) {
  const tipId = useId();
  const { tip, openTip, closeTip } = usePortalTip();
  const hint = isExpanded ? 'Hide score breakdown' : 'Show score breakdown';
  return (
    <button
      type="button"
      className={styles.pointsButton}
      aria-expanded={isExpanded}
      aria-controls={detailId}
      aria-describedby={tipId}
      onClick={onToggle}
      onPointerEnter={openTip}
      onPointerLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
    >
      <span>{pointsLabel}</span>
      <span className={styles.pointsCaret} aria-hidden>
        {isExpanded ? '▶️' : '🔽'}
      </span>
      <span id={tipId} className={styles.srOnly}>
        {hint}
      </span>
      <PortalTipBubble text={hint} tip={tip} />
    </button>
  );
}

/**
 * "Why did I score that?" receipt: the held dominoes (as mini tiles) plus every
 * module adjustment that bumped a captain's round delta. Driven entirely by the
 * engine's {@link explainRoundPoints}, so it always matches the shown total.
 */
function RoundPointReceipt({
  breakdown,
  maxPip,
  tileSurface,
}: {
  breakdown: RoundPointBreakdown;
  maxPip: number;
  tileSurface: { fill: string; border: string };
}) {
  const tileLines = breakdown.lines.filter(
    (
      line
    ): line is RoundPointLine & { tile: NonNullable<RoundPointLine['tile']> } =>
      line.kind === 'tile' && line.tile != null
  );
  // "Charted out — no pips counted" is a 0-point caption (normal-round go-out).
  const summaryLine = breakdown.lines.find((line) => line.kind === 'wentOut');
  // Kappa's inverted-round top-hand baseline: a real +points line that heads the
  // receipt, since the held tiles below subtract from it.
  const baselineLine = breakdown.lines.find(
    (line) => line.kind === 'inversionBaseline'
  );
  const moduleLines = breakdown.lines.filter(
    (line) =>
      line.kind !== 'tile' &&
      line.kind !== 'wentOut' &&
      line.kind !== 'inversionBaseline'
  );

  return (
    <div className={styles.receipt}>
      {summaryLine && (
        <p className={styles.receiptSummary}>{summaryLine.label}</p>
      )}
      {baselineLine && (
        <ul className={styles.receiptMods}>
          <ReceiptModRow
            label={baselineLine.label}
            note={baselineLine.note}
            points={baselineLine.points}
            tooltip={roundPointLineTooltip(baselineLine.kind)}
          />
        </ul>
      )}
      {tileLines.length > 0 && (
        <ul className={styles.receiptTiles}>
          {tileLines.map((line, index) => (
            <li key={index} className={styles.receiptTile}>
              <span className={styles.receiptTileArt} aria-hidden>
                <DominoTile
                  maxPips={maxPip}
                  value1={line.tile.high}
                  value2={line.tile.low}
                  width={18}
                  height={36}
                  backgroundColor={tileSurface.fill}
                  borderColor={tileSurface.border}
                  pipColors={WARP_PIP_COLORS}
                />
              </span>
              <span className={styles.receiptTileLabel}>
                {line.note ?? `${line.tile.high} + ${line.tile.low}`}
              </span>
              <span className={styles.receiptTilePts}>
                {formatSignedPoints(line.points)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {moduleLines.length > 0 && (
        <ul className={styles.receiptMods}>
          {moduleLines.map((line, index) => (
            <ReceiptModRow
              key={index}
              label={line.label}
              note={line.note}
              points={line.points}
              tooltip={roundPointLineTooltip(line.kind)}
            />
          ))}
        </ul>
      )}
      <div className={styles.receiptTotal}>
        <span>Round total</span>
        <span>{formatSignedPoints(breakdown.total)}</span>
      </div>
    </div>
  );
}

export interface BridgeTableProps {
  mode?: 'local' | 'online';
  game?: GameState;
  /** Local simulation: human vs AI seating and victory rules. */
  localConfig?: LocalGameConfig;
  /** Deal + AI RNG seed (crypto-drawn at launch). */
  matchSeed?: number;
  aiPlayers?: ReadonlyMap<string, WarpAiPlayer>;
  onRematch?: () => void;
  onLeaveSetup?: () => void;
  viewerId?: string;
  handCounts?: Record<string, number>;
  /** Online sectors with host-run AI officers (by captain id). */
  onlineAiCaptainIds?: ReadonlySet<string>;
  /** Online lobby captains — used for AI officer rank on tails and tooltips. */
  onlineCaptains?: readonly FirestoreCaptain[];
  /**
   * Online: when false, TTS uses call signs only (ignores roster speakAs).
   * Default true when omitted.
   */
  useSpeakAs?: boolean;
  /** Online: host intent to play for TEI (default true). */
  sectorRated?: boolean;
  /** Online: host pause — everyone spectator-like until resume. */
  sectorPaused?: boolean;
  pauseReason?: string;
  /** Online: shared per-round applied-action history (full log + advisor). */
  onlineMoveLog?: readonly FirestoreRoundMove[];
  /** Online: host allowSpectate (default true). */
  allowSpectate?: boolean;
  /** Online host: opens the host-controls dialog (headset icon on the table toolbar). */
  hostModControl?: { onOpen: () => void };
  onAction?: (action: GameAction) => Promise<ActionResult>;
  onLeave?: () => void;
  isOnlineHost?: boolean;
  onHostAbandonSector?: () => void | Promise<void>;
  onHostResetSector?: () => void;
  /** Mid-mission: replace host seat with AI and transfer command. */
  onHostLeaveWithAi?: (input: {
    newHostId: string;
    skill: import('warp12-engine').WarpSkillLevel;
  }) => void | Promise<void>;
  hostLeaveBusy?: boolean;
  onExportDebug?: () => void | Promise<void>;
  debugExportBusy?: boolean;
  sectorCode?: string;
  syncPending?: boolean;
  /** Online: tactical-advisor signals from Firestore presence subcollection. */
  coachPresence?: Record<string, CoachPresence>;
  onCoachSignal?: () => void | Promise<void>;
  /** Online: toggle for the subspace comms panel. */
  commsControl?: { open: boolean; onToggle: () => void };
  /** Dev-only: pause AI turn execution. */
  aiPaused?: boolean;
  /** Dev-only: toggle AI pause from console tools. */
  onAiPausedChange?: (paused: boolean) => void;
  /** Dev-only: full match rematch with a new seed (rebuilds AI roster). */
  onResetMatchWithSeed?: (seed: number) => void;
  /**
   * Always show the private hand (second-monitor /hand window). Overrides
   * hideHandOnBridge so stream-safe on the capture window does not blank this one.
   */
  forceShowHand?: boolean;
  /**
   * Private-hand companion chrome: hide the table / ticker and keep the helm
   * strip + Continuum panels (online /hand strip mode).
   */
  handStripOnly?: boolean;
  /** Watch / stream capture windows can prefer commentator on first load. */
  preferLogMode?: LogVisibilityMode;
}

export function BridgeTable({
  mode = 'local',
  game: externalGame,
  localConfig,
  matchSeed,
  aiPlayers,
  onRematch,
  onLeaveSetup,
  viewerId,
  handCounts = {},
  onlineAiCaptainIds,
  onlineCaptains,
  useSpeakAs = true,
  sectorRated = true,
  sectorPaused = false,
  pauseReason,
  onlineMoveLog,
  allowSpectate = true,
  hostModControl,
  onAction,
  onLeave,
  isOnlineHost = false,
  onHostAbandonSector,
  onHostResetSector,
  onHostLeaveWithAi,
  hostLeaveBusy = false,
  onExportDebug,
  debugExportBusy = false,
  sectorCode,
  syncPending = false,
  coachPresence = {},
  onCoachSignal,
  commsControl,
  aiPaused = false,
  onAiPausedChange,
  onResetMatchWithSeed,
  forceShowHand = false,
  handStripOnly = false,
  preferLogMode,
}: BridgeTableProps) {
  const layoutTier = useLayoutTier();
  const { orientation } = useLayoutTierState();
  const compactLayout = isCompactLayoutTier(layoutTier);
  const isOnline = mode === 'online';
  const isLocalPassAndPlay =
    mode === 'local' && !!localConfig && isPassAndPlay(localConfig);
  const hasLocalAiOfficers =
    mode === 'local' && !!aiPlayers && aiPlayers.size > 0;
  const isVsAi = hasLocalAiOfficers && !isLocalPassAndPlay;
  const humanId = localConfig?.humanId ?? 'you';
  const humanCaptainId = isVsAi ? humanId : viewerId ?? undefined;
  const humanSeatIds = useMemo(
    () => new Set(localConfig?.humanCaptains.map((human) => human.id) ?? []),
    [localConfig?.humanCaptains]
  );
  const auth = useFirebaseAuth();
  const playerStats = usePlayerStats();
  // usePlayerStats returns a fresh object every render; keep a stable ref so
  // effects can call it without listing the unstable object as a dependency.
  const playerStatsRef = useRef(playerStats);
  playerStatsRef.current = playerStats;
  const reportedLocalMatchRef = useRef<string | null>(null);
  const reportedOnlineMatchRef = useRef<string | null>(null);
  const advisorUsedThisMatchRef = useRef(false);
  /** Bridge console unlocked this match (`GABBAGABBAHEY`). Survives effect refreshes. */
  const devToolsUsedThisMatchRef = useRef(false);
  const devConsoleSessionUnlockedRef = useRef(false);
  const [devConsoleUnlocked, setDevConsoleUnlocked] = useState(false);
  const [devConsoleTeiVoid, setDevConsoleTeiVoid] = useState(false);
  // The viewer has acknowledged that engaging the advisor unrates this sector.
  const advisorConsentRef = useRef(false);
  // Seeded inter-round reshuffle stream so local round 2+ deals are reproducible
  // by the server verification replay (which uses the same seeded stream). Using
  // the engine default (Math.random) here makes the replay diverge with
  // COORDINATE_NOT_IN_HAND. Created once per match, advanced on each END_ROUND.
  const roundReshuffleRef = useRef<(() => number) | null>(null);
  const ensureRoundReshuffle = useCallback(() => {
    if (!roundReshuffleRef.current) {
      roundReshuffleRef.current = createMatchRoundReshuffle(matchSeed ?? 0);
    }
    return roundReshuffleRef.current;
  }, [matchSeed]);

  const [localGame, setLocalGame] = useState<GameState>(
    () => externalGame ?? createDemoGame()
  );
  const roundDealSeedRef = useRef<number | null>(matchSeed ?? null);
  useEffect(() => {
    roundDealSeedRef.current = matchSeed ?? null;
  }, [matchSeed]);
  const [localExportBusy, setLocalExportBusy] = useState(false);
  const [roundImageBusy, setRoundImageBusy] = useState<string | null>(null);
  const systemShareAvailable = canUseSystemShare();
  const actionLogRef = useRef(createActionLog());
  const gameLogRef = useRef(createGameLog());
  const syncedMoveLogCountRef = useRef(0);
  const roundStartedAtRef = useRef(Date.now());
  const roundStartStateRef = useRef<GameState | null>(null);
  const actionLogRoundStartIndexRef = useRef(0);
  const roundOutcomeLoggedRef = useRef<number | null>(null);
  const salamanderLoggedRef = useRef<number | null>(null);
  const longestTrailLoggedRef = useRef<number | null>(null);
  const temporalDebtLoggedRef = useRef<number | null>(null);
  const [gameLogVersion, setGameLogVersion] = useState(0);
  const loggedRoundRef = useRef<number | null>(null);
  const ratingsLoggedRoundRef = useRef<number | null>(null);
  const [advisorReportDialogOpen, setAdvisorReportDialogOpen] = useState(false);
  const [advisorReport, setAdvisorReport] = useState<AdvisorReport | null>(null);
  const [campaignCompleteOpen, setCampaignCompleteOpen] = useState(false);
  const [matchReport, setMatchReport] = useState<
    LocalAiMatchReport | OnlineHumanSelfReport | null
  >(null);
  const [matchReportPending, setMatchReportPending] = useState(false);
  const [matchReportNotice, setMatchReportNotice] = useState<string | null>(null);
  const [campaignPerformance, setCampaignPerformance] =
    useState<AdvisorPerformanceSummary | null>(null);
  const [campaignPointsHistory, setCampaignPointsHistory] = useState<
    CampaignRoundPoints[]
  >([]);
  const [campaignRoundCount, setCampaignRoundCount] = useState(0);
  const campaignAdvisorReviewsRef = useRef<AdvisorMoveReview[]>([]);
  const campaignRoundSnapshotsRef = useRef<
    Array<{
      roundNumber: number;
      roundStartState: GameState;
      entries: AdvisorActionLogEntry[];
    }>
  >([]);
  const lastScoredRoundRef = useRef<number | null>(null);
  const tableContentRef = useRef<HTMLDivElement>(null);
  const bridgeSurfaceRef = useRef<HTMLDivElement>(null);

  const game = isOnline ? (externalGame ?? localGame) : localGame;
  const gameRef = useRef(game);
  gameRef.current = game;

  const [advisorOmegaNet, setAdvisorOmegaNet] = useState<OmegaModelWeights | null>(
    null
  );
  const [advisorConceptNet, setAdvisorConceptNet] =
    useState<AdvisorModelWeights | null>(null);
  const neuralAdvisorOk = neuralAiSupported(game.maxPip ?? 12);
  useEffect(() => {
    let cancelled = false;
    if (!neuralAdvisorOk) {
      setAdvisorOmegaNet(null);
      setAdvisorConceptNet(null);
      return;
    }
    void preloadOmegaWeights(game.objective, { allowZeroFallback: true })
      .then((net) => {
        if (!cancelled) {
          setAdvisorOmegaNet(net);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdvisorOmegaNet(null);
        }
      });
    void preloadAdvisorWeights().then((weights) => {
      if (!cancelled) {
        setAdvisorConceptNet(weights);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game.objective, neuralAdvisorOk]);

  const coachSuggestionOptions = useMemo(() => {
    if (advisorConceptNet) {
      return { advisorWeights: advisorConceptNet };
    }
    return advisorOmegaNet ? { omegaNet: advisorOmegaNet } : undefined;
  }, [advisorConceptNet, advisorOmegaNet]);

  const advisorReportOptions = useMemo(() => {
    if (advisorConceptNet) {
      return { advisorWeights: advisorConceptNet };
    }
    return advisorOmegaNet ? { omegaNet: advisorOmegaNet } : {};
  }, [advisorConceptNet, advisorOmegaNet]);

  useEffect(() => {
    advisorUsedThisMatchRef.current = false;
    devToolsUsedThisMatchRef.current = false;
    devConsoleSessionUnlockedRef.current = false;
    setDevConsoleUnlocked(false);
    setDevConsoleTeiVoid(false);
    if (typeof window !== 'undefined') {
      delete (window as unknown as { localGame?: unknown }).localGame;
    }
    publishAdminToolsLoaded(false);
    advisorConsentRef.current = false;
    setAdvisorConfirmOpen(false);
    reportedLocalMatchRef.current = null;
    reportedOnlineMatchRef.current = null;
    roundReshuffleRef.current = null;
    campaignAdvisorReviewsRef.current = [];
    campaignRoundSnapshotsRef.current = [];
    lastScoredRoundRef.current = null;
    setCampaignPerformance(null);
    setCampaignPointsHistory([]);
    setMatchReport(null);
    setMatchReportPending(false);
    setMatchReportNotice(null);
    setCampaignRoundCount(0);
    setCampaignCompleteOpen(false);
    setHandoffPlayerId(null);
    handoffReadyRef.current = null;
    prevHandoffActiveRef.current = null;
  }, [game.id]);

  useEffect(() => {
    if (!isVsAi || !localConfig || game.phase !== 'complete') {
      if (isLocalPassAndPlay && game.phase === 'complete') {
        setMatchReportNotice(
          'Pass-and-play match complete — local standings only. TEI is not tracked.'
        );
      }
      return;
    }

    if (!isFirebaseConfigured()) {
      setMatchReportNotice(
        'TEI was not saved — Firebase is not configured in this build. Decision quality above is still computed locally.'
      );
      return;
    }

    if (!auth.ready) {
      setMatchReportPending(true);
      return;
    }

    if (!auth.user) {
      const localWon = humanWonLocalMatch(game, localConfig.humanId);
      if (!isNetworkAvailable()) {
        setMatchReportPending(false);
        setMatchReportNotice(
          advisorUsedThisMatchRef.current ||
          devToolsUsedThisMatchRef.current
            ? 'Unrated offline match — Advisor or bridge console was enabled, so TEI was not tracked.'
            : `Offline match complete (${localWon ? 'Victory' : 'Defeat'}). Sign in when online to sync TEI to the leaderboard.`
        );
        return;
      }
      setMatchReportNotice(
        auth.error ??
          'TEI was not saved — sign in to sync your rating to the leaderboard.'
      );
      return;
    }

    if (reportedLocalMatchRef.current === game.id) {
      return;
    }
    reportedLocalMatchRef.current = game.id;
    setMatchReportPending(true);
    setMatchReportNotice(null);

    const matchPerformance = summarizeAdvisorPerformance(
      campaignAdvisorReviewsRef.current
    );

    const advisorUsed = advisorUsedThisMatchRef.current;
    const devToolsUsed = devToolsUsedThisMatchRef.current;

    void reportLocalAiMatch(
      {
        uid: auth.user.uid,
        displayName: localConfig.humanName,
        ...classifyLocalAiMatchOpponent(localConfig.aiCaptains),
        objective: localConfig.objective,
        advisorUsed,
        ...(devToolsUsed ? { devToolsUsed: true } : {}),
        decisionPct: matchPerformance?.scorePct,
        decisionGrade: matchPerformance?.letterGrade,
        seed: matchSeed ?? Date.now(),
        config: localConfig,
        humanActions: extractHumanActions(
          localConfig,
          actionLogRef.current.snapshot()
        ),
      },
      game.id
    )
      .then((result) => {
        setMatchReportPending(false);
        const localWon = humanWonLocalMatch(game, localConfig.humanId);
        if (result.status === 'uploaded') {
          setMatchReport(result.report);
          if (!result.report.rated && !advisorUsed && !devToolsUsed) {
            setMatchReportNotice(
              'Casual match complete — TEI was not updated (sector was unrated).'
            );
          }
          void playerStatsRef.current.refresh();
          return;
        }
        if (result.status === 'queued') {
          setMatchReportNotice(
            advisorUsed || devToolsUsed
              ? 'Unrated offline match saved locally — TEI will not be tracked.'
              : `Match saved offline (${localWon ? 'Victory' : 'Defeat'}). TEI will sync when you're back online.`
          );
          return;
        }
        if (result.status === 'skipped' && result.reason === 'not_replayable') {
          setMatchReportNotice(
            result.notice ??
              'TEI was not saved — this match cannot be verified for rating.'
          );
          return;
        }
        setMatchReportNotice(
          'TEI was not saved — Firebase is not configured in this build.'
        );
      })
      .catch((error) => {
        console.error('[tei] local match report failed', {
          code: (error as { code?: string })?.code,
          message: (error as { message?: string })?.message,
        });
        setMatchReportPending(false);
        // Allow a retry only when auth/config actually changes (deps), not on
        // every render — resetting here previously caused a re-report storm.
        reportedLocalMatchRef.current = null;
        // Casual / unrated sectors still call the practice reporter for localAi
        // counters; a replay miss must not look like a TEI failure.
        if (localConfig && !isRatedLocalGame(localConfig)) {
          setMatchReportNotice(
            advisorUsed || devToolsUsed
              ? 'Unrated match complete — Advisor or bridge console was enabled, so TEI was not tracked.'
              : 'Casual match complete — TEI was not updated (sector was unrated).'
          );
          return;
        }
        const code = (error as { code?: string })?.code;
        const message =
          error instanceof Error
            ? error.message
            : 'network or server error.';
        setMatchReportNotice(
          `TEI was not saved — ${message}${code ? ` (${code})` : ''}`
        );
      });
  }, [
    auth.ready,
    auth.user,
    game,
    isLocalPassAndPlay,
    isVsAi,
    localConfig,
    matchSeed,
  ]);

  // Online human-pool TEI: report the completed sector for server-side rating.
  // The server re-derives standings and re-verifies every seat, so any verified
  // captain reporting once is sufficient and idempotent per game id.
  useEffect(() => {
    if (!isOnline || game.phase !== 'complete') {
      return;
    }
    const objective = ratedObjective(game.objective);
    const captains = onlineCaptains ?? [];
    if (!objective || captains.length === 0) {
      return;
    }

    const eligibility = onlineMatchRatingEligibility(
      captains,
      game.objective,
      sectorRated,
      game.maxPip ?? 12,
      toModuleConfig(game.modules)
    );
    if (!eligibility.rated) {
      setMatchReportNotice(
        onlineRatingWarning(eligibility, captains) ?? 'This sector is unrated.'
      );
      return;
    }

    if (!isFirebaseConfigured() || !auth.ready) {
      return;
    }

    // Only verified captains can earn TEI; guests still see the final standings.
    if (!auth.user || auth.user.isAnonymous) {
      setMatchReportNotice(
        'Rated sector — you are aboard as a guest. Sign in with an account to earn TEI.'
      );
      return;
    }

    if (reportedOnlineMatchRef.current === game.id) {
      return;
    }
    reportedOnlineMatchRef.current = game.id;
    setMatchReportPending(true);
    setMatchReportNotice(null);

    void reportOnlineMatch(game.id, objective)
      .then((report) => {
        setMatchReportPending(false);
        if (!report) {
          setMatchReportNotice(
            'TEI was not saved — Firebase is not configured in this build.'
          );
          return;
        }
        if (!report.rated) {
          setMatchReportNotice(onlineUnratedNotice(report.reason));
          return;
        }
        setMatchReport(report);
        void playerStatsRef.current.refresh();
      })
      .catch((error: unknown) => {
        setMatchReportPending(false);
        // Allow a retry when auth/roster deps change, not on every render.
        reportedOnlineMatchRef.current = null;
        const code = (error as { code?: string })?.code;
        const message =
          error instanceof Error ? error.message : 'network or server error.';
        setMatchReportNotice(
          `TEI was not saved — ${message}${code ? ` (${code})` : ''}`
        );
      });
  }, [isOnline, game, onlineCaptains, sectorRated, auth.ready, auth.user]);

  const [tablePrefs, setTablePrefs] = useState(readTableOptions);
  const { pilotIconSrc, pronounForms, speakAs: profileSpeakAs } =
    useCaptainProfile();
  const {
    layoutStyle,
    tileBg,
    holographicTiles,
    pipPreset,
    teachingMode,
    autoFollowAction,
    autoFollowReturn,
    autoFollowReturnDelayMs,
    followFocusNormX,
    followFocusNormY,
    sectorStatusHud,
    captainTailsHud,
    captainTailsDisplay,
    captainTailsCoordinate,
    captainTailsTrailLength,
    turnBeepsEnabled,
    bridgeSoundsEnabled,
    advisorIncludeAllCaptains,
    recordMatchDebug: recordMatchDebugPref,
    hideHandOnBridge,
    couchMode,
    audibleCommentary,
    commentatorShowElapsed,
    logFontScale,
  } = tablePrefs;

  const [setFocusMode, setSetFocusMode] = useState(false);
  const onCampaignCompleteEgg = useCampaignCompleteSplashEgg();

  useEffect(() => {
    if (!autoFollowAction && setFocusMode) {
      setSetFocusMode(false);
    }
  }, [autoFollowAction, setFocusMode]);

  const showSectorStatusHud = resolveSectorStatusHud(
    tablePrefs,
    compactLayout
  );

  const patchTablePrefs = useCallback(
    (patch: Partial<typeof tablePrefs>) => {
      setTablePrefs((current) => {
        const next = { ...current, ...patch };
        writeTableOptions(patch);
        return next;
      });
    },
    []
  );
  const [actionFocus, setActionFocus] = useState<TableFocusPoint | null>(null);
  const [followReturnCancelSignal, setFollowReturnCancelSignal] = useState(0);
  const bumpFollowReturnCancel = useCallback(() => {
    setFollowReturnCancelSignal((n) => n + 1);
  }, []);
  const prevRoundRef = useRef<RoundState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);
  const [showSpoolPicker, setShowSpoolPicker] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [doubleDownNotice, setDoubleDownNotice] =
    useState<DoubleDownNotice | null>(null);
  const moduleFeedbackProcessedRef = useRef(0);
  const prevActivePlayerRef = useRef<string | null>(null);
  const [coachSuggestion, setCoachSuggestion] = useState<CoachSuggestion | null>(
    null
  );
  const [coachBusy, setCoachBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameLogDialogOpen, setGameLogDialogOpen] = useState(false);
  const [streamSetupOpen, setStreamSetupOpen] = useState(false);
  const [matchDebugRecording, setMatchDebugRecording] =
    useState<MatchDebugRecording>(() =>
      createEmptyMatchDebugRecording(recordMatchDebugPref)
    );
  const matchDebugRecordingRef = useRef(matchDebugRecording);
  matchDebugRecordingRef.current = matchDebugRecording;
  const matchDebugPrevRoundRef = useRef<number | null>(null);
  const [pendingRoundImageShare, setPendingRoundImageShare] =
    useState<PendingRoundImageShare | null>(null);
  const announce = useAnnounce();
  const [logMode, setLogMode] = useState<LogVisibilityMode>(() => {
    if (preferLogMode) {
      return preferLogMode;
    }
    return readLogVisibilityMode(compactLayout);
  });
  const cycleLogMode = useCallback(() => {
    setLogMode((mode) => {
      const next = nextLogVisibilityMode(mode);
      writeLogVisibilityMode(next);
      return next;
    });
  }, []);
  const handleLogControl = useCallback(() => {
    cycleLogMode();
  }, [cycleLogMode]);
  const handleLogScopeChange = useCallback((scope: GameLogScope) => {
    const next = scopeToLogMode(scope);
    writeLogVisibilityMode(next);
    setLogMode(next);
  }, []);
  const dialogLogScope = logModeToScope(logMode);
  const [roundLogDownloadBusy, setRoundLogDownloadBusy] = useState(false);
  const [rematchConfirmOpen, setRematchConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false);
  const [advisorConfirmOpen, setAdvisorConfirmOpen] = useState(false);
  const [localCoachSignals, setLocalCoachSignals] = useState<
    Record<string, CoachPresence>
  >({});
  const [roundEndSummaryOpen, setRoundEndSummaryOpen] = useState(true);
  const roundEndReviewKeyRef = useRef<string | null>(null);
  const [handoffPlayerId, setHandoffPlayerId] = useState<string | null>(null);
  const handoffReadyRef = useRef<string | null>(null);
  const prevHandoffActiveRef = useRef<string | null>(null);

  const round = game.round;
  const maxPip = game.maxPip ?? 12;
  const roundAwaitingScore =
    game.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked);
  /** Last round stays on the table after the sector completes — still reviewable. */
  const canReviewFinalRound =
    game.phase === 'complete' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked);
  const canShowRoundEndSummary =
    (roundAwaitingScore || canReviewFinalRound) && Boolean(round);
  const activePlayerIsAi =
    isVsAi ||
    Boolean(
      isLocalPassAndPlay &&
        round?.activePlayerId &&
        aiPlayers?.has(round.activePlayerId)
    ) ||
    Boolean(
      isOnline &&
        round?.activePlayerId &&
        onlineAiCaptainIds?.has(round.activePlayerId)
    );
  const hub = useMemo(
    () => hubTableGeometry(round?.turnOrder.length ?? 4, layoutStyle),
    [layoutStyle, round?.turnOrder.length]
  );
  const {
    tableWidth: TABLE_WIDTH,
    tableHeight: TABLE_HEIGHT,
    centerX,
    centerY,
    hubRadius,
    hubSlots: HUB_SLOTS,
  } = hub;
  const names = useMemo(() => captainNameMap(game), [game]);
  const ttsNames = useMemo(() => {
    if (isOnline && onlineCaptains?.length) {
      const speakAsById: Record<string, string | null | undefined> = {};
      for (const captain of onlineCaptains) {
        speakAsById[captain.id] = captain.speakAs;
      }
      return resolveTtsNameMap(names, speakAsById, useSpeakAs);
    }
    if (humanCaptainId && profileSpeakAs) {
      return resolveTtsNameMap(
        names,
        { [humanCaptainId]: profileSpeakAs },
        true
      );
    }
    return names;
  }, [
    names,
    isOnline,
    onlineCaptains,
    useSpeakAs,
    humanCaptainId,
    profileSpeakAs,
  ]);
  const gameLogEntries = useMemo(() => {
    void gameLogVersion;
    return gameLogRef.current.snapshot();
  }, [gameLogVersion]);
  const gameLogLines = useMemo(
    () =>
      gameLogEntries
        .map((entry) => {
          // Privacy: pass viewerId and current hand size so we can show drawn tiles only for own actions
          const ownHandSizeAfter = 
            entry.kind === 'SPOOL_WARP_DRIVE' && 
            entry.captainId === humanCaptainId && 
            round?.hands[humanCaptainId]
              ? round.hands[humanCaptainId].length
              : undefined;
          
          return formatGameLogLine(
            entry, 
            names, 
            {
              roundStartedAtMs: roundStartedAtRef.current,
              formatElapsed: formatElapsedLogTime,
              formatAbsolute: formatDisplayTime,
            },
            humanCaptainId,
            ownHandSizeAfter
          );
        })
        .filter((line) => line.length > 0),
    [gameLogEntries, names, humanCaptainId, round]
  );
  const dominoTheme = useMemo(
    () =>
      createWarpDominoTheme({
        holographic: holographicTiles,
        tileBg,
        pipPreset,
      }),
    [holographicTiles, tileBg, pipPreset]
  );
  const tileSurface = WARP_TILE_SURFACE[tileBg];
  const { focus: bridgeFocus, setFocus: setBridgeFocus, toggleFocus } =
    useBridgeFocus();
  const immersiveLayout = bridgeFocus || compactLayout;
  useTableSession();
  useEffect(() => {
    if (compactLayout) {
      setBridgeFocus(true);
    }
  }, [compactLayout, setBridgeFocus]);
  const { registerActions, clearActions } = useBridgeHeaderActionRegistration();
  const { muted: soundsMuted, toggleMuted: toggleSoundsMuted } = useGameAudio();

  const openOptions = useCallback(() => setOptionsOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const trains = useMemo(
    () => (round ? gameStateToTrains(round, HUB_SLOTS) : []),
    [round]
  );

  useEffect(() => {
    if (!round) {
      loggedRoundRef.current = null;
      return;
    }
    if (
      loggedRoundRef.current !== null &&
      loggedRoundRef.current !== round.roundNumber
    ) {
      gameLogRef.current.clear();
      roundOutcomeLoggedRef.current = null;
      salamanderLoggedRef.current = null;
      longestTrailLoggedRef.current = null;
      temporalDebtLoggedRef.current = null;
      setGameLogVersion((version) => version + 1);
    }
    if (loggedRoundRef.current !== round.roundNumber) {
      const startedAt = new Date().toISOString();
      roundStartedAtRef.current = Date.now();
      roundStartStateRef.current = structuredClone(gameRef.current);
      actionLogRoundStartIndexRef.current =
        actionLogRef.current.snapshot().length;

      const prevRound = matchDebugPrevRoundRef.current;
      matchDebugPrevRoundRef.current = round.roundNumber;
      if (matchDebugRecordingRef.current.enabled) {
        const snapshot = {
          roundNumber: round.roundNumber,
          at: startedAt,
          kind: 'round-start' as const,
          gameState: structuredClone(gameRef.current),
        };
        setMatchDebugRecording((current) => {
          const base =
            shouldResetMatchDebugOnRound(prevRound, round.roundNumber) &&
            current.enabled
              ? enableMatchDebugRecording(current)
              : current;
          return appendMatchDebugRoundSnapshot(base, snapshot);
        });
      }

      gameLogRef.current.append(buildRoundStartedEntry(round, startedAt));
      gameLogRef.current.append(
        buildModuleLoadoutEntry(
          gameRef.current.modules,
          round.roundNumber,
          startedAt,
          gameRef.current.objective
        )
      );
      setGameLogVersion((version) => version + 1);
    }
    loggedRoundRef.current = round.roundNumber;
  }, [round?.roundNumber, round]);

  // Ratings line (captain classes / TEI). Kept separate from the round-start
  // entry so it can retry once the roster data is available — online captains
  // and the local player's TEI can both arrive a tick after the round starts.
  useEffect(() => {
    if (!round) {
      ratingsLoggedRoundRef.current = null;
      return;
    }
    // Wait until the round-start line for this round has been logged.
    if (loggedRoundRef.current !== round.roundNumber) {
      return;
    }
    if (ratingsLoggedRoundRef.current === round.roundNumber) {
      return;
    }

    let roster: readonly GameLogRosterEntry[] | null = null;
    if (isVsAi && localConfig) {
      const rated = ratedObjective(localConfig.objective);
      if (rated && playerStats.ready) {
        const matchSkill = classifyLocalAiMatchSkill(localConfig.aiCaptains);
        const humanTeiDisplay = playerStats.getTeiDisplay(matchSkill, rated);
        const humanTei = humanTeiDisplay?.formatted ?? null;
        roster = buildLocalRosterTei(localConfig, humanTei, rated);
      }
    } else if (isOnline && onlineCaptains?.length) {
      const rated = ratedObjective(game.objective) ?? 'points';
      const online = buildOnlineRosterClasses(
        round.turnOrder,
        onlineCaptains,
        rated
      );
      if (rosterHasTacticalClasses(online)) {
        roster = online;
      }
    }

    if (roster && roster.length > 0) {
      gameLogRef.current.append(
        buildRoundRatingsEntry(roster, round.roundNumber, new Date().toISOString())
      );
      setGameLogVersion((version) => version + 1);
      ratingsLoggedRoundRef.current = round.roundNumber;
    }
  }, [
    isVsAi,
    isOnline,
    localConfig,
    onlineCaptains,
    playerStats.ready,
    gameLogVersion,
    round,
  ]);

  // Online: append newly-synced entries from the shared per-round move log so
  // every client shows ALL captains' moves (not just the local player's). The
  // server resets the log each round; when it shrinks we re-sync from zero
  // (the round-start effect above has already cleared + re-seeded the ticker).
  useEffect(() => {
    if (!isOnline || !onlineMoveLog) {
      return;
    }
    if (onlineMoveLog.length < syncedMoveLogCountRef.current) {
      syncedMoveLogCountRef.current = 0;
    }
    if (onlineMoveLog.length === syncedMoveLogCountRef.current) {
      return;
    }
    for (
      let i = syncedMoveLogCountRef.current;
      i < onlineMoveLog.length;
      i += 1
    ) {
      const move = onlineMoveLog[i];
      if (move.entry) {
        gameLogRef.current.append(move.entry);
      }
      if (move.autoAllStop) {
        gameLogRef.current.append(move.autoAllStop);
      }
    }
    syncedMoveLogCountRef.current = onlineMoveLog.length;
    setGameLogVersion((version) => version + 1);
  }, [isOnline, onlineMoveLog]);

  useEffect(() => {
    prevRoundRef.current = null;
    syncedMoveLogCountRef.current = 0;
    moduleFeedbackProcessedRef.current = 0;
    setActionFocus(null);
    setSelectedTile(null);
    setDoubleDownNotice(null);
  }, [round?.roundNumber]);

  useEffect(() => {
    if (!round || !autoFollowAction || round.phase !== 'playing') {
      prevRoundRef.current = round ?? null;
      return;
    }

    const site = detectNewChart(prevRoundRef.current, round);
    prevRoundRef.current = round;

    if (!site) {
      return;
    }

    const point = computeTableFocusPoint({
      round,
      site,
      layoutStyle,
      centerX,
      centerY,
      hubRadius,
      hubSlots: HUB_SLOTS,
    });
    if (point) {
      setActionFocus(point);
    }
  }, [autoFollowAction, centerX, centerY, hubRadius, HUB_SLOTS, layoutStyle, round]);

  const activePlayerId = round?.activePlayerId ?? '';
  const activeIsHumanSeat = humanSeatIds.has(activePlayerId);
  const handoffPending =
    isLocalPassAndPlay &&
    isCompanionHandoffEnabled(couchMode) &&
    !!round &&
    game.phase === 'active' &&
    !roundAwaitingScore &&
    activeIsHumanSeat &&
    handoffPlayerId === activePlayerId;
  const handOwnerId = isVsAi
    ? humanId
    : isOnline
      ? (viewerId ?? '')
      : activePlayerId;
  const isMyTurn =
    !sectorPaused &&
    (isVsAi
      ? activePlayerId === humanId
      : isOnline
        ? viewerId === activePlayerId
        : isLocalPassAndPlay
          ? activeIsHumanSeat && !handoffPending
          : true);

  // Online: toast/banner when Double Down or spool entries sync from move log.
  useEffect(() => {
    if (!isOnline) {
      return;
    }
    if (gameLogEntries.length < moduleFeedbackProcessedRef.current) {
      moduleFeedbackProcessedRef.current = 0;
    }
    if (gameLogEntries.length <= moduleFeedbackProcessedRef.current) {
      return;
    }
    for (
      let i = moduleFeedbackProcessedRef.current;
      i < gameLogEntries.length;
      i += 1
    ) {
      const entry = gameLogEntries[i];
      if (entry.doubleDown) {
        const notice = doubleDownNoticeFromEntry(entry);
        if (notice) {
          setDoubleDownNotice(notice);
        }
        setLastMessage(
          formatDoubleDownFeedback(entry, names, handOwnerId) ?? null
        );
      } else if (entry.kind === 'SPOOL_WARP_DRIVE') {
        const feedback = formatModuleFeedbackFromLogEntry(
          entry,
          names,
          handOwnerId
        );
        if (feedback) {
          setLastMessage(feedback);
        }
      }
    }
    moduleFeedbackProcessedRef.current = gameLogEntries.length;
  }, [gameLogEntries, handOwnerId, isOnline, names]);

  // Clear Double Down HUD once the affected captain's turn ends.
  useEffect(() => {
    const nextActivePlayerId = round?.activePlayerId ?? null;
    if (
      doubleDownNotice &&
      prevActivePlayerRef.current === doubleDownNotice.targetCaptainId &&
      nextActivePlayerId !== doubleDownNotice.targetCaptainId
    ) {
      setDoubleDownNotice(null);
    }
    prevActivePlayerRef.current = nextActivePlayerId;
  }, [doubleDownNotice, round?.activePlayerId]);

  useEffect(() => {
    if (!isLocalPassAndPlay) {
      return;
    }
    prevHandoffActiveRef.current = null;
    handoffReadyRef.current = null;
    setHandoffPlayerId(null);
  }, [game.id, isLocalPassAndPlay, round?.roundNumber]);

  useEffect(() => {
    if (!isLocalPassAndPlay || !round || game.phase !== 'active' || roundAwaitingScore) {
      return;
    }
    if (!activeIsHumanSeat) {
      setHandoffPlayerId(null);
      return;
    }
    if (prevHandoffActiveRef.current === null) {
      prevHandoffActiveRef.current = activePlayerId;
      handoffReadyRef.current = activePlayerId;
      setHandoffPlayerId(null);
      return;
    }
    if (prevHandoffActiveRef.current === activePlayerId) {
      return;
    }
    prevHandoffActiveRef.current = activePlayerId;
    if (handoffReadyRef.current === activePlayerId) {
      setHandoffPlayerId(null);
      return;
    }
    setHandoffPlayerId(activePlayerId);
  }, [
    activeIsHumanSeat,
    activePlayerId,
    game.phase,
    isLocalPassAndPlay,
    round,
    roundAwaitingScore,
  ]);

  const confirmHandoff = useCallback(() => {
    handoffReadyRef.current = activePlayerId;
    setHandoffPlayerId(null);
  }, [activePlayerId]);
  const dropToImpulsePending =
    !!round &&
    round.phase === 'playing' &&
    game.phase === 'active' &&
    game.houseRules.dropToImpulseCall &&
    round.dropToImpulseCallPending === handOwnerId &&
    (round.hands[handOwnerId]?.length ?? 0) === 1;
  const dropToImpulseCatchTarget = round?.dropToImpulseCatchable ?? null;
  const canCatchDropToImpulse =
    !!round &&
    round.phase === 'playing' &&
    game.phase === 'active' &&
    game.houseRules.dropToImpulseCall &&
    dropToImpulseCatchTarget != null &&
    dropToImpulseCatchTarget !== handOwnerId &&
    (round.hands[dropToImpulseCatchTarget]?.length ?? 0) === 1;

  useBridgeAmbience({
    active: game.phase === 'active' && !!round,
    bridgeSoundsEnabled,
    soundsMuted,
  });

  useGameSoundEffects({
    enabled: game.phase === 'active' && !!round,
    gamePhase: game.phase,
    roundPhase: round?.phase,
    roundNumber: round?.roundNumber,
    isMyTurn,
    activePlayerId: round?.activePlayerId ?? null,
    doublesOnTable: round != null ? countDoublesOnTable(round.table) : 0,
    chartedTileCount: round != null ? countChartedTilesOnTable(round) : 0,
    illuminatedRedAlert:
      round != null && shouldIlluminateBridgeRedAlert(round),
    redAlertResponsibleId: round?.table.redAlert?.responsiblePlayerId ?? null,
    activeBeaconCount:
      round != null ? countActiveDistressBeacons(round.table) : 0,
    flashActive: game.modules.continuum.activeFlash != null,
    allStopDeclared: round?.allStopDeclared === true,
    allStopRequired: round?.allStopRequired === true,
    dropToImpulseCallPending: round?.dropToImpulseCallPending ?? null,
    dropToImpulseCatchable: round?.dropToImpulseCatchable ?? null,
    returnedToWarp: round?.returnedToWarp === true,
    wormholeOpened: round?.wormholeOpened === true,
    unchartedSectorCount: round?.unchartedSectors.length ?? 0,
    turnBeepsEnabled,
  });

  const visibleHand = round?.hands[handOwnerId] ?? [];
  const showOwnHand =
    forceShowHand ||
    handStripOnly ||
    (!hideHandOnBridge &&
      !!round &&
      game.phase === 'active' &&
      (isOnline || isVsAi
        ? visibleHand.length > 0 || isMyTurn
        : isMyTurn));
  const {
    orderedHand,
    applySort,
    toggleFlip,
    isFlipped,
    onHandTilePointerDown,
    onHandTilePointerMove,
    onHandTilePointerUp,
    onHandTilePointerCancel,
    pointerDraggingKey,
    pointerDropTargetKey,
    shouldIgnoreClick,
  } = useHandLayout(game.id, handOwnerId, visibleHand, {
    horizontalScroll: compactLayout && orientation === 'portrait',
  });
  const activeDraggingKey = pointerDraggingKey;
  const activeDropTargetKey = pointerDropTargetKey;
  const legalMoves =
    round && isMyTurn ? getLegalMoves(round, handOwnerId, game.houseRules) : [];

  const mergedCoachPresence = isOnline ? coachPresence : localCoachSignals;
  const coachByCaptain = useMemo(() => {
    if (!round) {
      return {} as Record<string, CoachIndicator>;
    }
    const indicators: Record<string, CoachIndicator> = {};
    for (const [captainId, presence] of Object.entries(mergedCoachPresence)) {
      const indicator = resolveCoachIndicator(presence, round.roundNumber);
      if (indicator) {
        indicators[captainId] = indicator;
      }
    }
    return indicators;
  }, [mergedCoachPresence, round]);

  // Sector-wide advisor void: once any captain consults the advisor, an
  // otherwise-rated online sector becomes unrated for everyone. Coach presence
  // is broadcast to all clients, so every captain sees this the moment it happens.
  const sectorAdvisorVoided = useMemo(() => {
    if (!isOnline) {
      return false;
    }
    if (
      !onlineMatchRatingEligibility(
        onlineCaptains ?? [],
        game.objective,
        sectorRated,
        game.maxPip ?? 12,
        toModuleConfig(game.modules)
      ).rated
    ) {
      return false;
    }
    return Object.values(mergedCoachPresence).some(
      (presence) => presence.coachUsedThisRound === true
    );
  }, [isOnline, mergedCoachPresence, onlineCaptains, game.objective, sectorRated, game.maxPip]);

  const coachChart = coachSuggestion
    ? coachChartMove(coachSuggestion.action)
    : null;
  const coachKind = coachSuggestion
    ? coachActionKind(coachSuggestion.action)
    : null;
  const coachAvailable =
    !!round &&
    isMyTurn &&
    game.phase === 'active' &&
    round.phase === 'playing' &&
    round.continuumPendingInvoker !== handOwnerId &&
    round.continuumWagerPending?.playerId !== handOwnerId;

  /**
   * Rated sectors hide the advisor entirely (button + teaching mode) so it
   * cannot eat HUD space or be clicked by accident. Online: host Rated flag.
   * Local: lobby Rated / TEI-eligible config.
   */
  const advisorSuppressedForRated = useMemo(() => {
    if (isOnline) {
      return sectorRated === true && (game.maxPip ?? 12) === 12;
    }
    return !!localConfig && isRatedLocalGame(localConfig);
  }, [isOnline, sectorRated, game.maxPip, localConfig]);

  const headerRating = useMemo((): {
    ratingLabel: string;
    ratingState: BridgeRatingState;
  } => {
    const maxPip = game.maxPip ?? localConfig?.maxPip ?? 12;
    if (maxPip !== 12) {
      return { ratingLabel: 'Exhibition', ratingState: 'exhibition' };
    }
    if (isOnline) {
      return sectorRated
        ? { ratingLabel: 'Rated', ratingState: 'rated' }
        : { ratingLabel: 'Unrated', ratingState: 'unrated' };
    }
    if (localConfig && isRatedLocalGame(localConfig)) {
      return { ratingLabel: 'Rated', ratingState: 'rated' };
    }
    return { ratingLabel: 'Unrated', ratingState: 'unrated' };
  }, [game.maxPip, isOnline, localConfig, sectorRated]);

  const { setHeaderStatus } = useBridgeHeaderStatusRegistration();
  useEffect(() => {
    setHeaderStatus(headerRating);
  }, [headerRating, setHeaderStatus]);
  useEffect(() => {
    return () => setHeaderStatus(null);
  }, [setHeaderStatus]);

  const prevSectorPausedRef = useRef(sectorPaused);
  useEffect(() => {
    if (!isOnline) {
      prevSectorPausedRef.current = sectorPaused;
      return;
    }
    if (prevSectorPausedRef.current === sectorPaused) {
      return;
    }
    prevSectorPausedRef.current = sectorPaused;
    gameLogRef.current.append({
      kind: sectorPaused ? 'SECTOR_PAUSED' : 'SECTOR_RESUMED',
      captainId: viewerId ?? 'host',
      effects: [],
      ...(sectorPaused && pauseReason ? { pauseReason } : {}),
    });
    setGameLogVersion((version) => version + 1);
  }, [isOnline, pauseReason, sectorPaused, viewerId]);

  const showAdvisorControls = coachAvailable && !advisorSuppressedForRated;

  useEffect(() => {
    if (!advisorSuppressedForRated) {
      return;
    }
    setCoachSuggestion(null);
    setAdvisorConfirmOpen(false);
    if (teachingMode) {
      patchTablePrefs({ teachingMode: false });
    }
  }, [advisorSuppressedForRated, patchTablePrefs, teachingMode]);

  useEffect(() => {
    if (!coachAvailable || advisorSuppressedForRated) {
      setCoachSuggestion(null);
      return;
    }
    if (!teachingMode) {
      setCoachSuggestion(null);
    }
  }, [activePlayerId, round?.roundNumber, coachAvailable, teachingMode, advisorSuppressedForRated]);

  const coachAnnouncedKeyRef = useRef<string | null>(null);

  const announceCoachUse = useCallback(async () => {
    if (!round) {
      return;
    }
    const key = `${round.roundNumber}:${handOwnerId}:${activePlayerId}`;
    if (coachAnnouncedKeyRef.current === key) {
      return;
    }
    coachAnnouncedKeyRef.current = key;
    advisorUsedThisMatchRef.current = true;

    const signal: CoachPresence = {
      coachRequestedAt: new Date().toISOString(),
      coachRoundNumber: round.roundNumber,
      coachUsedThisRound: true,
    };

    if (isOnline && onCoachSignal) {
      await onCoachSignal();
    } else {
      setLocalCoachSignals((current) => ({
        ...current,
        [handOwnerId]: signal,
      }));
    }
  }, [
    activePlayerId,
    handOwnerId,
    isOnline,
    onCoachSignal,
    round,
  ]);

  // True when engaging the advisor would flip an otherwise-rated online sector
  // to unrated — the acting captain is asked to confirm first (once per match).
  const advisorEngageNeedsConfirm = useCallback(() => {
    return (
      isOnline &&
      !advisorConsentRef.current &&
      !advisorUsedThisMatchRef.current &&
      onlineMatchRatingEligibility(
        onlineCaptains ?? [],
        game.objective,
        sectorRated,
        game.maxPip ?? 12,
        toModuleConfig(game.modules)
      ).rated
    );
  }, [isOnline, onlineCaptains, game.objective, sectorRated, game.maxPip]);

  const applyCoachSuggestion = useCallback(
    (suggestion: CoachSuggestion, options?: { announce?: boolean }) => {
      setCoachSuggestion(suggestion);
      setLastMessage(null);

      const chart = coachChartMove(suggestion.action);
      if (chart) {
        setSelectedTile(chart.coordinate);
      }

      if (options?.announce) {
        void announceCoachUse();
      }
    },
    [announceCoachUse]
  );

  const prevActivePlayerIdRef = useRef(activePlayerId);

  /** Clear stale hand selection when the active seat changes; advisor re-applies below. */
  useEffect(() => {
    if (prevActivePlayerIdRef.current === activePlayerId) {
      return;
    }
    prevActivePlayerIdRef.current = activePlayerId;
    setSelectedTile(null);
  }, [activePlayerId]);

  useEffect(() => {
    if (!teachingMode || !coachAvailable || advisorSuppressedForRated) {
      return;
    }

    // Teaching mode auto-consults every turn; in a rated online sector, ask for
    // consent before the first auto-engagement rather than silently unrating.
    // (Rated sectors normally suppress the advisor entirely — this is a backstop.)
    if (advisorEngageNeedsConfirm()) {
      setAdvisorConfirmOpen(true);
      return;
    }

    const suggestion = getCoachSuggestion(
      game,
      handOwnerId,
      names,
      coachSuggestionOptions
    );
    if (!suggestion) {
      setCoachSuggestion(null);
      setLastMessage('Advisor unavailable this turn');
      return;
    }

    applyCoachSuggestion(suggestion, { announce: true });
  }, [
    advisorEngageNeedsConfirm,
    advisorSuppressedForRated,
    applyCoachSuggestion,
    coachAvailable,
    coachSuggestionOptions,
    game,
    handOwnerId,
    teachingMode,
  ]);

  const trainConnectValue = useMemo(() => {
    if (!round) {
      return undefined;
    }
    // Module Zeta: read the shared squad trail via trailKeyFor — a
    // squadmate who isn't the trail's canonical owner has no entry keyed by
    // their own id, which would otherwise silently fall back to the
    // spacedock value instead of the real (shared) trail's open end.
    const trail = round.table.warpTrails[trailKeyFor(round, handOwnerId)];
    if (!trail) {
      return round.spacedockValue;
    }
    return trailOpenValue(trail, round.spacedockValue);
  }, [handOwnerId, round]);

  const trailSpokes = useMemo(
    () => (round ? buildTrailSpokeStatuses(round, names, HUB_SLOTS) : []),
    [names, round]
  );

  // Log ticker lines filtered by the Comms Log toggle. Commentator digests to
  // ringside highlights; Yourself keeps structural + own moves. Full log stays
  // in the sector dialog (with matching scope tabs).
  const logFormatOptions = useMemo(
    () => ({
      roundStartedAtMs: roundStartedAtRef.current,
      formatElapsed: formatElapsedLogTime,
      formatAbsolute: formatDisplayTime,
      includeElapsedPrefix: commentatorShowElapsed,
      pronouns: humanCaptainId
        ? { [humanCaptainId]: pronounForms }
        : undefined,
    }),
    // Recompute when round clock resets (version bumps with entries).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: track round start via entries/version
    [
      gameLogVersion,
      round?.roundNumber,
      humanCaptainId,
      pronounForms,
      commentatorShowElapsed,
    ]
  );

  const commentatorLines = useMemo(
    () =>
      filterGameLogLines({
        mode: 'commentator',
        entries: gameLogEntries,
        names,
        formatOptions: logFormatOptions,
      }),
    [gameLogEntries, names, logFormatOptions]
  );

  const tickerLogLines = useMemo(() => {
    const filtered = filterGameLogLines({
      mode: logMode,
      entries: gameLogEntries,
      allLines: gameLogLines,
      names,
      formatOptions: logFormatOptions,
      humanCaptainId,
      ownHandSizeForEntry: (entry) =>
        entry.kind === 'SPOOL_WARP_DRIVE' &&
        entry.captainId === humanCaptainId &&
        round?.hands[humanCaptainId]
          ? round.hands[humanCaptainId].length
          : undefined,
    });
    if (logMode === 'commentator') {
      return takeRecentLogLines(filtered, COMMENTATOR_TICKER_MAX_LINES);
    }
    return filtered;
  }, [
    logMode,
    gameLogLines,
    gameLogEntries,
    humanCaptainId,
    names,
    round,
    logFormatOptions,
  ]);

  const dialogLogLines = useMemo(() => {
    return filterGameLogLines({
      mode: dialogLogScope,
      entries: gameLogEntries,
      allLines: gameLogLines,
      names,
      formatOptions: logFormatOptions,
      humanCaptainId,
      ownHandSizeForEntry: (entry) =>
        entry.kind === 'SPOOL_WARP_DRIVE' &&
        entry.captainId === humanCaptainId &&
        round?.hands[humanCaptainId]
          ? round.hands[humanCaptainId].length
          : undefined,
    });
  }, [
    dialogLogScope,
    gameLogEntries,
    gameLogLines,
    humanCaptainId,
    names,
    round,
    logFormatOptions,
  ]);

  const commentatorAnnounceRef = useRef(0);
  const commentatorSpeechRef = useRef(0);
  const commentatorAudioRef = useRef(createCommentatorAudioPlayer());
  const commentatorTtsQueueRef = useRef(
    createCommentatorTtsQueue({
      synthesize: (input) =>
        synthesizeCommentatorSpeech(
          input as unknown as SynthesizeCommentatorSpeechInput
        ),
      play: async (result) => {
        await commentatorAudioRef.current.playBase64Mp3(result.audioBase64);
      },
      onError: (err) => {
        console.warn(
          '[tts] synthesizeCommentatorSpeech failed',
          err instanceof Error ? err.message : err
        );
      },
    })
  );
  useEffect(() => {
    if (commentatorLines.length <= commentatorAnnounceRef.current) {
      if (commentatorLines.length < commentatorAnnounceRef.current) {
        commentatorAnnounceRef.current = commentatorLines.length;
      }
      return;
    }
    const newest = commentatorLines[commentatorLines.length - 1];
    commentatorAnnounceRef.current = commentatorLines.length;
    if (newest && (logMode === 'commentator' || logMode === 'all')) {
      // Strip timestamp prefix for cleaner screen-reader callouts.
      const body = newest.includes(' - ')
        ? newest.slice(newest.indexOf(' - ') + 3)
        : newest;
      announce(body, 'polite');
    }
  }, [announce, commentatorLines, logMode]);

  useEffect(() => {
    const queue = commentatorTtsQueueRef.current;
    if (!audibleCommentary) {
      queue.clear();
      commentatorSpeechRef.current = commentatorLines.length;
      return;
    }
    if (commentatorLines.length <= commentatorSpeechRef.current) {
      if (commentatorLines.length < commentatorSpeechRef.current) {
        commentatorSpeechRef.current = commentatorLines.length;
      }
      return;
    }
    commentatorSpeechRef.current = commentatorLines.length;

    let entryForSpeech = null as (typeof gameLogEntries)[number] | null;
    for (let i = gameLogEntries.length - 1; i >= 0; i--) {
      const entry = gameLogEntries[i];
      if (!entry) {
        continue;
      }
      const line = formatCommentatorLine(entry, names, logFormatOptions);
      if (line) {
        entryForSpeech = entry;
        break;
      }
    }
    if (!entryForSpeech) {
      return;
    }

    queue.offer({
      entry: entryForSpeech,
      names: ttsNames,
      pronouns: logFormatOptions.pronouns,
      roundStartedAtMs: logFormatOptions.roundStartedAtMs,
      matchId: isOnline && sectorCode
        ? `online-${sectorCode}`
        : `local-${game.id}`,
      sectorCode: sectorCode ?? (isOnline ? undefined : 'local'),
    });
  }, [
    audibleCommentary,
    commentatorLines,
    gameLogEntries,
    ttsNames,
    logFormatOptions,
    isOnline,
    sectorCode,
    game.id,
    names,
  ]);

  useEffect(() => {
    return () => {
      commentatorTtsQueueRef.current.clear();
    };
  }, []);

  const humanCaptainTei = useMemo(() => {
    if (!humanCaptainId || !playerStats.ready) {
      return null;
    }
    const rated = ratedObjective(
      isVsAi && localConfig ? localConfig.objective : game.objective
    );
    if (!rated) {
      return null;
    }
    if (isVsAi && localConfig) {
      return (
        playerStats.getTeiDisplay(
          classifyLocalAiMatchSkill(localConfig.aiCaptains),
          rated
        )?.formatted ?? null
      );
    }
    return (
      playerStats.getTeiDisplay('commander', rated)?.formatted ?? null
    );
  }, [
    game.objective,
    humanCaptainId,
    isLocalPassAndPlay,
    isVsAi,
    localConfig,
    playerStats,
  ]);

  const captainTacticalClassAbbrevById = useMemo(
    () =>
      buildCaptainTacticalClassAbbrevById({
        localConfig,
        onlineCaptains,
        humanId: humanCaptainId,
        humanTei: humanCaptainTei,
      }),
    [humanCaptainId, humanCaptainTei, localConfig, onlineCaptains]
  );

  const captainTacticalClassLabelById = useMemo(
    () =>
      buildCaptainTacticalClassLabelById({
        localConfig,
        onlineCaptains,
        humanId: humanCaptainId,
        humanTei: humanCaptainTei,
      }),
    [humanCaptainId, humanCaptainTei, localConfig, onlineCaptains]
  );

  const teiGradeByCaptain = useMemo(() => {
    const grades: Record<string, import('warp12-engine').TeiGrade> = {};
    const rated = ratedObjective(
      isVsAi && localConfig ? localConfig.objective : game.objective
    );
    if (!rated || !playerStats.ready) {
      return grades;
    }

    // Add human captain's TEI grade
    if (humanCaptainId) {
      const skill = isVsAi && localConfig 
        ? classifyLocalAiMatchSkill(localConfig.aiCaptains)
        : 'commander';
      const display = playerStats.getTeiDisplay(skill, rated);
      if (display) {
        grades[humanCaptainId] = display.grade;
      }
    }

    // Add online captains' TEI grades (if available in onlineCaptains data)
    // Note: onlineCaptains currently doesn't include TEI data, but structure
    // is here for when that's added to the Firestore captain documents
    
    return grades;
  }, [
    humanCaptainId,
    isVsAi,
    localConfig,
    game.objective,
    playerStats,
    onlineCaptains,
  ]);

  const openBeacons = useMemo(
    () => openTrailCaptains(trailSpokes),
    [trailSpokes]
  );

  // Module Zeta: own trail is the shared squad trail — read via trailKeyFor
  // so a non-owner squadmate sees their squad's real beacon state, not an
  // always-false fallback from an empty lookup.
  const ownTrail = round
    ? round.table.warpTrails[trailKeyFor(round, handOwnerId)]
    : undefined;
  const shieldsDown = ownTrail?.distressBeacon.active === true;
  const helmControls = resolveHelmControls({
    round,
    handOwnerId,
    isMyTurn,
    houseRules: game.houseRules,
    dropToImpulsePending,
    legalMovesCount: legalMoves.length,
    gameState: game,
  });
  const canDeployBeacon = helmControls.showShieldsDown;
  const canPassAlert = helmControls.showPassRedAlert;
  const canPass = helmControls.showPass;
  const canRaiseShieldsExplicitly = helmControls.showShieldsUp;
  const spoolOptions = helmControls.spoolOptions;
  const canRaiseShields =
    !!round &&
    isMyTurn &&
    (canRaiseShieldsManually(round, handOwnerId, game.houseRules) ||
      canRaiseShieldsByCharting(round, handOwnerId, game.houseRules));

  const spokeByCaptain = useMemo(
    () =>
      new Map(
        trailSpokes
          .filter((spoke) => spoke.captainId)
          .map((spoke) => [spoke.captainId!, spoke.state])
      ),
    [trailSpokes]
  );

  const movesForSelected = useMemo(() => {
    if (!selectedTile) {
      return legalMoves;
    }
    return legalMoves.filter((move) =>
      coordinatesEqual(move.coordinate, selectedTile)
    );
  }, [legalMoves, selectedTile]);

  const handleRematch = useCallback(() => {
    if (mode !== 'local') {
      return;
    }
    if (onRematch) {
      setRematchConfirmOpen(true);
      return;
    }
    setLocalGame(createDemoGame());
    setSelectedTile(null);
    setLastMessage(null);
  }, [mode, onRematch]);

  const confirmRematch = useCallback(() => {
    setRematchConfirmOpen(false);
    onRematch?.();
    setSelectedTile(null);
    setLastMessage(null);
  }, [onRematch]);

  const recordGameLog = useCallback(
    (before: GameState, after: GameState, action: GameAction) => {
      if (action.type === 'END_ROUND') {
        return;
      }
      const entry = buildGameLogEntry(before, after, action);
      if (entry) {
        gameLogRef.current.append(entry);
      }
      const autoAllStop = buildAutoAllStopLogEntry(before, after, action);
      if (autoAllStop) {
        gameLogRef.current.append(autoAllStop);
      }
      if (entry || autoAllStop) {
        setGameLogVersion((version) => version + 1);
      }
    },
    []
  );

  const dispatch = useCallback(
    async (
      action: GameAction,
      meta?: { source?: ActionLogSource }
    ) => {
      const source = meta?.source ?? 'human';

      if (onAction) {
        const before = game;
        const result = await onAction(action);
        if (!result.ok) {
          setLastMessage(formatViolation(result.violation));
        } else {
          setLastMessage(null);
          setSelectedTile(null);
          setCoachSuggestion(null);
          // Online: the move log comes from the shared per-round history on the
          // game doc (see the onlineMoveLog effect), so every client shows all
          // captains' moves. Do NOT record locally here or the local player's
          // own actions would be double-logged.
          void before;
          const logEntry = {
            playerId: playerIdForAction(action),
            action,
            ok: true as const,
            source,
          };
          actionLogRef.current.append(logEntry);
          setMatchDebugRecording((current) =>
            appendMatchDebugAction(current, {
              ...logEntry,
              at: new Date().toISOString(),
            })
          );
        }
        return;
      }

      const before = gameRef.current;
      // Route through applyMatchAction so END_ROUND reshuffles the next deal with
      // the seeded stream (reproducible by the verification replay); all other
      // actions behave exactly like applyAction.
      const result = applyMatchAction(before, action, ensureRoundReshuffle());
      const localLogEntry = {
        playerId: playerIdForAction(action),
        action,
        ok: result.ok,
        violation: result.ok ? undefined : result.violation,
        source,
      };
      actionLogRef.current.append(localLogEntry);
      setMatchDebugRecording((current) =>
        appendMatchDebugAction(current, {
          ...localLogEntry,
          at: new Date().toISOString(),
        })
      );
      if (!result.ok) {
        setLastMessage(formatViolation(result.violation));
        return;
      }
      // Round-end must clone `before`: applyMatchAction/scoreRound already
      // redeals the next hand into `result.state`, which made prior exports look
      // like post-shuffle "end" snapshots (full hands, cleared winner).
      if (
        action.type === 'END_ROUND' &&
        matchDebugRecordingRef.current.enabled
      ) {
        const endedRound = before.round?.roundNumber;
        if (typeof endedRound === 'number') {
          const endedAt = new Date().toISOString();
          setMatchDebugRecording((current) =>
            appendMatchDebugRoundSnapshot(current, {
              roundNumber: endedRound,
              at: endedAt,
              kind: 'round-end',
              gameState: structuredClone(before),
            })
          );
        }
      }
      setLastMessage(null);
      setSelectedTile(null);
      setCoachSuggestion(null);
      recordGameLog(before, result.state, action);
      const logEntry = buildGameLogEntry(before, result.state, action);
      if (logEntry?.doubleDown) {
        const notice = doubleDownNoticeFromEntry(logEntry);
        if (notice) {
          setDoubleDownNotice(notice);
        }
        setLastMessage(
          formatDoubleDownFeedback(logEntry, names, handOwnerId) ?? null
        );
      } else if (action.type === 'SPOOL_WARP_DRIVE') {
        setLastMessage(
          formatSpoolFeedback({
            before,
            after: result.state,
            action,
            entry: logEntry,
            names,
            viewerId: handOwnerId,
          }) ?? null
        );
      }
      gameRef.current = result.state;
      setLocalGame(result.state);
    },
    [game, handOwnerId, names, onAction, recordGameLog, ensureRoundReshuffle]
  );

  // Dev console: gated by GABBAGABBAHEY + Firebase admin claim (local DEV only).
  // Effect deps refresh after every dispatch; never strip mid-session or autoplay
  // loses window.localGame. Tear-down uses a generation counter + microtask so
  // React Strict Mode remounts / dep refreshes keep tools until a true leave.
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return;
    }

    interface LocalGameDevTools {
      getMatchSeed: () => number | null;
      resetMatchWithSeed: (seed: number) => void;
      getRoundSeed: () => number | null;
      resetRoundWithSeed: (seed: number) => void;
      /**
       * Redeal the current round in memory for `seed` without mutating React
       * state — for fast console seed searches (Salamander / Continuum).
       */
      previewRoundSeed: (seed: number) => {
        seed: number;
        hand: ReadonlyArray<{ low: number; high: number }>;
        roundNumber: number | null;
      } | null;
      /** Force Continuum Salamander swap for the current round (scoring test). */
      forceSalamanderSwap: () => void;
      getHand: () => ReadonlyArray<{ low: number; high: number }> | null;
      getGame: () => GameState | null;
      getHumanId: () => string;
      dispatch: (action: GameAction) => Promise<void>;
      suggestAction: (mode?: ConsolePlayMode) => GameAction | null;
      playHumanAction: (mode?: ConsolePlayMode) => Promise<GameAction | null>;
      pauseAI: () => void;
      resumeAI: () => void;
      isAIPaused: () => boolean;
    }

    type UnlockHost = {
      localGame?: LocalGameDevTools;
      [DEV_CONSOLE_UNLOCK_COMMAND]?: () => Promise<boolean>;
    };

    const host = window as unknown as UnlockHost;
    const effectGen = ++bridgeDevConsoleEffectGen;
    let installed = false;

    const stripTools = () => {
      delete host.localGame;
      installed = false;
      devConsoleSessionUnlockedRef.current = false;
      setDevConsoleUnlocked(false);
      publishAdminToolsLoaded(false);
    };

    if (isOnline) {
      stripTools();
      delete host[DEV_CONSOLE_UNLOCK_COMMAND];
      return;
    }

    const humanSeat = localConfig?.humanId || 'you';

    const assertAdminSession = async (): Promise<boolean> => {
      // Once tools are installed for this session, trust the unlock — do not
      // re-hit Firebase Auth on every seed reset / autoplay step (quota).
      if (installed) {
        return true;
      }
      const ok = await userHasAdminRole(auth.user);
      if (!ok) {
        console.warn(
          'Bridge console denied — sign in with Google and a Firebase admin claim.'
        );
        stripTools();
        return false;
      }
      return true;
    };

    const installTools = () => {
      const suggestAction = (mode: ConsolePlayMode = 'random') =>
        suggestConsoleHumanAction(gameRef.current, humanSeat, mode, {
          names,
          ...coachSuggestionOptions,
        });

      const guardAsync = async <T,>(
        run: () => Promise<T> | T
      ): Promise<T | null> => {
        if (!(await assertAdminSession())) {
          return null;
        }
        return run();
      };

      host.localGame = {
        getMatchSeed: () => {
          if (!installed) {
            return null;
          }
          if (matchSeed == null) {
            console.log('No active match seed');
            return null;
          }
          console.log('Current match seed:', matchSeed);
          return matchSeed;
        },
        resetMatchWithSeed: (seed: number) => {
          void guardAsync(() => {
            if (!onResetMatchWithSeed) {
              console.log('Match rematch is not wired');
              return;
            }
            console.log('Resetting match with seed:', seed);
            onResetMatchWithSeed(seed);
          });
        },
        getRoundSeed: () => (installed ? roundDealSeedRef.current : null),
        previewRoundSeed: (seed: number) => {
          if (!installed) {
            return null;
          }
          try {
            const next = redealLocalRoundWithSeed(gameRef.current, seed);
            return {
              seed,
              hand: next.round?.hands[humanSeat] ?? [],
              roundNumber: next.round?.roundNumber ?? null,
            };
          } catch (error) {
            console.error('previewRoundSeed failed:', error);
            return null;
          }
        },
        forceSalamanderSwap: () => {
          void guardAsync(() => {
            const current = gameRef.current;
            const round = current.round;
            if (!round) {
              console.log('No active round');
              return;
            }
            if (!current.modules.salamanderPenalty.enabled) {
              console.warn('Module Beta (Salamander) is off — enable it first.');
              return;
            }
            if (!current.modules.continuum.enabled) {
              console.warn(
                'Module Alpha (Continuum) is off — swap still patches effects, but flash UI will not apply.'
              );
            }
            const next: GameState = {
              ...current,
              round: {
                ...round,
                continuumEffects: {
                  ...(round.continuumEffects ?? EMPTY_Q_ROUND_EFFECTS),
                  salamanderSwap: true,
                },
              },
            };
            gameRef.current = next;
            setLocalGame(next);
            console.log(
              '✓ Forced continuumEffects.salamanderSwap = true for this round.',
              'Keep maxPip-maxPip in a non-winner hand to see the swap log at round end.'
            );
          });
        },
        resetRoundWithSeed: (seed: number) => {
          void guardAsync(() => {
            try {
              const next = redealLocalRoundWithSeed(gameRef.current, seed);
              roundDealSeedRef.current = seed;
              actionLogRef.current = createActionLog();
              gameLogRef.current = createGameLog();
              loggedRoundRef.current = null;
              ratingsLoggedRoundRef.current = null;
              roundOutcomeLoggedRef.current = null;
              salamanderLoggedRef.current = null;
              longestTrailLoggedRef.current = null;
              temporalDebtLoggedRef.current = null;
              syncedMoveLogCountRef.current = 0;
              actionLogRoundStartIndexRef.current = 0;
              roundStartedAtRef.current = Date.now();
              roundStartStateRef.current = next;
              gameRef.current = next;
              setGameLogVersion((version) => version + 1);
              setLocalGame(next);
              console.log(
                'Resetting round',
                next.round?.roundNumber,
                'with seed:',
                seed
              );
            } catch (error) {
              console.error('resetRoundWithSeed failed:', error);
            }
          });
        },
        getHand: () => {
          if (!installed) {
            return null;
          }
          const hands = gameRef.current.round?.hands;
          if (!hands) {
            console.log('No active round');
            return null;
          }
          return hands[humanSeat] ?? null;
        },
        getGame: () => (installed ? gameRef.current : null),
        getHumanId: () => humanSeat,
        dispatch: async (action: GameAction) => {
          await guardAsync(async () => {
            await dispatch(action, { source: 'human' });
          });
        },
        suggestAction: (mode = 'random') =>
          installed ? suggestAction(mode) : null,
        playHumanAction: async (mode: ConsolePlayMode = 'random') => {
          return guardAsync(async () => {
            const action = suggestAction(mode);
            if (!action) {
              console.log('No playable human action');
              return null;
            }
            console.log('Playing', action.type, action);
            await dispatch(action, { source: 'human' });
            return action;
          });
        },
        pauseAI: () => {
          void guardAsync(() => {
            onAiPausedChange?.(true);
            console.log('🛑 AI paused - they will not take turns');
          });
        },
        resumeAI: () => {
          void guardAsync(() => {
            onAiPausedChange?.(false);
            console.log('▶️ AI resumed - they will continue playing');
          });
        },
        isAIPaused: () => {
          if (!installed) {
            return false;
          }
          console.log('AI paused:', aiPaused);
          return aiPaused;
        },
      };
      installed = true;
      setDevConsoleUnlocked(true);
      publishAdminToolsLoaded(true);
    };

    host[DEV_CONSOLE_UNLOCK_COMMAND] = async () => {
      const isAdmin = await userHasAdminRole(auth.user, { forceRefresh: true });
      if (!isAdmin) {
        console.warn(
          `${DEV_CONSOLE_UNLOCK_COMMAND} refused — Firebase admin claim required (Google sign-in).`
        );
        stripTools();
        setDevConsoleTeiVoid(false);
        return false;
      }

      devConsoleSessionUnlockedRef.current = true;
      installTools();
      devToolsUsedThisMatchRef.current = true;
      const voidsTei = consoleUnlockVoidsTei({ isAdmin: true });
      setDevConsoleTeiVoid(voidsTei);
      gameLogRef.current.append(
        buildDevConsoleUnlockEntry(humanSeat, new Date().toISOString())
      );
      setGameLogVersion((version) => version + 1);
      console.log(
        `✓ Bridge console unlocked (${DEV_CONSOLE_UNLOCK_COMMAND}). CHEATER logged. TEI ${
          voidsTei ? 'void for non-admins' : 'kept for admin claim'
        }.`
      );
      return true;
    };

    // Refresh tool closures after dep changes; do not wipe an active unlock.
    if (devConsoleSessionUnlockedRef.current) {
      installTools();
    }

    return () => {
      // Defer strip so dep refreshes / Strict Mode remounts can supersede.
      queueMicrotask(() => {
        if (bridgeDevConsoleEffectGen !== effectGen) {
          return;
        }
        stripTools();
        delete host[DEV_CONSOLE_UNLOCK_COMMAND];
      });
    };
  }, [
    isOnline,
    matchSeed,
    localConfig?.humanId,
    aiPaused,
    onAiPausedChange,
    onResetMatchWithSeed,
    dispatch,
    names,
    coachSuggestionOptions,
    auth.user,
  ]);

  const exportLocalDebug = async () => {
    setLocalExportBusy(true);
    try {
      const recording = matchDebugRecordingRef.current;
      const clientSnapshot = {
        gameState: game,
        localConfig,
        actionLog: actionLogRef.current.snapshot(),
      };
      const basePayload = recording.enabled
        ? {
            ...matchDebugExportPayload(recording, {
              exportedAt: new Date().toISOString(),
              mode: 'local',
              sectorCode: 'local',
              viewerId: humanId,
            }),
            client: clientSnapshot,
            notes: [
              'Match debug recording — full-match actionLog + round snapshots.',
              `Actions: ${recording.actionLog.length}; round snapshots: ${recording.rounds.length}.`,
            ],
          }
        : {
            exportedAt: new Date().toISOString(),
            mode: 'local' as const,
            sectorCode: 'local',
            viewerId: humanId,
            client: clientSnapshot,
            notes: ['Local simulation — full hands included in gameState.'],
          };

      const result = await downloadDebugExport(basePayload);
      if (result === 'copied') {
        setLastMessage('Debug log copied to clipboard');
      } else if (result === 'shared') {
        setLastMessage('Debug log ready in the share sheet');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLastMessage(
        err instanceof Error ? err.message : 'Could not export the debug log'
      );
    } finally {
      setLocalExportBusy(false);
    }
  };

  const handleExportDebug = () => {
    if (onExportDebug) {
      void onExportDebug();
      return;
    }
    void exportLocalDebug();
  };

  const handleLeaveSetup = useCallback(() => {
    if (!onLeaveSetup) {
      return;
    }
    setSetupConfirmOpen(true);
  }, [onLeaveSetup]);

  const confirmLeaveSetup = useCallback(() => {
    setSetupConfirmOpen(false);
    onLeaveSetup?.();
  }, [onLeaveSetup]);

  const handleLeaveBridge = useCallback(() => {
    if (
      isOnline &&
      isOnlineHost &&
      onHostResetSector &&
      onHostAbandonSector
    ) {
      setLeaveConfirmOpen(true);
      return;
    }
    onLeave?.();
  }, [
    isOnline,
    isOnlineHost,
    onHostResetSector,
    onHostAbandonSector,
    onLeave,
  ]);

  const confirmReturnToWaitingRoom = useCallback(() => {
    setLeaveConfirmOpen(false);
    onHostResetSector?.();
  }, [onHostResetSector]);

  const confirmDissolveSector = useCallback(() => {
    setLeaveConfirmOpen(false);
    void onHostAbandonSector?.();
  }, [onHostAbandonSector]);

  const confirmLeaveWithAi = useCallback(
    (input: {
      newHostId: string;
      skill: import('warp12-engine').WarpSkillLevel;
    }) => {
      void onHostLeaveWithAi?.(input);
    },
    [onHostLeaveWithAi]
  );

  useEffect(() => {
    const actions: {
      id: string;
      label: string;
      onClick: () => void;
    }[] = [];

    if (mode === 'local') {
      actions.push({
        id: 'rematch',
        label: isVsAi ? 'Rematch' : isLocalPassAndPlay ? 'Rematch' : 'New sector',
        onClick: handleRematch,
      });
    }
    if (onLeaveSetup) {
      actions.push({
        id: 'setup',
        label: 'Setup',
        onClick: handleLeaveSetup,
      });
    }
    actions.push({
      id: 'rules',
      label: 'Rules',
      onClick: openSettings,
    });
    actions.push({
      id: 'options',
      label: 'Options',
      onClick: openOptions,
    });

    registerActions(actions);
  }, [
    mode,
    isLocalPassAndPlay,
    isVsAi,
    onLeaveSetup,
    handleRematch,
    handleLeaveSetup,
    openSettings,
    openOptions,
    registerActions,
  ]);

  useEffect(() => {
    return () => clearActions();
  }, [clearActions]);

  const showDebugExport =
    (isOnlineHost && !!onExportDebug) || (!isOnline && mode === 'local');
  const debugBusy = isOnline ? debugExportBusy : localExportBusy;

  const playMove = useCallback(
    (move: LegalMove) => {
      void dispatch({
        type: 'CHART_COORDINATE',
        playerId: handOwnerId,
        coordinate: move.coordinate,
        route: move.route,
      });
      setCoachSuggestion(null);
    },
    [handOwnerId, dispatch]
  );

  const applyCoachHighlight = useCallback(() => {
    if (!coachSuggestion) {
      return;
    }
    const chart = coachChartMove(coachSuggestion.action);
    if (chart) {
      setSelectedTile(chart.coordinate);
    }
  }, [coachSuggestion]);

  const runAskCoach = useCallback(async () => {
    if (!round || !coachAvailable || coachBusy) {
      return;
    }

    setCoachBusy(true);
    try {
      const suggestion = getCoachSuggestion(
      game,
      handOwnerId,
      names,
      coachSuggestionOptions
    );
      if (!suggestion) {
        setLastMessage('Advisor unavailable this turn');
        return;
      }

      applyCoachSuggestion(suggestion, { announce: true });
    } finally {
      setCoachBusy(false);
    }
  }, [
    applyCoachSuggestion,
    coachAvailable,
    coachBusy,
    coachSuggestionOptions,
    game,
    handOwnerId,
    round,
  ]);

  const askCoach = useCallback(async () => {
    if (advisorSuppressedForRated) {
      return;
    }
    if (advisorEngageNeedsConfirm()) {
      setAdvisorConfirmOpen(true);
      return;
    }
    await runAskCoach();
  }, [advisorEngageNeedsConfirm, advisorSuppressedForRated, runAskCoach]);

  const confirmAdvisorEngage = useCallback(() => {
    advisorConsentRef.current = true;
    setAdvisorConfirmOpen(false);
    void runAskCoach();
  }, [runAskCoach]);

  const cancelAdvisorEngage = useCallback(() => {
    setAdvisorConfirmOpen(false);
    // Declining also stops teaching mode so it does not keep re-prompting.
    if (teachingMode) {
      patchTablePrefs({ teachingMode: false });
    }
  }, [patchTablePrefs, teachingMode]);

  const aiBusy = useRef(false);

  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      return;
    }
    if (roundOutcomeLoggedRef.current === round.roundNumber) {
      return;
    }
    roundOutcomeLoggedRef.current = round.roundNumber;
    gameLogRef.current.append(buildRoundOutcomeEntry(round, undefined, game));
    setGameLogVersion((version) => version + 1);
  }, [round, roundAwaitingScore]);

  // Public Salamander line once hands are known (local immediately; online after
  // round-end hand reveal). Retries until attribution resolves or the round scores.
  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      return;
    }
    if (salamanderLoggedRef.current === round.roundNumber) {
      return;
    }
    const penalty = salamanderPenaltyAction(game, round);
    if (!penalty) {
      return;
    }
    salamanderLoggedRef.current = round.roundNumber;
    gameLogRef.current.append(
      buildSalamanderPenaltyLogEntry(penalty, undefined, {
        continuumSwapArmed:
          game.modules.continuum.enabled &&
          round.continuumEffects?.salamanderSwap === true,
      })
    );
    setGameLogVersion((version) => version + 1);
  }, [game, round, roundAwaitingScore]);

  // Public Longest Trail Bonus line once scoring hands are known.
  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      return;
    }
    if (longestTrailLoggedRef.current === round.roundNumber) {
      return;
    }
    const bonuses = longestTrailBonusActions(game, round);
    if (bonuses.length === 0) {
      return;
    }
    longestTrailLoggedRef.current = round.roundNumber;
    for (const bonus of bonuses) {
      gameLogRef.current.append(buildLongestTrailBonusLogEntry(bonus));
    }
    setGameLogVersion((version) => version + 1);
  }, [game, round, roundAwaitingScore]);

  // Public Temporal Debt lines once scoring hands are known.
  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      return;
    }
    if (temporalDebtLoggedRef.current === round.roundNumber) {
      return;
    }
    const debts = temporalDebtPenaltyActions(game, round);
    if (debts.length === 0) {
      return;
    }
    temporalDebtLoggedRef.current = round.roundNumber;
    for (const debt of debts) {
      gameLogRef.current.append(buildTemporalDebtPenaltyLogEntry(debt));
    }
    setGameLogVersion((version) => version + 1);
  }, [game, round, roundAwaitingScore]);

  const canShareRound = Boolean(round && canShowRoundEndSummary);

  const captainOrder = useMemo(
    () => round?.turnOrder ?? game.captains.map((captain) => captain.id),
    [game.captains, round?.turnOrder]
  );
  const gameLogNameColors = useMemo(
    () => buildCaptainNameColors(names, captainOrder),
    [captainOrder, names]
  );

  useEffect(() => {
    const title = round
      ? `Round ${round.roundNumber}`
      : sectorCode
        ? `Sector ${sectorCode}`
        : 'Warp commentary';
    publishCommentatorSnapshot({
      lines: commentatorLines,
      nameColors: gameLogNameColors,
      title,
      sectorCode: sectorCode ?? undefined,
    });
  }, [commentatorLines, gameLogNameColors, round, sectorCode]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channel = new BroadcastChannel(COMMENTATOR_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (
        !isCommentatorBroadcastMessage(event.data) ||
        event.data.type !== 'hello'
      ) {
        return;
      }
      const title = round
        ? `Round ${round.roundNumber}`
        : sectorCode
          ? `Sector ${sectorCode}`
          : 'Warp commentary';
      publishCommentatorSnapshot({
        lines: commentatorLines,
        nameColors: gameLogNameColors,
        title,
        sectorCode: sectorCode ?? undefined,
      });
    };
    return () => {
      channel.close();
    };
  }, [commentatorLines, gameLogNameColors, round, sectorCode]);

  const companionHumanSeats = useMemo(
    () =>
      resolveCompanionHumanSeats({
        mode,
        isOnline,
        isVsAi,
        humanId,
        humanName: localConfig?.humanName,
        humanCaptains: localConfig?.humanCaptains,
        names,
      }),
    [
      humanId,
      isOnline,
      isVsAi,
      localConfig?.humanCaptains,
      localConfig?.humanName,
      mode,
      names,
    ]
  );

  const buildHandCompanionSnapshotForSeat = useCallback(
    (seatId: string) => {
      if (isOnline || mode !== 'local') {
        return null;
      }
      const drafting =
        round?.phase === 'drafting' && round.draftState != null;
      const seatHandoff =
        handoffPending && activePlayerId === seatId && isCompanionHandoffEnabled(couchMode);
      const draftTurn =
        drafting && round!.draftState!.currentDrafter === seatId;
      const playTurn =
        round?.phase === 'playing' &&
        activePlayerId === seatId &&
        !seatHandoff &&
        game.phase === 'active' &&
        !sectorPaused;
      const isSeatTurn = Boolean(draftTurn || playTurn);
      const seatHand = round?.hands[seatId] ?? [];
      const seatLegal =
        isSeatTurn && round?.phase === 'playing'
          ? getLegalMoves(round, seatId, game.houseRules)
          : [];
      const seatHelm = resolveHelmControls({
        round,
        handOwnerId: seatId,
        isMyTurn: Boolean(playTurn),
        houseRules: game.houseRules,
        dropToImpulsePending: Boolean(
          round &&
            round.phase === 'playing' &&
            game.phase === 'active' &&
            game.houseRules.dropToImpulseCall &&
            round.dropToImpulseCallPending === seatId &&
            (round.hands[seatId]?.length ?? 0) === 1
        ),
        legalMovesCount: seatLegal.length,
        gameState: game,
      });
      const catchTarget = round?.dropToImpulseCatchable ?? null;
      const seatCanCatch =
        Boolean(playTurn) &&
        !!round &&
        round.phase === 'playing' &&
        game.phase === 'active' &&
        game.houseRules.dropToImpulseCall &&
        catchTarget != null &&
        catchTarget !== seatId &&
        (round.hands[catchTarget]?.length ?? 0) === 1;
      const status = drafting
        ? round!.draftState!.currentDrafter === seatId
          ? 'Your draft pick — select a coordinate from your pack'
          : `${names[round!.draftState!.currentDrafter] ?? 'Captain'} is drafting`
        : game.phase !== 'active'
          ? game.phase === 'complete'
            ? 'Sector complete'
            : 'Stand by'
          : seatHandoff
            ? 'Confirm ready at helm'
            : !isSeatTurn
              ? 'Stand by for helm'
              : lastMessage && activePlayerId === seatId
                ? lastMessage
                : seatLegal.length > 0
                  ? 'Select a playable coordinate'
                  : seatHelm.showDraw
                    ? 'Draw or pass'
                    : 'Your turn';
      return {
        gameId: game.id,
        maxPip,
        handOwnerId: seatId,
        handOwnerName: names[seatId] ?? 'Captain',
        isMyTurn: Boolean(isSeatTurn && game.phase === 'active'),
        phase: game.phase,
        status,
        hand: seatHand,
        legalMoves: seatLegal,
        helm: {
          showDraw: seatHelm.showDraw,
          showDesperationDig: seatHelm.showDesperationDig,
          showShieldsDown: seatHelm.showShieldsDown,
          showShieldsUp: seatHelm.showShieldsUp,
          showPassRedAlert: seatHelm.showPassRedAlert,
          showPass: seatHelm.showPass,
        },
        spoolOptions: seatHelm.spoolOptions.map((option) => ({
          route: option.route,
          label: routeLabel(option.route, names),
        })),
        dropToImpulsePending: Boolean(
          playTurn &&
            round &&
            round.phase === 'playing' &&
            game.phase === 'active' &&
            game.houseRules.dropToImpulseCall &&
            round.dropToImpulseCallPending === seatId &&
            (round.hands[seatId]?.length ?? 0) === 1
        ),
        canCatchDropToImpulse: seatCanCatch,
        dropToImpulseCatchTargetId: seatCanCatch ? catchTarget : null,
        dropToImpulseCatchLabel:
          seatCanCatch && catchTarget
            ? names[catchTarget] ?? 'Captain'
            : null,
        names: { ...names },
        game: redactGameForSeat(game, seatId),
        tileBg,
        handoffPending: seatHandoff,
        handoffCaptainName: seatHandoff
          ? names[activePlayerId] ?? 'Captain'
          : null,
      };
    },
    [
      activePlayerId,
      couchMode,
      game,
      handoffPending,
      isOnline,
      lastMessage,
      maxPip,
      mode,
      names,
      round,
      sectorPaused,
      tileBg,
    ]
  );

  const republishHandCompanions = useCallback(() => {
    if (isOnline || mode !== 'local' || companionHumanSeats.length === 0) {
      return;
    }
    publishHandCompanionRoster({
      gameId: game.id,
      seats: companionHumanSeats,
    });
    for (const seat of companionHumanSeats) {
      const snapshot = buildHandCompanionSnapshotForSeat(seat.id);
      if (!snapshot) {
        continue;
      }
      publishHandCompanionSnapshot(
        snapshot,
        handCompanionChannelForSeat(seat.id)
      );
    }
    // Follow-active channel for streamer single-window /local/hand
    const followId = resolveFollowCompanionSeatId({
      isLocalPassAndPlay,
      activePlayerId,
      humanSeatIds,
      companionSeats: companionHumanSeats,
      humanId,
    });
    if (followId) {
      const followSnap = buildHandCompanionSnapshotForSeat(followId);
      if (followSnap) {
        publishHandCompanionSnapshot(followSnap, HAND_COMPANION_CHANNEL);
      }
    }
  }, [
    activePlayerId,
    buildHandCompanionSnapshotForSeat,
    companionHumanSeats,
    game.id,
    humanId,
    humanSeatIds,
    isLocalPassAndPlay,
    isOnline,
    mode,
  ]);

  useEffect(() => {
    republishHandCompanions();
  }, [republishHandCompanions]);

  useEffect(() => {
    if (isOnline || mode !== 'local') {
      return;
    }
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    const channelNames = [...companionListenChannels(companionHumanSeats)];
    const channels = channelNames.map((name) => new BroadcastChannel(name));
    const onMessage = (channelName: string) => (event: MessageEvent) => {
      if (!isHandCompanionInboundMessage(event.data)) {
        return;
      }
      if (event.data.type === 'hello') {
        republishHandCompanions();
        return;
      }
      if (event.data.type === 'handoff-ready') {
        if (
          shouldAcceptCompanionHandoffReady({
            channelName,
            readySeatId: event.data.seatId,
            activePlayerId,
            handOwnerId,
          })
        ) {
          confirmHandoff();
        }
        return;
      }
      const action = event.data.action;
      const actor = playerIdForAction(action);
      if (
        !shouldAcceptCompanionAction({
          channelName,
          actorId: actor,
          handOwnerId,
          humanSeatIds,
          humanId,
        })
      ) {
        return;
      }
      void dispatch(action, { source: 'human' });
    };
    const listeners = channels.map((channel, index) => {
      const listener = onMessage(channelNames[index]);
      channel.addEventListener('message', listener);
      return { channel, listener };
    });
    return () => {
      for (const { channel, listener } of listeners) {
        channel.removeEventListener('message', listener);
        channel.close();
      }
    };
  }, [
    activePlayerId,
    companionHumanSeats,
    confirmHandoff,
    dispatch,
    handOwnerId,
    humanId,
    humanSeatIds,
    isOnline,
    mode,
    republishHandCompanions,
  ]);

  // Stream-safe drafting: reopen private hand(s) if the pack UI is off-camera.
  useEffect(() => {
    if (isOnline || mode !== 'local' || !hideHandOnBridge) {
      return;
    }
    if (round?.phase !== 'drafting') {
      return;
    }
    if (couchMode && companionHumanSeats.length > 0) {
      openCouchHandWindows(companionHumanSeats);
      return;
    }
    openLocalHandCompanionWindow();
  }, [
    companionHumanSeats,
    couchMode,
    hideHandOnBridge,
    isOnline,
    mode,
    round?.phase,
  ]);

  const roundLogFilename = useMemo(() => {
    if (!round) {
      return 'warp12-round-log.txt';
    }
    return buildRoundLogFilename(
      round.roundNumber,
      new Date().toISOString(),
      sectorCode ?? (isOnline ? undefined : 'local'),
      'txt'
    );
  }, [isOnline, round, sectorCode]);
  const roundLogJsonFilename = useMemo(() => {
    if (!round) {
      return 'warp12-round-log.json';
    }
    return buildRoundLogFilename(
      round.roundNumber,
      new Date().toISOString(),
      sectorCode ?? (isOnline ? undefined : 'local'),
      'json'
    );
  }, [isOnline, round, sectorCode]);

  const handleOpenRoundLog = useCallback(() => {
    setGameLogDialogOpen(true);
  }, []);

  const buildCurrentRoundLogExport = useCallback(() => {
    if (!round) {
      return null;
    }
    return buildRoundLogExport(
      gameLogRef.current.snapshot(),
      round.roundNumber,
      names,
      {
        sectorCode: sectorCode ?? (isOnline ? undefined : 'local'),
        roundStartedAtMs: roundStartedAtRef.current,
        formatElapsed: formatElapsedLogTime,
        formatAbsolute: formatDisplayTime,
      }
    );
  }, [isOnline, names, round, sectorCode]);

  const handleDownloadRoundLog = useCallback(async () => {
    const payload = buildCurrentRoundLogExport();
    if (!payload) {
      return;
    }
    setRoundLogDownloadBusy(true);
    try {
      const result = await downloadRoundLog(payload);
      if (result === 'copied') {
        setLastMessage('Round log copied to clipboard');
      } else if (result === 'shared') {
        setLastMessage('Round log ready in the share sheet');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLastMessage(
        err instanceof Error ? err.message : 'Could not export the round log'
      );
    } finally {
      setRoundLogDownloadBusy(false);
    }
  }, [buildCurrentRoundLogExport]);

  const handleDownloadHighlights = useCallback(async () => {
    if (!round) {
      return;
    }
    setRoundLogDownloadBusy(true);
    try {
      const stamp = new Date().toISOString();
      const filename = buildRoundLogFilename(
        round.roundNumber,
        stamp,
        sectorCode ?? (isOnline ? undefined : 'local'),
        'txt'
      ).replace('-log-', '-highlights-');
      const body = commentatorLines.join('\n');
      const result = await deliverBlob({
        blob: new Blob([body], { type: 'text/plain;charset=utf-8' }),
        filename,
        title: `Warp · Round ${round.roundNumber} highlights`,
        text: body,
      });
      if (result === 'copied') {
        setLastMessage('Highlights copied to clipboard');
      } else if (result === 'shared') {
        setLastMessage('Highlights ready in the share sheet');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLastMessage(
        err instanceof Error ? err.message : 'Could not export highlights'
      );
    } finally {
      setRoundLogDownloadBusy(false);
    }
  }, [commentatorLines, isOnline, round, sectorCode]);

  const handleDownloadRoundLogJson = useCallback(async () => {
    const payload = buildCurrentRoundLogExport();
    if (!payload) {
      return;
    }
    setRoundLogDownloadBusy(true);
    try {
      const result = await downloadRoundLogJson(payload);
      if (result === 'copied') {
        setLastMessage('Round log JSON copied to clipboard');
      } else if (result === 'shared') {
        setLastMessage('Round log JSON ready in the share sheet');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLastMessage(
        err instanceof Error ? err.message : 'Could not export the round log JSON'
      );
    } finally {
      setRoundLogDownloadBusy(false);
    }
  }, [buildCurrentRoundLogExport]);

  const streamOverlayUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return COMMENTARY_OVERLAY_PATH;
    }
    if (isOnline && sectorCode) {
      return `${window.location.origin}/online/${sectorCode}/commentary`;
    }
    return `${window.location.origin}${COMMENTARY_OVERLAY_PATH}`;
  }, [isOnline, sectorCode]);

  const handleOpenStreamOverlay = useCallback(() => {
    if (isOnline && sectorCode) {
      const url = `${window.location.origin}/online/${sectorCode}/commentary`;
      window.open(url, 'warp12-commentary', 'popup=yes,width=960,height=540');
      return;
    }
    openCommentaryOverlayWindow();
  }, [isOnline, sectorCode]);

  const handleOpenPrivateHand = useCallback(() => {
    if (isOnline && sectorCode) {
      const url = sectorHandUrl(sectorCode);
      window.open(url, 'warp12-private-hand', 'popup=yes,width=1100,height=800');
      return;
    }
    openLocalHandCompanionWindow();
    announce(
      'Private hand companion opened. Keep it off-camera; leave this Bridge on the capture display.',
      'polite'
    );
  }, [announce, isOnline, sectorCode]);

  const handleEnableStreamSafe = useCallback(() => {
    patchTablePrefs({ hideHandOnBridge: true });
    writeLogVisibilityMode('commentator');
    setLogMode('commentator');
    if (isOnline && sectorCode) {
      window.open(
        sectorHandUrl(sectorCode),
        'warp12-private-hand',
        'popup=yes,width=1100,height=800'
      );
    } else if (!isOnline) {
      openLocalHandCompanionWindow();
    }
    announce(
      'Stream-safe enabled. Hand hidden on this Bridge; commentator log on.',
      'polite'
    );
  }, [announce, isOnline, patchTablePrefs, sectorCode]);

  const handleEnableCouchMode = useCallback(() => {
    patchTablePrefs({ hideHandOnBridge: true, couchMode: true });
    writeLogVisibilityMode('commentator');
    setLogMode('commentator');
    openCouchHandWindows(companionHumanSeats);
    announce(
      'Couch mode on. Each captain plays from their private hand window; handoff skipped.',
      'polite'
    );
  }, [announce, companionHumanSeats, patchTablePrefs]);

  const handleOpenCouchHands = useCallback(() => {
    openCouchHandWindows(companionHumanSeats);
    announce(
      `Opened ${companionHumanSeats.length} seat hand window${
        companionHumanSeats.length === 1 ? '' : 's'
      }.`,
      'polite'
    );
  }, [announce, companionHumanSeats]);

  const focusPlayerIdsForAdvisor = useMemo(() => {
    if (isVsAi) {
      return [humanId];
    }
    if (isOnline && viewerId) {
      return [viewerId];
    }
    return game.captains.map((captain) => captain.id);
  }, [game.captains, humanId, isOnline, isVsAi, viewerId]);

  const canOpenAdvisorReport = useMemo(() => {
    if (!canShowRoundEndSummary || !roundStartStateRef.current) {
      return false;
    }
    return (
      actionLogRef.current.snapshot().length >
      actionLogRoundStartIndexRef.current
    );
  }, [gameLogVersion, canShowRoundEndSummary]);

  const advisorOpponentLabel = useMemo(
    () => tableOpponentLabelForAdvisor(localConfig),
    [localConfig]
  );

  const buildRoundAdvisorReport = useCallback(
    (includeAllCaptains = advisorIncludeAllCaptains) => {
      const roundStartState = roundStartStateRef.current;
      if (!roundStartState) {
        return null;
      }
      const entries = actionLogRef.current
        .snapshot()
        .slice(actionLogRoundStartIndexRef.current);
      return buildAdvisorReport({
        roundStartState,
        entries,
        ...advisorReportOptions,
        ...(includeAllCaptains
          ? { includeAllPlayers: true }
          : { focusPlayerIds: focusPlayerIdsForAdvisor }),
        names,
      });
    },
    [advisorIncludeAllCaptains, advisorReportOptions, focusPlayerIdsForAdvisor, names]
  );

  const buildCampaignAdvisorReports = useCallback(
    (includeAllCaptains: boolean) =>
      campaignRoundSnapshotsRef.current.map((snapshot) => ({
        roundNumber: snapshot.roundNumber,
        report: buildAdvisorReport({
          roundStartState: snapshot.roundStartState,
          entries: snapshot.entries,
          ...advisorReportOptions,
          ...(includeAllCaptains
            ? { includeAllPlayers: true }
            : { focusPlayerIds: focusPlayerIdsForAdvisor }),
          names,
        }),
      })),
    [advisorReportOptions, focusPlayerIdsForAdvisor, names]
  );

  const downloadCampaignAdvisorReport = useCallback(
    async (includeAllCaptains: boolean) => {
      const rounds = buildCampaignAdvisorReports(includeAllCaptains);
      const text = campaignAdvisorPlainText(rounds, names, {
        includeAllCaptains,
        opponentLabel: advisorOpponentLabel,
      });
      const filename = `warp12-campaign-advisor-${sectorCode ?? 'local'}.txt`;
      try {
        const result = await deliverBlob({
          blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
          filename,
          title: 'Warp 12 · Campaign advisor report',
          text,
        });
        if (result === 'copied') {
          setLastMessage('Campaign advisor report copied to clipboard');
        } else if (result === 'shared') {
          setLastMessage('Campaign advisor report ready in the share sheet');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setLastMessage(
          err instanceof Error
            ? err.message
            : 'Could not export the campaign advisor report'
        );
      }
    },
    [buildCampaignAdvisorReports, names, sectorCode, advisorOpponentLabel]
  );

  const rebuildCampaignAdvisorReviews = useCallback(() => {
    const reviews: AdvisorMoveReview[] = [];
    for (const snapshot of campaignRoundSnapshotsRef.current) {
      const report = buildAdvisorReport({
        roundStartState: snapshot.roundStartState,
        entries: snapshot.entries,
        ...advisorReportOptions,
        focusPlayerIds: focusPlayerIdsForAdvisor,
        names,
      });
      reviews.push(...report.reviews);
    }
    campaignAdvisorReviewsRef.current = reviews;
    setCampaignPerformance(summarizeAdvisorPerformance(reviews));
    setCampaignRoundCount(campaignRoundSnapshotsRef.current.length);
  }, [advisorReportOptions, focusPlayerIdsForAdvisor, names]);

  const appendRoundAdvisorReviews = useCallback(() => {
    const roundStartState = roundStartStateRef.current;
    if (!roundStartState || !round) {
      return;
    }
    const entries = actionLogRef.current
      .snapshot()
      .slice(actionLogRoundStartIndexRef.current);
    const snapshot = {
      roundNumber: round.roundNumber,
      roundStartState: structuredClone(roundStartState),
      entries: [...entries],
    };
    const existingIndex = campaignRoundSnapshotsRef.current.findIndex(
      (item) => item.roundNumber === round.roundNumber
    );
    if (existingIndex >= 0) {
      campaignRoundSnapshotsRef.current = [
        ...campaignRoundSnapshotsRef.current.slice(0, existingIndex),
        snapshot,
        ...campaignRoundSnapshotsRef.current.slice(existingIndex + 1),
      ];
    } else {
      campaignRoundSnapshotsRef.current = [
        ...campaignRoundSnapshotsRef.current,
        snapshot,
      ];
    }

    rebuildCampaignAdvisorReviews();
  }, [rebuildCampaignAdvisorReviews, round]);

  const handleAdvisorIncludeAllChange = useCallback(
    (includeAllCaptains: boolean) => {
      patchTablePrefs({ advisorIncludeAllCaptains: includeAllCaptains });
      const report = buildRoundAdvisorReport(includeAllCaptains);
      if (report) {
        setAdvisorReport(report);
      }
    },
    [buildRoundAdvisorReport, patchTablePrefs]
  );

  const handleOpenAdvisorReport = useCallback(() => {
    const report = buildRoundAdvisorReport(advisorIncludeAllCaptains);
    if (!report) {
      return;
    }
    setAdvisorReport(report);
    setAdvisorReportDialogOpen(true);
  }, [advisorIncludeAllCaptains, buildRoundAdvisorReport]);

  const advisorReportFilename = useMemo(() => {
    if (!round) {
      return 'warp12-advisor-report.txt';
    }
    return `warp12-advisor-r${round.roundNumber}-${sectorCode ?? 'local'}.txt`;
  }, [round, sectorCode]);

  const shareRoundMetadata = useMemo((): ShareRoundMetadata | null => {
    if (!canShareRound || !round) {
      return null;
    }

    const statsLines =
      game.objective === 'points'
        ? formatPointsStatLines(buildRoundEndScoreRows(game, round))
        : game.captains.map(
            (captain) =>
              `${names[captain.id] ?? captain.displayName}: ${
                round.hands[captain.id]?.length ?? 0
              } in hand`
          );

    return {
      roundNumber: round.roundNumber,
      headline: roundEndTitle(game, round, names),
      subtitle: roundEndHeadline(game, round, names),
      statsLines,
      sectorCode: sectorCode ?? (isOnline ? undefined : 'local'),
    };
  }, [canShareRound, game, isOnline, names, round, sectorCode]);

  const handleRoundImage = useCallback(
    async (mode: ShareRoundImageMode, delivery: ShareRoundDelivery) => {
      if (!shareRoundMetadata || !tableContentRef.current) {
        return;
      }
      const busyKey = `${delivery}-${mode}`;
      setRoundImageBusy(busyKey);
      try {
        await deliverRoundImage({
          tableContent: tableContentRef.current,
          meta: shareRoundMetadata,
          mode,
          delivery,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof RoundImageShareGestureError) {
          setPendingRoundImageShare(err.pending);
          setLastMessage('Image ready — tap Share now to open the sheet');
          return;
        }
        setLastMessage(
          err instanceof Error ? err.message : 'Could not share the board image'
        );
      } finally {
        setRoundImageBusy(null);
      }
    },
    [shareRoundMetadata]
  );

  const confirmPendingRoundImageShare = useCallback(async () => {
    if (!pendingRoundImageShare) {
      return;
    }
    const pending = pendingRoundImageShare;
    setPendingRoundImageShare(null);
    try {
      await deliverPendingRoundImage(pending);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLastMessage(
        err instanceof Error ? err.message : 'Could not share the board image'
      );
    }
  }, [pendingRoundImageShare]);

  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      roundEndReviewKeyRef.current = null;
      return;
    }
    const key = `${round.roundNumber}:${round.roundWinnerId ?? 'blocked'}:${round.roundBlocked}`;
    if (roundEndReviewKeyRef.current !== key) {
      roundEndReviewKeyRef.current = key;
      setRoundEndSummaryOpen(true);
      setExpandedBreakdownId(null);
    }
  }, [
    roundAwaitingScore,
    round?.roundBlocked,
    round?.roundNumber,
    round?.roundWinnerId,
  ]);

  const roundOutcome = useMemo(() => {
    if (!round || !canShowRoundEndSummary) {
      return null;
    }
    return summarizeRoundOutcome(game, round);
  }, [game, round, canShowRoundEndSummary]);

  const roundPenaltySummary = useMemo(() => {
    if (!round || !canShowRoundEndSummary || game.objective !== 'points') {
      return [];
    }
    const rows = buildRoundEndScoreRows(game, round, {
      ...(isOnline ? { handCounts } : {}),
    });
    if (!roundOutcome) {
      return rows;
    }
    // Winner(s) first, then best-to-worst. Pinning winners first matters for
    // inverted (Kappa) rounds, where the winner can hold the most points.
    return sortRoundEndScoreRows(
      rows,
      new Set(roundOutcome.roundWinnerIds)
    );
  }, [
    game,
    round,
    canShowRoundEndSummary,
    roundOutcome,
    isOnline,
    handCounts,
  ]);

  // Itemized "why did I score that?" receipt for each captain, keyed by id.
  const roundPointBreakdowns = useMemo(() => {
    if (!round || !canShowRoundEndSummary || game.objective !== 'points') {
      return new Map<string, RoundPointBreakdown>();
    }
    return new Map(
      explainRoundPoints(game, round).map(
        (breakdown) => [breakdown.playerId, breakdown] as const
      )
    );
  }, [game, round, canShowRoundEndSummary]);

  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(
    null
  );

  const scoreCurrentRound = useCallback(() => {
    if (!round || !roundAwaitingScore) {
      return;
    }
    if (lastScoredRoundRef.current === round.roundNumber) {
      return;
    }
    lastScoredRoundRef.current = round.roundNumber;
    appendRoundAdvisorReviews();
    const appendAutoAction = (action: GameAction) => {
      const entry = {
        playerId: playerIdForAction(action),
        action,
        ok: true as const,
        source: 'auto' as const,
      };
      actionLogRef.current.append(entry);
      setMatchDebugRecording((current) =>
        appendMatchDebugAction(current, {
          ...entry,
          at: new Date().toISOString(),
        })
      );
    };
    const salamander = salamanderPenaltyAction(game, round);
    if (salamander) {
      appendAutoAction(salamander);
    }
    for (const bonus of longestTrailBonusActions(game, round)) {
      appendAutoAction(bonus);
    }
    for (const debt of temporalDebtPenaltyActions(game, round)) {
      appendAutoAction(debt);
    }
    void dispatch(
      {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      },
      { source: 'auto' }
    );
  }, [appendRoundAdvisorReviews, dispatch, game, round, roundAwaitingScore]);

  useEffect(() => {
    if (game.phase === 'complete') {
      setCampaignPerformance(
        summarizeAdvisorPerformance(campaignAdvisorReviewsRef.current)
      );
      setCampaignPointsHistory(
        deriveCampaignPointsHistory(
          campaignRoundSnapshotsRef.current,
          gameRef.current
        )
      );
      setCampaignCompleteOpen(true);
      setRoundEndSummaryOpen(false);
      void import('../platform/achievements/report-milestones.js').then(
        ({ reportCampaignComplete }) => {
          reportCampaignComplete({ maxPip: game.maxPip });
        }
      );
    }
  }, [game.phase, game.maxPip]);

  const aiTurnKey = round
    ? [
        round.roundNumber,
        round.activePlayerId,
        round.handExchangePending?.largerPlayerId ?? '',
        round.roundStarterOpening?.playerId ?? '',
        round.mandatoryPlay?.playerId ?? '',
        round.continuumPendingInvoker ?? '',
        round.continuumWagerPending?.playerId ?? '',
        round.allStopRequired,
        round.allStopDeclared,
        round.roundWinnerId ?? '',
        round.phase,
        round.draftState?.pickNumber ?? 0,
      ].join(':')
    : '';

  // AI draft execution (drafting phase)
  useEffect(() => {
    if (!hasLocalAiOfficers || !aiPlayers || !round || game.phase === 'complete' || aiPaused) {
      return;
    }

    if (round.phase !== 'drafting' || !round.draftState) return;
    if (isVsAi && round.activePlayerId === humanId) return;
    if (isLocalPassAndPlay && humanSeatIds.has(round.activePlayerId)) return;

    const activePlayerId = round.activePlayerId;
    const ai = aiPlayers.get(activePlayerId);
    if (!ai || aiBusy.current) return;

    const pack = round.draftState.currentPacks[activePlayerId];
    if (!pack || pack.length === 0) return;

    aiBusy.current = true;
    const timer = window.setTimeout(() => {
      const current = gameRef.current;
      const currentRound = current.round;
      aiBusy.current = false;
      if (
        !currentRound ||
        currentRound.phase !== 'drafting' ||
        !currentRound.draftState ||
        currentRound.activePlayerId !== activePlayerId
      ) {
        return;
      }

      const currentPack = currentRound.draftState.currentPacks[activePlayerId];
      if (!currentPack || currentPack.length === 0) {
        return;
      }

      // Use balanced draft pick strategy for AI
      const picked = pickBalancedTile(activePlayerId, currentPack);
      
      const action: GameAction = {
        type: 'PICK_FROM_PACK',
        playerId: activePlayerId,
        coordinate: picked,
      };
      
      void dispatch(action, { source: 'ai' });
    }, 450);

    return () => {
      clearTimeout(timer);
      aiBusy.current = false;
    };
  }, [
    aiPlayers,
    aiTurnKey,
    dispatch,
    game.phase,
    hasLocalAiOfficers,
    humanId,
    humanSeatIds,
    isLocalPassAndPlay,
    isVsAi,
    round,
    aiPaused,
  ]);

  // AI turn execution (playing phase)
  useEffect(() => {
    if (!hasLocalAiOfficers || !aiPlayers || !round || game.phase === 'complete' || aiPaused) {
      return;
    }

    if (round.phase !== 'playing') return;
    const actorId = pendingResolutionActorId(round);
    if (isVsAi && actorId === humanId) return;
    if (isLocalPassAndPlay && humanSeatIds.has(actorId)) return;

    const activePlayerId = actorId;
    const ai = aiPlayers.get(activePlayerId);
    if (!ai || aiBusy.current) return;

    aiBusy.current = true;
    const timer = window.setTimeout(() => {
      const current = gameRef.current;
      const currentRound = current.round;
      aiBusy.current = false;
      if (
        !currentRound ||
        currentRound.phase !== 'playing' ||
        pendingResolutionActorId(currentRound) !== activePlayerId
      ) {
        return;
      }
      
      
      // Normal path: AI plays freely
      const action = ai.decideGameAction(current, activePlayerId);
      if (action) {
        void dispatch(action, { source: 'ai' });
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      aiBusy.current = false;
    };
  }, [
    aiPlayers,
    aiTurnKey,
    dispatch,
    game.phase,
    hasLocalAiOfficers,
    humanId,
    humanSeatIds,
    isLocalPassAndPlay,
    isVsAi,
    round,
    aiPaused,
    game.houseRules,
  ]);

  const dropToImpulseCatchable = round?.dropToImpulseCatchable ?? null;
  useEffect(() => {
    if (
      !hasLocalAiOfficers ||
      !aiPlayers ||
      !round ||
      game.phase === 'complete' ||
      !game.houseRules.dropToImpulseCall ||
      !dropToImpulseCatchable
    ) {
      return;
    }

    const aiChallengerId = [...aiPlayers.keys()].find(
      (id) => id !== dropToImpulseCatchable
    );
    if (!aiChallengerId || aiBusy.current) {
      return;
    }

    aiBusy.current = true;
    const timer = window.setTimeout(() => {
      aiBusy.current = false;
      void dispatch(
        {
          type: 'CATCH_DROP_TO_IMPULSE',
          challengerId: aiChallengerId,
          targetPlayerId: dropToImpulseCatchable,
        },
        { source: 'ai' }
      );
    }, 450);

    return () => {
      clearTimeout(timer);
      aiBusy.current = false;
    };
  }, [
    aiPlayers,
    dispatch,
    dropToImpulseCatchable,
    game.houseRules.dropToImpulseCall,
    game.phase,
    hasLocalAiOfficers,
    round,
  ]);

  const onTileClick = (coordinate: Coordinate) => {
    if (shouldIgnoreClick()) {
      return;
    }
    const moves = legalMoves.filter((move) =>
      coordinatesEqual(move.coordinate, coordinate)
    );
    if (moves.length === 0) {
      return;
    }
    // Clicking a playable tile never charts it outright — it selects the tile
    // and opens the Play/Flip prompt. This keeps "click to flip" safe (no
    // accidental plays while arranging) and works identically on mouse and
    // touch. A second click/tap on an already-selected single-route tile plays.
    const alreadySelected =
      selectedTile !== null && coordinatesEqual(selectedTile, coordinate);
    if (alreadySelected && moves.length === 1) {
      playMove(moves[0]);
      return;
    }
    setSelectedTile(coordinate);
  };

  const onHandTileClick = (
    coordinate: Coordinate,
    key: string,
    playable: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (shouldIgnoreClick()) {
      return;
    }
    if (event.altKey || event.shiftKey || !playable) {
      toggleFlip(key);
      return;
    }
    onTileClick(coordinate);
  };

  const fracture = round?.table.subspaceFracture;
  const bridgeYellowAlert =
    round != null && shouldIlluminateBridgeYellowAlert(round);
  const bridgeRedAlert =
    round != null && shouldIlluminateBridgeRedAlert(round);
  const sectorRedAlertRow =
    round != null ? formatSectorRedAlertRow(round, names) : null;
  const beaconCount = round
    ? Object.values(round.table.warpTrails).filter(
        (trail) => trail.distressBeacon.active
      ).length
    : 0;
  
  // Module Theta: longest personal trail leader(s) for sector HUD.
  const longestTrailData = useMemo(() => {
    if (!round || !game.modules.longestTrail?.enabled) {
      return { captains: [] as string[], length: 0 };
    }

    const trailLengths = Object.entries(round.table.warpTrails).map(
      ([captainId, trail]) => ({
        captainId,
        length: trail.tiles.length,
      })
    );

    const maxLength = Math.max(0, ...trailLengths.map((t) => t.length));
    const leaders = trailLengths
      .filter((t) => t.length > 0 && t.length === maxLength)
      .map((t) => t.captainId);

    return {
      captains: leaders,
      length: maxLength,
    };
  }, [round, game.modules.longestTrail?.enabled]);

  // Module Delta: Hazard Marker holder for sector HUD (independent of Theta).
  const hazardMarkerHolder = useMemo(() => {
    if (!round || !game.modules.warpDriveSpool?.enabled) {
      return null;
    }
    return round.hazardMarkerHolder ?? null;
  }, [round, game.modules.warpDriveSpool?.enabled]);
  
  const portraitSummaryNudge =
    shouldNudgePortraitForSummary(layoutTier, orientation) &&
    ((canShowRoundEndSummary && roundEndSummaryOpen) ||
      (game.phase === 'complete' && campaignCompleteOpen));

  const handSortButtons = (
    <>
      <button
        type="button"
        className={styles.handSortBtn}
        onClick={() => applySort('pips-desc')}
        aria-label="Sort heaviest first"
        title="Sort by total pips, heaviest first"
      >
        {compactLayout ? 'Heavy' : 'Heaviest'}
      </button>
      <button
        type="button"
        className={styles.handSortBtn}
        onClick={() => applySort('pips-asc')}
        aria-label="Sort lightest first"
        title="Sort by total pips, lightest first"
      >
        {compactLayout ? 'Light' : 'Lightest'}
      </button>
      <button
        type="button"
        className={styles.handSortBtn}
        onClick={() => applySort('low-first')}
        aria-label="Sort by low pip"
        title="Sort by the lower end of each tile (0s, then 1s, …)"
      >
        {compactLayout ? 'Low' : 'Low pip'}
      </button>
      <button
        type="button"
        className={styles.handSortBtn}
        onClick={() => applySort('doubles-first')}
        aria-label="Sort doubles first"
        title="Doubles first, then by total pips"
      >
        {compactLayout ? 'Double' : 'Doubles'}
      </button>
      <button
        type="button"
        className={styles.handSortBtn}
        onClick={() => applySort('best-train', trainConnectValue)}
        disabled={trainConnectValue === undefined}
        aria-label="Sort best for your train"
        title="Tiles that play on your open trail first"
      >
        Best Train
      </button>
    </>
  );

  return (
    <DominoThemeProvider theme={dominoTheme}>
      <div
        className={styles.bridgeLayout}
        data-focus={immersiveLayout ? 'true' : 'false'}
        data-layout-tier={layoutTier}
        data-orientation={orientation}
        data-hand-strip-only={handStripOnly ? 'true' : undefined}
      >
      {round?.phase === 'drafting' && round.draftState ? (
        hideHandOnBridge && !isOnline && !handStripOnly ? (
          <section className={styles.draftStreamSafe} role="status">
            <p className={styles.draftStreamSafeEyebrow}>Tactical Requisition</p>
            <h2 className={styles.draftStreamSafeTitle}>
              {(names[round.draftState.currentDrafter] ?? 'Captain') +
                (round.draftState.currentDrafter === handOwnerId
                  ? ' — your pick'
                  : ' is drafting')}
            </h2>
            <p className={styles.draftStreamSafeBody}>
              Pack tiles stay off-camera. Confirm picks on the private hand
              window (Stream setup → Open private hand).
            </p>
            <div className={styles.draftStreamSafeActions}>
              {(onLeaveSetup || onLeave) && (
                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={
                    onLeaveSetup ? handleLeaveSetup : handleLeaveBridge
                  }
                >
                  {onLeaveSetup ? 'Return to setup' : 'Leave bridge'}
                </button>
              )}
            </div>
          </section>
        ) : (
          <DraftPhase
            draftState={round.draftState}
            myId={handOwnerId}
            names={names}
            tileBg={tileBg}
            maxPip={maxPip}
            onPickTile={(coordinate) => {
              const action: GameAction = {
                type: 'PICK_FROM_PACK',
                playerId: handOwnerId,
                coordinate,
              };
              void dispatch(action);
            }}
            onAbort={
              onLeaveSetup
                ? handleLeaveSetup
                : onLeave
                  ? handleLeaveBridge
                  : undefined
            }
            abortLabel={onLeaveSetup ? 'Return to setup' : 'Leave bridge'}
          />
        )
      ) : (
        <>
      <div
        ref={bridgeSurfaceRef}
        className={styles.bridge}
        data-yellow-alert={bridgeYellowAlert ? 'true' : undefined}
        data-red-alert={bridgeRedAlert ? 'true' : undefined}
        style={{
          ...(immersiveLayout
            ? {}
            : {
                width: `${TABLE_WIDTH}px`,
                height: `${TABLE_HEIGHT}px`,
              }),
          maxWidth: '100%',
          ['--warp-table' as string]: warpPalette.table,
          ['--warp-table-border' as string]: warpPalette.tableBorder,
          ['--warp-panel' as string]: warpPalette.panel,
          ['--warp-panel-border' as string]: warpPalette.panelBorder,
          ['--warp-text' as string]: warpPalette.text,
          ['--warp-text-muted' as string]: warpPalette.textMuted,
          ['--warp-accent' as string]: warpPalette.accent,
          ['--warp-accent-warm' as string]: warpPalette.accentWarm,
          ['--warp-spacedock-ring' as string]: warpPalette.spacedockRing,
          ['--warp-spacedock-glow' as string]: warpPalette.spacedockGlow,
          ['--warp-danger' as string]: warpPalette.danger,
        }}
      >
        {logMode !== 'off' && !handStripOnly && (
          <GameLogTicker
            lines={tickerLogLines}
            nameColors={gameLogNameColors}
            variant={logMode === 'commentator' ? 'commentator' : 'fleet'}
            fontScale={LOG_FONT_SCALE_FACTOR[logFontScale]}
          />
        )}

        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            {onLeave && (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={handleLeaveBridge}
              >
                Leave bridge
              </button>
            )}
            {showAdvisorControls && !teachingMode && (
              <button
                type="button"
                className={styles.controlBtn}
                data-coach-trigger="true"
                disabled={coachBusy}
                onClick={() => void askCoach()}
              >
                {coachBusy ? 'Advisor…' : 'Ask advisor'}
              </button>
            )}
            <button
              type="button"
              className={styles.controlBtn}
              data-coach={coachKind === 'draw'}
              disabled={!round || !isMyTurn || !helmControls.showDraw}
              onClick={() =>
                void dispatch({
                  type: 'DRAW_FROM_UNCHARTED',
                  playerId: handOwnerId,
                })
              }
            >
              Draw
            </button>
            {helmControls.showDesperationDig && (
              <button
                type="button"
                className={styles.controlBtn}
                data-module-eta="true"
                aria-label="Desperation Dig — draw up to three from Uncharted; chart the first playable; beacon stays open for two turns"
                disabled={!round || !isMyTurn}
                onClick={() =>
                  void dispatch({
                    type: 'DESPERATION_DIG',
                    playerId: handOwnerId,
                  })
                }
              >
                Desperation Dig
              </button>
            )}
            {spoolOptions.length > 0 && (
              <button
                type="button"
                className={styles.controlBtn}
                data-module-delta="true"
                disabled={!round || !isMyTurn}
                onClick={() => {
                  if (spoolOptions.length === 1) {
                    // Only one option, spool directly
                    void dispatch({
                      type: 'SPOOL_WARP_DRIVE',
                      playerId: handOwnerId,
                      route: spoolOptions[0].route,
                    });
                  } else {
                    // Multiple options, show picker
                    setShowSpoolPicker(true);
                  }
                }}
              >
                Engage warp drive
              </button>
            )}
            {canDeployBeacon && (
              <button
                type="button"
                className={styles.controlBtn}
                data-active={shieldsDown}
                data-coach={
                  coachKind === 'deploy-beacon' || coachKind === 'pass-turn'
                }
                onClick={() =>
                  void dispatch({
                    type: 'DEPLOY_DISTRESS_BEACON',
                    playerId: handOwnerId,
                  })
                }
              >
                Shields down
              </button>
            )}
            {canRaiseShieldsExplicitly && (
              <button
                type="button"
                className={styles.controlBtn}
                data-coach={coachKind === 'raise-shields'}
                onClick={() =>
                  void dispatch({
                    type: 'RAISE_SHIELDS',
                    playerId: handOwnerId,
                  })
                }
              >
                Shields up
              </button>
            )}
            {canPassAlert && (
              <button
                type="button"
                className={styles.controlBtn}
                data-coach={coachKind === 'pass-red-alert'}
                onClick={() =>
                  void dispatch({
                    type: 'PASS_RED_ALERT',
                    playerId: handOwnerId,
                  })
                }
              >
                Pass red alert
              </button>
            )}
            {canPass && !dropToImpulsePending && (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  void dispatch({
                    type: 'PASS_TURN',
                    playerId: handOwnerId,
                  })
                }
              >
                Pass
              </button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={pendingRoundImageShare !== null}
          title="Share board image"
          titleId="warp12-share-image-confirm-title"
          message="The board image is ready. Tap Share now to open the system share sheet (Save Image, Mail, Files…)."
          confirmLabel="Share now"
          cancelLabel="Cancel"
          onConfirm={() => void confirmPendingRoundImageShare()}
          onClose={() => setPendingRoundImageShare(null)}
        />

        <ConfirmDialog
          open={advisorConfirmOpen}
          title="Engage the tactical advisor?"
          titleId="warp12-advisor-confirm-title"
          message="This is a rated sector. Consulting the advisor makes the match assisted, and TEI will not change for any captain at the table. This cannot be undone for this sector."
          confirmLabel="Engage advisor"
          cancelLabel="Play unassisted"
          confirmTone="danger"
          onConfirm={confirmAdvisorEngage}
          onClose={cancelAdvisorEngage}
        />

        <div className={styles.topRightHud}>
          <ContinuumOrb game={game} names={names} />
        </div>

        {(() => {
          const sensorGrid = round?.sensorGrid ?? [];
          const onSensorSweep = isMyTurn
            ? (coordinate: Coordinate) =>
                void dispatch({
                  type: 'SENSOR_SWEEP',
                  playerId: handOwnerId,
                  coordinate,
                })
            : undefined;
          const continuumModalOpen =
            round?.continuumPendingInvoker === handOwnerId ||
            Boolean(round?.continuumWagerPending);
          // Full-screen / modal chrome — hide floating HUDs so they don't
          // sit beside (or under) the dialog and steal focus.
          const bridgeModalOpen =
            optionsOpen ||
            settingsOpen ||
            gameLogDialogOpen ||
            advisorReportDialogOpen ||
            rematchConfirmOpen ||
            leaveConfirmOpen ||
            setupConfirmOpen ||
            advisorConfirmOpen ||
            pendingRoundImageShare !== null ||
            showSpoolPicker ||
            continuumModalOpen ||
            (canShowRoundEndSummary && roundEndSummaryOpen) ||
            (game.phase === 'complete' && campaignCompleteOpen);
          const showSectorHud = showSectorStatusHud && !bridgeModalOpen;
          const showFleetHud = captainTailsHud && Boolean(round) && !bridgeModalOpen;
          const showSensorPanel =
            sensorGrid.length > 0 &&
            !bridgeModalOpen &&
            (compactLayout || !showSectorStatusHud);

          return (
            <div onPointerDownCapture={bumpFollowReturnCancel}>
              {showSectorHud &&
                (compactLayout ? (
                  <SectorStatusHolo
                    containerRef={bridgeSurfaceRef}
                    game={game}
                    round={round}
                    names={names}
                    activePlayerId={activePlayerId}
                    handOwnerId={handOwnerId}
                    isMyTurn={isMyTurn}
                    activePlayerIsAi={activePlayerIsAi}
                    isOnline={isOnline}
                    isOnlineHost={isOnlineHost}
                    syncPending={syncPending}
                    roundAwaitingScore={roundAwaitingScore}
                    roundEndSummaryOpen={roundEndSummaryOpen}
                    lastMessage={lastMessage}
                    spacedockValue={round?.spacedockValue ?? 12}
                    unchartedCount={round?.unchartedSectors.length ?? 0}
                    beaconCount={beaconCount}
                    openTrailCaptains={openBeacons}
                    redAlertActive={sectorRedAlertRow != null}
                    redAlertLabel={sectorRedAlertRow?.label ?? ''}
                    redAlertSummary={sectorRedAlertRow?.summary ?? ''}
                    redAlertTone={sectorRedAlertRow?.tone ?? 'alert'}
                    longestTrailCaptains={longestTrailData.captains}
                    longestTrailLength={longestTrailData.length}
                    hazardMarkerHolder={hazardMarkerHolder}
                  />
                ) : (
                  <SectorStatusHud
                    containerRef={bridgeSurfaceRef}
                    game={game}
                    round={round}
                    names={names}
                    activePlayerId={activePlayerId}
                    handOwnerId={handOwnerId}
                    viewerId={handOwnerId}
                    isMyTurn={isMyTurn}
                    activePlayerIsAi={activePlayerIsAi}
                    isOnline={isOnline}
                    isOnlineHost={isOnlineHost}
                    syncPending={syncPending}
                    roundAwaitingScore={roundAwaitingScore}
                    roundEndSummaryOpen={roundEndSummaryOpen}
                    lastMessage={lastMessage}
                    spacedockValue={round?.spacedockValue ?? 12}
                    unchartedCount={round?.unchartedSectors.length ?? 0}
                    sensorGrid={sensorGrid}
                    tileBg={tileBg}
                    maxPip={maxPip}
                    onSensorSweep={onSensorSweep}
                    beaconCount={beaconCount}
                    openTrailCaptains={openBeacons}
                    shieldsDown={shieldsDown}
                    canRaiseShields={canRaiseShields}
                    manualShieldControl={game.houseRules.manualShieldControl}
                    fractureActive={Boolean(fracture?.active)}
                    fractureStabilizers={fracture?.stabilizers.length ?? 0}
                    redAlertActive={sectorRedAlertRow != null}
                    redAlertLabel={sectorRedAlertRow?.label ?? ''}
                    redAlertSummary={sectorRedAlertRow?.summary ?? ''}
                    redAlertTone={sectorRedAlertRow?.tone ?? 'alert'}
                    longestTrailCaptains={longestTrailData.captains}
                    longestTrailLength={longestTrailData.length}
                    hazardMarkerHolder={hazardMarkerHolder}
                    doubleDownNotice={doubleDownNotice}
                  />
                ))}
              {showSensorPanel && (
                <SensorGridHud
                  containerRef={bridgeSurfaceRef}
                  sensorGrid={sensorGrid}
                  tileBg={tileBg}
                  maxPip={maxPip}
                  compact={compactLayout}
                  onSensorSweep={onSensorSweep}
                />
              )}
              {showFleetHud &&
                round &&
                (compactLayout ? (
                  <EdgeTailRail
                    round={round}
                    trailSpokes={trailSpokes}
                    activePlayerId={activePlayerId}
                    coordinate={captainTailsCoordinate}
                    tacticalClassAbbrevByCaptain={captainTacticalClassAbbrevById}
                    tacticalClassLabelByCaptain={captainTacticalClassLabelById}
                  />
                ) : (
                  <CaptainTailsHud
                    containerRef={bridgeSurfaceRef}
                    round={round}
                    trailSpokes={trailSpokes}
                    activePlayerId={activePlayerId}
                    display={captainTailsDisplay}
                    coordinate={captainTailsCoordinate}
                    showTrailLength={captainTailsTrailLength}
                    tileBg={tileBg}
                    tacticalClassAbbrevByCaptain={captainTacticalClassAbbrevById}
                    tacticalClassLabelByCaptain={captainTacticalClassLabelById}
                    teiGradeByCaptain={teiGradeByCaptain}
                    maxPip={maxPip}
                    moduleDeltaEnabled={
                      game.modules.warpDriveSpool?.enabled ?? false
                    }
                  />
                ))}
            </div>
          );
        })()}

        {coachSuggestion && !advisorSuppressedForRated && (
          <FloatingCoachPanel
            containerRef={bridgeSurfaceRef}
            suggestion={coachSuggestion.action}
            reasons={coachSuggestion.reasons}
            names={names}
            suggestionFormat={{
              allStopEcho: round?.continuumEffects?.allStopEcho === true,
            }}
            busy={coachBusy}
            pinned={teachingMode}
            onApply={applyCoachHighlight}
            onDismiss={() => setCoachSuggestion(null)}
          />
        )}

        {!handStripOnly && (
        <TableViewport
          tableWidth={TABLE_WIDTH}
          tableHeight={TABLE_HEIGHT}
          contentRef={tableContentRef}
          autoFollowAction={autoFollowAction}
          autoFollowReturn={autoFollowReturn}
          autoFollowReturnDelayMs={autoFollowReturnDelayMs}
          followFocusNormX={followFocusNormX}
          followFocusNormY={followFocusNormY}
          setFocusMode={setFocusMode}
          onSetFocusModeChange={setSetFocusMode}
          onFollowFocusNormChange={({ x, y }) =>
            patchTablePrefs({
              followFocusNormX: sanitizeFollowFocusNorm(x),
              followFocusNormY: sanitizeFollowFocusNorm(y),
            })
          }
          actionFocus={actionFocus}
          followReturnCancelSignal={followReturnCancelSignal}
          compactLayout={compactLayout}
          focusControl={
            compactLayout
              ? undefined
              : {
                  active: bridgeFocus,
                  onToggle: toggleFocus,
                }
          }
          soundControl={{
            muted: soundsMuted,
            onToggle: toggleSoundsMuted,
          }}
          logControl={{
            mode: logMode,
            onCycle: handleLogControl,
          }}
          logDialogControl={{
            onOpen: () => setGameLogDialogOpen(true),
          }}
          hostModControl={hostModControl}
          setFollowFocusControl={{
            active: setFocusMode,
            enabled: autoFollowAction,
            onToggle: () => setSetFocusMode((current) => !current),
          }}
          commsControl={commsControl}
        >
          <div
            className={styles.hubOverlay}
            style={{ left: centerX, top: centerY }}
            aria-hidden
          />

          {round && (
            <>
              <TrailSpokeIndicators
                centerX={centerX}
                centerY={centerY}
                hubRadius={hubRadius}
                startDistance={hub.startDistance}
                hubSlots={HUB_SLOTS}
                spokes={trailSpokes}
                coachByCaptain={coachByCaptain}
                tacticalClassLabelByCaptain={captainTacticalClassLabelById}
              />
              <DominoHub
              playerCount={HUB_SLOTS}
              centerX={centerX}
              centerY={centerY}
              radius={hubRadius}
              engineValue={round.spacedockValue}
              maxPips={maxPip}
              trains={trains}
              layoutStyle={layoutStyle}
              pipColors={WARP_PIP_COLORS}
            />
            </>
          )}
        </TableViewport>
        )}

        {canShowRoundEndSummary && round && roundEndSummaryOpen && !portraitSummaryNudge && (
          <div
            className={styles.roundEndOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="warp12-round-end-title"
          >
            <div className={styles.roundEndCard}>
              <p className={styles.roundEndEyebrow}>Round {round.roundNumber}</p>
              <h3 id="warp12-round-end-title" className={styles.roundEndTitle}>
                {roundEndTitle(game, round, names)}
              </h3>
              <p className={styles.roundEndBody}>
                {roundEndHeadline(game, round, names)}
              </p>
              {game.objective === 'points' &&
                (roundPenaltySummary.length === 0 ? (
                  <p className={styles.roundEndBody}>
                    No points held this round.
                  </p>
                ) : (
                  <table className={styles.roundEndTable}>
                    <thead>
                      <tr>
                        <th aria-label="Round markers" />
                        <th scope="col" className={styles.roundEndCaptain}>
                          Captain
                        </th>
                        <th scope="col">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundPenaltySummary.map((entry) => {
                        const wonRound =
                          roundOutcome?.roundWinnerIds.includes(entry.id) ??
                          false;
                        const wentOut = roundOutcome?.wentOutId === entry.id;
                        const pointsLabel = entry.pointsPending
                          ? '…'
                          : formatSignedPoints(entry.points);
                        const pointsAriaLabel = entry.pointsPending
                          ? 'Points pending — revealing hand'
                          : undefined;
                        const breakdown = entry.pointsPending
                          ? undefined
                          : roundPointBreakdowns.get(entry.id);
                        const isExpanded = expandedBreakdownId === entry.id;
                        const detailId = `round-breakdown-${entry.id}`;
                        return (
                          <Fragment key={entry.id}>
                            <tr data-expanded={isExpanded}>
                              <td className={styles.roundEndMarker}>
                                {wonRound && (
                                  <PortalTip text="Round winner">🏆</PortalTip>
                                )}
                                {wentOut && (
                                  <PortalTip text="Emptied hand">✋</PortalTip>
                                )}
                              </td>
                              <td className={styles.roundEndCaptain}>
                                {entry.name}
                                {isAiCaptainId(entry.id) ? ' · AI' : ''}
                              </td>
                              <td
                                className={styles.roundEndPointsCell}
                                aria-label={pointsAriaLabel}
                              >
                                {breakdown ? (
                                  <ScoreBreakdownButton
                                    pointsLabel={pointsLabel}
                                    isExpanded={isExpanded}
                                    detailId={detailId}
                                    onToggle={() =>
                                      setExpandedBreakdownId(
                                        isExpanded ? null : entry.id
                                      )
                                    }
                                  />
                                ) : (
                                  pointsLabel
                                )}
                              </td>
                            </tr>
                            {breakdown && isExpanded && (
                              <tr className={styles.roundEndDetailRow}>
                                <td colSpan={3} id={detailId}>
                                  <RoundPointReceipt
                                    breakdown={breakdown}
                                    maxPip={maxPip}
                                    tileSurface={tileSurface}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ))}
              <RoundImageActions
                className={styles.roundEndShareActions}
                systemShareAvailable={systemShareAvailable}
                roundImageBusy={roundImageBusy}
                onRoundImage={handleRoundImage}
                onOpenRoundLog={handleOpenRoundLog}
                onDownloadRoundLogJson={handleDownloadRoundLogJson}
                roundLogBusy={roundLogDownloadBusy}
              />
              <div className={styles.roundEndActions}>
                {canOpenAdvisorReport && (
                  <button
                    type="button"
                    className={styles.roundEndBtnSecondary}
                    onClick={handleOpenAdvisorReport}
                  >
                    Advisor report
                  </button>
                )}
                <button
                  type="button"
                  className={styles.roundEndBtnSecondary}
                  onClick={() => {
                    setRoundEndSummaryOpen(false);
                    if (canReviewFinalRound) {
                      setCampaignCompleteOpen(false);
                    }
                  }}
                >
                  View board
                </button>
                {roundAwaitingScore ? (
                  <button
                    type="button"
                    className={styles.roundEndBtn}
                    onClick={scoreCurrentRound}
                  >
                    {roundEndContinueLabel(game, round)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.roundEndBtn}
                    onClick={() => {
                      setRoundEndSummaryOpen(false);
                      setCampaignCompleteOpen(true);
                    }}
                  >
                    Match summary
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {roundAwaitingScore && round && !roundEndSummaryOpen && (
          <div className={styles.roundEndDock} role="status">
            <div className={styles.roundEndDockText}>
              <strong>{roundEndTitle(game, round, names)}</strong>
              <span>Pan and zoom to review the final layout.</span>
            </div>
            <RoundImageActions
              className={styles.roundEndShareActions}
              systemShareAvailable={systemShareAvailable}
              roundImageBusy={roundImageBusy}
              onRoundImage={handleRoundImage}
              onOpenRoundLog={handleOpenRoundLog}
              onDownloadRoundLogJson={handleDownloadRoundLogJson}
              roundLogBusy={roundLogDownloadBusy}
            />
            <div className={styles.roundEndActions}>
              {canOpenAdvisorReport && (
                <button
                  type="button"
                  className={styles.roundEndBtnSecondary}
                  onClick={handleOpenAdvisorReport}
                >
                  Advisor report
                </button>
              )}
              <button
                type="button"
                className={styles.roundEndBtnSecondary}
                onClick={() => setRoundEndSummaryOpen(true)}
              >
                Summary
              </button>
              <button
                type="button"
                className={styles.roundEndBtn}
                onClick={scoreCurrentRound}
              >
                {roundEndContinueLabel(game, round)}
              </button>
            </div>
          </div>
        )}

        <GameLogDialog
          open={gameLogDialogOpen}
          onClose={() => setGameLogDialogOpen(false)}
          title={
            round
              ? `Round ${round.roundNumber} log`
              : 'Sector log'
          }
          lines={dialogLogLines}
          nameColors={gameLogNameColors}
          downloadFilename={roundLogFilename}
          downloadJsonFilename={roundLogJsonFilename}
          onDownload={handleDownloadRoundLog}
          onDownloadJson={handleDownloadRoundLogJson}
          downloadBusy={roundLogDownloadBusy}
          scope={dialogLogScope}
          onScopeChange={handleLogScopeChange}
          onDownloadHighlights={handleDownloadHighlights}
          onOpenStreamOverlay={handleOpenStreamOverlay}
          onOpenStreamSetup={() => setStreamSetupOpen(true)}
          streamOverlayUrl={streamOverlayUrl}
          fontScale={LOG_FONT_SCALE_FACTOR[logFontScale]}
        />

        <StreamSetupDialog
          open={streamSetupOpen}
          onClose={() => setStreamSetupOpen(false)}
          sectorCode={sectorCode}
          hideHandOnBridge={hideHandOnBridge}
          onHideHandOnBridgeChange={(next) =>
            patchTablePrefs({ hideHandOnBridge: next })
          }
          couchMode={couchMode}
          onCouchModeChange={
            isLocalPassAndPlay
              ? (next) => patchTablePrefs({ couchMode: next })
              : undefined
          }
          onEnableStreamSafe={handleEnableStreamSafe}
          onEnableCouchMode={
            isLocalPassAndPlay ? handleEnableCouchMode : undefined
          }
          onOpenCommentaryOverlay={handleOpenStreamOverlay}
          onOpenPrivateHand={handleOpenPrivateHand}
          onOpenCouchHands={
            isLocalPassAndPlay && companionHumanSeats.length > 0
              ? handleOpenCouchHands
              : undefined
          }
          couchSeats={isLocalPassAndPlay ? companionHumanSeats : undefined}
          isOnline={isOnline}
        />

        <AdvisorReportDialog
          open={advisorReportDialogOpen}
          onClose={() => setAdvisorReportDialogOpen(false)}
          report={advisorReport}
          names={names}
          nameColors={gameLogNameColors}
          downloadFilename={advisorReportFilename}
          includeAllCaptains={advisorIncludeAllCaptains}
          onIncludeAllCaptainsChange={handleAdvisorIncludeAllChange}
          opponentLabel={advisorOpponentLabel}
        />

        {handoffPending && hideHandOnBridge ? (
          <p className={styles.feedback} role="status">
            Pass the bridge to {names[activePlayerId] ?? 'the next captain'} —
            confirm <strong>Ready at helm</strong> on the private hand window
            (off-camera).
          </p>
        ) : null}

        {handoffPending && !hideHandOnBridge ? (
          <div
            className={styles.roundEndOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="warp12-handoff-title"
          >
            <div className={styles.roundEndCard}>
              <p className={styles.roundEndEyebrow}>Pass the bridge</p>
              <h3 id="warp12-handoff-title" className={styles.roundEndTitle}>
                {names[activePlayerId] ?? 'Captain'} at helm
              </h3>
              <p className={styles.roundEndBody}>
                Hand the device to {names[activePlayerId] ?? 'the active captain'}.
                Their coordinates stay hidden until they confirm ready.
              </p>
              <div className={styles.roundEndActions}>
                <button
                  type="button"
                  className={styles.roundEndBtn}
                  onClick={confirmHandoff}
                >
                  Ready at helm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {game.goOutOvertimePending === true &&
          (isOnlineHost || !isOnline) && (
            <div
              className={styles.roundEndOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="warp12-overtime-title"
            >
              <div className={styles.roundEndCard}>
                <p className={styles.roundEndEyebrow}>Campaign tied</p>
                <h3 id="warp12-overtime-title" className={styles.roundEndTitle}>
                  Overtime?
                </h3>
                <p className={styles.roundEndBody}>
                  The go-out campaign ended with equal wins. Play overtime rounds
                  until the tie breaks, or end the sector tied.
                </p>
                <div className={styles.roundEndActions}>
                  <button
                    type="button"
                    className={styles.roundEndBtn}
                    onClick={() =>
                      void dispatch({
                        type: 'RESOLVE_GO_OUT_OVERTIME',
                        playerId: viewerId ?? humanId,
                        accept: true,
                      })
                    }
                  >
                    Accept overtime
                  </button>
                  <button
                    type="button"
                    className={styles.roundEndBtnSecondary}
                    onClick={() =>
                      void dispatch({
                        type: 'RESOLVE_GO_OUT_OVERTIME',
                        playerId: viewerId ?? humanId,
                        accept: false,
                      })
                    }
                  >
                    End tied
                  </button>
                </div>
              </div>
            </div>
          )}

        <CampaignCompleteOverlay
          open={
            game.phase === 'complete' &&
            campaignCompleteOpen &&
            !roundEndSummaryOpen &&
            !portraitSummaryNudge
          }
          game={game}
          names={names}
          humanId={isVsAi ? humanId : viewerId}
          humanName={isVsAi ? names[humanId] : names[viewerId ?? '']}
          matchReport={matchReport}
          matchReportPending={matchReportPending}
          matchReportNotice={matchReportNotice}
          ratedMatchCheckInUrl={ratedMatchCheckInUrl()}
          pointsHistory={campaignPointsHistory}
          handCounts={isOnline ? handCounts : undefined}
          performance={campaignPerformance}
          canDownloadAdvisorReport={campaignRoundCount > 0}
          onDownloadAdvisorReport={downloadCampaignAdvisorReport}
          pilotIconSrc={pilotIconSrc}
          onRematch={onRematch}
          onLeaveSetup={onLeaveSetup}
          onClose={() => {
            setCampaignCompleteOpen(false);
            setRoundEndSummaryOpen(false);
          }}
        />

        {game.phase === 'complete' &&
          !campaignCompleteOpen &&
          !roundEndSummaryOpen &&
          !portraitSummaryNudge && (
          <div className={styles.roundEndDock} role="status">
            <div className={styles.roundEndDockText}>
              <button
                type="button"
                className={styles.splashEggTrigger}
                onClick={onCampaignCompleteEgg}
                aria-label={
                  game.objective === 'go-out'
                    ? 'Sector complete'
                    : 'Campaign complete'
                }
              >
                {game.objective === 'go-out'
                  ? 'Sector complete'
                  : 'Campaign complete'}
              </button>
              <span>Pan and zoom to review the final board.</span>
            </div>
            <div className={styles.roundEndActions}>
              {canReviewFinalRound && (
                <button
                  type="button"
                  className={styles.roundEndBtnSecondary}
                  onClick={() => {
                    setCampaignCompleteOpen(false);
                    setRoundEndSummaryOpen(true);
                  }}
                >
                  Round summary
                </button>
              )}
              <button
                type="button"
                className={styles.roundEndBtnSecondary}
                onClick={() => {
                  setRoundEndSummaryOpen(false);
                  setCampaignCompleteOpen(true);
                }}
              >
                Match summary
              </button>
              {onRematch && (
                <button
                  type="button"
                  className={styles.roundEndBtn}
                  onClick={onRematch}
                >
                  Rematch
                </button>
              )}
            </div>
          </div>
        )}

        <ContinuumFlashPanel
          game={game}
          playerId={handOwnerId}
          names={names}
          onInvoke={(action) => void dispatch(action)}
        />
        <ContinuumWagerPanel
          game={game}
          playerId={handOwnerId}
          onResolve={(action) => void dispatch(action)}
        />
        <HandExchangePanel
          game={game}
          playerId={handOwnerId}
          tileBg={tileBg}
          onResolve={(action) => void dispatch(action)}
        />
      </div>

      <section className={styles.commandPanel} data-my-turn={isMyTurn}>
        <div className={styles.commandPanelBody}>
        <header className={styles.commandHeader}>
          {compactLayout ? (
            <div className={styles.commandHeaderStart}>
              <h2 className={styles.commandTitle}>
                {game.phase === 'complete'
                  ? `${sectorWinnerName(game, names)} wins the sector`
                  : roundAwaitingScore && round
                    ? round.roundBlocked
                      ? `Round ${round.roundNumber} blocked`
                      : `${names[round.roundWinnerId ?? ''] ?? 'Captain'} wins round ${round.roundNumber}`
                    : `${names[handOwnerId] ?? 'Captain'}'s coordinates`}
              </h2>
              {showOwnHand ? (
                <div className={styles.handSortRow} aria-label="Sort hand">
                  {handSortButtons}
                </div>
              ) : null}
            </div>
          ) : (
            <h2 className={styles.commandTitle}>
              {game.phase === 'complete'
                ? `${sectorWinnerName(game, names)} wins the sector`
                : roundAwaitingScore && round
                  ? round.roundBlocked
                    ? `Round ${round.roundNumber} blocked`
                    : `${names[round.roundWinnerId ?? ''] ?? 'Captain'} wins round ${round.roundNumber}`
                  : `${names[handOwnerId] ?? 'Captain'}'s coordinates`}
            </h2>
          )}
          <span className={styles.handCount}>
            {showOwnHand
              ? `${visibleHand.length} in hand`
              : 'Stand by'}
          </span>
        </header>

        {sectorPaused && (
          <p className={styles.feedback} role="status">
            ⏸ Sector paused
            {pauseReason ? ` — ${pauseReason}` : ''}. Helm controls are locked
            until the host resumes.
          </p>
        )}

        {sectorAdvisorVoided && (
          <p className={styles.feedback} role="status">
            ⚠ Sector unrated — the tactical advisor was engaged. TEI will not
            change for any captain.
          </p>
        )}

        {devConsoleUnlocked && (
          <p className={styles.feedback} role="status">
            ⚠ CHEATER — bridge console unlocked
            {devConsoleTeiVoid
              ? '. TEI void for this sector.'
              : ' (admin). TEI may still update if the server confirms your claim.'}
          </p>
        )}

        {(roundAwaitingScore ||
          lastMessage ||
          (syncPending && isMyTurn)) && (
          <p className={styles.feedback} role="status">
            {roundAwaitingScore
              ? roundEndSummaryOpen
                ? 'Review the summary, view the board, then continue when ready.'
                : 'Review the final board — open Summary or continue when ready.'
              : syncPending && isMyTurn
                ? 'Transmitting to subspace…'
                : lastMessage}
          </p>
        )}

        {selectedTile && movesForSelected.length >= 1 && (
          <div className={styles.routePicker}>
            <p className={styles.routePrompt}>
              {movesForSelected.length > 1 ? 'Choose route:' : 'Play here, or flip?'}
            </p>
            {movesForSelected.map((move) => (
              <button
                key={routeKey(move.route)}
                type="button"
                className={styles.routeBtn}
                data-coach={
                  coachChart !== null &&
                  coordinatesEqual(coachChart.coordinate, move.coordinate) &&
                  routesEqual(coachChart.route, move.route)
                }
                onClick={() => playMove(move)}
              >
                {movesForSelected.length === 1
                  ? `Play on ${routeLabel(move.route, names)}`
                  : routeLabel(move.route, names)}
              </button>
            ))}
            <button
              type="button"
              className={styles.routeBtn}
              onClick={() => {
                toggleFlip(coordinateKey(selectedTile));
                setSelectedTile(null);
              }}
            >
              Flip
            </button>
            <button
              type="button"
              className={styles.routeCancel}
              onClick={() => setSelectedTile(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {showSpoolPicker && spoolOptions.length > 0 && (
          <div className={styles.routePicker}>
            <p className={styles.routePrompt}>Engage warp drive on:</p>
            {spoolOptions.map((option) => (
              <button
                key={routeKey(option.route)}
                type="button"
                className={styles.routeBtn}
                onClick={() => {
                  void dispatch({
                    type: 'SPOOL_WARP_DRIVE',
                    playerId: handOwnerId,
                    route: option.route,
                  });
                  setShowSpoolPicker(false);
                }}
              >
                {routeLabel(option.route, names)}
              </button>
            ))}
            <button
              type="button"
              className={styles.routeCancel}
              onClick={() => setShowSpoolPicker(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {!showOwnHand && hideHandOnBridge && !isOnline ? (
          <p className={styles.feedback} role="status">
            Hand hidden for stream — play from the private hand companion window
            (Stream setup → Open private hand).
          </p>
        ) : null}

        {showOwnHand ? (
          <div className={styles.handSection}>
            {!compactLayout && (
              <div className={styles.handToolbar}>
                <span className={styles.handHint}>
                  {isMyTurn
                    ? 'Drag to arrange · Click to flip · Shift/Option-click playable tiles'
                    : 'Drag to arrange · Click to flip — stand by for helm'}
                </span>
                {handSortButtons}
              </div>
            )}
            <div className={styles.hand} data-scrollable={compactLayout ? 'true' : undefined}>
              {orderedHand.map((coordinate) => {
                const key = coordinateKey(coordinate);
                const flipped = isFlipped(key);
                const { top, bottom } = displayCoordinateValues(coordinate, flipped);
                const playable = legalMoves.some((move) =>
                  coordinatesEqual(move.coordinate, coordinate)
                );
                const selected =
                  selectedTile !== null &&
                  coordinatesEqual(selectedTile, coordinate);

                const coachTile =
                  coachChart !== null &&
                  coordinatesEqual(coachChart.coordinate, coordinate);

                return (
                  <button
                    key={key}
                    type="button"
                    className={styles.handTile}
                    data-hand-tile-key={key}
                    data-playable={playable}
                    data-selected={selected}
                    data-coach={coachTile}
                    data-flipped={flipped}
                    data-dragging={activeDraggingKey === key}
                    data-drop-target={activeDropTargetKey === key}
                    onPointerDown={(event) => onHandTilePointerDown(key, event)}
                    onPointerMove={onHandTilePointerMove}
                    onPointerUp={(event) => onHandTilePointerUp(key, event)}
                    onPointerCancel={onHandTilePointerCancel}
                    onClick={(event) =>
                      onHandTileClick(coordinate, key, playable, event)
                    }
                    aria-label={`Coordinate ${top}-${bottom}`}
                  >
                    <DominoTile
                      maxPips={maxPip}
                      value1={top}
                      value2={bottom}
                      width={compactLayout ? HAND_TILE_WIDTH_COMPACT : HAND_TILE_WIDTH}
                      height={compactLayout ? HAND_TILE_HEIGHT_COMPACT : HAND_TILE_HEIGHT}
                      backgroundColor={tileSurface.fill}
                      borderColor={tileSurface.border}
                      pipColors={WARP_PIP_COLORS}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        </div>

        {(dropToImpulsePending && isMyTurn && (!isOnline || !syncPending)) ||
        (canCatchDropToImpulse && (!isOnline || !syncPending)) ? (
          <div className={styles.commandActions}>
        {dropToImpulsePending && isMyTurn && (!isOnline || !syncPending) && (
          <>
            <button
              type="button"
              className={styles.allStopBtn}
              data-coach={coachKind === 'drop-to-impulse'}
              onClick={() =>
                void dispatch({
                  type: 'DROP_TO_IMPULSE',
                  playerId: handOwnerId,
                })
              }
            >
              Drop to Impulse!
            </button>
            {canPass && (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  void dispatch({
                    type: 'PASS_TURN',
                    playerId: handOwnerId,
                  })
                }
              >
                Pass helm (skip announce)
              </button>
            )}
          </>
        )}

        {canCatchDropToImpulse && (!isOnline || !syncPending) && (
          <button
            type="button"
            className={styles.controlBtn}
            onClick={() =>
              void dispatch({
                type: 'CATCH_DROP_TO_IMPULSE',
                challengerId: handOwnerId,
                targetPlayerId: dropToImpulseCatchTarget!,
              })
            }
          >
            Catch Drop to Impulse!
          </button>
        )}
          </div>
        ) : null}

        {game.phase === 'complete' && (
          <div className={styles.roundEnd}>
            <p>
              {game.objective === 'go-out'
                ? 'Sector complete — first captain out takes the victory.'
                : 'Campaign complete — lowest points total wins.'}
            </p>
            {isOnline && isOnlineHost && onHostResetSector && (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() => onHostResetSector()}
              >
                New sector (same crew)
              </button>
            )}
          </div>
        )}

        {game.objective === 'points' ? (
          <>
            <p className={styles.scoreLegend}>
              Campaign totals are public. In-hand pip count is shown only for
              your hand — opponents&apos; tiles stay hidden until a round scores.
            </p>
            <ul
              className={styles.captainScores}
              aria-label="Campaign points"
            >
              {game.captains.map((captain) => (
                <li key={captain.id}>
                  <span>
                    {captain.displayName}
                    {isAiCaptainId(captain.id) ? ' · AI' : ''}
                    {coachByCaptain[captain.id] && (
                      <span
                        className={spokeStyles.captainCoachTag}
                        data-flash={coachByCaptain[captain.id]?.flash}
                        title="Tactical advisor engaged this round"
                        aria-label="Tactical advisor"
                      >
                        {' '}
                        A
                      </span>
                    )}
                  </span>
                  <span>
                    {formatPointsScoreLine(
                      captain.id,
                      captain.pointsScore,
                      round,
                      round?.hands[captain.id],
                      {
                        handOwnerId,
                        salamanderEnabled:
                          game.modules.salamanderPenalty.enabled,
                        doubleZeroScore: game.houseRules.doubleZeroScore,
                        maxPip: game.maxPip ?? round?.maxPip ?? 12,
                      }
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          round && (
            <ul className={styles.captainScores} aria-label="Hand counts">
              {round.turnOrder.map((id) => (
                <li key={id}>
                  <span>
                    {names[id]}
                    {isAiCaptainId(id) ? ' · AI' : ''}
                    {coachByCaptain[id] && (
                      <span
                        className={spokeStyles.captainCoachTag}
                        data-flash={coachByCaptain[id]?.flash}
                        title="Tactical advisor engaged this round"
                        aria-label="Tactical advisor"
                      >
                        {' '}
                        A
                      </span>
                    )}
                  </span>
                  <span className={captainAccessClass(spokeByCaptain.get(id))}>
                    {captainAccessLabel(spokeByCaptain.get(id))}
                  </span>
                  <span>{handCounts[id] ?? round.hands[id]?.length ?? 0} coords</span>
                </li>
              ))}
              <li>
                <span>Neutral zone</span>
                <span className={spokeStyles.captainNeutral}>Open</span>
                <span>{round.table.neutralZone.tiles.length} charted</span>
              </li>
            </ul>
          )
        )}
      </section>
      </>
      )}

      {/* Header actions (Setup / Options / Rules / Rematch / Leave) must stay
          reachable during Module Epsilon drafting — that UI replaces the bridge. */}
      <SectorSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        game={game}
      />

      <TableOptionsDialog
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        layoutStyle={layoutStyle}
        onLayoutStyleChange={(next) => patchTablePrefs({ layoutStyle: next })}
        tileBg={tileBg}
        onTileBgChange={(next) => patchTablePrefs({ tileBg: next })}
        holographicTiles={holographicTiles}
        onHolographicTilesChange={(next) =>
          patchTablePrefs({ holographicTiles: next })
        }
        pipPreset={pipPreset}
        onPipPresetChange={(next) => patchTablePrefs({ pipPreset: next })}
        teachingMode={teachingMode}
        onTeachingModeChange={(next) => patchTablePrefs({ teachingMode: next })}
        advisorAvailable={!advisorSuppressedForRated}
        advisorNeuralAvailable={neuralAdvisorOk}
        autoFollowAction={autoFollowAction}
        onAutoFollowActionChange={(next) =>
          patchTablePrefs({
            autoFollowAction: next,
            ...(next ? {} : { autoFollowReturn: false }),
          })
        }
        autoFollowReturn={autoFollowReturn}
        onAutoFollowReturnChange={(next) =>
          patchTablePrefs({ autoFollowReturn: next })
        }
        autoFollowReturnDelayMs={autoFollowReturnDelayMs}
        onAutoFollowReturnDelayMsChange={(next) =>
          patchTablePrefs({
            autoFollowReturnDelayMs: sanitizeAutoFollowReturnDelayMs(next),
          })
        }
        sectorStatusHud={showSectorStatusHud}
        onSectorStatusHudChange={(next) =>
          patchTablePrefs({ sectorStatusHud: next })
        }
        captainTailsHud={captainTailsHud}
        onCaptainTailsHudChange={(next) =>
          patchTablePrefs({ captainTailsHud: next })
        }
        captainTailsDisplay={captainTailsDisplay}
        onCaptainTailsDisplayChange={(next) =>
          patchTablePrefs({ captainTailsDisplay: next })
        }
        captainTailsCoordinate={captainTailsCoordinate}
        onCaptainTailsCoordinateChange={(next) =>
          patchTablePrefs({ captainTailsCoordinate: next })
        }
        captainTailsTrailLength={captainTailsTrailLength}
        onCaptainTailsTrailLengthChange={(next) =>
          patchTablePrefs({ captainTailsTrailLength: next })
        }
        compactLayout={compactLayout}
        bridgeSoundsEnabled={bridgeSoundsEnabled}
        onBridgeSoundsEnabledChange={(next) =>
          patchTablePrefs({ bridgeSoundsEnabled: next })
        }
        turnBeepsEnabled={turnBeepsEnabled}
        onTurnBeepsEnabledChange={(next) =>
          patchTablePrefs({ turnBeepsEnabled: next })
        }
        commentatorShowElapsed={commentatorShowElapsed}
        onCommentatorShowElapsedChange={(next) =>
          patchTablePrefs({ commentatorShowElapsed: next })
        }
        logFontScale={logFontScale}
        onLogFontScaleChange={(next) =>
          patchTablePrefs({ logFontScale: next })
        }
        audibleCommentary={audibleCommentary}
        onAudibleCommentaryChange={(next) =>
          patchTablePrefs({ audibleCommentary: next })
        }
        showDebugExport={showDebugExport}
        debugExportBusy={debugBusy}
        onExportDebug={handleExportDebug}
        recordMatchDebug={matchDebugRecording.enabled}
        onRecordMatchDebugChange={(next) => {
          patchTablePrefs({ recordMatchDebug: next });
          setMatchDebugRecording((current) =>
            next
              ? enableMatchDebugRecording(current)
              : disableMatchDebugRecording()
          );
        }}
        recordMatchDebugActionCount={matchDebugRecording.actionLog.length}
        showShareRound={canShareRound}
        systemShareAvailable={systemShareAvailable}
        roundImageBusy={roundImageBusy}
        onRoundImage={handleRoundImage}
        onOpenRoundLog={canShareRound ? handleOpenRoundLog : undefined}
        onDownloadRoundLogJson={
          canShareRound ? handleDownloadRoundLogJson : undefined
        }
        roundLogBusy={roundLogDownloadBusy}
        sectorInvite={
          isOnline && sectorCode
            ? {
                code: sectorCode,
                allowSpectate,
                rated: sectorRated,
              }
            : null
        }
      />

      <ConfirmDialog
        open={rematchConfirmOpen}
        title="Start rematch?"
        titleId="warp12-rematch-confirm-title"
        message="The current sector will be discarded and a new game will be dealt with the same settings."
        confirmLabel="Start rematch"
        cancelLabel="Keep playing"
        confirmTone="danger"
        onConfirm={confirmRematch}
        onClose={() => setRematchConfirmOpen(false)}
      />

      <ConfirmDialog
        open={setupConfirmOpen}
        title="Return to setup?"
        titleId="warp12-setup-confirm-title"
        message="You will leave the current sector and any progress in this game will be lost."
        confirmLabel="Return to setup"
        cancelLabel="Keep playing"
        confirmTone="danger"
        onConfirm={confirmLeaveSetup}
        onClose={() => setSetupConfirmOpen(false)}
      />

      <HostLeaveSectorDialog
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onReturnToWaitingRoom={confirmReturnToWaitingRoom}
        onDissolveSector={confirmDissolveSector}
        onLeaveWithAi={
          isOnline && isOnlineHost && onHostLeaveWithAi
            ? confirmLeaveWithAi
            : undefined
        }
        captains={onlineCaptains}
        hostId={viewerId ?? ''}
        busy={hostLeaveBusy}
      />

      <PortraitLockOverlay
        active={portraitSummaryNudge}
        title="Rotate for the summary"
        body="Turn your device upright to review round results and continue."
      />
    </div>
    </DominoThemeProvider>
  );
}

function captainAccessClass(state: TrailAccessState | undefined): string {
  switch (state) {
    case 'open':
      return spokeStyles.captainOpen;
    case 'red-alert':
      return spokeStyles.captainAlert;
    case 'shields':
    default:
      return spokeStyles.captainShields;
  }
}

function captainAccessLabel(state: TrailAccessState | undefined): string {
  switch (state) {
    case 'open':
      return 'Trail open';
    case 'red-alert':
      return 'Red alert';
    case 'shields':
    default:
      return 'Shields up';
  }
}

function routeKey(route: ChartRoute): string {
  switch (route.kind) {
    case 'warp-trail':
      return `warp-${route.playerId}`;
    case 'neutral-zone':
      return 'neutral';
    case 'fracture-stabilizer':
      return 'fracture';
    case 'red-alert-cover':
      return `cover-${route.trailPlayerId}`;
  }
}

function routesEqual(a: ChartRoute, b: ChartRoute): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case 'warp-trail':
      return b.kind === 'warp-trail' && a.playerId === b.playerId;
    case 'neutral-zone':
      return b.kind === 'neutral-zone';
    case 'fracture-stabilizer':
      return b.kind === 'fracture-stabilizer';
    case 'red-alert-cover':
      return b.kind === 'red-alert-cover' && a.trailPlayerId === b.trailPlayerId;
  }
}

export default BridgeTable;
