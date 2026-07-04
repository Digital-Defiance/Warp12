import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAction,
  buildAdvisorReport,
  canRaiseShieldsByCharting,
  canRaiseShieldsManually,
  captainNameMap,
  createDemoGame,
  formatViolation,
  formatRoundPointsDelta,
  getLegalMoves,
  handPoints,
  countActiveDistressBeacons,
  countDoublesOnTable,
  isTrueRedAlert,
  trailOpenValue,
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
} from 'warp12-engine';
import { resolveHelmControls } from '../game/helm-controls.js';
import { DominoHub, DoubleTwelve, DominoThemeProvider } from 'doubletwelve';
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
  buildRoundRatingsEntry,
  buildRoundStartedEntry,
  type GameLogEntry,
  type GameLogRosterEntry,
  formatGameLogLine,
  gameStateToTrains,
  buildTrailSpokeStatuses,
  computeTableFocusPoint,
  detectNewChart,
  formatSectorRedAlertRow,
  getCoachSuggestion,
  openTrailCaptainNames,
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
} from 'warp12-react';
import { downloadDebugExport } from '../game/debug-export.js';
import {
  buildRoundLogFilename,
  downloadRoundLog,
} from '../game/save-round-log.js';
import {
  canUseSystemShare,
  deliverRoundImage,
  formatPointsStatLines,
  type ShareRoundDelivery,
  type ShareRoundImageMode,
  type ShareRoundMetadata,
} from '../game/share-round.js';
import type { LocalGameConfig } from '../game/local-game-config';
import { isPassAndPlay } from '../game/local-game-config';
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
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import {
  classifyLocalAiMatchOpponent,
  classifyLocalAiMatchSkill,
  humanWonLocalMatch,
} from '../game/local-match-stats.js';
import { tableOpponentLabelForAdvisor } from '../game/advisor-report-meta.js';
import { useCaptainProfile } from '../game/use-captain-profile.js';
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
  createWarpDominoTheme,
  WARP_PIP_COLORS,
  WARP_TILE_SURFACE,
  warpPalette,
} from 'warp12-theme';
import { useBridgeFocus, useTableSession } from './bridge-focus-context';
import { useBridgeHeaderActionRegistration } from './bridge-header-actions-context';
import { useGameAudio } from './game-audio-context';
import { FloatingCoachPanel } from './floating-coach-panel';
import { CaptainTailsHud } from './captain-tails-hud';
import styles from './bridge-table.module.scss';
import {
  QActiveOrb,
  QFlashPanel,
  QGamblePanel,
} from './q-flash-panel';
import { TrailSpokeIndicators } from './trail-spoke-indicators';
import spokeStyles from './trail-spoke-indicators.module.scss';
import { TableViewport, type LogVisibilityMode } from './table-viewport';
import { TableOptionsDialog } from './table-options-dialog';
import { SectorSettingsDialog } from './sector-settings-dialog';
import {
  readTableOptions,
  writeTableOptions,
} from './table-view-prefs';
import { ConfirmDialog } from './confirm-dialog';
import { HostLeaveSectorDialog } from './host-leave-sector-dialog';
import { RoundImageActions } from './round-image-actions';
import { SectorStatusHud } from './sector-status-hud';
import { GameLogTicker } from './game-log-ticker';
import { GameLogDialog } from './game-log-dialog';
import { AdvisorReportDialog } from './advisor-report-dialog.js';
import { buildCaptainNameColors } from './game-log-display';

const TABLE_WIDTH = 1200;
const TABLE_HEIGHT = 800;
const HUB_SLOTS = 8;

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
  }
): string {
  const campaign = `${campaignScore} campaign`;
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
    options.doubleZeroScore
  );
  return `${campaign} · ${inHand} in hand`;
}

