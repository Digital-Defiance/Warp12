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
  format: 'binary-v1';
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

  // Decode actions
  const actions: GameAction[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const { action, bytesRead } = decodeAction(bytes.subarray(offset), ctx);
    actions.push(action);
    offset += bytesRead;
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
    }

    lines.push(desc);
  }

  return lines.join('\n');
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

  // Parse options
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

  // Read input file
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf-8');
  const data: DebugExport = JSON.parse(content);

  // Find binary log
  const binaryLog = data.client?.actionLogBinary || data.actionLogBinary;
  if (!binaryLog) {
    console.error('Error: No binary action log found in export');
    process.exit(1);
  }

  // Decode binary log
  console.error(`Decoding ${binaryLog.actionCount} actions (${binaryLog.byteSize} bytes)...`);
  const actions = decodeBinaryLog(binaryLog);

  // Filter by round if requested
  let filteredActions = actions;
  if (roundNumber !== null) {
    const roundData = extractRoundActions(actions, roundNumber);
    if (!roundData) {
      console.error(`Error: Round ${roundNumber} not found`);
      process.exit(1);
    }
    console.error(`Extracted round ${roundNumber}: actions ${roundData.startIndex + 1}-${roundData.endIndex}`);
    filteredActions = roundData.actions;
  }

  // Format output
  let output: string;
  if (format === 'json') {
    output = formatActionsAsJson(filteredActions);
  } else {
    const gameState = data.client?.gameState;
    const viewerId = data.viewerId;
    output = formatActionsAsText(filteredActions, gameState, viewerId);
  }

  // Write output
  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.error(`Output written to ${outputFile}`);
  } else {
    console.log(output);
  }
}

main();
