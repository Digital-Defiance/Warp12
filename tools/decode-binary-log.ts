#!/usr/bin/env node
/**
 * Binary Log Decoder
 * 
 * Converts binary-encoded debug exports back to human-readable formats.
 * 
 * Usage:
 *   yarn decode-log <input.json> [options]
 * 
 * Options:
 *   --format <json|text>     Output format (default: json)
 *   --round <number>         Extract specific round only (default: all)
 *   --output <file>          Output file (default: stdout)
 * 
 * Examples:
 *   # Convert binary log to verbose JSON
 *   yarn decode-log debug-export.json --format json > verbose.json
 * 
 *   # Extract round 3 as text
 *   yarn decode-log debug-export.json --format text --round 3
 * 
 *   # Full text log
 *   yarn decode-log debug-export.json --format text > full-log.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import { decodeAction, type GameAction, type DecodeContext, formatGameLogLine, type GameState } from 'warp12-engine';

interface BinaryLogMetadata {
  format: 'binary-v2';
  encoding: 'base64';
  data: string;
  actionCount: number;
  byteSize: number;
  playerIds: string[];
  maxPip: number;
}

interface DebugExport {
  exportedAt: string;
  mode: 'local' | 'online';
  sectorCode: string;
  viewerId?: string;
  client?: {
    gameState?: GameState;
    actionLog?: string | GameAction[];
    actionLogBinary?: BinaryLogMetadata;
  };
  actionLog?: string | GameAction[];
  actionLogBinary?: BinaryLogMetadata;
}

function decodeBinaryLog(binary: BinaryLogMetadata): GameAction[] {
  if (binary.format !== 'binary-v2') {
    throw new Error(
      `Unsupported action log format: ${String(binary.format)} (expected binary-v2)`
    );
  }
  if ('skipped' in binary && (binary as { skipped?: boolean }).skipped) {
    throw new Error(
      `Binary encoding was skipped in this export: ${
        (binary as { reason?: string }).reason ?? 'unknown'
      }`
    );
  }

  const ctx: DecodeContext = {
    playerIds: binary.playerIds,
    maxPip: binary.maxPip,
  };

  // Decode base64 to Uint8Array
  const binaryStr = atob(binary.data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Debug exports concatenate raw action frames (no 4-byte count prefix).
  const actions: GameAction[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const { action, bytesRead } = decodeAction(bytes, offset, ctx);
    actions.push(action);
    offset += bytesRead;
  }

  if (binary.actionCount > 0 && actions.length !== binary.actionCount) {
    console.error(
      `Warning: decoded ${actions.length} actions, metadata said ${binary.actionCount}`
    );
  }

  return actions;
}

function extractRoundActions(
  actions: GameAction[],
  roundNumber: number
): { actions: GameAction[]; startIndex: number; endIndex: number } | null {
  let currentRound = 0;
  let roundStart = -1;
  let roundEnd = -1;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Round boundaries: END_ROUND increments round counter
    if (action.type === 'END_ROUND') {
      currentRound++;
      if (currentRound === roundNumber) {
        roundEnd = i + 1;
        break;
      }
    }

    // Track start of requested round
    if (currentRound === roundNumber - 1 && roundStart === -1) {
      // Next action after previous round's END_ROUND is start of this round
      roundStart = i;
    }
  }

  if (roundStart === -1 || roundEnd === -1) {
    return null;
  }

  return {
    actions: actions.slice(roundStart, roundEnd),
    startIndex: roundStart,
    endIndex: roundEnd,
  };
}

function formatActionsAsJson(actions: GameAction[], pretty = true): string {
  return JSON.stringify(actions, null, pretty ? 2 : 0);
}

function formatActionsAsText(
  actions: GameAction[],
  gameState?: GameState,
  viewerId?: string
): string {
  const lines: string[] = [];
  
  // Extract player names from gameState if available
  const names: Record<string, string> = {};
  if (gameState?.round) {
    for (const playerId of gameState.round.turnOrder) {
      // Try to get display name, fall back to ID
      const captain = gameState.captains?.[playerId];
      names[playerId] = captain?.displayName || playerId;
    }
  }

  // Add header
  lines.push('=== Match Action Log ===');
  lines.push('');

  // Format each action
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const num = String(i + 1).padStart(4, ' ');
    
    // Basic action description
    let desc = `${num}. ${action.type}`;
    
    if ('playerId' in action) {
      const name = names[action.playerId] || action.playerId;
      desc += ` by ${name}`;
    }

    if (action.type === 'CHART_COORDINATE') {
      desc += ` - ${action.coordinate.low}:${action.coordinate.high} on ${action.route.kind}`;
    } else if (action.type === 'SPOOL_WARP_DRIVE') {
      desc += ` on ${action.route.kind}`;
    } else if (action.type === 'CATCH_DROP_TO_IMPULSE') {
      const challenger = names[action.challengerId] || action.challengerId;
      const target = names[action.targetPlayerId] || action.targetPlayerId;
      desc += ` - ${challenger} catches ${target}`;
    } else if (action.type === 'INVOKE_CONTINUUM_FLASH') {
      desc += ` - ${action.effect}`;
    } else if (action.type === 'END_ROUND') {
      if (action.winnerId) {
        const winner = names[action.winnerId] || action.winnerId;
        desc += ` - ${winner} wins`;
      }
      lines.push('');
      lines.push(desc);
      lines.push('─'.repeat(60));
      lines.push('');
      continue;
    } else if (action.type === 'SALAMANDER_PENALTY') {
      const holder = names[action.holderId] || action.holderId;
      const scoredOn = names[action.scoredOnId] || action.scoredOnId;
      if (action.holderId === action.scoredOnId) {
        desc += ` - ${holder} +${action.points}`;
      } else {
        desc += ` - ${holder} swaps to ${scoredOn} +${action.points}`;
      }
    } else if (action.type === 'LONGEST_TRAIL_BONUS') {
      const who = names[action.playerId] || action.playerId;
      const delta =
        action.points > 0
          ? `+${action.points}`
          : action.points < 0
            ? `−${Math.abs(action.points)}`
            : '0';
      desc += ` - ${who} (${action.trailLength} tiles) ${delta}`;
    } else if (action.type === 'TEMPORAL_DEBT_PENALTY') {
      const who = names[action.playerId] || action.playerId;
      desc += ` - ${who} (${action.tokens} tokens) +${action.points}`;
    }

    lines.push(desc);
  }

  return lines.join('\n');
}

function unwrapJsonActionLog(rawLog: readonly unknown[]): GameAction[] {
  return rawLog.map((entry) => {
    if (entry && typeof entry === 'object' && 'action' in entry) {
      return (entry as { action: GameAction }).action;
    }
    return entry as GameAction;
  });
}

function resolveActionsFromExport(data: DebugExport): GameAction[] {
  const binaryLog = data.client?.actionLogBinary || data.actionLogBinary;
  if (binaryLog && !('skipped' in binaryLog && (binaryLog as { skipped?: boolean }).skipped)) {
    console.error(
      `Decoding ${binaryLog.actionCount} actions (${binaryLog.byteSize} bytes, ${binaryLog.format}, maxPip=${binaryLog.maxPip})…`
    );
    return decodeBinaryLog(binaryLog);
  }

  const rawLog = data.client?.actionLog ?? data.actionLog;
  if (Array.isArray(rawLog) && rawLog.length > 0) {
    console.error(`Expanding ${rawLog.length} JSON action log entries…`);
    return unwrapJsonActionLog(rawLog);
  }

  if (binaryLog && 'skipped' in binaryLog) {
    throw new Error(
      `Binary encoding skipped and no JSON actionLog present: ${
        (binaryLog as { reason?: string }).reason ?? 'unknown'
      }`
    );
  }

  throw new Error('No actionable log found in export (actionLogBinary / actionLog)');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Binary Log Decoder

Converts binary-encoded debug exports back to human-readable formats.

Usage:
  yarn decode-log <input.json> [options]

Options:
  --format <json|text>     Output format (default: json)
  --round <number>         Extract specific round only (default: all)
  --output <file>          Output file (default: stdout)

Examples:
  # Convert binary log to verbose JSON
  yarn decode-log debug-export.json --format json > verbose.json

  # Extract round 3 as text
  yarn decode-log debug-export.json --format text --round 3

  # Full text log
  yarn decode-log debug-export.json --format text > full-log.txt
    `);
    process.exit(0);
  }

  const inputFile = args[0];
  let format: 'json' | 'text' = 'json';
  let roundNumber: number | null = null;
  let outputFile: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && i + 1 < args.length) {
      format = args[i + 1] as 'json' | 'text';
      i++;
    } else if (args[i] === '--round' && i + 1 < args.length) {
      roundNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      outputFile = args[i + 1];
      i++;
    }
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf-8');
  const data: DebugExport = JSON.parse(content);

  let actions: GameAction[];
  try {
    actions = resolveActionsFromExport(data);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  let filteredActions = actions;
  if (roundNumber !== null) {
    const roundData = extractRoundActions(actions, roundNumber);
    if (!roundData) {
      console.error(`Error: Round ${roundNumber} not found`);
      process.exit(1);
    }
    console.error(
      `Extracted round ${roundNumber}: actions ${roundData.startIndex + 1}-${roundData.endIndex}`
    );
    filteredActions = roundData.actions;
  }

  const output =
    format === 'json'
      ? formatActionsAsJson(filteredActions)
      : formatActionsAsText(
          filteredActions,
          data.client?.gameState,
          data.viewerId
        );

  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.error(`Output written to ${outputFile}`);
  } else {
    console.log(output);
  }
}

main();