function roundEndHeadline(
  round: RoundState,
  names: Record<string, string>
): string {
  if (round.roundBlocked) {
    return `Round ${round.roundNumber} blocked — no legal charts remain.`;
  }
  const winner = names[round.roundWinnerId ?? ''] ?? 'Captain';
  return `${winner} charts the final coordinate — round ${round.roundNumber} complete.`;
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

function roundEndTitle(
  round: RoundState,
  names: Record<string, string>
): string {
  if (round.roundBlocked) {
    return 'Sector blocked';
  }
  return `${names[round.roundWinnerId ?? ''] ?? 'Captain'} wins the round`;
}

function roundPenaltyAdds(
  game: GameState,
  round: RoundState
): { id: string; name: string; points: number }[] {
  const salamander = game.modules.salamanderPenalty.enabled;
  return game.captains
    .map((captain) => {
      if (!round.roundBlocked && captain.id === round.roundWinnerId) {
        return null;
      }
      const hand = round.hands[captain.id] ?? [];
      const points = handPoints(
        hand,
        salamander,
        round.roundNumber,
        game.houseRules.doubleZeroScore
      );
      if (points === 0) {
        return null;
      }
      return {
        id: captain.id,
        name: captain.displayName,
        points,
      };
    })
    .filter((entry): entry is { id: string; name: string; points: number } =>
      Boolean(entry)
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
  /** Online: host intent to play for TEI (default true). */
  sectorRated?: boolean;
  /** Online: shared per-round applied-action history (full log + advisor). */
  onlineMoveLog?: readonly FirestoreRoundMove[];
  onAction?: (action: GameAction) => Promise<ActionResult>;
  onLeave?: () => void;
  isOnlineHost?: boolean;
  onHostAbandonSector?: () => void | Promise<void>;
  onHostResetSector?: () => void;
  onExportDebug?: () => void | Promise<void>;
  debugExportBusy?: boolean;
  sectorCode?: string;
  syncPending?: boolean;
  /** Online: tactical-advisor signals from Firestore presence subcollection. */
  coachPresence?: Record<string, CoachPresence>;
  onCoachSignal?: () => void | Promise<void>;
  /** Online: toggle for the subspace comms panel. */
  commsControl?: { open: boolean; onToggle: () => void };
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
  sectorRated = true,
  onlineMoveLog,
  onAction,
  onLeave,
  isOnlineHost = false,
  onHostAbandonSector,
  onHostResetSector,
  onExportDebug,
  debugExportBusy = false,
  sectorCode,
  syncPending = false,
  coachPresence = {},
  onCoachSignal,
  commsControl,
}: BridgeTableProps) {
  const isOnline = mode === 'online';
  const isLocalPassAndPlay =
    mode === 'local' && !!localConfig && isPassAndPlay(localConfig);
  const hasLocalAiOfficers =
    mode === 'local' && !!aiPlayers && aiPlayers.size > 0;
  const isVsAi = hasLocalAiOfficers && !isLocalPassAndPlay;
  const humanId = localConfig?.humanId ?? 'you';
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

  useEffect(() => {
    advisorUsedThisMatchRef.current = false;
    advisorConsentRef.current = false;
    setAdvisorConfirmOpen(false);
    reportedLocalMatchRef.current = null;
    reportedOnlineMatchRef.current = null;
    roundReshuffleRef.current = null;
    campaignAdvisorReviewsRef.current = [];
    campaignRoundSnapshotsRef.current = [];
    lastScoredRoundRef.current = null;
    setCampaignPerformance(null);
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
          advisorUsedThisMatchRef.current
            ? 'Unrated offline match — Advisor was enabled, so TEI was not tracked.'
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

    void reportLocalAiMatch(
      {
        uid: auth.user.uid,
        displayName: localConfig.humanName,
        ...classifyLocalAiMatchOpponent(localConfig.aiCaptains),
        objective: localConfig.objective,
        advisorUsed: advisorUsedThisMatchRef.current,
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
          void playerStatsRef.current.refresh();
          return;
        }
        if (result.status === 'queued') {
          setMatchReportNotice(
            advisorUsedThisMatchRef.current
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
      sectorRated
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
  const {
    layoutStyle,
    tileBg,
    holographicTiles,
    pipPreset,
    teachingMode,
    autoFollowAction,
    captainTailsHud,
    captainTailsDisplay,
    turnBeepsEnabled,
    bridgeSoundsEnabled,
    advisorIncludeAllCaptains,
  } = tablePrefs;

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
  const prevRoundRef = useRef<RoundState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [coachSuggestion, setCoachSuggestion] = useState<CoachSuggestion | null>(
    null
  );
  const [coachBusy, setCoachBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameLogDialogOpen, setGameLogDialogOpen] = useState(false);
  const [logMode, setLogMode] = useState<LogVisibilityMode>('all');
  const cycleLogMode = useCallback(
    () =>
      setLogMode((mode) =>
        mode === 'all' ? 'mine' : mode === 'mine' ? 'off' : 'all'
      ),
    []
  );
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
  const roundAwaitingScore =
    game.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked);
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
  const centerX = TABLE_WIDTH / 2;
  const centerY = TABLE_HEIGHT / 2;
  const names = useMemo(() => captainNameMap(game), [game]);
  const gameLogEntries = useMemo(() => {
    void gameLogVersion;
    return gameLogRef.current.snapshot();
  }, [gameLogVersion]);
  const gameLogLines = useMemo(
    () =>
      gameLogEntries
        .map((entry) =>
          formatGameLogLine(entry, names, {
            roundStartedAtMs: roundStartedAtRef.current,
          })
        )
        .filter((line) => line.length > 0),
    [gameLogEntries, names]
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
  const { focus: bridgeFocus, toggleFocus } = useBridgeFocus();
  useTableSession();
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
      setGameLogVersion((version) => version + 1);
    }
    if (loggedRoundRef.current !== round.roundNumber) {
      const startedAt = new Date().toISOString();
      roundStartedAtRef.current = Date.now();
      roundStartStateRef.current = structuredClone(gameRef.current);
      actionLogRoundStartIndexRef.current =
        actionLogRef.current.snapshot().length;
      gameLogRef.current.append(buildRoundStartedEntry(round, startedAt));
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
        const humanTei = playerStats.displayTei(matchSkill, rated);
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
    setActionFocus(null);
    setSelectedTile(null);
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
      hubRadius: 80,
      hubSlots: HUB_SLOTS,
    });
    if (point) {
      setActionFocus(point);
    }
  }, [autoFollowAction, centerX, centerY, layoutStyle, round]);

  const activePlayerId = round?.activePlayerId ?? '';
  const activeIsHumanSeat = humanSeatIds.has(activePlayerId);
  const handoffPending =
    isLocalPassAndPlay &&
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
  const isMyTurn = isVsAi
    ? activePlayerId === humanId
    : isOnline
      ? viewerId === activePlayerId
      : isLocalPassAndPlay
        ? activeIsHumanSeat && !handoffPending
        : true;

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
    game.houseRules.dropToImpulseCall &&
    round.dropToImpulseCallPending === handOwnerId &&
    (round.hands[handOwnerId]?.length ?? 0) === 1;
  const dropToImpulseCatchTarget = round?.dropToImpulseCatchable ?? null;
  const canCatchDropToImpulse =
    !!round &&
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
    trueRedAlert: round != null && isTrueRedAlert(round),
    redAlertResponsibleId: round?.table.redAlert?.responsiblePlayerId ?? null,
    activeBeaconCount:
      round != null ? countActiveDistressBeacons(round.table) : 0,
    qFlashActive: game.modules.qContinuum.activeFlash != null,
    allStopDeclared: round?.allStopDeclared === true,
    allStopRequired: round?.allStopRequired === true,
    dropToImpulseCallPending: round?.dropToImpulseCallPending ?? null,
    dropToImpulseCatchable: round?.dropToImpulseCatchable ?? null,
    returnedToWarp: round?.returnedToWarp === true,
    unchartedSectorCount: round?.unchartedSectors.length ?? 0,
    turnBeepsEnabled,
  });

  const visibleHand = round?.hands[handOwnerId] ?? [];
  const showOwnHand =
    !!round &&
    game.phase === 'active' &&
    (isOnline || isVsAi
      ? visibleHand.length > 0 || isMyTurn
      : isMyTurn);
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
  } = useHandLayout(game.id, handOwnerId, visibleHand);
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
      !onlineMatchRatingEligibility(onlineCaptains ?? [], game.objective, sectorRated)
        .rated
    ) {
      return false;
    }
    return Object.values(mergedCoachPresence).some(
      (presence) => presence.coachUsedThisRound === true
    );
  }, [isOnline, mergedCoachPresence, onlineCaptains, game.objective, sectorRated]);

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
    round.qPendingInvoker !== handOwnerId &&
    round.qGamblePending?.playerId !== handOwnerId;

  useEffect(() => {
    if (!coachAvailable) {
      setCoachSuggestion(null);
      return;
    }
    if (!teachingMode) {
      setCoachSuggestion(null);
    }
  }, [activePlayerId, round?.roundNumber, coachAvailable, teachingMode]);

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
      onlineMatchRatingEligibility(onlineCaptains ?? [], game.objective, sectorRated)
        .rated
    );
  }, [isOnline, onlineCaptains, game.objective, sectorRated]);

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
    if (!teachingMode || !coachAvailable) {
      return;
    }

    // Teaching mode auto-consults every turn; in a rated online sector, ask for
    // consent before the first auto-engagement rather than silently unrating.
    if (advisorEngageNeedsConfirm()) {
      setAdvisorConfirmOpen(true);
      return;
    }

    const suggestion = getCoachSuggestion(game, handOwnerId, names);
    if (!suggestion) {
      setCoachSuggestion(null);
      setLastMessage('Advisor unavailable this turn');
      return;
    }

    applyCoachSuggestion(suggestion, { announce: true });
  }, [
    advisorEngageNeedsConfirm,
    applyCoachSuggestion,
    coachAvailable,
    game,
    handOwnerId,
    teachingMode,
  ]);

  const trainConnectValue = useMemo(() => {
    if (!round) {
      return undefined;
    }
    const trail = round.table.warpTrails[handOwnerId];
    if (!trail) {
      return round.spacedockValue;
    }
    return trailOpenValue(trail, round.spacedockValue);
  }, [handOwnerId, round]);

  const trailSpokes = useMemo(
    () => (round ? buildTrailSpokeStatuses(round, names, HUB_SLOTS) : []),
    [names, round]
  );

  const humanCaptainId = isVsAi ? humanId : viewerId ?? undefined;

  // Log ticker lines filtered by the Comms Log toggle. Structural entries
  // (round start, ratings, outcome) always show; "Captain only" keeps just the
  // viewer's own moves. The full log is always available via the round-log dialog.
  const tickerLogLines = useMemo(() => {
    if (logMode === 'all') {
      return gameLogLines;
    }
    const structural: ReadonlySet<GameLogEntry['kind']> = new Set([
      'ROUND_STARTED',
      'ROUND_RATINGS',
      'END_ROUND',
    ]);
    return gameLogEntries
      .filter(
        (entry) =>
          structural.has(entry.kind) || entry.captainId === humanCaptainId
      )
      .map((entry) =>
        formatGameLogLine(entry, names, {
          roundStartedAtMs: roundStartedAtRef.current,
        })
      )
      .filter((line) => line.length > 0);
  }, [logMode, gameLogLines, gameLogEntries, humanCaptainId, names]);

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
      return playerStats.displayTei(
        classifyLocalAiMatchSkill(localConfig.aiCaptains),
        rated
      );
    }
    return playerStats.displayTei('commander', rated);
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

  const openTrailNames = useMemo(
    () => openTrailCaptainNames(trailSpokes),
    [trailSpokes]
  );

  const ownTrail = round ? round.table.warpTrails[handOwnerId] : undefined;
  const shieldsDown = ownTrail?.distressBeacon.active === true;
  const helmControls = resolveHelmControls({
    round,
    handOwnerId,
    isMyTurn,
    houseRules: game.houseRules,
    dropToImpulsePending,
    legalMovesCount: legalMoves.length,
  });
  const canDeployBeacon = helmControls.showShieldsDown;
  const canPassAlert = helmControls.showPassRedAlert;
  const canPass = helmControls.showPass;
  const canRaiseShieldsExplicitly = helmControls.showShieldsUp;
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
          actionLogRef.current.append({
            playerId: playerIdForAction(action),
            action,
            ok: true,
            source,
          });
        }
        return;
      }

      const before = gameRef.current;
      // Route through applyMatchAction so END_ROUND reshuffles the next deal with
      // the seeded stream (reproducible by the verification replay); all other
      // actions behave exactly like applyAction.
      const result = applyMatchAction(before, action, ensureRoundReshuffle());
      actionLogRef.current.append({
        playerId: playerIdForAction(action),
        action,
        ok: result.ok,
        violation: result.ok ? undefined : result.violation,
        source,
      });
      if (!result.ok) {
        setLastMessage(formatViolation(result.violation));
        return;
      }
      setLastMessage(null);
      setSelectedTile(null);
      setCoachSuggestion(null);
      recordGameLog(before, result.state, action);
      setLocalGame(result.state);
    },
    [game, onAction, recordGameLog, ensureRoundReshuffle]
  );

  const exportLocalDebug = async () => {
    setLocalExportBusy(true);
    try {
      downloadDebugExport({
        exportedAt: new Date().toISOString(),
        mode: 'local',
        sectorCode: 'local',
        viewerId: humanId,
        client: {
          gameState: game,
          localConfig,
          actionLog: actionLogRef.current.snapshot(),
        },
        notes: ['Local simulation — full hands included in gameState.'],
      });
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
      const suggestion = getCoachSuggestion(game, handOwnerId, names);
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
    game,
    handOwnerId,
    round,
  ]);

  const askCoach = useCallback(async () => {
    if (advisorEngageNeedsConfirm()) {
      setAdvisorConfirmOpen(true);
      return;
    }
    await runAskCoach();
  }, [advisorEngageNeedsConfirm, runAskCoach]);

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
    gameLogRef.current.append(buildRoundOutcomeEntry(round));
    setGameLogVersion((version) => version + 1);
  }, [round, roundAwaitingScore]);

  const canShareRound = Boolean(round && roundAwaitingScore);

  const captainOrder = useMemo(
    () => round?.turnOrder ?? game.captains.map((captain) => captain.id),
    [game.captains, round?.turnOrder]
  );
  const gameLogNameColors = useMemo(
    () => buildCaptainNameColors(names, captainOrder),
    [captainOrder, names]
  );
  const gameLogReviewable = Boolean(
    gameLogLines.length > 0 &&
      ((roundAwaitingScore && round) || game.phase === 'complete')
  );
  const roundLogFilename = useMemo(() => {
    if (!round) {
      return 'warp12-round-log.txt';
    }
    return buildRoundLogFilename(
      round.roundNumber,
      new Date().toISOString(),
      sectorCode ?? (isOnline ? undefined : 'local')
    );
  }, [isOnline, round, sectorCode]);

  const handleOpenRoundLog = useCallback(() => {
    setGameLogDialogOpen(true);
  }, []);

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
    if (!roundAwaitingScore || !roundStartStateRef.current) {
      return false;
    }
    return (
      actionLogRef.current.snapshot().length >
      actionLogRoundStartIndexRef.current
    );
  }, [gameLogVersion, roundAwaitingScore]);

  const advisorOpponentLabel = useMemo(
    () => tableOpponentLabelForAdvisor(localConfig),
    [localConfig]
  );
  const { pilotIconSrc } = useCaptainProfile();

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
        ...(includeAllCaptains
          ? { includeAllPlayers: true }
          : { focusPlayerIds: focusPlayerIdsForAdvisor }),
        names,
      });
    },
    [advisorIncludeAllCaptains, focusPlayerIdsForAdvisor, names]
  );

  const buildCampaignAdvisorReports = useCallback(
    (includeAllCaptains: boolean) =>
      campaignRoundSnapshotsRef.current.map((snapshot) => ({
        roundNumber: snapshot.roundNumber,
        report: buildAdvisorReport({
          roundStartState: snapshot.roundStartState,
          entries: snapshot.entries,
          ...(includeAllCaptains
            ? { includeAllPlayers: true }
            : { focusPlayerIds: focusPlayerIdsForAdvisor }),
          names,
        }),
      })),
    [focusPlayerIdsForAdvisor, names]
  );

  const downloadCampaignAdvisorReport = useCallback(
    (includeAllCaptains: boolean) => {
      const rounds = buildCampaignAdvisorReports(includeAllCaptains);
      const text = campaignAdvisorPlainText(rounds, names, {
        includeAllCaptains,
        opponentLabel: advisorOpponentLabel,
      });
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `warp12-campaign-advisor-${sectorCode ?? 'local'}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [buildCampaignAdvisorReports, names, sectorCode, advisorOpponentLabel]
  );

  const rebuildCampaignAdvisorReviews = useCallback(() => {
    const reviews: AdvisorMoveReview[] = [];
    for (const snapshot of campaignRoundSnapshotsRef.current) {
      const report = buildAdvisorReport({
        roundStartState: snapshot.roundStartState,
        entries: snapshot.entries,
        focusPlayerIds: focusPlayerIdsForAdvisor,
        names,
      });
      reviews.push(...report.reviews);
    }
    campaignAdvisorReviewsRef.current = reviews;
    setCampaignPerformance(summarizeAdvisorPerformance(reviews));
    setCampaignRoundCount(campaignRoundSnapshotsRef.current.length);
  }, [focusPlayerIdsForAdvisor, names]);

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
        ? formatPointsStatLines(roundPenaltyAdds(game, round))
        : game.captains.map(
            (captain) =>
              `${names[captain.id] ?? captain.displayName}: ${
                round.hands[captain.id]?.length ?? 0
              } in hand`
          );

    return {
      roundNumber: round.roundNumber,
      headline: roundEndTitle(round, names),
      subtitle: roundEndHeadline(round, names),
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
      } finally {
        setRoundImageBusy(null);
      }
    },
    [shareRoundMetadata]
  );

  const handleDownloadRoundLog = useCallback(() => {
    if (!round) {
      return;
    }
    setRoundLogDownloadBusy(true);
    try {
      downloadRoundLog(
        buildRoundLogExport(
          gameLogRef.current.snapshot(),
          round.roundNumber,
          names,
          {
            sectorCode: sectorCode ?? (isOnline ? undefined : 'local'),
            roundStartedAtMs: roundStartedAtRef.current,
          }
        )
      );
    } finally {
      setRoundLogDownloadBusy(false);
    }
  }, [round, names, sectorCode, isOnline]);

  useEffect(() => {
    if (!roundAwaitingScore || !round) {
      roundEndReviewKeyRef.current = null;
      return;
    }
    const key = `${round.roundNumber}:${round.roundWinnerId ?? 'blocked'}:${round.roundBlocked}`;
    if (roundEndReviewKeyRef.current !== key) {
      roundEndReviewKeyRef.current = key;
      setRoundEndSummaryOpen(true);
    }
  }, [
    roundAwaitingScore,
    round?.roundBlocked,
    round?.roundNumber,
    round?.roundWinnerId,
  ]);

  const roundPenaltySummary = useMemo(() => {
    if (!round || !roundAwaitingScore || game.objective !== 'points') {
      return [];
    }
    return roundPenaltyAdds(game, round);
  }, [game, round, roundAwaitingScore]);

  const scoreCurrentRound = useCallback(() => {
    if (!round || !roundAwaitingScore) {
      return;
    }
    if (lastScoredRoundRef.current === round.roundNumber) {
      return;
    }
    lastScoredRoundRef.current = round.roundNumber;
    appendRoundAdvisorReviews();
    void dispatch(
      {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      },
      { source: 'auto' }
    );
  }, [appendRoundAdvisorReviews, dispatch, round, roundAwaitingScore]);

  useEffect(() => {
    if (game.phase === 'complete') {
      setCampaignPerformance(
        summarizeAdvisorPerformance(campaignAdvisorReviewsRef.current)
      );
      setCampaignCompleteOpen(true);
    }
  }, [game.phase]);

  const aiTurnKey = round
    ? [
        round.roundNumber,
        round.activePlayerId,
        round.roundStarterOpening?.playerId ?? '',
        round.mandatoryPlay?.playerId ?? '',
        round.qPendingInvoker ?? '',
        round.qGamblePending?.playerId ?? '',
        round.allStopRequired,
        round.allStopDeclared,
        round.roundWinnerId ?? '',
      ].join(':')
    : '';

  useEffect(() => {
    if (!hasLocalAiOfficers || !aiPlayers || !round || game.phase === 'complete') {
      return;
    }

    if (round.phase !== 'playing') return;
    if (isVsAi && round.activePlayerId === humanId) return;
    if (isLocalPassAndPlay && humanSeatIds.has(round.activePlayerId)) return;

    const activePlayerId = round.activePlayerId;
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
        currentRound.activePlayerId !== activePlayerId
      ) {
        return;
      }
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
  const sectorRedAlertRow =
    round != null ? formatSectorRedAlertRow(round, names) : null;
  const beaconCount = round
    ? Object.values(round.table.warpTrails).filter(
        (trail) => trail.distressBeacon.active
      ).length
    : 0;

  return (
    <DominoThemeProvider theme={dominoTheme}>
      <div
        className={styles.bridgeLayout}
        data-focus={bridgeFocus ? 'true' : 'false'}
      >
      <div
        ref={bridgeSurfaceRef}
        className={styles.bridge}
        style={{
          ...(bridgeFocus
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
        {logMode !== 'off' && (
          <GameLogTicker
            lines={tickerLogLines}
            clickable={gameLogReviewable}
            onOpen={handleOpenRoundLog}
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
            {coachAvailable && !teachingMode && (
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
          autoFollowAction={autoFollowAction}
          onAutoFollowActionChange={(next) =>
            patchTablePrefs({ autoFollowAction: next })
          }
          captainTailsHud={captainTailsHud}
          onCaptainTailsHudChange={(next) =>
            patchTablePrefs({ captainTailsHud: next })
          }
          captainTailsDisplay={captainTailsDisplay}
          onCaptainTailsDisplayChange={(next) =>
            patchTablePrefs({ captainTailsDisplay: next })
          }
          bridgeSoundsEnabled={bridgeSoundsEnabled}
          onBridgeSoundsEnabledChange={(next) =>
            patchTablePrefs({ bridgeSoundsEnabled: next })
          }
          turnBeepsEnabled={turnBeepsEnabled}
          onTurnBeepsEnabledChange={(next) =>
            patchTablePrefs({ turnBeepsEnabled: next })
          }
          showDebugExport={showDebugExport}
          debugExportBusy={debugBusy}
          onExportDebug={handleExportDebug}
          showShareRound={canShareRound}
          systemShareAvailable={systemShareAvailable}
          roundImageBusy={roundImageBusy}
          onRoundImage={handleRoundImage}
          onSaveRoundLog={canShareRound ? handleOpenRoundLog : undefined}
          roundLogBusy={roundLogDownloadBusy}
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

        <HostLeaveSectorDialog
          open={leaveConfirmOpen}
          onClose={() => setLeaveConfirmOpen(false)}
          onReturnToWaitingRoom={confirmReturnToWaitingRoom}
          onDissolveSector={confirmDissolveSector}
        />

        <div className={styles.topRightHud}>
          <QActiveOrb game={game} names={names} />
        </div>

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
          beaconCount={beaconCount}
          openTrailNames={openTrailNames}
          shieldsDown={shieldsDown}
          canRaiseShields={canRaiseShields}
          manualShieldControl={game.houseRules.manualShieldControl}
          fractureActive={Boolean(fracture?.active)}
          fractureStabilizers={fracture?.stabilizers.length ?? 0}
          redAlertActive={sectorRedAlertRow != null}
          redAlertLabel={sectorRedAlertRow?.label ?? ''}
          redAlertSummary={sectorRedAlertRow?.summary ?? ''}
          redAlertTone={sectorRedAlertRow?.tone ?? 'alert'}
        />

        {coachSuggestion && (
          <FloatingCoachPanel
            containerRef={bridgeSurfaceRef}
            suggestion={coachSuggestion.action}
            reasons={coachSuggestion.reasons}
            names={names}
            suggestionFormat={{
              allStopEcho: round.qEffects?.allStopEcho === true,
            }}
            busy={coachBusy}
            pinned={teachingMode}
            onApply={applyCoachHighlight}
            onDismiss={() => setCoachSuggestion(null)}
          />
        )}

        {captainTailsHud && round && (
          <CaptainTailsHud
            containerRef={bridgeSurfaceRef}
            round={round}
            trailSpokes={trailSpokes}
            activePlayerId={activePlayerId}
            display={captainTailsDisplay}
            tileBg={tileBg}
            tacticalClassAbbrevByCaptain={captainTacticalClassAbbrevById}
            tacticalClassLabelByCaptain={captainTacticalClassLabelById}
          />
        )}

        <TableViewport
          tableWidth={TABLE_WIDTH}
          tableHeight={TABLE_HEIGHT}
          contentRef={tableContentRef}
          autoFollowAction={autoFollowAction}
          actionFocus={actionFocus}
          focusControl={{
            active: bridgeFocus,
            onToggle: toggleFocus,
          }}
          soundControl={{
            muted: soundsMuted,
            onToggle: toggleSoundsMuted,
          }}
          logControl={{
            mode: logMode,
            onCycle: cycleLogMode,
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
                hubRadius={80}
                hubSlots={HUB_SLOTS}
                spokes={trailSpokes}
                coachByCaptain={coachByCaptain}
                tacticalClassLabelByCaptain={captainTacticalClassLabelById}
              />
              <DominoHub
              playerCount={HUB_SLOTS}
              centerX={centerX}
              centerY={centerY}
              radius={80}
              engineValue={round.spacedockValue}
              trains={trains}
              layoutStyle={layoutStyle}
              tableWidth={TABLE_WIDTH}
              tableHeight={TABLE_HEIGHT}
              pipColors={WARP_PIP_COLORS}
            />
            </>
          )}
        </TableViewport>

        {roundAwaitingScore && round && roundEndSummaryOpen && (
          <div
            className={styles.roundEndOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="warp12-round-end-title"
          >
            <div className={styles.roundEndCard}>
              <p className={styles.roundEndEyebrow}>Round {round.roundNumber}</p>
              <h3 id="warp12-round-end-title" className={styles.roundEndTitle}>
                {roundEndTitle(round, names)}
              </h3>
              <p className={styles.roundEndBody}>
                {roundEndHeadline(round, names)}
              </p>
              {game.objective === 'points' && (
                <ul className={styles.roundEndPoints}>
                  {roundPenaltySummary.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}: {formatRoundPointsDelta(entry.points)}
                    </li>
                  ))}
                  {roundPenaltySummary.length === 0 && (
                    <li>No points held this round.</li>
                  )}
                </ul>
              )}
              <RoundImageActions
                className={styles.roundEndShareActions}
                systemShareAvailable={systemShareAvailable}
                roundImageBusy={roundImageBusy}
                onRoundImage={handleRoundImage}
                onSaveRoundLog={handleOpenRoundLog}
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
                  onClick={() => setRoundEndSummaryOpen(false)}
                >
                  View board
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
          </div>
        )}

        {roundAwaitingScore && round && !roundEndSummaryOpen && (
          <div className={styles.roundEndDock} role="status">
            <div className={styles.roundEndDockText}>
              <strong>{roundEndTitle(round, names)}</strong>
              <span>Pan and zoom to review the final layout.</span>
            </div>
            <RoundImageActions
              className={styles.roundEndShareActions}
              systemShareAvailable={systemShareAvailable}
              roundImageBusy={roundImageBusy}
              onRoundImage={handleRoundImage}
              onSaveRoundLog={handleOpenRoundLog}
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
          lines={gameLogLines}
          nameColors={gameLogNameColors}
          downloadFilename={roundLogFilename}
          onDownload={handleDownloadRoundLog}
          downloadBusy={roundLogDownloadBusy}
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

        {handoffPending && (
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
        )}

        <CampaignCompleteOverlay
          open={game.phase === 'complete' && campaignCompleteOpen}
          game={game}
          names={names}
          humanId={isVsAi ? humanId : viewerId}
          humanName={isVsAi ? names[humanId] : names[viewerId ?? '']}
          matchReport={matchReport}
          matchReportPending={matchReportPending}
          matchReportNotice={matchReportNotice}
          ratedMatchCheckInUrl={ratedMatchCheckInUrl()}
          performance={campaignPerformance}
          canDownloadAdvisorReport={campaignRoundCount > 0}
          onDownloadAdvisorReport={downloadCampaignAdvisorReport}
          pilotIconSrc={pilotIconSrc}
          onRematch={onRematch}
          onLeaveSetup={onLeaveSetup}
          onClose={() => setCampaignCompleteOpen(false)}
        />

        <QFlashPanel
          game={game}
          playerId={handOwnerId}
          names={names}
          onInvoke={(action) => void dispatch(action)}
        />
        <QGamblePanel
          game={game}
          playerId={handOwnerId}
          onResolve={(action) => void dispatch(action)}
        />
      </div>

      <section className={styles.commandPanel} data-my-turn={isMyTurn}>
        <header className={styles.commandHeader}>
          <h2 className={styles.commandTitle}>
            {game.phase === 'complete'
              ? `${sectorWinnerName(game, names)} wins the sector`
              : roundAwaitingScore && round
                ? round.roundBlocked
                  ? `Round ${round.roundNumber} blocked`
                  : `${names[round.roundWinnerId ?? ''] ?? 'Captain'} wins round ${round.roundNumber}`
                : `${names[handOwnerId] ?? 'Captain'}'s coordinates`}
          </h2>
          <span className={styles.handCount}>
            {showOwnHand
              ? `${visibleHand.length} in hand`
              : 'Stand by'}
          </span>
        </header>

        {sectorAdvisorVoided && (
          <p className={styles.feedback} role="status">
            ⚠ Sector unrated — the tactical advisor was engaged. TEI will not
            change for any captain.
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

        {showOwnHand ? (
          <div className={styles.handSection}>
            <div className={styles.handToolbar}>
              <span className={styles.handHint}>
                {isMyTurn
                  ? 'Drag to arrange · Click to flip · Shift/Option-click playable tiles'
                  : 'Drag to arrange · Click to flip — stand by for helm'}
              </span>
              <button
                type="button"
                className={styles.handSortBtn}
                onClick={() => applySort('pips-desc')}
              >
                Heaviest
              </button>
              <button
                type="button"
                className={styles.handSortBtn}
                onClick={() => applySort('pips-asc')}
              >
                Lightest
              </button>
              <button
                type="button"
                className={styles.handSortBtn}
                onClick={() => applySort('low-first')}
              >
                Low pip
              </button>
              <button
                type="button"
                className={styles.handSortBtn}
                onClick={() => applySort('doubles-first')}
              >
                Doubles
              </button>
              <button
                type="button"
                className={styles.handSortBtn}
                onClick={() => applySort('best-train', trainConnectValue)}
                disabled={trainConnectValue === undefined}
              >
                Best train
              </button>
            </div>
            <div className={styles.hand}>
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
                    <DoubleTwelve
                      value1={top}
                      value2={bottom}
                      width={36}
                      height={72}
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
