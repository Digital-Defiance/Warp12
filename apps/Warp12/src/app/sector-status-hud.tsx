import { GAME_OBJECTIVE_LABELS, formatCampaignRoundProgress, type GameState, type RoundState } from 'warp12-engine';
import type { RefObject } from 'react';
import { sectorWinnerName } from '../game/sector-outcome.js';
import { ActiveQFlashBanner, PeekedSectorBanner } from './q-flash-panel';
import { FloatingPanelShell } from './floating-panel-shell';
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
  beaconCount: number;
  openTrailNames: readonly string[];
  shieldsDown: boolean;
  canRaiseShields: boolean;
  fractureActive: boolean;
  fractureStabilizers: number;
  redAlertActive: boolean;
  redAlertLabel: string;
  redAlertSummary: string;
  redAlertTone: 'caution' | 'alert';
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
}): string {
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
    return `${sectorWinnerName(game, names)} wins the sector`;
  }

  if (roundAwaitingScore && round) {
    if (roundEndSummaryOpen) {
      return 'Review round summary';
    }
    if (round.roundBlocked) {
      return 'Sector blocked';
    }
    return `${names[round.roundWinnerId ?? ''] ?? 'Captain'} won the round`;
  }

  if (syncPending && isMyTurn) {
    return 'Transmitting to subspace…';
  }

  if (lastMessage) {
    return lastMessage;
  }

  if (isMyTurn) {
    return `${names[handOwnerId] ?? 'You'} · your turn`;
  }

  if (shouldShowAiThinking({ activePlayerIsAi, isOnline, isOnlineHost })) {
    return `${names[activePlayerId] ?? 'Captain'} is thinking…`;
  }

  if (isOnline) {
    return `Awaiting ${names[activePlayerId] ?? 'captain'}`;
  }

  return `${names[activePlayerId] ?? 'Captain'} at helm`;
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
  beaconCount,
  openTrailNames,
  shieldsDown,
  canRaiseShields,
  fractureActive,
  fractureStabilizers,
  redAlertActive,
  redAlertLabel,
  redAlertSummary,
  redAlertTone,
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

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={STORAGE_KEY}
      defaultAnchor="top-right"
      panelClassName={styles.belowQOrb}
      title="Sector status"
      width={300}
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
          <dd>Double-{spacedockValue}</dd>
        </div>
        <div className={styles.row}>
          <dt>Helm</dt>
          <dd>{names[activePlayerId] ?? '—'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Uncharted</dt>
          <dd>{unchartedCount}</dd>
        </div>
        <div className={styles.row}>
          <dt>Beacons</dt>
          <dd>
            {beaconCount}
            {openTrailNames.length > 0
              ? ` · ${openTrailNames.join(', ')}`
              : ''}
          </dd>
        </div>
        {shieldsDown && (
          <div className={`${styles.row} ${styles.beacon}`}>
            <dt>Shields</dt>
            <dd>
              {canRaiseShields
                ? 'Down — chart on your warp trail to raise'
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
              redAlertTone === 'caution' ? styles.caution : styles.alert
            }`}
          >
            <dt>{redAlertLabel}</dt>
            <dd>{redAlertSummary}</dd>
          </div>
        )}
        <ActiveQFlashBanner game={game} names={names} className={styles.row} />
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
        {turnFooter}
      </p>
    </FloatingPanelShell>
  );
}
