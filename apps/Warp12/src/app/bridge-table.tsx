import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAction,
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsByCharting,
  GAME_OBJECTIVE_LABELS,
  getLegalMoves,
  trailOpenValue,
  type ActionResult,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type LegalMove,
  type WarpAiPlayer,
} from '@warp12/Warp12-lib';
import { DominoHub, DoubleTwelve, DominoThemeProvider } from 'doubletwelve';

import { captainNameMap, createDemoGame } from '../game/create-demo-game';
import type { LocalGameConfig } from '../game/local-game-config';
import {
  coordinatesEqual,
  gameStateToTrains,
  routeLabel,
} from '../game/game-to-trains';
import {
  buildTrailSpokeStatuses,
  openTrailCaptainNames,
  type TrailAccessState,
} from '../game/trail-access';
import { coordinateKey, displayCoordinateValues } from '../game/hand-layout';
import {
  coachActionKind,
  coachChartMove,
  getCoachSuggestion,
  type CoachSuggestion,
} from '../game/warp-coach.js';
import {
  resolveCoachIndicator,
  type CoachIndicator,
  type CoachPresence,
} from '../firebase/coach-presence';
import { useHandLayout } from '../game/use-hand-layout';
import { WARP_PIP_COLORS, warpPalette } from '../theme/warp-theme';
import {
  createWarpDominoTheme,
  WARP_TILE_SURFACE,
  type WarpPipPreset,
  type WarpTileBg,
} from '../theme/warp-domino-theme';
import { useBridgeFocus } from './bridge-focus-context';
import { CoachPanel } from './coach-panel';
import styles from './bridge-table.module.scss';
import {
  ActiveQFlashBanner,
  PeekedSectorBanner,
  QActiveOrb,
  QFlashPanel,
  QGamblePanel,
} from './q-flash-panel';
import { TrailSpokeIndicators } from './trail-spoke-indicators';
import spokeStyles from './trail-spoke-indicators.module.scss';
import { RulesDialog } from './rules-dialog';
import { TableViewport } from './table-viewport';

const TABLE_WIDTH = 1200;
const TABLE_HEIGHT = 800;
const HUB_SLOTS = 8;

const PIP_PRESET_CYCLE: WarpPipPreset[] = [
  'default',
  'plasma',
  'tactical',
  'active',
];

const pipPresetLabel: Record<WarpPipPreset, string> = {
  default: 'Standard',
  plasma: 'Plasma',
  tactical: 'Tactical',
  active: 'Active',
};

