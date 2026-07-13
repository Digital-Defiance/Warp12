import { encodeAction, type GameAction, type EncodeContext } from 'warp12-engine';

export function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
}

export function buildDebugFilename(sectorCode: string, exportedAt: string): string {
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  return `warp12-${sanitizeFilenamePart(sectorCode)}-${stamp}.json`;
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
  }
  return Array.from(playerSet).sort();
}

/**
 * Encode action log to binary format for compact storage.
 * Returns base64-encoded binary data alongside metadata.
 */
function encodeActionLogBinary(
  actions: readonly GameAction[],
  gameState?: unknown
): {
  format: 'binary-v1';
  encoding: 'base64';
  data: string;
  actionCount: number;
  byteSize: number;
  playerIds: string[];
  maxPip: number;
} {
  // Extract encoding context
  const playerIds = extractPlayerIds(gameState, actions);
  const maxPip = 12; // Default to W12, could extract from gameState if needed

  const ctx: EncodeContext = { playerIds, maxPip };
  const buffers: Uint8Array[] = [];
  let totalBytes = 0;

  for (const action of actions) {
    const encoded = encodeAction(action, ctx);
    buffers.push(encoded);
    totalBytes += encoded.length;
  }

  // Concatenate all action buffers
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buffer of buffers) {
    combined.set(buffer, offset);
    offset += buffer.length;
  }

  // Convert to base64
  const base64 = btoa(String.fromCharCode(...combined));

  return {
    format: 'binary-v1',
    encoding: 'base64',
    data: base64,
    actionCount: actions.length,
    byteSize: totalBytes,
    playerIds,
    maxPip,
  };
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
  const processed = { ...payload };

  // Check for actionLog in client.actionLog (local mode)
  if (
    'client' in processed &&
    typeof processed.client === 'object' &&
    processed.client &&
    'actionLog' in processed.client &&
    Array.isArray(processed.client.actionLog)
  ) {
    const actionLog = processed.client.actionLog as readonly GameAction[];
    const gameState = 'gameState' in processed.client ? processed.client.gameState : undefined;
    const binaryLog = encodeActionLogBinary(actionLog, gameState);
    
    (processed as { client: { actionLog: unknown; actionLogBinary?: unknown } }).client = {
      ...(processed.client as object),
      actionLog: `${actionLog.length} actions (see actionLogBinary for binary format)`,
      actionLogBinary: binaryLog,
    };
  }

  // Check for actionLog at top level
  if ('actionLog' in processed && Array.isArray(processed.actionLog)) {
    const actionLog = processed.actionLog as readonly GameAction[];
    const gameState = 'gameState' in processed ? processed.gameState : undefined;
    const binaryLog = encodeActionLogBinary(actionLog, gameState);
    
    (processed as { actionLog: unknown; actionLogBinary?: unknown }).actionLog = 
      `${actionLog.length} actions (see actionLogBinary for binary format)`;
    (processed as { actionLogBinary?: unknown }).actionLogBinary = binaryLog;
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
