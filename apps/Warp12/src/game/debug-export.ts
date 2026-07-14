import {
  BINARY_ACTION_LOG_FORMAT,
  encodeAction,
  type GameAction,
  type EncodeContext,
} from 'warp12-engine';

export function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
}

export function buildDebugFilename(sectorCode: string, exportedAt: string): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  return `warp12-${sanitizeFilenamePart(sectorCode)}-${stamp}.json`;
}

/**
 * Bridge action logs store {@link ActionLogEntry} wrappers
 * (`{ at, playerId, action, ok, source }`). Older fixtures / scripts may
 * export bare {@link GameAction}s. Normalize either shape.
 */
export function unwrapLoggedActions(log: readonly unknown[]): GameAction[] {
  const actions: GameAction[] = [];
  for (const entry of log) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as { type?: unknown; action?: unknown };
    const candidate =
      record.action && typeof record.action === 'object'
        ? (record.action as { type?: unknown })
        : record;
    if (typeof candidate.type === 'string') {
      actions.push(candidate as GameAction);
    }
  }
  return actions;
}

function extractMaxPip(gameState: unknown): number {
  if (
    typeof gameState === 'object' &&
    gameState &&
    'maxPip' in gameState &&
    typeof (gameState as { maxPip: unknown }).maxPip === 'number'
  ) {
    return (gameState as { maxPip: number }).maxPip;
  }
  return 12;
}

/**
 * Extract player IDs from game state or action log.
 */
function extractPlayerIds(gameState: unknown, actions: readonly GameAction[]): string[] {
  // Try to get from gameState.round.turnOrder
  if (
    typeof gameState === 'object' &&
    gameState &&
    'round' in gameState &&
    typeof gameState.round === 'object' &&
    gameState.round &&
    'turnOrder' in gameState.round &&
    Array.isArray(gameState.round.turnOrder)
  ) {
    return gameState.round.turnOrder as string[];
  }

  // Fall back to extracting unique player IDs from actions
  const playerSet = new Set<string>();
  for (const action of actions) {
    if ('playerId' in action && typeof action.playerId === 'string') {
      playerSet.add(action.playerId);
    }
    if (action.type === 'CATCH_DROP_TO_IMPULSE') {
      playerSet.add(action.challengerId);
      playerSet.add(action.targetPlayerId);
    }
    if (action.type === 'SALAMANDER_PENALTY') {
      playerSet.add(action.holderId);
      playerSet.add(action.scoredOnId);
    }
    if (action.type === 'LONGEST_TRAIL_BONUS') {
      playerSet.add(action.playerId);
    }
    if (action.type === 'TEMPORAL_DEBT_PENALTY') {
      playerSet.add(action.playerId);
    }
  }
  return Array.from(playerSet).sort();
}

function bytesToBase64(bytes: Uint8Array): string {
  // Avoid `String.fromCharCode(...bytes)` — large logs blow the call stack.
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Encode action log to binary format for compact storage.
 * Returns base64-encoded binary data alongside metadata.
 */
function encodeActionLogBinary(
  actions: readonly GameAction[],
  gameState?: unknown
): {
  format: typeof BINARY_ACTION_LOG_FORMAT;
  encoding: 'base64';
  data: string;
  actionCount: number;
  byteSize: number;
  playerIds: string[];
  maxPip: number;
} {
  const playerIds = extractPlayerIds(gameState, actions);
  const maxPip = extractMaxPip(gameState);

  const ctx: EncodeContext = { playerIds, maxPip };
  const buffers: Uint8Array[] = [];
  let totalBytes = 0;

  for (const action of actions) {
    const encoded = encodeAction(action, ctx);
    buffers.push(encoded);
    totalBytes += encoded.length;
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buffer of buffers) {
    combined.set(buffer, offset);
    offset += buffer.length;
  }

  return {
    format: BINARY_ACTION_LOG_FORMAT,
    encoding: 'base64',
    data: bytesToBase64(combined),
    actionCount: actions.length,
    byteSize: totalBytes,
    playerIds,
    maxPip,
  };
}

function replaceActionLogWithBinary(
  holder: Record<string, unknown>,
  actionLogKey: 'actionLog',
  gameState: unknown
): void {
  const raw = holder[actionLogKey];
  if (!Array.isArray(raw)) {
    return;
  }
  const actions = unwrapLoggedActions(raw);
  try {
    const binaryLog = encodeActionLogBinary(actions, gameState);
    const skipped = raw.length - actions.length;
    holder[actionLogKey] =
      skipped > 0
        ? `${actions.length} actions (${skipped} skipped; see actionLogBinary)`
        : `${actions.length} actions (see actionLogBinary for binary format)`;
    holder.actionLogBinary = binaryLog;
  } catch (error) {
    holder.actionLogBinary = {
      skipped: true,
      reason:
        error instanceof Error
          ? error.message
          : 'binary encode failed; actionLog kept as JSON',
      actionCount: actions.length,
      maxPip: extractMaxPip(gameState),
    };
  }
}

/**
 * Process payload to encode action logs in binary format if present.
 * Exported for testing.
 */
export function processPayloadForBinaryExport(payload: unknown): unknown {
  if (typeof payload !== 'object' || !payload) {
    return payload;
  }

  // Make a shallow copy to avoid mutating original
  const processed = { ...payload } as Record<string, unknown>;

  // Check for actionLog in client.actionLog (local / online mode)
  if (
    'client' in processed &&
    typeof processed.client === 'object' &&
    processed.client
  ) {
    const client = { ...(processed.client as Record<string, unknown>) };
    const gameState = client.gameState ?? client.displayGameState;
    replaceActionLogWithBinary(client, 'actionLog', gameState);
    processed.client = client;
  }

  // Check for actionLog at top level
  if ('actionLog' in processed && Array.isArray(processed.actionLog)) {
    replaceActionLogWithBinary(
      processed,
      'actionLog',
      processed.gameState
    );
  }

  return processed;
}

export function downloadDebugExport(
  payload: unknown,
  filename?: string
): void {
  const exportedAt =
    typeof payload === 'object' &&
    payload &&
    'exportedAt' in payload &&
    typeof (payload as { exportedAt: unknown }).exportedAt === 'string'
      ? (payload as { exportedAt: string }).exportedAt
      : new Date().toISOString();
  const sectorCode =
    typeof payload === 'object' &&
    payload &&
    'sectorCode' in payload &&
    typeof (payload as { sectorCode: unknown }).sectorCode === 'string'
      ? (payload as { sectorCode: string }).sectorCode
      : 'debug';
  const name = filename ?? buildDebugFilename(sectorCode, exportedAt);

  // Process payload to encode action logs in binary format
  const processedPayload = processPayloadForBinaryExport(payload);

  const json = JSON.stringify(processedPayload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
