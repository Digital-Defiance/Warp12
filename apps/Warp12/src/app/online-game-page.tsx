import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  applyAction,
  squadronDisplayName,
  type ActionResult,
  type ActionViolation,
  type GameAction,
  type GameState,
} from 'warp12-engine';

import {
  dissolveLobby,
  fetchHostDebugSnapshot,
  resetSectorToLobby,
  signalCoachRequest,
  subscribeCoachPresence,
  subscribeOnlineGame,
  submitOnlineAction,
  useFirebaseAuth,
  type CoachPresence,
  type FirestoreCaptain,
  type FirestoreRoundMove,
} from '../firebase';
import { isAiCaptain } from '../game/ai-captain.js';
import {
  subscribeMessages,
  type SubspaceMessage,
} from '../firebase/messages.js';
import { CommsPanel } from './comms-panel.js';
import {
  createActionLog,
  playerIdForAction,
} from 'warp12-react';
import { downloadDebugExport } from '../game/debug-export.js';
import { useBridgeHeaderStatusRegistration } from './bridge-header-status-context';
import { BridgeTable } from './bridge-table';
import { useHostAiRunner } from './use-host-ai-runner';
import { formatViolation } from 'warp12-engine';
import styles from './lobby.module.scss';

function violationMessage(violation: string): string {
  return formatViolation(violation);
}

