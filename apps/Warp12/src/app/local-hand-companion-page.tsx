import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  ChartRoute,
  Coordinate,
  GameAction,
  LegalMove,
} from 'warp12-engine';
import {
  coordinatesEqual,
  coordinateKey,
  displayCoordinateValues,
  routeLabel,
} from 'warp12-react';
import { DominoTile, DominoThemeProvider } from 'double-eighteen-react';
import {
  createWarpDominoTheme,
  WARP_PIP_COLORS,
  WARP_TILE_SURFACE,
} from 'warp12-theme';

import { useAnnounce } from '../a11y/live-announcer.js';
import {
  ContinuumFlashPanel,
  ContinuumWagerPanel,
  HandExchangePanel,
} from './flash-panel.js';
import { DraftPhase } from './draft-phase.js';
import {
  HAND_COMPANION_CHANNEL,
  handCompanionChannelForSeat,
  isHandCompanionOutboundMessage,
  localHandCompanionPath,
  publishHandCompanionAction,
  publishHandCompanionHandoffReady,
  publishHandCompanionHello,
  type HandCompanionRosterMessage,
  type HandCompanionSnapshotMessage,
} from './hand-companion-broadcast.js';
import styles from './local-hand-companion-page.module.scss';

const HAND_TILE_WIDTH = 40;
const HAND_TILE_HEIGHT = 80;

function routeKey(route: ChartRoute): string {
  switch (route.kind) {
    case 'warp-trail':
      return `warp-${route.playerId}`;
    case 'neutral-zone':
      return 'neutral';
    case 'fracture-stabilizer':
      return 'fracture';
    case 'red-alert-cover':
      return `cover-${route.trailPlayerId ?? 'nz'}`;
  }
}

/**
 * Off-camera playable hand for local stream-safe / couch mode.
 * `/local/hand` follows the active seat; `/local/hand/:seatId` locks to one
 * captain (couch). Mirrors the Bridge via BroadcastChannel.
 */
