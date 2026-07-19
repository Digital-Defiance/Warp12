import { useEffect, useMemo, useRef, useState } from 'react';

import type { GameState } from 'warp12-engine';

import { fetchAiCaptainHand, submitOnlineAction } from '../firebase';
import {
  aiCaptainToConfig,
  isAiCaptain,
  onlineAiSeed,
} from '../game/ai-captain.js';
import type { ActionLogEntry } from 'warp12-react';
import { playerIdForAction } from 'warp12-react';
import { buildAiRosterFromConfigsAsync } from '../game/create-local-game.js';
import type { AiCaptainConfig } from '../game/local-game-config.js';
import { mergeAiHandsIntoGame } from '../game/merge-ai-hands.js';
import {
  formatViolation,
  pendingResolutionActorId,
  pickBalancedTile,
  type WarpAiPlayer,
} from 'warp12-engine';
import type { FirestoreCaptain } from '../firebase/schema.js';

function violationMessage(violation: string): string {
  return formatViolation(violation);
}

const AI_TURN_DELAY_MS = 450;
const AI_RETRY_DELAY_MS = 800;
const AI_MAX_SUBMIT_RETRIES = 5;

export function extractAiCaptainConfigs(
  captains: readonly FirestoreCaptain[]
): AiCaptainConfig[] {
  return captains
    .map((captain) => aiCaptainToConfig(captain))
    .filter((config): config is AiCaptainConfig => config != null);
}

