import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAction,
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsByCharting,
  captainNameMap,
  createDemoGame,
  formatViolation,
  getLegalMoves,
  handPenaltyPoints,
  countActiveDistressBeacons,
  countDoublesOnTable,
  isTrueRedAlert,
  trailOpenValue,
  type ActionResult,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type LegalMove,
  type RoundState,
  type WarpAiPlayer,
} from 'warp12-engine';
import { DominoHub, DoubleTwelve, DominoThemeProvider } from 'doubletwelve';
import {
  coachActionKind,
  coachChartMove,
  coordinatesEqual,
  createActionLog,
  gameStateToTrains,
  buildTrailSpokeStatuses,
  computeTableFocusPoint,
  detectNewChart,
  formatRedAlertStatus,
  getCoachSuggestion,
  openTrailCaptainNames,
  playerIdForAction,
  routeLabel,
  coordinateKey,
  displayCoordinateValues,
  useHandLayout,
  type ActionLogSource,
  type CoachSuggestion,
  type TableFocusPoint,
  type TrailAccessState,
} from 'warp12-react';
import { downloadDebugExport } from '../game/debug-export.js';
import {
  canUseSystemShare,
  deliverRoundImage,
  formatPenaltyStatLines,
  type ShareRoundDelivery,
  type ShareRoundImageMode,
  type ShareRoundMetadata,
} from '../game/share-round.js';
import type { LocalGameConfig } from '../game/local-game-config';
import { useGameSoundEffects } from '../game/use-game-sounds.js';
import {
  resolveCoachIndicator,
  type CoachIndicator,
  type CoachPresence,
} from '../firebase/coach-presence';
import {
  createWarpDominoTheme,
  WARP_PIP_COLORS,
  WARP_TILE_SURFACE,
  warpPalette,
  type WarpPipPreset,
  type WarpTileBg,
} from 'warp12-theme';
import { useBridgeFocus } from './bridge-focus-context';
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
import { TableViewport } from './table-viewport';
import { TableOptionsDialog } from './table-options-dialog';
import {
  readCaptainTailsDisplay,
  readCaptainTailsHudEnabled,
  writeCaptainTailsDisplay,
  writeCaptainTailsHudEnabled,
  type CaptainTailsDisplay,
} from './table-view-prefs';
import { ConfirmDialog } from './confirm-dialog';
import { RoundImageActions } from './round-image-actions';
import { SectorStatusHud } from './sector-status-hud';

const TABLE_WIDTH = 1200;
const TABLE_HEIGHT = 800;
const HUB_SLOTS = 8;

function canShowInHandPenalty(
  captainId: string,
  options: {
    handOwnerId: string;
    isOnlineHost: boolean;
  }
): boolean {
  return captainId === options.handOwnerId || options.isOnlineHost;
}

