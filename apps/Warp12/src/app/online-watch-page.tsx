import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { GameState } from 'warp12-engine';

import {
  subscribeCoachPresence,
  subscribeOnlineGame,
  useFirebaseAuth,
  type CoachPresence,
  type FirestoreCaptain,
  type FirestoreRoundMove,
} from '../firebase';
import {
  subscribeMessages,
  subscribePublicMessages,
  type SubspaceMessage,
} from '../firebase/messages.js';
import { leaveSpectate, joinSpectate } from '../firebase/spectate-service.js';
import { userHasAdminRole } from '../firebase/warp-auth-roles.js';
import { useBridgeHeaderStatusRegistration } from './bridge-header-status-context';
import { BridgeTable } from './bridge-table';
import { CommsPanel } from './comms-panel.js';
import styles from './lobby.module.scss';

/**
 * Read-only gallery / ops supervision view.
 * - Public spectate: `/online/:gameId/watch`
 * - Silent supervision: `/online/:gameId/watch?ops=1` (admin claim)
 */
export function OnlineWatchPage() {
  const { gameId: routeGameId } = useParams();
  const [searchParams] = useSearchParams();
  const wantSupervise = searchParams.get('ops') === '1';
  const navigate = useNavigate();
  const auth = useFirebaseAuth();
  const { setHeaderStatus } = useBridgeHeaderStatusRegistration();

  const code = routeGameId?.toUpperCase() ?? '';
  const uid = auth.user?.uid;

  const [mode, setMode] = useState<'spectate' | 'supervise' | null>(null);
  /** Public gallery: must be listed in spectatorIds before message queries work. */
  const [galleryJoined, setGalleryJoined] = useState(false);
  const [serverGame, setServerGame] = useState<GameState | null>(null);
  const [sectorCaptains, setSectorCaptains] = useState<FirestoreCaptain[]>([]);
  const [sectorRated, setSectorRated] = useState(true);
  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [moveLog, setMoveLog] = useState<FirestoreRoundMove[]>([]);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [commsMessages, setCommsMessages] = useState<SubspaceMessage[]>([]);
  const [coachPresence, setCoachPresence] = useState<
    Record<string, CoachPresence>
  >({});
  const [commsOpen, setCommsOpen] = useState(true);

  useEffect(() => {
    if (!auth.ready || !auth.user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      if (wantSupervise) {
        const ok = await userHasAdminRole(auth.user!, { forceRefresh: true });
        if (cancelled) {
          return;
        }
        if (!ok) {
          setError('Admin claim required for silent supervision.');
          setMode(null);
          return;
        }
        setGalleryJoined(true);
        setMode('supervise');
        return;
      }
      setMode('spectate');
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, auth.user, wantSupervise]);

  // Deep-linked /watch must register in spectatorIds — lobby "Spectate" does
  // this before navigate; opening the share URL alone previously skipped it.
  useEffect(() => {
    if (!code || !uid || !auth.ready || mode !== 'spectate') {
      return;
    }
    let cancelled = false;
    setGalleryJoined(false);
    void (async () => {
      try {
        await joinSpectate(code);
        if (!cancelled) {
          setError(null);
          setGalleryJoined(true);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Could not join the gallery.';
        console.warn('[spectate] joinSpectate failed', err);
        setError(message);
        setGalleryJoined(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, uid, auth.ready, mode]);

  useEffect(() => {
    if (!code || !uid || !auth.ready || !mode) {
      return;
    }
    if (mode === 'spectate' && !galleryJoined) {
      return;
    }

    return subscribeOnlineGame(
      code,
      uid,
      ({
        state,
        handCounts: counts,
        moveLog: sharedMoveLog,
        connected: live,
        synced: inSync,
        sectorCaptains: captains,
        rated,
        dissolved,
        ejected,
        terminated,
        spectatorCount: gallery,
      }) => {
        if (dissolved || terminated) {
          navigate('/online', {
            replace: true,
            state: {
              callSignNotice: terminated
                ? 'This sector was terminated by Ops.'
                : 'Sector dissolved by the host.',
            },
          });
          return;
        }
        if (mode === 'spectate' && ejected) {
          navigate(`/online/${code}`, {
            replace: true,
            state: {
              callSignNotice:
                'Spectating is closed for this sector (or you were dropped).',
            },
          });
          return;
        }
        if (!state) {
          if (captains.some((c) => c.id === uid)) {
            navigate(`/online/${code}/play`, { replace: true });
          }
          return;
        }
        setServerGame(state);
        setSectorCaptains(captains);
        setSectorRated(rated);
        setHandCounts(counts);
        setMoveLog(sharedMoveLog);
        setConnected(live);
        setSynced(inSync);
        setSpectatorCount(gallery);
      },
      (err) => {
        console.warn('[spectate] game subscription failed', err);
        setError(err.message);
      },
      mode
    );
  }, [code, uid, auth.ready, mode, galleryJoined, navigate]);

  useEffect(() => {
    if (!code || !mode) {
      return;
    }
    if (mode === 'spectate' && !galleryJoined) {
      return;
    }
    if (mode === 'supervise') {
      return subscribeMessages(code, setCommsMessages, (err) => {
        console.warn('[spectate] messages subscription failed', err);
        setError(err.message);
      });
    }
    return subscribePublicMessages(code, setCommsMessages, (err) => {
      console.warn('[spectate] public messages subscription failed', err);
      setError(err.message);
    });
  }, [code, mode, galleryJoined]);

  useEffect(() => {
    if (!code || mode !== 'supervise') {
      return;
    }
    return subscribeCoachPresence(code, setCoachPresence);
  }, [code, mode]);

  useEffect(() => {
    if (!auth.ready || !serverGame || !code) {
      setHeaderStatus(null);
      return;
    }
    setHeaderStatus({
      sectorLabel: `Sector ${code} · ${
        mode === 'supervise' ? 'Supervision' : 'Spectating'
      }${
        mode === 'spectate' && spectatorCount > 0
          ? ` · ${spectatorCount} watching`
          : ''
      }`,
      connectionLabel: !connected
        ? 'Reconnecting…'
        : synced
          ? 'Gallery link active'
          : 'Resyncing…',
      connectionState: !connected ? 'pending' : synced ? 'live' : 'stale',
    });
    return () => setHeaderStatus(null);
  }, [
    auth.ready,
    code,
    connected,
    synced,
    serverGame,
    setHeaderStatus,
    mode,
    spectatorCount,
  ]);

  const leave = useCallback(async () => {
    if (code && mode === 'spectate') {
      try {
        await leaveSpectate(code);
      } catch {
        // best-effort
      }
    }
    navigate(`/online/${code}`);
  }, [code, mode, navigate]);

  const spectatorNames = useMemo(
    () =>
      sectorCaptains.map((c) => ({ id: c.id, displayName: c.displayName })),
    [sectorCaptains]
  );

  if (!auth.ready) {
    return <p className={styles.waitingMessage}>Loading…</p>;
  }

  if (!auth.configured) {
    return (
      <p className={styles.waitingMessage} role="alert">
        Firebase is not configured — spectate unavailable.{' '}
        <Link to="/">Back</Link>
      </p>
    );
  }

  if (error && !serverGame) {
    return (
      <section className={styles.waitingRoom}>
        <p role="alert">{error}</p>
        <p>
          <Link to={`/online/${code}`}>Back to sector</Link>
        </p>
      </section>
    );
  }

  if (
    !uid ||
    !mode ||
    (mode === 'spectate' && !galleryJoined) ||
    !serverGame
  ) {
    return (
      <p className={styles.waitingMessage} role="status">
        Opening gallery…
      </p>
    );
  }

  const phase =
    serverGame.phase === 'lobby' ||
    serverGame.phase === 'active' ||
    serverGame.phase === 'complete' ||
    serverGame.phase === 'round-end'
      ? serverGame.phase
      : 'active';

  return (
    <div className={styles.onlinePlay}>
      <div className={styles.actions} style={{ marginBottom: '0.75rem' }}>
        <button type="button" onClick={() => void leave()}>
          Leave gallery
        </button>
        <button
          type="button"
          aria-pressed={commsOpen}
          onClick={() => setCommsOpen((o) => !o)}
        >
          {commsOpen ? 'Hide subspace' : 'Show subspace'}
        </button>
        <span role="status">
          {mode === 'supervise'
            ? 'Silent supervision — not listed in spectator count'
            : `Spectating · ${spectatorCount} watching · hands hidden`}
        </span>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <BridgeTable
        mode="online"
        game={serverGame}
        viewerId={uid}
        handCounts={handCounts}
        onlineCaptains={sectorCaptains}
        sectorRated={sectorRated}
        onlineMoveLog={moveLog}
        coachPresence={mode === 'supervise' ? coachPresence : {}}
      />
      {commsOpen ? (
        <CommsPanel
          gameId={code}
          viewerUid={uid}
          viewerName="Spectator"
          messages={commsMessages}
          rated={sectorRated}
          phase={phase}
          captains={spectatorNames}
          readOnly
        />
      ) : null}
    </div>
  );
}