export function useHostAiRunner(options: {
  enabled: boolean;
  code: string;
  hostUid: string | undefined;
  hostId: string;
  game: GameState | null;
  sectorCaptains: readonly FirestoreCaptain[];
  aiHands: Readonly<Record<string, readonly { low: number; high: number }[]>>;
  syncPending: boolean;
  onError: (message: string) => void;
  onActionLogged?: (entry: Omit<ActionLogEntry, 'at'>) => void;
}): void {
  const aiBusy = useRef(false);
  const runId = useRef(0);
  const submitRetries = useRef(0);
  const [aiRetryTick, setAiRetryTick] = useState(0);
  const gameRef = useRef(options.game);
  const aiHandsRef = useRef(options.aiHands);
  const sectorCaptainsRef = useRef(options.sectorCaptains);

  gameRef.current = options.game;
  aiHandsRef.current = options.aiHands;
  sectorCaptainsRef.current = options.sectorCaptains;

  const aiCaptains = useMemo(
    () => extractAiCaptainConfigs(options.sectorCaptains),
    [options.sectorCaptains]
  );

  const objective = options.game?.objective ?? 'points';
  const [roster, setRoster] = useState<ReadonlyMap<
    string,
    WarpAiPlayer
  > | null>(null);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;

  useEffect(() => {
    if (!options.enabled || aiCaptains.length === 0) {
      setRoster(null);
      return;
    }
    let cancelled = false;
    const tableSize =
      options.game?.captains.length ?? options.sectorCaptains.length;
    void buildAiRosterFromConfigsAsync(
      aiCaptains,
      objective,
      onlineAiSeed(options.code),
      tableSize,
      options.game?.maxPip ?? 12,
      options.game?.modules
    )
      .then((next) => {
        if (!cancelled) setRoster(next);
      })
      .catch((error) => {
        console.error('[omega] host AI roster failed', error);
        if (!cancelled) {
          setRoster(null);
          options.onError(
            'Could not load Commander (Ω) weights for AI officers. Check the host connection and try again.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    aiCaptains,
    objective,
    options.code,
    options.enabled,
    options.game?.captains.length,
    options.game?.maxPip,
    options.game?.modules,
    options.onError,
    options.sectorCaptains.length,
  ]);

  const activePlayerId = options.game?.round?.activePlayerId;
  const handExchangeActorId =
    options.game?.round?.handExchangePending?.largerPlayerId ?? null;
  const roundPhase = options.game?.round?.phase;
  const dropToImpulseCatchable = options.game?.round?.dropToImpulseCatchable ?? null;
  const dropToImpulseEnabled = options.game?.houseRules.dropToImpulseCall === true;

  useEffect(() => {
    submitRetries.current = 0;
  }, [activePlayerId, roundPhase, handExchangeActorId]);

  useEffect(() => {
    const {
      enabled,
      code,
      hostUid,
      hostId,
      syncPending,
      onError,
    } = options;

    if (
      !enabled ||
      !hostUid ||
      hostUid !== hostId ||
      !rosterRef.current ||
      syncPending ||
      !dropToImpulseEnabled ||
      !dropToImpulseCatchable
    ) {
      return;
    }

    const aiChallenger = sectorCaptainsRef.current.find(
      (captain) =>
        isAiCaptain(captain) && captain.id !== dropToImpulseCatchable
    );
    if (!aiChallenger || aiBusy.current) {
      return;
    }

    const currentRun = ++runId.current;
    aiBusy.current = true;

    const runAiCatch = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, AI_TURN_DELAY_MS));
      if (currentRun !== runId.current) {
        return;
      }

      const action = {
        type: 'CATCH_DROP_TO_IMPULSE' as const,
        challengerId: aiChallenger.id,
        targetPlayerId: dropToImpulseCatchable,
      };

      try {
        const result = await submitOnlineAction(code, hostUid, action);
        if (currentRun !== runId.current) {
          return;
        }
        options.onActionLogged?.({
          playerId: playerIdForAction(action),
          action,
          ok: result.ok,
          violation: result.ok ? undefined : result.violation,
          source: 'ai',
        });
        if (!result.ok) {
          onError(violationMessage(result.violation));
        }
      } catch (err) {
        if (currentRun !== runId.current) {
          return;
        }
        onError(
          err instanceof Error ? err.message : 'Could not transmit AI catch'
        );
      }
    };

    void runAiCatch().finally(() => {
      if (currentRun === runId.current) {
        aiBusy.current = false;
      }
    });

    return () => {
      runId.current += 1;
      aiBusy.current = false;
    };
  }, [
    dropToImpulseCatchable,
    dropToImpulseEnabled,
    options.hostId,
    options.enabled,
    options.hostUid,
    options.code,
    options.syncPending,
    options.onError,
  ]);

  // Module Epsilon: host proxies AI pack picks while the round is drafting.
  useEffect(() => {
    const {
      enabled,
      code,
      hostUid,
      hostId,
      syncPending,
      onError,
    } = options;

    if (
      !enabled ||
      !hostUid ||
      hostUid !== hostId ||
      syncPending ||
      !activePlayerId ||
      roundPhase !== 'drafting'
    ) {
      return;
    }

    const activeCaptain = sectorCaptainsRef.current.find(
      (captain) => captain.id === activePlayerId
    );
    if (!activeCaptain || !isAiCaptain(activeCaptain)) {
      return;
    }

    if (aiBusy.current) {
      return;
    }

    const currentRun = ++runId.current;
    aiBusy.current = true;

    const runAiDraftPick = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, AI_TURN_DELAY_MS));
      if (currentRun !== runId.current) {
        return;
      }

      const game = gameRef.current;
      const round = game?.round;
      if (
        !game ||
        !round ||
        round.phase !== 'drafting' ||
        !round.draftState ||
        round.activePlayerId !== activePlayerId
      ) {
        return;
      }

      const pack = round.draftState.currentPacks[activePlayerId];
      if (!pack || pack.length === 0) {
        onError(`${activeCaptain.displayName} has an empty draft pack`);
        return;
      }

      const action = {
        type: 'PICK_FROM_PACK' as const,
        playerId: activePlayerId,
        coordinate: pickBalancedTile(activePlayerId, pack),
      };

      try {
        const result = await submitOnlineAction(code, hostUid, action);
        if (currentRun !== runId.current) {
          return;
        }
        options.onActionLogged?.({
          playerId: playerIdForAction(action),
          action,
          ok: result.ok,
          violation: result.ok ? undefined : result.violation,
          source: 'ai',
        });
        if (!result.ok) {
          if (submitRetries.current < AI_MAX_SUBMIT_RETRIES) {
            submitRetries.current += 1;
            window.setTimeout(
              () => setAiRetryTick((tick) => tick + 1),
              AI_RETRY_DELAY_MS
            );
            return;
          }
          onError(violationMessage(result.violation));
          return;
        }
        submitRetries.current = 0;
      } catch (err) {
        if (currentRun !== runId.current) {
          return;
        }
        if (submitRetries.current < AI_MAX_SUBMIT_RETRIES) {
          submitRetries.current += 1;
          window.setTimeout(
            () => setAiRetryTick((tick) => tick + 1),
            AI_RETRY_DELAY_MS
          );
          return;
        }
        onError(
          err instanceof Error ? err.message : 'Could not transmit AI draft pick'
        );
      }
    };

    void runAiDraftPick().finally(() => {
      if (currentRun === runId.current) {
        aiBusy.current = false;
      }
    });

    return () => {
      runId.current += 1;
      aiBusy.current = false;
    };
  }, [
    activePlayerId,
    aiRetryTick,
    options.hostId,
    options.enabled,
    options.hostUid,
    options.code,
    options.syncPending,
    options.onError,
    roundPhase,
  ]);

  useEffect(() => {
    const {
      enabled,
      code,
      hostUid,
      hostId,
      syncPending,
      onError,
    } = options;

    if (
      !enabled ||
      !hostUid ||
      hostUid !== hostId ||
      !rosterRef.current ||
      syncPending ||
      roundPhase !== 'playing'
    ) {
      return;
    }

    const gameNow = gameRef.current;
    const actorId = gameNow?.round
      ? pendingResolutionActorId(gameNow.round)
      : activePlayerId;
    if (!actorId) {
      return;
    }

    const activeCaptain = sectorCaptainsRef.current.find(
      (captain) => captain.id === actorId
    );
    if (!activeCaptain || !isAiCaptain(activeCaptain)) {
      return;
    }

    if (aiBusy.current) {
      return;
    }

    const currentRun = ++runId.current;
    aiBusy.current = true;

    const runAiTurn = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, AI_TURN_DELAY_MS));
      if (currentRun !== runId.current) {
        return;
      }

      const game = gameRef.current;
      const round = game?.round;
      if (!game || !round || round.phase !== 'playing') {
        return;
      }
      const decisionPlayerId = pendingResolutionActorId(round);
      if (decisionPlayerId !== actorId) {
        return;
      }

      const ai = rosterRef.current?.get(decisionPlayerId);
      if (!ai) {
        onError('AI officer roster unavailable');
        return;
      }

      let mirrored = aiHandsRef.current[decisionPlayerId];
      // Empty array is not nullish — treat a zero-length mirror as "unknown" and
      // fall back to getDoc (listeners can stay empty while one-shot reads work).
      let hand =
        mirrored != null && mirrored.length > 0
          ? mirrored
          : await fetchAiCaptainHand(code, decisionPlayerId);

      if (currentRun !== runId.current) {
        return;
      }

      const decisionState = mergeAiHandsIntoGame(game, {
        [decisionPlayerId]: hand ?? [],
      });
      const action = await ai.decideGameActionAsync(
        decisionState,
        decisionPlayerId
      );
      if (!action) {
        onError(`${activeCaptain.displayName} could not choose a move`);
        return;
      }

      try {
        const result = await submitOnlineAction(code, hostUid, action);
        if (currentRun !== runId.current) {
          return;
        }
        options.onActionLogged?.({
          playerId: playerIdForAction(action),
          action,
          ok: result.ok,
          violation: result.ok ? undefined : result.violation,
          source: 'ai',
        });
        if (!result.ok) {
          if (submitRetries.current < AI_MAX_SUBMIT_RETRIES) {
            submitRetries.current += 1;
            window.setTimeout(
              () => setAiRetryTick((tick) => tick + 1),
              AI_RETRY_DELAY_MS
            );
            return;
          }
          onError(violationMessage(result.violation));
          return;
        }
        submitRetries.current = 0;
      } catch (err) {
        if (currentRun !== runId.current) {
          return;
        }
        options.onActionLogged?.({
          playerId: playerIdForAction(action),
          action,
          ok: false,
          violation: 'GAME_NOT_ACTIVE',
          source: 'ai',
        });
        if (submitRetries.current < AI_MAX_SUBMIT_RETRIES) {
          submitRetries.current += 1;
          window.setTimeout(
            () => setAiRetryTick((tick) => tick + 1),
            AI_RETRY_DELAY_MS
          );
          return;
        }
        onError(
          err instanceof Error ? err.message : 'Could not transmit AI move'
        );
      }
    };

    void runAiTurn().finally(() => {
      if (currentRun === runId.current) {
        aiBusy.current = false;
      }
    });

    return () => {
      runId.current += 1;
      aiBusy.current = false;
    };
  }, [
    activePlayerId,
    handExchangeActorId,
    aiRetryTick,
    options.hostId,
    options.enabled,
    options.hostUid,
    options.code,
    options.syncPending,
    options.onError,
    roundPhase,
    roster,
  ]);
}