const tileBgLabel: Record<WarpTileBg, string> = {
  dark: 'Dark',
  light: 'Light',
};

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
  onAction?: (action: GameAction) => Promise<ActionResult>;
  onLeave?: () => void;
  isOnlineHost?: boolean;
  onHostResetSector?: () => void;
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
  onAction,
  onLeave,
  isOnlineHost = false,
  onHostResetSector,
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

  useEffect(() => {
    if (!isOnline && externalGame) {
      setLocalGame(externalGame);
    }
  }, [externalGame, isOnline]);

  const game = isOnline ? (externalGame ?? localGame) : localGame;

  const [layoutStyle, setLayoutStyle] = useState<'offset' | 'linear'>('offset');
  const [holographicTiles, setHolographicTiles] = useState(false);
  const [tileBg, setTileBg] = useState<WarpTileBg>('dark');
  const [pipPreset, setPipPreset] = useState<WarpPipPreset>('default');
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [coachSuggestion, setCoachSuggestion] = useState<CoachSuggestion | null>(
    null
  );
  const [coachBusy, setCoachBusy] = useState(false);
  const [localCoachSignals, setLocalCoachSignals] = useState<
    Record<string, CoachPresence>
  >({});

  const round = game.round;
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

  useEffect(() => {
    return () => setBridgeFocus(false);
  }, [setBridgeFocus]);

  const trains = useMemo(
    () => (round ? gameStateToTrains(round, HUB_SLOTS) : []),
    [round]
  );

  const activePlayerId = round?.activePlayerId ?? '';
  const isMyTurn = isVsAi
    ? activePlayerId === humanId
    : !isOnline || viewerId === activePlayerId;
  const handOwnerId = isVsAi
    ? humanId
    : isOnline
      ? (viewerId ?? '')
      : activePlayerId;
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
  const [rulesOpen, setRulesOpen] = useState(false);
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
    setCoachSuggestion(null);
  }, [activePlayerId, round?.roundNumber]);

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

  const newSector = useCallback(() => {
    if (mode === 'local') {
      if (onRematch) {
        onRematch();
      } else {
        setLocalGame(createDemoGame());
      }
      setSelectedTile(null);
      setLastMessage(null);
    }
  }, [mode, onRematch]);

  const dispatch = useCallback(
    async (action: GameAction) => {
      if (onAction) {
        const result = await onAction(action);
        if (!result.ok) {
          setLastMessage(result.violation.replaceAll('_', ' ').toLowerCase());
        } else {
          setLastMessage(null);
          setSelectedTile(null);
          setCoachSuggestion(null);
        }
        return;
      }

      setLocalGame((current) => {
        const result = applyAction(current, action);
        if (!result.ok) {
          setLastMessage(result.violation.replaceAll('_', ' ').toLowerCase());
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

      setCoachSuggestion(suggestion);
      setLastMessage(null);

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

      const chart = coachChartMove(suggestion.action);
      if (chart) {
        setSelectedTile(chart.coordinate);
      }
    } finally {
      setCoachBusy(false);
    }
  }, [
    coachAvailable,
    coachBusy,
    game,
    handOwnerId,
    isOnline,
    onCoachSignal,
    round,
  ]);

  const aiBusy = useRef(false);

  useEffect(() => {
    if (!isVsAi || !aiPlayers || !round || game.phase === 'complete') {
      return;
    }

    if (round.phase === 'ended' && round.roundWinnerId) {
      const timer = window.setTimeout(() => {
        void dispatch({
          type: 'END_ROUND',
          winnerId: round.roundWinnerId!,
        });
      }, 600);
      return () => clearTimeout(timer);
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
        void dispatch(action);
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
      <button
        type="button"
        className={styles.focusToggle}
        aria-pressed={bridgeFocus}
        aria-label={
          bridgeFocus ? 'Restore standard layout' : 'Expand play area'
        }
        title={bridgeFocus ? 'Exit focus mode' : 'Focus mode'}
        onClick={toggleFocus}
      >
        <span className={styles.focusToggleIcon} aria-hidden>
          {bridgeFocus ? '▣' : '⛶'}
        </span>
      </button>
      <div
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
            {mode === 'local' && (
              <button type="button" className={styles.controlBtn} onClick={newSector}>
                {isVsAi ? 'Rematch' : 'New sector'}
              </button>
            )}
            {onLeaveSetup && (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={onLeaveSetup}
              >
                Setup
              </button>
            )}
            {onLeave && (
              <button type="button" className={styles.controlBtn} onClick={onLeave}>
                Leave bridge
              </button>
            )}
            <button
              type="button"
              className={styles.controlBtn}
              onClick={() => setRulesOpen(true)}
            >
              Rules
            </button>
            {coachAvailable && (
              <button
                type="button"
                className={styles.controlBtn}
                data-coach-trigger="true"
                disabled={coachBusy}
                onClick={() => void askCoach()}
              >
                {coachBusy ? 'Advisor…' : 'Ask coach'}
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
          <div className={`${styles.controlsRow} ${styles.appearanceControls}`}>
            <button
              type="button"
              className={styles.controlBtn}
              data-active={layoutStyle === 'offset'}
              onClick={() =>
                setLayoutStyle((current) =>
                  current === 'offset' ? 'linear' : 'offset'
                )
              }
            >
              Layout: {layoutStyle === 'offset' ? 'Offset' : 'Linear'}
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              disabled={holographicTiles}
              data-active={tileBg === 'light'}
              title={
                holographicTiles
                  ? 'Turn off Holo tiles to change tile background'
                  : undefined
              }
              onClick={() =>
                setTileBg((current) => (current === 'dark' ? 'light' : 'dark'))
              }
            >
              Bg: {tileBgLabel[tileBg]}
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              data-active={holographicTiles}
              onClick={() => setHolographicTiles((current) => !current)}
            >
              Holo tiles
            </button>
            <button
              type="button"
              className={styles.controlBtn}
              disabled={holographicTiles}
              data-active={!holographicTiles && pipPreset !== 'default'}
              title={
                holographicTiles
                  ? 'Turn off Holo tiles to try pip presets'
                  : undefined
              }
              onClick={() =>
                setPipPreset((current) => {
                  const index = PIP_PRESET_CYCLE.indexOf(current);
                  return PIP_PRESET_CYCLE[(index + 1) % PIP_PRESET_CYCLE.length];
                })
              }
            >
              Pips: {pipPresetLabel[pipPreset]}
            </button>
          </div>
        </div>

        <div className={styles.topRightHud}>
          <QActiveOrb game={game} names={names} />
          <dl className={styles.statusPanel}>
          <div>
            <dt>Objective:</dt>
            <dd>{GAME_OBJECTIVE_LABELS[game.objective]}</dd>
          </div>
          <div>
            <dt>Spacedock:</dt>
            <dd>Double-{round?.spacedockValue ?? 12}</dd>
          </div>
          <div>
            <dt>Helm:</dt>
            <dd>{names[activePlayerId] ?? '—'}</dd>
          </div>
          <div>
            <dt>Uncharted:</dt>
            <dd>{round?.unchartedSectors.length ?? 0}</dd>
          </div>
          <div>
            <dt>Beacons:</dt>
            <dd>
              {beaconCount}
              {openTrailNames.length > 0
                ? ` · open: ${openTrailNames.join(', ')}`
                : ''}
            </dd>
          </div>
          {shieldsDown && (
            <div className={styles.alert}>
              <dt>Shields:</dt>
              <dd>
                {canRaiseShields
                  ? 'Down — chart on your warp trail to raise'
                  : 'Down — trail open to all captains'}
              </dd>
            </div>
          )}
          {fracture?.active && (
            <div className={styles.alert}>
              <dt>Fracture:</dt>
              <dd>{fracture.stabilizers.length}/3</dd>
            </div>
          )}
          {redAlert?.active && (
            <div className={styles.alert}>
              <dt>Red alert:</dt>
              <dd>{names[redAlert.responsiblePlayerId ?? ''] ?? 'fleet'}</dd>
            </div>
          )}
          <ActiveQFlashBanner game={game} names={names} />
          <PeekedSectorBanner game={game} viewerId={handOwnerId} />
          </dl>
        </div>

        <TableViewport tableWidth={TABLE_WIDTH} tableHeight={TABLE_HEIGHT}>
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
              : isMyTurn
                ? `${names[handOwnerId] ?? 'Captain'}'s coordinates`
                : isVsAi
                  ? `${names[activePlayerId] ?? 'Captain'} is charting…`
                  : `Awaiting ${names[activePlayerId] ?? 'captain'}`}
          </h2>
          <span className={styles.handCount}>
            {showOwnHand
              ? `${visibleHand.length} in hand`
              : 'Stand by'}
          </span>
        </header>

        {(lastMessage ||
          (syncPending && isMyTurn) ||
          (!isMyTurn && (isOnline || isVsAi) && !syncPending)) && (
          <p className={styles.feedback} role="status">
            {syncPending && isMyTurn
              ? 'Transmitting to subspace…'
              : lastMessage ??
                (isOnline
                  ? 'Subspace link active — not your turn.'
                  : isVsAi
                    ? `${names[activePlayerId] ?? 'Captain'} is thinking…`
                    : null)}
          </p>
        )}

        {coachSuggestion && (
          <CoachPanel
            suggestion={coachSuggestion.action}
            names={names}
            busy={coachBusy}
            onApply={applyCoachHighlight}
            onDismiss={() => setCoachSuggestion(null)}
          />
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

        {isMyTurn && round?.treatyDeclarationRequired && !round.treatyDeclared && (
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
            Declare treaty
          </button>
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

        {isMyTurn &&
          !isOnline &&
          game.objective === 'penalty' &&
          round?.phase === 'ended' &&
          round.roundWinnerId && (
            <div className={styles.roundEnd}>
              <p>{names[round.roundWinnerId]} charts the final coordinate.</p>
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  void dispatch({
                    type: 'END_ROUND',
                    winnerId: round.roundWinnerId!,
                  })
                }
              >
                Score round
              </button>
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
          <ul className={styles.captainScores} aria-label="Penalty scores">
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
                <span>{captain.penaltyScore} pts</span>
              </li>
            ))}
          </ul>
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

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
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
