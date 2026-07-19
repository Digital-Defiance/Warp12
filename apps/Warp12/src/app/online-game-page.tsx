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
  clearSpectatorGallery,
  dissolveLobby,
  fetchHostDebugSnapshot,
  hostDropCaptain,
  hostLeaveWithAi,
  hostMuteInSector,
  hostReplaceCaptainWithAi,
  hostTransferHost,
  pauseSector,
  pingSeatPresence,
  resetSectorToLobby,
  resumeSector,
  SEAT_HEARTBEAT_MS,
  isSeatStale,
  signalCoachRequest,
  subscribeCoachPresence,
  subscribeOnlineGame,
  submitOnlineAction,
  updateLobbySettings,
  useFirebaseAuth,
  type CoachPresence,
  type FirestoreCaptain,
  type FirestoreRoundMove,
} from '../firebase';
import {
  reportSectorCaptain,
  type PlayerReportCategory,
} from '../firebase/moderation-reports.js';
import { isAiCaptain } from '../game/ai-captain.js';
import { HostMissingCaptainDialog } from './host-missing-captain-dialog.js';
import { HostModDialog } from './host-mod-dialog.js';
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
import { formatViolation, type WarpSkillLevel } from 'warp12-engine';
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
  const [allowSpectate, setAllowSpectate] = useState(true);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [sectorPaused, setSectorPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | undefined>();
  const [missingCaptainId, setMissingCaptainId] = useState<string | null>(null);
  const [missingBusy, setMissingBusy] = useState(false);
  const dismissedMissingRef = useRef(new Set<string>());
  const seatGraceStartedRef = useRef<Record<string, number>>({});
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
  const [hostModOpen, setHostModOpen] = useState(false);
  const [hostModBusy, setHostModBusy] = useState(false);
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
        ejected,
        terminated,
        allowSpectate: spectateAllowed,
        spectatorCount: galleryCount,
        paused,
        pauseReason: pauseNote,
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
        if (ejected) {
          setServerGame(null);
          setOptimisticGame(null);
          setHeaderStatus(null);
          navigate('/online', {
            replace: true,
            state: {
              callSignNotice: terminated
                ? 'This sector was terminated by Ops.'
                : 'You were removed from this sector by Ops.',
            },
          });
          return;
        }
        if (terminated) {
          setServerGame(null);
          setOptimisticGame(null);
          setHeaderStatus(null);
          navigate('/online', {
            replace: true,
            state: { callSignNotice: 'This sector was terminated by Ops.' },
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
        setAllowSpectate(spectateAllowed);
        setSpectatorCount(galleryCount);
        setSectorPaused(paused);
        setPauseReason(pauseNote);
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

  // Seat heartbeat — every human pings so the host can spot dropouts.
  useEffect(() => {
    if (!code || !uid || !serverGame || serverGame.phase !== 'active') {
      return;
    }
    void pingSeatPresence(code, uid).catch(() => undefined);
    const timer = window.setInterval(() => {
      void pingSeatPresence(code, uid).catch(() => undefined);
    }, SEAT_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [code, uid, serverGame?.phase]);

  // Host: prompt when a human seat goes silent.
  useEffect(() => {
    if (
      !isHost ||
      !uid ||
      !serverGame ||
      serverGame.phase !== 'active' ||
      sectorPaused
    ) {
      return;
    }
    const now = Date.now();
    for (const captain of sectorCaptains) {
      if (isAiCaptain(captain) || captain.id === uid) {
        continue;
      }
      if (!seatGraceStartedRef.current[captain.id]) {
        seatGraceStartedRef.current[captain.id] = now;
      }
      if (now - seatGraceStartedRef.current[captain.id]! < SEAT_HEARTBEAT_MS * 2) {
        continue;
      }
      if (dismissedMissingRef.current.has(captain.id)) {
        if (!isSeatStale(coachPresence[captain.id], now)) {
          dismissedMissingRef.current.delete(captain.id);
        }
        continue;
      }
      if (isSeatStale(coachPresence[captain.id], now)) {
        setMissingCaptainId(captain.id);
        return;
      }
    }
    setMissingCaptainId((current) => {
      if (!current) {
        return null;
      }
      return isSeatStale(coachPresence[current], now) ? current : null;
    });
  }, [
    coachPresence,
    isHost,
    sectorCaptains,
    sectorPaused,
    serverGame,
    uid,
  ]);

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
    enabled: isHost && !sectorPaused,
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

  const missingCaptainName =
    sectorCaptains.find((c) => c.id === missingCaptainId)?.displayName ??
    'Captain';

  const hostPauseSector = useCallback(
    async (reason?: string) => {
      if (!code || !uid) {
        return;
      }
      setError(null);
      try {
        await pauseSector(code, uid, reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not pause sector');
      }
    },
    [code, uid]
  );

  const hostResumeSector = useCallback(async () => {
    if (!code) {
      return;
    }
    setError(null);
    try {
      await resumeSector(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume sector');
    }
  }, [code]);

  const handleMissingPause = useCallback(async () => {
    if (!missingCaptainId) {
      return;
    }
    setMissingBusy(true);
    try {
      await hostPauseSector(`Waiting for ${missingCaptainName}`);
      setMissingCaptainId(null);
    } finally {
      setMissingBusy(false);
    }
  }, [hostPauseSector, missingCaptainId, missingCaptainName]);

  const handleMissingDrop = useCallback(async () => {
    if (!code || !missingCaptainId) {
      return;
    }
    setMissingBusy(true);
    setError(null);
    try {
      await hostDropCaptain(
        code,
        missingCaptainId,
        `Offline: ${missingCaptainName}`
      );
      dismissedMissingRef.current.add(missingCaptainId);
      setMissingCaptainId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not drop captain seat'
      );
    } finally {
      setMissingBusy(false);
    }
  }, [code, missingCaptainId, missingCaptainName]);

  const handleMissingAbort = useCallback(async () => {
    setMissingBusy(true);
    try {
      await hostAbandonSector();
    } finally {
      setMissingBusy(false);
    }
  }, [hostAbandonSector]);

  const handleMissingDismiss = useCallback(() => {
    if (missingCaptainId) {
      dismissedMissingRef.current.add(missingCaptainId);
    }
    setMissingCaptainId(null);
  }, [missingCaptainId]);

  const hostClearSpectators = useCallback(async () => {
    if (!code || !uid) {
      return;
    }
    setHostModBusy(true);
    setError(null);
    try {
      await clearSpectatorGallery(code, uid);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not clear spectator gallery'
      );
    } finally {
      setHostModBusy(false);
    }
  }, [code, uid]);

  const hostSetAllowSpectate = useCallback(
    async (allow: boolean) => {
      if (!code || !uid) {
        return;
      }
      setHostModBusy(true);
      setError(null);
      try {
        await updateLobbySettings(code, uid, { allowSpectate: allow });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not update spectator access'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code, uid]
  );

  const hostReportCaptain = useCallback(
    async (input: {
      targetUid: string;
      category: PlayerReportCategory;
      reason: string;
    }) => {
      if (!code) {
        throw new Error('Sector code unavailable');
      }
      return reportSectorCaptain({
        gameId: code,
        ...input,
      });
    },
    [code]
  );

  const hostDropSelectedCaptain = useCallback(
    async (targetUid: string) => {
      if (!code) {
        return;
      }
      const name =
        sectorCaptains.find((captain) => captain.id === targetUid)
          ?.displayName ?? 'Captain';
      setHostModBusy(true);
      setError(null);
      try {
        await hostDropCaptain(code, targetUid, `Host drop: ${name}`);
        setHostModOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not drop captain seat'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code, sectorCaptains]
  );

  const hostReplaceSelectedWithAi = useCallback(
    async (targetUid: string, skill: WarpSkillLevel) => {
      if (!code) {
        return;
      }
      setHostModBusy(true);
      setError(null);
      try {
        await hostReplaceCaptainWithAi(code, targetUid, skill);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not replace seat with AI'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code]
  );

  const hostMuteSelected = useCallback(
    async (targetUid: string, reason: string) => {
      if (!code) {
        return;
      }
      setHostModBusy(true);
      setError(null);
      try {
        await hostMuteInSector(code, targetUid, reason);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not mute captain'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code]
  );

  const hostTransferSelected = useCallback(
    async (newHostId: string) => {
      if (!code) {
        return;
      }
      setHostModBusy(true);
      setError(null);
      try {
        await hostTransferHost(code, newHostId);
        setHostModOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not transfer host'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code]
  );

  const hostLeaveContinue = useCallback(
    async (input: { newHostId: string; skill: WarpSkillLevel }) => {
      if (!code) {
        return;
      }
      setHostModBusy(true);
      setError(null);
      try {
        abandoningRef.current = true;
        await hostLeaveWithAi(code, input);
        setHeaderStatus(null);
        navigate('/', {
          replace: true,
          state: {
            callSignNotice:
              'You left the sector — an AI took your seat and host transferred.',
          },
        });
      } catch (err) {
        abandoningRef.current = false;
        setError(
          err instanceof Error
            ? err.message
            : 'Could not leave with AI replacement'
        );
      } finally {
        setHostModBusy(false);
      }
    },
    [code, navigate, setHeaderStatus]
  );

  const hostDissolveFromMod = useCallback(async () => {
    setHostModBusy(true);
    try {
      await hostAbandonSector();
    } finally {
      setHostModBusy(false);
    }
  }, [hostAbandonSector]);

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
        'Host export merges captain hands into fullGameState when rules allow.',
      ];
      if (Object.keys(firestore.handReadErrors).length > 0) {
        notes.push(
          `Hand read errors: ${Object.keys(firestore.handReadErrors).join(', ')}`
        );
      }

      await downloadDebugExport({
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
      <HostMissingCaptainDialog
        open={Boolean(missingCaptainId) && isHost && !sectorPaused}
        captainName={missingCaptainName}
        onClose={handleMissingDismiss}
        onPause={() => void handleMissingPause()}
        onDropSeat={() => void handleMissingDrop()}
        onAbortSector={() => void handleMissingAbort()}
        busy={missingBusy}
      />
      <HostModDialog
        open={hostModOpen && isHost}
        onClose={() => setHostModOpen(false)}
        sectorCode={code}
        sectorPaused={sectorPaused}
        allowSpectate={allowSpectate}
        spectatorCount={spectatorCount}
        captains={sectorCaptains}
        hostId={hostId}
        busy={hostModBusy}
        onPause={async () => {
          setHostModBusy(true);
          try {
            await hostPauseSector();
          } finally {
            setHostModBusy(false);
          }
        }}
        onResume={async () => {
          setHostModBusy(true);
          try {
            await hostResumeSector();
          } finally {
            setHostModBusy(false);
          }
        }}
        onDissolve={() => void hostDissolveFromMod()}
        onClearSpectators={() => void hostClearSpectators()}
        onSetAllowSpectate={(allow) => void hostSetAllowSpectate(allow)}
        onReportCaptain={hostReportCaptain}
        onDropCaptain={(targetUid) => void hostDropSelectedCaptain(targetUid)}
        onReplaceWithAi={(targetUid, skill) =>
          void hostReplaceSelectedWithAi(targetUid, skill)
        }
        onMuteCaptain={(targetUid, reason) =>
          void hostMuteSelected(targetUid, reason)
        }
        onTransferHost={(newHostId) => void hostTransferSelected(newHostId)}
      />
      <BridgeTable
        mode="online"
        game={game}
        viewerId={uid ?? ''}
        handCounts={handCounts}
        onlineAiCaptainIds={onlineAiCaptainIds}
        onlineCaptains={sectorCaptains}
        sectorRated={sectorRated}
        sectorPaused={sectorPaused}
        pauseReason={pauseReason}
        onlineMoveLog={moveLog}
        allowSpectate={allowSpectate}
        onAction={dispatch}
        onLeave={() => navigate('/')}
        isOnlineHost={isHost}
        onHostAbandonSector={isHost ? hostAbandonSector : undefined}
        onHostResetSector={isHost ? hostResetSector : undefined}
        onHostLeaveWithAi={isHost ? hostLeaveContinue : undefined}
        hostLeaveBusy={hostModBusy}
        hostModControl={
          isHost ? { onOpen: () => setHostModOpen(true) } : undefined
        }
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
          allowSpectate={allowSpectate}
        />
      )}
    </div>
  );
}

export default OnlineGamePage;
