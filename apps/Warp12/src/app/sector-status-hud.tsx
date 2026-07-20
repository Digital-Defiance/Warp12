import { GAME_OBJECTIVE_LABELS, formatCampaignRoundProgress, type Coordinate, type GameState, type RoundState } from 'warp12-engine';
import type { RefObject } from 'react';
import { DominoTile } from 'double-eighteen-react';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';
import { sectorWinnerId, sectorWinnerName } from '../game/sector-outcome.js';
import type { DoubleDownNotice } from '../game/module-feedback.js';
import { ActiveContinuumFlashBanner, PeekedSectorBanner } from './flash-panel.js';
import { FloatingPanelShell } from './floating-panel-shell';
import { captainLogColor, logPipTextColor } from './game-log-display.js';
import styles from './sector-status-hud.module.scss';

const STORAGE_KEY = 'warp12-sector-hud-pos';

export interface SectorStatusHudProps {
  containerRef: RefObject<HTMLElement | null>;
  game: GameState;
  round: RoundState | null | undefined;
  names: Readonly<Record<string, string>>;
  activePlayerId: string;
  handOwnerId: string;
  viewerId: string;
  isMyTurn: boolean;
  activePlayerIsAi: boolean;
  isOnline: boolean;
  isOnlineHost: boolean;
  syncPending: boolean;
  roundAwaitingScore: boolean;
  roundEndSummaryOpen: boolean;
  lastMessage: string | null;
  spacedockValue: number;
  unchartedCount: number;
  sensorGrid?: readonly Coordinate[];
  tileBg: WarpTileBg;
  maxPip: number;
  onSensorSweep?: (coordinate: Coordinate) => void;
  beaconCount: number;
  openTrailCaptains: readonly { captainId: string; label: string }[];
  shieldsDown: boolean;
  canRaiseShields: boolean;
  manualShieldControl: boolean;
  fractureActive: boolean;
  fractureStabilizers: number;
  redAlertActive: boolean;
  redAlertLabel: string;
  redAlertSummary: string;
  redAlertTone: 'yellow' | 'alert';
  longestTrailCaptains?: readonly string[];
  longestTrailLength?: number;
  hazardMarkerHolder?: string | null;
  doubleDownNotice?: DoubleDownNotice | null;
  /** Phone / compact bridge: narrower panel so it fits beside EdgeTailRail. */
  compact?: boolean;
}

export function shouldShowAiThinking(props: {
  activePlayerIsAi: boolean;
  isOnline: boolean;
  isOnlineHost: boolean;
}): boolean {
  return (
    props.activePlayerIsAi &&
    (!props.isOnline || props.isOnlineHost)
  );
}

export type SectorTurnFooter =
  | { readonly kind: 'plain'; readonly text: string }
  | {
      readonly kind: 'named';
      readonly captainId: string;
      readonly name: string;
      readonly prefix?: string;
      readonly rest: string;
    };

export function formatSectorTurnFooter(props: {
  game: GameState;
  round: RoundState | null | undefined;
  names: Readonly<Record<string, string>>;
  activePlayerId: string;
  handOwnerId: string;
  isMyTurn: boolean;
  activePlayerIsAi: boolean;
  isOnline: boolean;
  isOnlineHost: boolean;
  syncPending: boolean;
  roundAwaitingScore: boolean;
  roundEndSummaryOpen: boolean;
  lastMessage: string | null;
}): SectorTurnFooter {
  const {
    game,
    round,
    names,
    activePlayerId,
    handOwnerId,
    isMyTurn,
    activePlayerIsAi,
    isOnline,
    isOnlineHost,
    syncPending,
    roundAwaitingScore,
    roundEndSummaryOpen,
    lastMessage,
  } = props;

  if (game.phase === 'complete') {
    const winnerId = sectorWinnerId(game) ?? '';
    return {
      kind: 'named',
      captainId: winnerId,
      name: sectorWinnerName(game, names),
      rest: ' wins the sector',
    };
  }

  if (roundAwaitingScore && round) {
    if (roundEndSummaryOpen) {
      return { kind: 'plain', text: 'Review round summary' };
    }
    if (round.roundBlocked) {
      return { kind: 'plain', text: 'Sector blocked' };
    }
    const winnerId = round.roundWinnerId ?? '';
    return {
      kind: 'named',
      captainId: winnerId,
      name: names[winnerId] ?? 'Captain',
      rest: ' won the round',
    };
  }

  if (syncPending && isMyTurn) {
    return { kind: 'plain', text: 'Transmitting to subspace…' };
  }

  if (lastMessage) {
    return { kind: 'plain', text: lastMessage };
  }

  if (isMyTurn) {
    return {
      kind: 'named',
      captainId: handOwnerId,
      name: names[handOwnerId] ?? 'You',
      rest: ' · your turn',
    };
  }

  if (shouldShowAiThinking({ activePlayerIsAi, isOnline, isOnlineHost })) {
    return {
      kind: 'named',
      captainId: activePlayerId,
      name: names[activePlayerId] ?? 'Captain',
      rest: ' is thinking…',
    };
  }

  if (isOnline) {
    return {
      kind: 'named',
      captainId: activePlayerId,
      name: names[activePlayerId] ?? 'captain',
      prefix: 'Awaiting ',
      rest: '',
    };
  }

  return {
    kind: 'named',
    captainId: activePlayerId,
    name: names[activePlayerId] ?? 'Captain',
    rest: ' at helm',
  };
}

