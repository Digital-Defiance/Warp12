type DocData = Record<string, unknown>;

export type ContinuityCaptain = {
  id: string;
  displayName?: string;
  isAi?: boolean;
  skill?: string;
  pointsScore?: number;
  joinedAt?: string;
  squadronId?: string;
  [key: string]: unknown;
};

export function isAiCaptain(captain: ContinuityCaptain): boolean {
  return captain.isAi === true || captain.id.startsWith('ai:');
}

/** Prefer a remaining human host; never hand the bridge to an AI. */
export function pickHumanHost(
  captains: readonly ContinuityCaptain[],
  excludeId: string
): string | null {
  const human = captains.find(
    (c) => c.id !== excludeId && !isAiCaptain(c)
  );
  return human?.id ?? null;
}

function remapIdMap(
  record: Record<string, unknown> | null | undefined,
  fromId: string,
  toId: string
): Record<string, unknown> | undefined {
  if (!record || typeof record !== 'object') {
    return undefined;
  }
  if (!(fromId in record)) {
    return { ...record };
  }
  const next = { ...record };
  next[toId] = next[fromId];
  delete next[fromId];
  return next;
}

function remapStringList(
  list: unknown,
  fromId: string,
  toId: string
): string[] | undefined {
  if (!Array.isArray(list)) {
    return undefined;
  }
  return list.map((id) => (id === fromId ? toId : String(id)));
}

/** Firestore rejects `undefined` field values — drop them before writes. */
export function omitUndefinedFields(data: DocData): DocData {
  const next: DocData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function remapSeatId(value: unknown, fromId: string, toId: string): unknown {
  if (value === fromId) {
    return toId;
  }
  return value === undefined ? null : value;
}

/**
 * Rename a seat id throughout the public round blob without removing the seat.
 */
export function remapPlayerInRound(
  round: DocData | null | undefined,
  fromId: string,
  toId: string
): DocData | null {
  if (!round || typeof round !== 'object') {
    return null;
  }

  const turnOrder =
    remapStringList(round.turnOrder, fromId, toId) ??
    (Array.isArray(round.turnOrder) ? [...(round.turnOrder as string[])] : []);

  const activePlayerId =
    round.activePlayerId === fromId ? toId : round.activePlayerId;

  const handCounts = remapIdMap(
    round.handCounts as Record<string, unknown> | undefined,
    fromId,
    toId
  );
  const debtTokens = remapIdMap(
    round.debtTokens as Record<string, unknown> | undefined,
    fromId,
    toId
  );

  const table = { ...((round.table as DocData) ?? {}) };
  if (Array.isArray(table.warpTrails)) {
    table.warpTrails = (table.warpTrails as DocData[]).map((trail) =>
      trail.trailPlayerId === fromId
        ? { ...trail, trailPlayerId: toId }
        : trail
    );
  }

  let continuumEffects = round.continuumEffects as DocData | null | undefined;
  if (continuumEffects && typeof continuumEffects === 'object') {
    const skip = remapStringList(
      continuumEffects.skipNextTurnFor,
      fromId,
      toId
    );
    continuumEffects = {
      ...continuumEffects,
      ...(skip ? { skipNextTurnFor: skip } : {}),
    };
  }

  let draftState = round.draftState as DocData | null | undefined;
  if (draftState && typeof draftState === 'object') {
    draftState = {
      ...draftState,
      currentDrafter:
        draftState.currentDrafter === fromId ? toId : draftState.currentDrafter,
      draftOrder:
        remapStringList(draftState.draftOrder, fromId, toId) ??
        draftState.draftOrder,
      currentPacks:
        remapIdMap(
          draftState.currentPacks as Record<string, unknown> | undefined,
          fromId,
          toId
        ) ?? draftState.currentPacks,
      pickedTiles:
        remapIdMap(
          draftState.pickedTiles as Record<string, unknown> | undefined,
          fromId,
          toId
        ) ?? draftState.pickedTiles,
    };
  }

  let squadrons = round.squadrons as DocData[] | undefined;
  if (Array.isArray(squadrons)) {
    squadrons = squadrons.map((squad) => ({
      ...squad,
      memberIds:
        remapStringList(squad.memberIds, fromId, toId) ?? squad.memberIds,
      trailKey: squad.trailKey === fromId ? toId : squad.trailKey,
    }));
  }

  let mandatoryPlay = round.mandatoryPlay as DocData | null | undefined;
  if (
    mandatoryPlay &&
    typeof mandatoryPlay === 'object' &&
    mandatoryPlay.playerId === fromId
  ) {
    mandatoryPlay = { ...mandatoryPlay, playerId: toId };
  }

  let pendingRoundWin = round.pendingRoundWin as DocData | null | undefined;
  if (
    pendingRoundWin &&
    typeof pendingRoundWin === 'object' &&
    pendingRoundWin.playerId === fromId
  ) {
    pendingRoundWin = { ...pendingRoundWin, playerId: toId };
  }

  let continuumWagerPending = round.continuumWagerPending as
    | DocData
    | null
    | undefined;
  if (
    continuumWagerPending &&
    typeof continuumWagerPending === 'object' &&
    continuumWagerPending.playerId === fromId
  ) {
    continuumWagerPending = { ...continuumWagerPending, playerId: toId };
  }

  let roundStarterOpening = round.roundStarterOpening as
    | DocData
    | null
    | undefined;
  if (
    roundStarterOpening &&
    typeof roundStarterOpening === 'object' &&
    roundStarterOpening.playerId === fromId
  ) {
    roundStarterOpening = { ...roundStarterOpening, playerId: toId };
  }

  return omitUndefinedFields({
    ...round,
    turnOrder,
    activePlayerId,
    ...(handCounts ? { handCounts } : {}),
    ...(debtTokens ? { debtTokens } : {}),
    table,
    continuumEffects: continuumEffects ?? round.continuumEffects ?? null,
    hazardMarkerHolder: remapSeatId(round.hazardMarkerHolder, fromId, toId),
    dropToImpulseCallPending: remapSeatId(
      round.dropToImpulseCallPending,
      fromId,
      toId
    ),
    dropToImpulseCatchable: remapSeatId(
      round.dropToImpulseCatchable,
      fromId,
      toId
    ),
    continuumPendingInvoker: remapSeatId(
      round.continuumPendingInvoker,
      fromId,
      toId
    ),
    roundWinnerId: remapSeatId(round.roundWinnerId, fromId, toId),
    mandatoryPlay: mandatoryPlay ?? round.mandatoryPlay ?? null,
    pendingRoundWin: pendingRoundWin ?? round.pendingRoundWin ?? null,
    continuumWagerPending:
      continuumWagerPending ?? round.continuumWagerPending ?? null,
    roundStarterOpening:
      roundStarterOpening ?? round.roundStarterOpening ?? null,
    ...(draftState !== undefined ? { draftState } : {}),
    ...(squadrons !== undefined ? { squadrons } : {}),
  });
}

export function remapGameSquadrons(
  squadrons: unknown,
  fromId: string,
  toId: string
): DocData[] | undefined {
  if (!Array.isArray(squadrons)) {
    return undefined;
  }
  return squadrons.map((squad) => {
    const row = squad as DocData;
    return {
      ...row,
      memberIds:
        remapStringList(row.memberIds, fromId, toId) ?? row.memberIds,
      trailKey: row.trailKey === fromId ? toId : row.trailKey,
    };
  });
}