export function OnlineGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const auth = useFirebaseAuth();
  const [serverGame, setServerGame] = useState<GameState | null>(null);
  const [optimisticGame, setOptimisticGame] = useState<GameState | null>(null);
  const [hostId, setHostId] = useState('');
  const [sectorCaptains, setSectorCaptains] = useState<
    readonly FirestoreCaptain[]
  >([]);
  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [sectorRated, setSectorRated] = useState(true);
  const [moveLog, setMoveLog] = useState<readonly FirestoreRoundMove[]>([]);
  const [aiHands, setAiHands] = useState<
    Record<string, readonly { low: number; high: number }[]>
  >({});
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [coachPresence, setCoachPresence] = useState<
    Record<string, CoachPresence>
  >({});
  const [commsMessages, setCommsMessages] = useState<SubspaceMessage[]>([]);
  const [mutedUids, setMutedUids] = useState<Set<string>>(new Set());
  const [commsOpen, setCommsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const actionLogRef = useRef(createActionLog());
  const abandoningRef = useRef(false);

  const uid = auth.user?.uid;
  const code = gameId?.toUpperCase() ?? '';
  const game = optimisticGame ?? serverGame;
  const { setHeaderStatus } = useBridgeHeaderStatusRegistration();
  const isHost = Boolean(uid && hostId && hostId === uid);
  const onlineAiCaptainIds = useMemo(
    () =>
      new Set(
        sectorCaptains.filter(isAiCaptain).map((captain) => captain.id)
      ),
    [sectorCaptains]
  );

  useEffect(() => {
    if (!code || !uid || !auth.ready) {
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
        hostId: sectorHost,
        sectorCaptains: captains,
        aiHands: hostAiHands,
        rated,
        dissolved,
      }) => {
        if (dissolved) {
          setServerGame(null);
          setOptimisticGame(null);
          setHeaderStatus(null);
          if (abandoningRef.current) {
            abandoningRef.current = false;
            return;
          }
          navigate('/online', {
            replace: true,
            state: { callSignNotice: 'Sector dissolved by the host.' },
          });
          return;
        }
        if (!state) {
          return;
        }
        setServerGame(state);
        setHostId(sectorHost);
        setSectorCaptains(captains);
        setSectorRated(rated);
        setHandCounts(counts);
        setMoveLog(sharedMoveLog);
        setAiHands(hostAiHands);
        setConnected(live);
        setSynced(inSync);
        setOptimisticGame(null);
        setSyncPending(false);
      },
      (err) => {
        setConnected(false);
        setSynced(false);
        setError(err.message);
      }
    );
  }, [code, uid, auth.ready, navigate, setHeaderStatus]);

  useEffect(() => {
    if (!code || !serverGame || serverGame.phase !== 'lobby') {
      return;
    }
    navigate(`/online/${code}`, {
      replace: true,
      state: {
        callSignNotice: 'Host returned the sector to the waiting room.',
      },
    });
  }, [code, navigate, serverGame]);

  useEffect(() => {
    if (!code) {
      return;
    }

    return subscribeCoachPresence(code, setCoachPresence);
  }, [code]);

  useEffect(() => {
    if (!code) {
      return;
    }
    return subscribeMessages(code, setCommsMessages);
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

  const dispatch = useCallback(
    async (action: GameAction): Promise<ActionResult> => {
      const baseGame = optimisticGame ?? serverGame;
      if (!code || !uid || !baseGame) {
        return { ok: false, violation: 'GAME_NOT_ACTIVE' };
      }

      const preview = applyAction(baseGame, action);
      if (!preview.ok) {
        actionLogRef.current.append({
          playerId: playerIdForAction(action),
          action,
          ok: false,
          violation: preview.violation,
          source: 'human',
        });
        setError(violationMessage(preview.violation));
        return preview;
      }

      setOptimisticGame(preview.state);
      setSyncPending(true);
      setError(null);

      try {
        const result = await submitOnlineAction(code, uid, action);
        actionLogRef.current.append({
          playerId: playerIdForAction(action),
          action,
          ok: result.ok,
          violation: result.ok ? undefined : result.violation,
          source: 'human',
        });
        if (!result.ok) {
          setOptimisticGame(null);
          setError(violationMessage(result.violation));
          return { ok: false, violation: result.violation as ActionViolation };
        }

        return { ok: true, state: preview.state };
      } catch (err) {
        actionLogRef.current.append({
          playerId: playerIdForAction(action),
          action,
          ok: false,
          violation: 'GAME_NOT_ACTIVE',
          source: 'human',
        });
        setOptimisticGame(null);
        setError(
          err instanceof Error ? err.message : 'Could not transmit move'
        );
        return { ok: false, violation: 'GAME_NOT_ACTIVE' };
      } finally {
        setSyncPending(false);
      }
    },
    [code, uid, serverGame, optimisticGame]
  );

  const reportAiError = useCallback((message: string) => {
    setError(message);
  }, []);

  const logAction = useCallback(
    (entry: Parameters<typeof actionLogRef.current.append>[0]) => {
      actionLogRef.current.append(entry);
    },
    []
  );

  useHostAiRunner({
    enabled: isHost,
    code,
    hostUid: uid,
    hostId,
    game: serverGame,
    sectorCaptains,
    aiHands,
    syncPending,
    onError: reportAiError,
    onActionLogged: logAction,
  });

  useEffect(() => {
    if (!auth.ready || !game || !uid) {
      setHeaderStatus(null);
      return;
    }

    const captainName =
      game.captains.find((captain) => captain.id === uid)?.displayName ??
      'Captain';

    const connectionLabel = syncPending
      ? 'Transmitting move…'
      : !connected
        ? 'Reconnecting…'
        : synced
          ? 'Subspace IWDF link active'
          : 'Resyncing subspace IWDF link…';

    const connectionState = syncPending
      ? 'pending'
      : !connected
        ? 'pending'
        : synced
          ? 'live'
          : 'stale';

    setHeaderStatus({
      sectorLabel: `Sector ${code} · ${captainName}`,
      connectionLabel,
      connectionState,
    });

    return () => setHeaderStatus(null);
  }, [
    auth.ready,
    code,
    connected,
    synced,
    game,
    setHeaderStatus,
    syncPending,
    uid,
  ]);

  const signalCoach = useCallback(async () => {
    if (!code || !uid || !serverGame?.round) {
      return;
    }
    await signalCoachRequest(code, uid, serverGame.round.roundNumber);
  }, [code, uid, serverGame?.round?.roundNumber]);

  const handleMute = useCallback((targetUid: string) => {
    setMutedUids((prev) => new Set([...prev, targetUid]));
  }, []);

  const toggleComms = useCallback(() => {
    setCommsOpen((open) => !open);
  }, []);

  const commsPhase: 'lobby' | 'active' | 'complete' =
    game?.phase === 'active' ? 'active' : game?.phase === 'complete' ? 'complete' : 'lobby';
  const viewerSquadronId = sectorCaptains.find((c) => c.id === uid)?.squadronId;
  const viewerSquadronName = useMemo(() => {
    const squadrons = game?.squadrons;
    if (!squadrons || !viewerSquadronId) {
      return undefined;
    }
    const squad = squadrons.find((s) => s.id === viewerSquadronId);
    return squad ? squadronDisplayName(squadrons, squad) : undefined;
  }, [game?.squadrons, viewerSquadronId]);

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

  const hostAbandonSector = useCallback(async () => {
    if (!code || !uid) {
      return;
    }
    setError(null);
    try {
      abandoningRef.current = true;
      await dissolveLobby(code, uid);
      setHeaderStatus(null);
      navigate('/', { replace: true });
    } catch (err) {
      abandoningRef.current = false;
      setError(
        err instanceof Error ? err.message : 'Could not abandon sector'
      );
    }
  }, [code, navigate, setHeaderStatus, uid]);

  const exportDebug = async () => {
    if (!code || !uid || !serverGame) {
      return;
    }
    setExportBusy(true);
    try {
      const exportedAt = new Date().toISOString();
      const captainIds = serverGame.captains.map((captain) => captain.id);
      const firestore = await fetchHostDebugSnapshot(code, captainIds);
      const notes = [
        'Host export includes all captain hands and a merged fullGameState.',
        'Deploy updated firestore.rules for host hand reads in production.',
      ];
      if (Object.keys(firestore.handReadErrors).length > 0) {
        notes.push(
          `Hand read errors: ${Object.keys(firestore.handReadErrors).join(', ')}`
        );
      }

      downloadDebugExport({
        exportedAt,
        mode: 'online',
        sectorCode: code,
        viewerId: uid,
        hostId,
        client: {
          connected,
          syncPending,
          displayGameState: game,
          serverGameState: serverGame,
          optimisticGameState: optimisticGame,
          fullGameState: firestore.fullGameState,
          handCounts,
          aiHands,
          coachPresence,
          sectorCaptains,
          actionLog: actionLogRef.current.snapshot(),
        },
        firestore,
        notes,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not export debug data'
      );
    } finally {
      setExportBusy(false);
    }
  };

  if (!auth.ready || !game) {
    return (
      <p className={styles.waitingMessage}>
        {error ?? 'Establishing subspace IWDF link…'}
      </p>
    );
  }

  return (
    <div className={styles.onlinePlay}>
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
        onlineAiCaptainIds={onlineAiCaptainIds}
        onlineCaptains={sectorCaptains}
        sectorRated={sectorRated}
        onlineMoveLog={moveLog}
        onAction={dispatch}
        onLeave={() => navigate('/')}
        isOnlineHost={isHost}
        onHostAbandonSector={isHost ? hostAbandonSector : undefined}
        onHostResetSector={isHost ? hostResetSector : undefined}
        onExportDebug={isHost ? exportDebug : undefined}
        debugExportBusy={exportBusy}
        sectorCode={code}
        syncPending={syncPending}
        coachPresence={coachPresence}
        onCoachSignal={signalCoach}
        commsControl={{ open: commsOpen, onToggle: toggleComms }}
      />
      {commsOpen && uid && (
        <CommsPanel
          gameId={code}
          viewerUid={uid}
          viewerName={
            sectorCaptains.find((c) => c.id === uid)?.displayName ?? 'Captain'
          }
          messages={commsMessages}
          rated={sectorRated}
          phase={commsPhase}
          captains={sectorCaptains}
          viewerSquadronId={viewerSquadronId}
          viewerSquadronName={viewerSquadronName}
          muted={mutedUids}
          onMute={handleMute}
        />
      )}
    </div>
  );
}

export default OnlineGamePage;