function formatPenaltyScoreLine(
  captainId: string,
  campaignScore: number,
  round: RoundState | null | undefined,
  hand: readonly Coordinate[] | undefined,
  options: {
    handOwnerId: string;
    isOnlineHost: boolean;
    salamanderEnabled: boolean;
  }
): string {
  const campaign = `${campaignScore} campaign`;
  if (!round || !canShowInHandPenalty(captainId, options) || hand === undefined) {
    return campaign;
  }

  const inHand = handPenaltyPoints(
    hand,
    options.salamanderEnabled,
    round.roundNumber
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
  if (game.objective === 'penalty' && round.roundNumber < 13) {
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
      const points = handPenaltyPoints(hand, salamander, round.roundNumber);
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
  aiPlayers?: ReadonlyMap<string, WarpAiPlayer>;
  onRematch?: () => void;
  onLeaveSetup?: () => void;
  viewerId?: string;
  handCounts?: Record<string, number>;
  /** Online sectors with host-run AI officers (by captain id). */
  onlineAiCaptainIds?: ReadonlySet<string>;
  onAction?: (action: GameAction) => Promise<ActionResult>;
  onLeave?: () => void;
  isOnlineHost?: boolean;
  onHostResetSector?: () => void;
  onExportDebug?: () => void | Promise<void>;
  debugExportBusy?: boolean;
  sectorCode?: string;
  syncPending?: boolean;
  /** Online: tactical-advisor signals from Firestore presence subcollection. */
  coachPresence?: Record<string, CoachPresence>;
  onCoachSignal?: () => void | Promise<void>;
}

export function BridgeTable({
  mode = 'local',
  game: externalGame,
  localConfig,
  aiPlayers,
  onRematch,
  onLeaveSetup,
  viewerId,
  handCounts = {},
  onlineAiCaptainIds,
  onAction,
  onLeave,
  isOnlineHost = false,
  onHostResetSector,
  onExportDebug,
  debugExportBusy = false,
  sectorCode,
  syncPending = false,
  coachPresence = {},
  onCoachSignal,
}: BridgeTableProps) {
  const isOnline = mode === 'online';
  const isVsAi = mode === 'local' && !!localConfig && !!aiPlayers;
  const humanId = localConfig?.humanId ?? 'you';

  const [localGame, setLocalGame] = useState<GameState>(
    () => externalGame ?? createDemoGame()
  );
  const [localExportBusy, setLocalExportBusy] = useState(false);
  const [roundImageBusy, setRoundImageBusy] = useState<string | null>(null);
  const systemShareAvailable = canUseSystemShare();
  const actionLogRef = useRef(createActionLog());
  const tableContentRef = useRef<HTMLDivElement>(null);
  const bridgeSurfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOnline && externalGame) {
      setLocalGame(externalGame);
    }
  }, [externalGame, isOnline]);

  const game = isOnline ? (externalGame ?? localGame) : localGame;

  const [layoutStyle, setLayoutStyle] = useState<'offset' | 'linear'>('offset');
  const [holographicTiles, setHolographicTiles] = useState(false);
  const [tileBg, setTileBg] = useState<WarpTileBg>('dark');
  const [pipPreset, setPipPreset] = useState<WarpPipPreset>('classic');
  const [teachingMode, setTeachingMode] = useState(false);
  const [autoFollowAction, setAutoFollowAction] = useState(false);
  const [captainTailsHud, setCaptainTailsHud] = useState(readCaptainTailsHudEnabled);
  const [captainTailsDisplay, setCaptainTailsDisplay] = useState<CaptainTailsDisplay>(
    readCaptainTailsDisplay
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
  const [rematchConfirmOpen, setRematchConfirmOpen] = useState(false);
  const [setupConfirmOpen, setSetupConfirmOpen] = useState(false);
  const [localCoachSignals, setLocalCoachSignals] = useState<
    Record<string, CoachPresence>
  >({});
  const [roundEndSummaryOpen, setRoundEndSummaryOpen] = useState(true);
  const roundEndReviewKeyRef = useRef<string | null>(null);

  const round = game.round;
  const activePlayerIsAi =
    isVsAi ||
    Boolean(
      isOnline &&
        round?.activePlayerId &&
        onlineAiCaptainIds?.has(round.activePlayerId)
    );
  const centerX = TABLE_WIDTH / 2;
  const centerY = TABLE_HEIGHT / 2;
  const names = useMemo(() => captainNameMap(game), [game]);
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
  const { focus: bridgeFocus, toggleFocus, setFocus: setBridgeFocus } =
    useBridgeFocus();
  const { registerActions, clearActions } = useBridgeHeaderActionRegistration();
  const { muted: soundsMuted, toggleMuted: toggleSoundsMuted } = useGameAudio();

  const openOptions = useCallback(() => setOptionsOpen(true), []);

  useEffect(() => {
    return () => setBridgeFocus(false);
  }, [setBridgeFocus]);

  const trains = useMemo(
    () => (round ? gameStateToTrains(round, HUB_SLOTS) : []),
    [round]
  );

  useEffect(() => {
    prevRoundRef.current = null;
    setActionFocus(null);
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
  const handOwnerId = isVsAi
    ? humanId
    : isOnline
      ? (viewerId ?? '')
      : activePlayerId;
  const treatyTurnPending =
    !!round &&
    round.treatyDeclarationRequired &&
    !round.treatyDeclared &&
    (round.roundWinnerId === handOwnerId ||
      (round.roundWinnerId == null && activePlayerId === handOwnerId));
  const isMyTurn = isVsAi
    ? activePlayerId === humanId
    : treatyTurnPending ||
      !isOnline ||
      viewerId === activePlayerId;

  useGameSoundEffects({
    enabled: game.phase === 'active' && !!round,
    gamePhase: game.phase,
    roundPhase: round?.phase,
    roundNumber: round?.roundNumber,
    isMyTurn,
    doublesOnTable: round != null ? countDoublesOnTable(round.table) : 0,
    trueRedAlert: round != null && isTrueRedAlert(round),
    redAlertResponsibleId: round?.table.redAlert?.responsiblePlayerId ?? null,
    activeBeaconCount:
      round != null ? countActiveDistressBeacons(round.table) : 0,
    qFlashActive: game.modules.qContinuum.activeFlash != null,
    treatyDeclared: round?.treatyDeclared === true,
    treatyDeclarationRequired: round?.treatyDeclarationRequired === true,
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
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    shouldIgnoreClick,
  } = useHandLayout(game.id, handOwnerId, visibleHand);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const legalMoves =
    round && isMyTurn ? getLegalMoves(round, handOwnerId) : [];

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
    round.qGamblePending?.playerId !== handOwnerId &&
    !(round.treatyDeclarationRequired && !round.treatyDeclared);

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

  useEffect(() => {
    if (!teachingMode || !coachAvailable) {
      return;
    }

    const suggestion = getCoachSuggestion(game, handOwnerId);
    if (!suggestion) {
      setCoachSuggestion(null);
      setLastMessage('Advisor unavailable this turn');
      return;
    }

    applyCoachSuggestion(suggestion, { announce: true });
  }, [
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

  const openTrailNames = useMemo(
    () => openTrailCaptainNames(trailSpokes),
    [trailSpokes]
  );

  const ownTrail = round ? round.table.warpTrails[handOwnerId] : undefined;
  const shieldsDown = ownTrail?.distressBeacon.active === true;
  const canDeployBeacon =
    !!round && isMyTurn && canDeployDistressBeacon(round, handOwnerId);
  const canPassAlert =
    !!round && isMyTurn && canPassRedAlert(round, handOwnerId);
  const canPass =
    !!round && isMyTurn && canPassTurn(round, handOwnerId);
  const canRaiseShields =
    !!round && isMyTurn && canRaiseShieldsByCharting(round, handOwnerId);

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

  const dispatch = useCallback(
    async (
      action: GameAction,
      meta?: { source?: ActionLogSource }
    ) => {
      if (onAction) {
        const result = await onAction(action);
        if (!result.ok) {
          setLastMessage(formatViolation(result.violation));
        } else {
          setLastMessage(null);
          setSelectedTile(null);
          setCoachSuggestion(null);
        }
        return;
      }

      const source = meta?.source ?? 'human';
      setLocalGame((current) => {
        const result = applyAction(current, action);
        actionLogRef.current.append({
          playerId: playerIdForAction(action),
          action,
          ok: result.ok,
          violation: result.ok ? undefined : result.violation,
          source,
        });
        if (!result.ok) {
          setLastMessage(formatViolation(result.violation));
          return current;
        }
        setLastMessage(null);
        setSelectedTile(null);
        setCoachSuggestion(null);
        return result.state;
      });
    },
    [onAction]
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

  useEffect(() => {
    const actions: {
      id: string;
      label: string;
      onClick: () => void;
    }[] = [];

    if (mode === 'local') {
      actions.push({
        id: 'rematch',
        label: isVsAi ? 'Rematch' : 'New sector',
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
      id: 'options',
      label: 'Options',
      onClick: openOptions,
    });

    registerActions(actions);
  }, [
    mode,
    isVsAi,
    onLeaveSetup,
    handleRematch,
    handleLeaveSetup,
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

  const askCoach = useCallback(async () => {
    if (!round || !coachAvailable || coachBusy) {
      return;
    }

    setCoachBusy(true);
    try {
      const suggestion = getCoachSuggestion(game, handOwnerId);
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

  const aiBusy = useRef(false);

  const roundAwaitingScore =
    game.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked);

  const canShareRound = Boolean(round && roundAwaitingScore);

  const shareRoundMetadata = useMemo((): ShareRoundMetadata | null => {
    if (!canShareRound || !round) {
      return null;
    }

    const statsLines =
      game.objective === 'penalty'
        ? formatPenaltyStatLines(roundPenaltyAdds(game, round))
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
    if (!round || !roundAwaitingScore || game.objective !== 'penalty') {
      return [];
    }
    return roundPenaltyAdds(game, round);
  }, [game, round, roundAwaitingScore]);

  const scoreCurrentRound = useCallback(() => {
    if (!round || !roundAwaitingScore) {
      return;
    }
    void dispatch({
      type: 'END_ROUND',
      winnerId: round.roundBlocked ? null : round.roundWinnerId!,
    });
  }, [dispatch, round, roundAwaitingScore]);

  useEffect(() => {
    if (!isVsAi || !aiPlayers || !round || game.phase === 'complete') {
      return;
    }

    if (round.phase !== 'playing') return;
    if (round.activePlayerId === humanId) return;

    const ai = aiPlayers.get(round.activePlayerId);
    if (!ai || aiBusy.current) return;

    aiBusy.current = true;
    const timer = window.setTimeout(() => {
      const action = ai.decideGameAction(game, round.activePlayerId);
      aiBusy.current = false;
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
    dispatch,
    game,
    humanId,
    isVsAi,
    round?.activePlayerId,
    round?.phase,
    round?.roundWinnerId,
    round?.treatyDeclarationRequired,
    round?.treatyDeclared,
    round?.qPendingInvoker,
    round?.qGamblePending,
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
    if (moves.length === 1) {
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
  const redAlert = round?.table.redAlert;
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
        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            {onLeave && (
              <button type="button" className={styles.controlBtn} onClick={onLeave}>
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
              disabled={!round || !isMyTurn || legalMoves.length > 0}
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
                Pass
              </button>
            )}
          </div>
        </div>

        <TableOptionsDialog
          open={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          layoutStyle={layoutStyle}
          onLayoutStyleChange={setLayoutStyle}
          tileBg={tileBg}
          onTileBgChange={setTileBg}
          holographicTiles={holographicTiles}
          onHolographicTilesChange={setHolographicTiles}
          pipPreset={pipPreset}
          onPipPresetChange={setPipPreset}
          teachingMode={teachingMode}
          onTeachingModeChange={setTeachingMode}
          autoFollowAction={autoFollowAction}
          onAutoFollowActionChange={setAutoFollowAction}
          captainTailsHud={captainTailsHud}
          onCaptainTailsHudChange={(next) => {
            setCaptainTailsHud(next);
            writeCaptainTailsHudEnabled(next);
          }}
          captainTailsDisplay={captainTailsDisplay}
          onCaptainTailsDisplayChange={(next) => {
            setCaptainTailsDisplay(next);
            writeCaptainTailsDisplay(next);
          }}
          showDebugExport={showDebugExport}
          debugExportBusy={debugBusy}
          onExportDebug={handleExportDebug}
          showShareRound={canShareRound}
          systemShareAvailable={systemShareAvailable}
          roundImageBusy={roundImageBusy}
          onRoundImage={handleRoundImage}
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
          fractureActive={Boolean(fracture?.active)}
          fractureStabilizers={fracture?.stabilizers.length ?? 0}
          redAlertActive={Boolean(redAlert?.active)}
          redAlertSummary={
            redAlert?.active ? formatRedAlertStatus(redAlert, names) : ''
          }
        />

        {coachSuggestion && (
          <FloatingCoachPanel
            containerRef={bridgeSurfaceRef}
            suggestion={coachSuggestion.action}
            reasons={coachSuggestion.reasons}
            names={names}
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
              {game.objective === 'penalty' && (
                <ul className={styles.roundEndPenalties}>
                  {roundPenaltySummary.map((entry) => (
                    <li key={entry.id}>
                      {entry.name}: +{entry.points} penalty
                    </li>
                  ))}
                  {roundPenaltySummary.length === 0 && (
                    <li>No penalty tiles held.</li>
                  )}
                </ul>
              )}
              <RoundImageActions
                className={styles.roundEndShareActions}
                systemShareAvailable={systemShareAvailable}
                roundImageBusy={roundImageBusy}
                onRoundImage={handleRoundImage}
              />
              <div className={styles.roundEndActions}>
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
            />
            <div className={styles.roundEndActions}>
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

      <section className={styles.commandPanel}>
        <header className={styles.commandHeader}>
          <h2 className={styles.commandTitle}>
            {game.phase === 'complete'
              ? `${names[round?.roundWinnerId ?? ''] ?? 'Captain'} wins the sector`
              : roundAwaitingScore && round
                ? round.roundBlocked
                  ? `Round ${round.roundNumber} blocked`
                  : `${names[round.roundWinnerId ?? ''] ?? 'Captain'} wins round ${round.roundNumber}`
                : isMyTurn
                  ? `${names[handOwnerId] ?? 'Captain'}'s coordinates`
                  : activePlayerIsAi
                    ? `${names[activePlayerId] ?? 'Captain'} is charting…`
                    : `Awaiting ${names[activePlayerId] ?? 'captain'}`}
          </h2>
          <span className={styles.handCount}>
            {showOwnHand
              ? `${visibleHand.length} in hand`
              : 'Stand by'}
          </span>
        </header>

        {(roundAwaitingScore ||
          lastMessage ||
          (syncPending && isMyTurn) ||
          (!isMyTurn && (isOnline || isVsAi) && !syncPending)) && (
          <p className={styles.feedback} role="status">
            {roundAwaitingScore
              ? roundEndSummaryOpen
                ? 'Review the summary, view the board, then continue when ready.'
                : 'Review the final board — open Summary or continue when ready.'
              : syncPending && isMyTurn
                ? 'Transmitting to subspace…'
                : lastMessage ??
                  (activePlayerIsAi
                    ? `${names[activePlayerId] ?? 'Captain'} is thinking…`
                    : isOnline
                      ? 'Subspace link active — not your turn.'
                      : null)}
          </p>
        )}

        {selectedTile && movesForSelected.length > 1 && (
          <div className={styles.routePicker}>
            <p className={styles.routePrompt}>Choose route:</p>
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
                {routeLabel(move.route, names)}
              </button>
            ))}
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
                    data-playable={playable}
                    data-selected={selected}
                    data-coach={coachTile}
                    data-flipped={flipped}
                    data-dragging={draggingKey === key}
                    data-drop-target={dropTargetKey === key}
                    draggable
                    onDragStart={(event) => {
                      setDraggingKey(key);
                      onDragStart(key, event);
                    }}
                    onDragEnd={() => {
                      setDraggingKey(null);
                      setDropTargetKey(null);
                      onDragEnd();
                    }}
                    onDragOver={onDragOver}
                    onDragEnter={() => setDropTargetKey(key)}
                    onDragLeave={() =>
                      setDropTargetKey((current) =>
                        current === key ? null : current
                      )
                    }
                    onDrop={() => {
                      onDrop(key);
                      setDraggingKey(null);
                      setDropTargetKey(null);
                    }}
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

        {treatyTurnPending && (!isOnline || !syncPending) && (
          <>
            <button
              type="button"
              className={styles.treatyBtn}
              data-coach={coachKind === 'declare-treaty'}
              onClick={() =>
                void dispatch({
                  type: 'DECLARE_TREATY',
                  playerId: handOwnerId,
                })
              }
            >
              Drop to impulse
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={() =>
                void dispatch({
                  type: 'FORFEIT_IMPULSE',
                  playerId: handOwnerId,
                })
              }
            >
              Miss impulse (draw penalty)
            </button>
          </>
        )}

        {game.phase === 'complete' && (
          <div className={styles.roundEnd}>
            <p>
              {game.objective === 'go-out'
                ? 'Sector complete — first captain out takes the victory.'
                : 'Campaign complete — lowest penalty score wins.'}
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

        {isOnline &&
          isOnlineHost &&
          onHostResetSector &&
          game.phase === 'active' &&
          round?.phase === 'playing' && (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => onHostResetSector()}
            >
              Abort to waiting room
            </button>
          )}

        {game.objective === 'penalty' ? (
          <>
            <p className={styles.scoreLegend}>
              Campaign totals are public. In-hand pip count is shown only for
              your hand — opponents&apos; tiles stay hidden until a round scores.
            </p>
            <ul
              className={styles.captainScores}
              aria-label="Penalty scores"
            >
              {game.captains.map((captain) => (
                <li key={captain.id}>
                  <span>
                    {captain.displayName}
                    {coachByCaptain[captain.id] && (
                      <span
                        className={spokeStyles.captainCoachTag}
                        data-flash={coachByCaptain[captain.id]?.flash}
                      >
                        {' '}
                        Advisor
                      </span>
                    )}
                  </span>
                  <span>
                    {formatPenaltyScoreLine(
                      captain.id,
                      captain.penaltyScore,
                      round,
                      round?.hands[captain.id],
                      {
                        handOwnerId,
                        isOnlineHost,
                        salamanderEnabled:
                          game.modules.salamanderPenalty.enabled,
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
                      >
                        {' '}
                        Advisor
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
