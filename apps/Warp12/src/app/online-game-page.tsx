import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  applyAction,
  type ActionResult,
  type ActionViolation,
  type GameAction,
  type GameState,
} from '@warp12/Warp12-lib';

import {
  resetSectorToLobby,
  signalCoachRequest,
  subscribeCoachPresence,
  subscribeOnlineGame,
  submitOnlineAction,
  useFirebaseAuth,
  type CoachPresence,
} from '../firebase';
import { useBridgeFocus } from './bridge-focus-context';
import { BridgeTable } from './bridge-table';
import styles from './lobby.module.scss';

function violationMessage(violation: string): string {
  return violation.replaceAll('_', ' ').toLowerCase();
}

export function OnlineGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const auth = useFirebaseAuth();
  const [serverGame, setServerGame] = useState<GameState | null>(null);
  const [optimisticGame, setOptimisticGame] = useState<GameState | null>(null);
  const [hostId, setHostId] = useState('');
  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [coachPresence, setCoachPresence] = useState<
    Record<string, CoachPresence>
  >({});
  const [error, setError] = useState<string | null>(null);
  const endRoundInFlight = useRef(false);

  const uid = auth.user?.uid;
  const code = gameId?.toUpperCase() ?? '';
  const game = optimisticGame ?? serverGame;
  const { focus: bridgeFocus } = useBridgeFocus();

  useEffect(() => {
    if (!code || !uid || !auth.ready) {
      return;
    }

    return subscribeOnlineGame(
      code,
      uid,
      ({ state, handCounts: counts, connected: live, hostId: sectorHost }) => {
        setServerGame(state);
        setHostId(sectorHost);
        setHandCounts(counts);
        setConnected(live);
        setOptimisticGame(null);
        setSyncPending(false);
      },
      (err) => {
        setConnected(false);
        setError(err.message);
      }
    );
  }, [code, uid, auth.ready]);

  useEffect(() => {
    if (!code) {
      return;
    }

    return subscribeCoachPresence(code, setCoachPresence);
  }, [code]);

  useEffect(() => {
    if (!code || !uid || !auth.ready || !serverGame) {
      return;
    }
    const isMember = serverGame.captains.some((captain) => captain.id === uid);
    if (!isMember) {
      navigate(`/online/${code}`, { replace: true });
    }
  }, [code, uid, auth.ready, navigate, serverGame?.captains]);

  useEffect(() => {
    if (!code || !uid || !serverGame) {
      return;
    }
    const round = serverGame.round;
    if (!round || round.phase !== 'ended' || !round.roundWinnerId) {
      return;
    }
    if (endRoundInFlight.current) {
      return;
    }

    endRoundInFlight.current = true;
    void submitOnlineAction(code, uid, {
      type: 'END_ROUND',
      winnerId: round.roundWinnerId,
    })
      .then((result) => {
        if (!result.ok) {
          setError(violationMessage(result.violation));
        }
      })
      .finally(() => {
        endRoundInFlight.current = false;
      });
  }, [
    code,
    uid,
    serverGame?.round?.phase,
    serverGame?.round?.roundWinnerId,
  ]);

  const dispatch = useCallback(
    async (action: GameAction): Promise<ActionResult> => {
      if (!code || !uid || !serverGame) {
        return { ok: false, violation: 'GAME_NOT_ACTIVE' };
      }

      const preview = applyAction(serverGame, action);
      if (!preview.ok) {
        setError(violationMessage(preview.violation));
        return preview;
      }

      setOptimisticGame(preview.state);
      setSyncPending(true);
      setError(null);

      try {
        const result = await submitOnlineAction(code, uid, action);
        if (!result.ok) {
          setOptimisticGame(null);
          setError(violationMessage(result.violation));
          return { ok: false, violation: result.violation as ActionViolation };
        }

        return { ok: true, state: preview.state };
      } catch (err) {
        setOptimisticGame(null);
        setError(
          err instanceof Error ? err.message : 'Could not transmit move'
        );
        return { ok: false, violation: 'GAME_NOT_ACTIVE' };
      } finally {
        setSyncPending(false);
      }
    },
    [code, uid, serverGame]
  );

  const signalCoach = useCallback(async () => {
    if (!code || !uid || !serverGame?.round) {
      return;
    }
    await signalCoachRequest(code, uid, serverGame.round.roundNumber);
  }, [code, uid, serverGame?.round?.roundNumber]);

  const hostResetSector = async () => {
    if (!code || !uid) {
      return;
    }
    setError(null);
    try {
      await resetSectorToLobby(code, uid);
      navigate(`/online/${code}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset sector');
    }
  };

  if (!auth.ready || !game) {
    return (
      <p className={styles.waitingMessage}>
        {error ?? 'Establishing subspace link…'}
      </p>
    );
  }

  return (
    <div
      className={bridgeFocus ? styles.onlinePlayFocus : styles.onlinePlay}
    >
      <div className={styles.onlineStatusBar}>
        {uid && (
          <p className={styles.onlineBadge}>
            Sector {code} ·{' '}
            {game.captains.find((c) => c.id === uid)?.displayName ?? 'Captain'}
          </p>
        )}
        <p
          className={styles.connectionBadge}
          data-live={connected && !syncPending}
          role="status"
        >
          {syncPending
            ? 'Transmitting move…'
            : connected
              ? 'Subspace link active'
              : 'Reconnecting…'}
        </p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <BridgeTable
        mode="online"
        game={game}
        viewerId={uid ?? ''}
        handCounts={handCounts}
        onAction={dispatch}
        onLeave={() => navigate('/')}
        isOnlineHost={Boolean(uid && hostId === uid)}
        onHostResetSector={hostResetSector}
        syncPending={syncPending}
        coachPresence={coachPresence}
        onCoachSignal={signalCoach}
      />
    </div>
  );
}

export default OnlineGamePage;