export function LocalHandCompanionPage() {
  const announce = useAnnounce();
  const { seatId: seatIdParam } = useParams<{ seatId?: string }>();
  const lockedSeatId = seatIdParam ? decodeURIComponent(seatIdParam) : null;
  const channelName = lockedSeatId
    ? handCompanionChannelForSeat(lockedSeatId)
    : HAND_COMPANION_CHANNEL;

  const [snapshot, setSnapshot] = useState<HandCompanionSnapshotMessage | null>(
    null
  );
  const [roster, setRoster] = useState<HandCompanionRosterMessage | null>(null);
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);
  const [waiting, setWaiting] = useState(true);
  const theme = useMemo(() => createWarpDominoTheme(), []);
  const tileSurface = WARP_TILE_SURFACE[snapshot?.tileBg ?? 'dark'];

  useEffect(() => {
    document.documentElement.dataset.handCompanion = 'true';
    document.body.dataset.handCompanion = 'true';
    return () => {
      delete document.documentElement.dataset.handCompanion;
      delete document.body.dataset.handCompanion;
    };
  }, []);

  useEffect(() => {
    setSnapshot(null);
    setSelectedTile(null);
    setWaiting(true);
  }, [channelName]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      setWaiting(false);
      return;
    }
    const channel = new BroadcastChannel(channelName);
    const rosterChannel =
      channelName === HAND_COMPANION_CHANNEL
        ? channel
        : new BroadcastChannel(HAND_COMPANION_CHANNEL);

    const onMessage = (event: MessageEvent) => {
      if (!isHandCompanionOutboundMessage(event.data)) {
        return;
      }
      if (event.data.type === 'hello') {
        return;
      }
      if (event.data.type === 'roster') {
        setRoster(event.data);
        return;
      }
      if (
        lockedSeatId &&
        event.data.type === 'snapshot' &&
        event.data.handOwnerId !== lockedSeatId
      ) {
        return;
      }
      setSnapshot(event.data);
      setWaiting(false);
      // Keep selection across hello-driven republishes; drop only if the tile
      // left the hand (turn advanced / exchange / draft).
      setSelectedTile((current) => {
        if (!current || event.data.type !== 'snapshot') {
          return null;
        }
        const stillInHand = event.data.hand.some((tile) =>
          coordinatesEqual(tile, current)
        );
        return stillInHand ? current : null;
      });
    };

    const onRosterOnly = (event: MessageEvent) => {
      if (!isHandCompanionOutboundMessage(event.data)) {
        return;
      }
      if (event.data.type === 'roster') {
        setRoster(event.data);
      }
    };

    channel.addEventListener('message', onMessage);
    if (rosterChannel !== channel) {
      rosterChannel.addEventListener('message', onRosterOnly);
    }
    publishHandCompanionHello(channelName);
    publishHandCompanionHello(HAND_COMPANION_CHANNEL);
    const helloTimer = window.setInterval(() => {
      publishHandCompanionHello(channelName);
    }, 2500);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
      if (rosterChannel !== channel) {
        rosterChannel.removeEventListener('message', onRosterOnly);
        rosterChannel.close();
      }
      window.clearInterval(helloTimer);
    };
  }, [channelName, lockedSeatId]);

  const legalMoves = snapshot?.legalMoves ?? [];
  const movesForSelected = useMemo(() => {
    if (!selectedTile) {
      return legalMoves;
    }
    return legalMoves.filter((move) =>
      coordinatesEqual(move.coordinate, selectedTile)
    );
  }, [legalMoves, selectedTile]);

  const send = (action: GameAction) => {
    publishHandCompanionAction(action, channelName);
    setSelectedTile(null);
    announce('Helm order sent to Bridge.', 'polite');
  };

  const playMove = (move: LegalMove) => {
    if (!snapshot) {
      return;
    }
    send({
      type: 'CHART_COORDINATE',
      playerId: snapshot.handOwnerId,
      coordinate: move.coordinate,
      route: move.route,
    });
  };

  const onTileClick = (coordinate: Coordinate) => {
    if (!snapshot?.isMyTurn || snapshot.handoffPending) {
      return;
    }
    const moves = legalMoves.filter((move) =>
      coordinatesEqual(move.coordinate, coordinate)
    );
    if (moves.length === 0) {
      return;
    }
    const alreadySelected =
      selectedTile !== null && coordinatesEqual(selectedTile, coordinate);
    if (alreadySelected && moves.length === 1) {
      playMove(moves[0]);
      return;
    }
    setSelectedTile(coordinate);
  };

  const confirmHandoff = () => {
    const seat = snapshot?.handOwnerId ?? lockedSeatId;
    if (!seat) {
      return;
    }
    publishHandCompanionHandoffReady(seat, channelName);
    announce('Ready at helm — hand revealed.', 'assertive');
  };

  const draftState = snapshot?.game?.round?.draftState;
  const isDrafting = snapshot?.game?.round?.phase === 'drafting' && !!draftState;
  const showSeatPicker = !lockedSeatId && roster && roster.seats.length > 1;

  return (
    <DominoThemeProvider theme={theme}>
      <main className={styles.page} aria-live="polite">
        <h1 className={styles.srOnly}>
          {lockedSeatId
            ? 'Seat hand — keep off camera'
            : 'Private hand — keep off camera'}
        </h1>
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            {lockedSeatId
              ? 'Couch seat · off-camera'
              : 'Private hand · off-camera'}
          </p>
          <p className={styles.title}>
            {snapshot?.handoffPending
              ? `Pass to ${snapshot.handoffCaptainName ?? 'next captain'}`
              : isDrafting
                ? 'Tactical Requisition'
                : snapshot
                  ? `${snapshot.handOwnerName} · ${
                      snapshot.isMyTurn ? 'Your turn' : 'Stand by'
                    }`
                  : 'Waiting for Bridge…'}
          </p>
          {snapshot?.status && !snapshot.handoffPending ? (
            <p className={styles.status} role="status">
              {snapshot.status}
            </p>
          ) : null}
        </header>

        {showSeatPicker ? (
          <nav className={styles.seatPicker} aria-label="Open a locked seat hand">
            <p className={styles.waiting}>
              This window follows the active captain. For couch mode, open a
              locked seat:
            </p>
            <ul className={styles.seatList}>
              {roster.seats.map((seat) => (
                <li key={seat.id}>
                  <Link
                    className={styles.seatLink}
                    to={localHandCompanionPath(seat.id)}
                  >
                    {seat.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {waiting && !snapshot ? (
          <p className={styles.waiting} role="status">
            Open a local match on the Bridge, then enable Stream-safe or Couch
            mode (or keep this window open). Hand tiles sync over
            BroadcastChannel — do not add this URL as an OBS source.
          </p>
        ) : null}

        {snapshot?.handoffPending ? (
          <div
            className={styles.handoffCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hand-companion-handoff-title"
          >
            <h2 id="hand-companion-handoff-title" className={styles.handoffTitle}>
              {snapshot.handoffCaptainName ?? 'Captain'} at helm
            </h2>
            <p className={styles.waiting}>
              Pass the device / attention to this captain. Coordinates stay
              hidden until they confirm ready.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={confirmHandoff}
            >
              Ready at helm
            </button>
          </div>
        ) : null}

        {snapshot && isDrafting && draftState && !snapshot.handoffPending ? (
          <DraftPhase
            draftState={draftState}
            myId={snapshot.handOwnerId}
            names={snapshot.names}
            tileBg={snapshot.tileBg}
            maxPip={snapshot.maxPip}
            onPickTile={(coordinate) => {
              const drafter =
                draftState.currentDrafter || snapshot.handOwnerId;
              send({
                type: 'PICK_FROM_PACK',
                playerId: drafter,
                coordinate,
              });
            }}
          />
        ) : null}

        {snapshot &&
        !snapshot.handoffPending &&
        !isDrafting &&
        selectedTile &&
        movesForSelected.length >= 1 ? (
          <div
            className={styles.routePicker}
            role="group"
            aria-label="Choose route"
          >
            <p className={styles.routePrompt}>
              {movesForSelected.length > 1
                ? 'Choose route:'
                : 'Play here, or cancel?'}
            </p>
            {movesForSelected.map((move) => (
              <button
                key={routeKey(move.route)}
                type="button"
                className={styles.routeBtn}
                onClick={() => playMove(move)}
              >
                {movesForSelected.length === 1
                  ? `Play on ${routeLabel(move.route, snapshot.names)}`
                  : routeLabel(move.route, snapshot.names)}
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
        ) : null}

        {snapshot && !snapshot.handoffPending && !isDrafting ? (
          <div
            className={styles.hand}
            role="list"
            aria-label={`${snapshot.hand.length} coordinates in hand`}
          >
            {snapshot.hand.map((coordinate) => {
              const key = coordinateKey(coordinate);
              const { top, bottom } = displayCoordinateValues(coordinate, false);
              const playable =
                snapshot.isMyTurn &&
                legalMoves.some((move) =>
                  coordinatesEqual(move.coordinate, coordinate)
                );
              const selected =
                selectedTile !== null &&
                coordinatesEqual(selectedTile, coordinate);
              return (
                <button
                  key={key}
                  type="button"
                  role="listitem"
                  className={styles.handTile}
                  data-playable={playable}
                  data-selected={selected}
                  disabled={!snapshot.isMyTurn || !playable}
                  onClick={() => onTileClick(coordinate)}
                  aria-label={`Coordinate ${top}-${bottom}${
                    playable ? ', playable' : ''
                  }`}
                >
                  <DominoTile
                    maxPips={snapshot.maxPip}
                    value1={top}
                    value2={bottom}
                    width={HAND_TILE_WIDTH}
                    height={HAND_TILE_HEIGHT}
                    backgroundColor={tileSurface.fill}
                    borderColor={tileSurface.border}
                    pipColors={WARP_PIP_COLORS}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        {snapshot?.isMyTurn && !snapshot.handoffPending && !isDrafting ? (
          <div
            className={styles.controls}
            role="toolbar"
            aria-label="Helm controls"
          >
            {snapshot.helm.showDraw ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'DRAW_FROM_UNCHARTED',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Draw
              </button>
            ) : null}
            {snapshot.helm.showDesperationDig ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'DESPERATION_DIG',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Desperation Dig
              </button>
            ) : null}
            {snapshot.spoolOptions.map((option) => (
              <button
                key={routeKey(option.route)}
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'SPOOL_WARP_DRIVE',
                    playerId: snapshot.handOwnerId,
                    route: option.route as Extract<
                      ChartRoute,
                      { kind: 'warp-trail' } | { kind: 'neutral-zone' }
                    >,
                  })
                }
              >
                Spool · {option.label}
              </button>
            ))}
            {snapshot.helm.showShieldsDown ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'DEPLOY_DISTRESS_BEACON',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Shields down
              </button>
            ) : null}
            {snapshot.helm.showShieldsUp ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'RAISE_SHIELDS',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Shields up
              </button>
            ) : null}
            {snapshot.helm.showPassRedAlert ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'PASS_RED_ALERT',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Pass Red Alert
              </button>
            ) : null}
            {snapshot.helm.showPass ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'PASS_TURN',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Pass
              </button>
            ) : null}
            {snapshot.dropToImpulsePending ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() =>
                  send({
                    type: 'DROP_TO_IMPULSE',
                    playerId: snapshot.handOwnerId,
                  })
                }
              >
                Drop to Impulse!
              </button>
            ) : null}
            {snapshot.canCatchDropToImpulse &&
            snapshot.dropToImpulseCatchTargetId ? (
              <button
                type="button"
                className={styles.controlBtn}
                onClick={() =>
                  send({
                    type: 'CATCH_DROP_TO_IMPULSE',
                    challengerId: snapshot.handOwnerId,
                    targetPlayerId: snapshot.dropToImpulseCatchTargetId!,
                  })
                }
              >
                Catch Drop to Impulse!
                {snapshot.dropToImpulseCatchLabel
                  ? ` (${snapshot.dropToImpulseCatchLabel})`
                  : ''}
              </button>
            ) : null}
          </div>
        ) : null}

        {snapshot?.game && !snapshot.handoffPending && !isDrafting ? (
          <>
            <ContinuumFlashPanel
              game={snapshot.game}
              playerId={snapshot.handOwnerId}
              names={snapshot.names}
              onInvoke={send}
            />
            <ContinuumWagerPanel
              game={snapshot.game}
              playerId={snapshot.handOwnerId}
              onResolve={send}
            />
            <HandExchangePanel
              game={snapshot.game}
              playerId={snapshot.handOwnerId}
              tileBg={snapshot.tileBg}
              onResolve={send}
            />
          </>
        ) : null}

        <p className={styles.hint}>
          Keep this window off the OBS crop. Draft picks, Continuum, Flash, and
          hand exchange open here when it is your seat.
        </p>
      </main>
    </DominoThemeProvider>
  );
}

export default LocalHandCompanionPage;