/** Flatten footer for tests / announcements. */
export function sectorTurnFooterText(footer: SectorTurnFooter): string {
  if (footer.kind === 'plain') {
    return footer.text;
  }
  return `${footer.prefix ?? ''}${footer.name}${footer.rest}`;
}

export function SectorTurnFooterView({
  footer,
  captainOrder,
}: {
  footer: SectorTurnFooter;
  captainOrder: readonly string[];
}) {
  if (footer.kind === 'plain') {
    return footer.text;
  }
  return (
    <>
      {footer.prefix ? <span data-part="rest">{footer.prefix}</span> : null}
      <span
        data-part="name"
        style={{ color: captainLogColor(footer.captainId, captainOrder) }}
      >
        {footer.name}
      </span>
      {footer.rest ? <span data-part="rest">{footer.rest}</span> : null}
    </>
  );
}

export function SectorStatusHud({
  containerRef,
  game,
  round,
  names,
  activePlayerId,
  handOwnerId,
  viewerId,
  isMyTurn,
  activePlayerIsAi,
  isOnline,
  isOnlineHost,
  syncPending,
  roundAwaitingScore,
  roundEndSummaryOpen,
  lastMessage,
  spacedockValue,
  unchartedCount,
  sensorGrid = [],
  tileBg,
  maxPip,
  onSensorSweep,
  beaconCount,
  openTrailCaptains,
  shieldsDown,
  canRaiseShields,
  manualShieldControl,
  fractureActive,
  fractureStabilizers,
  redAlertActive,
  redAlertLabel,
  redAlertSummary,
  redAlertTone,
  longestTrailCaptains = [],
  longestTrailLength = 0,
  hazardMarkerHolder = null,
  doubleDownNotice = null,
  compact = false,
}: SectorStatusHudProps) {
  const showAiThinking = shouldShowAiThinking({
    activePlayerIsAi,
    isOnline,
    isOnlineHost,
  });
  const turnFooter = formatSectorTurnFooter({
    game,
    round,
    names,
    activePlayerId,
    handOwnerId,
    isMyTurn,
    activePlayerIsAi,
    isOnline,
    isOnlineHost,
    syncPending,
    roundAwaitingScore,
    roundEndSummaryOpen,
    lastMessage,
  });
  const captainOrder =
    round?.turnOrder ?? game.captains.map((captain) => captain.id);
  const helmColor = captainLogColor(activePlayerId, captainOrder);

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={compact ? `${STORAGE_KEY}:compact` : STORAGE_KEY}
      defaultAnchor="top-right"
      panelClassName={`${styles.belowQOrb}${compact ? ` ${styles.compact}` : ''}`}
      title="Sector status"
      width={compact ? 240 : 300}
      accent="cyan"
    >
      <dl className={styles.stats}>
        <div className={styles.row}>
          <dt>Objective</dt>
          <dd>
            {game.objective === 'points'
              ? `${GAME_OBJECTIVE_LABELS[game.objective]} (${game.campaignRounds} rounds)`
              : GAME_OBJECTIVE_LABELS[game.objective]}
          </dd>
        </div>
        {round && (
          <div className={styles.row}>
            <dt>Round</dt>
            <dd>
              {game.objective === 'points'
                ? formatCampaignRoundProgress(
                    round.roundNumber,
                    game.campaignRounds
                  )
                : round.roundNumber}
            </dd>
          </div>
        )}
        <div className={styles.row}>
          <dt>Spacedock</dt>
          <dd style={{ color: logPipTextColor(spacedockValue) }}>
            Double-{spacedockValue}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Helm</dt>
          <dd style={{ color: helmColor }}>{names[activePlayerId] ?? '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Uncharted</dt>
          <dd>{unchartedCount}</dd>
        </div>
        {sensorGrid.length > 0 && (
          <div className={`${styles.row} ${styles.sensorGrid}`}>
            <dt>Sensor Grid</dt>
            <dd className={styles.gridTiles}>
              {sensorGrid.map((tile, i) => {
                const tileSurface = WARP_TILE_SURFACE[tileBg];
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.gridTile}
                    title={`Sensor sweep: ${tile.low}:${tile.high}`}
                    onClick={() => onSensorSweep?.(tile)}
                    disabled={!onSensorSweep}
                  >
                    <DominoTile
                      maxPips={maxPip}
                      value1={tile.low}
                      value2={tile.high}
                      width={20}
                      height={40}
                      rotation={0}
                      backgroundColor={tileSurface.fill}
                      borderColor={tileSurface.border}
                      pipColors={WARP_PIP_COLORS}
                    />
                  </button>
                );
              })}
            </dd>
          </div>
        )}
        <div className={styles.row}>
          <dt>Beacons</dt>
          <dd>
            {beaconCount}
            {openTrailCaptains.length > 0 ? (
              <>
                {' · '}
                {openTrailCaptains.map((captain, index) => (
                  <span key={captain.captainId}>
                    {index > 0 ? ', ' : null}
                    <span
                      style={{
                        color: captainLogColor(captain.captainId, captainOrder),
                      }}
                    >
                      {captain.label}
                    </span>
                  </span>
                ))}
              </>
            ) : null}
          </dd>
        </div>
        {shieldsDown && (
          <div className={`${styles.row} ${styles.beacon}`}>
            <dt>Shields</dt>
            <dd>
              {canRaiseShields
                ? manualShieldControl
                  ? 'Down — use Shields up to close your trail'
                  : 'Down — chart on your warp trail to raise'
                : 'Down — trail open to all captains'}
            </dd>
          </div>
        )}
        {fractureActive && (
          <div className={`${styles.row} ${styles.alert}`}>
            <dt>Fracture</dt>
            <dd>{fractureStabilizers}/3</dd>
          </div>
        )}
        {redAlertActive && (
          <div
            className={`${styles.row} ${
              redAlertTone === 'yellow' ? styles.yellowAlert : styles.alert
            }`}
          >
            <dt>{redAlertLabel}</dt>
            <dd>{redAlertSummary}</dd>
          </div>
        )}
        {game.modules.longestTrail?.enabled && longestTrailLength > 0 && (
          <div className={`${styles.row} ${styles.moduleDelta}`}>
            <dt>Longest trail</dt>
            <dd>
              {longestTrailCaptains.length === 0 ? (
                'None yet'
              ) : (
                <>
                  {longestTrailCaptains.map((captainId, index) => (
                    <span key={captainId}>
                      {index > 0 ? ', ' : null}
                      <span
                        style={{
                          color: captainLogColor(captainId, captainOrder),
                        }}
                      >
                        {names[captainId] ?? 'Unknown'}
                      </span>
                    </span>
                  ))}
                  {` (${longestTrailLength})`}
                </>
              )}
            </dd>
          </div>
        )}
        {game.modules.warpDriveSpool?.enabled && hazardMarkerHolder && (
          <div className={`${styles.row} ${styles.hazardWarning}`}>
            <dt>Hazard marker</dt>
            <dd>
              <span
                style={{
                  color: captainLogColor(hazardMarkerHolder, captainOrder),
                }}
              >
                {names[hazardMarkerHolder] ?? 'Unknown'}
              </span>
              {game.round?.hazardMarkerPassCount &&
              game.round.hazardMarkerPassCount > 0
                ? ` (passed ×${game.round.hazardMarkerPassCount} = +${game.round.hazardMarkerPassCount * 5} penalty)`
                : ' (not yet passed)'}
            </dd>
          </div>
        )}
        {game.modules.temporalDebt?.enabled && round && (
          <div className={`${styles.row} ${styles.temporalDebt}`}>
            <dt>Debt tokens</dt>
            <dd>
              {(() => {
                const owed = Object.entries(round.debtTokens ?? {}).filter(
                  ([, count]) => count > 0
                );
                if (owed.length === 0) {
                  return 'None yet';
                }
                return owed.map(([playerId, count], index) => (
                  <span key={playerId}>
                    {index > 0 ? ', ' : null}
                    <span
                      style={{
                        color: captainLogColor(playerId, captainOrder),
                      }}
                    >
                      {names[playerId] ?? playerId}
                    </span>
                    {`: ${count}`}
                  </span>
                ));
              })()}
            </dd>
          </div>
        )}
        {game.modules.temporalInversion?.enabled && round && round.roundNumber % 2 === 0 && (
          <div className={`${styles.row} ${styles.temporalInversion}`}>
            <dt>⚠️ Inverted!</dt>
            <dd>HIGHEST hand wins this round</dd>
          </div>
        )}
        {game.modules.doubleDown?.enabled &&
          doubleDownNotice &&
          isMyTurn &&
          handOwnerId === doubleDownNotice.targetCaptainId && (
            <div className={`${styles.row} ${styles.doubleDown}`}>
              <dt>Double Down</dt>
              <dd>
                {doubleDownNotice.drawCount === 1
                  ? 'Active — you drew 1 from Uncharted Sectors'
                  : `Active — you drew ${doubleDownNotice.drawCount} from Uncharted Sectors`}
              </dd>
            </div>
          )}
        <ActiveContinuumFlashBanner
          game={game}
          names={names}
          captainOrder={captainOrder}
          className={styles.row}
        />
        <PeekedSectorBanner
          game={game}
          viewerId={viewerId}
          className={styles.row}
        />
      </dl>

      <p
        className={styles.turnFooter}
        data-my-turn={isMyTurn && !roundAwaitingScore ? 'true' : undefined}
        data-ai={showAiThinking && !isMyTurn ? 'true' : undefined}
        role="status"
      >
        <SectorTurnFooterView footer={turnFooter} captainOrder={captainOrder} />
      </p>
    </FloatingPanelShell>
  );
}
