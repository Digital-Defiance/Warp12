/**
 * Binary Match Log Accumulator
 * 
 * Accumulates match actions and state snapshots in compact binary format.
 * Supports full match replay with round-boundary checkpoints.
 * 
 * Format:
 * - Actions: 2-5 bytes each (vs ~100-300 bytes JSON)
 * - State snapshots: ~300 bytes per round (optional)
 * - Total: ~1KB binary vs ~50-500KB JSON for typical match
 * 
 * @example
 * ```typescript
 * const log = new BinaryMatchLog({
 *   gameId: 'match-123',
 *   playerIds: ['p0', 'p1', 'p2', 'p3'],
 *   maxPip: 12,
 *   captureSnapshots: true, // Enable round-boundary checkpoints
 * });
 * 
 * // During match
 * log.recordAction(action);
 * log.recordRoundEnd(roundState); // Captures snapshot
 * 
 * // Export
 * const exported = log.export();
 * console.log(`${exported.actions.byteSize} bytes`);
 * console.log(`${exported.snapshots?.length} round snapshots`);
 * ```
 */

import type { GameAction } from 'warp12-engine';
import type { RoundState } from 'warp12-engine';
import {
  BINARY_ACTION_LOG_FORMAT,
  encodeActions,
  encodeRoundState,
} from 'warp12-engine';

export interface BinaryMatchLogConfig {
  /** Unique match identifier */
  gameId: string;
  /** Player IDs in turn order */
  playerIds: readonly string[];
  /** Warp factor (9/12/15/18) */
  maxPip: number;
  /** Capture state snapshots at round boundaries (optional) */
  captureSnapshots?: boolean;
}

export interface BinaryActionLog {
  /** Binary format version */
  format: typeof BINARY_ACTION_LOG_FORMAT;
  /** Base64 encoding */
  encoding: 'base64';
  /** Base64-encoded binary data */
  data: string;
  /** Number of actions */
  actionCount: number;
  /** Size in bytes */
  byteSize: number;
  /** Player IDs for decoding */
  playerIds: readonly string[];
  /** Warp factor */
  maxPip: number;
}

export interface BinaryStateSnapshot {
  /** Round number */
  round: number;
  /** Base64-encoded state snapshot */
  data: string;
  /** Size in bytes */
  byteSize: number;
  /** Timestamp when captured */
  timestamp: number;
}

export interface BinaryMatchExport {
  /** Match metadata */
  gameId: string;
  /** Binary-encoded actions */
  actions: BinaryActionLog;
  /** Optional state snapshots at round boundaries */
  snapshots?: BinaryStateSnapshot[];
  /** Export timestamp */
  exportedAt: number;
}

/**
 * Binary match log accumulator with optional state snapshots.
 */
export class BinaryMatchLog {
  private config: BinaryMatchLogConfig;
  private actions: GameAction[] = [];
  private snapshots: BinaryStateSnapshot[] = [];
  private currentRound = 1;

  constructor(config: BinaryMatchLogConfig) {
    this.config = config;
  }

  /**
   * Record a game action.
   */
  recordAction(action: GameAction): void {
    this.actions.push(action);
  }

  /**
   * Record multiple actions at once.
   */
  recordActions(actions: readonly GameAction[]): void {
    this.actions.push(...actions);
  }

  /**
   * Capture state snapshot at round end.
   */
  recordRoundEnd(round: RoundState): void {
    if (!this.config.captureSnapshots) {
      return;
    }

    const ctx = { maxPip: this.config.maxPip };
    const encoded = encodeRoundState(round, ctx);
    const base64 = btoa(String.fromCharCode(...encoded));

    this.snapshots.push({
      round: round.roundNumber,
      data: base64,
      byteSize: encoded.length,
      timestamp: Date.now(),
    });

    this.currentRound = round.roundNumber + 1;
  }

  /**
   * Get action count.
   */
  getActionCount(): number {
    return this.actions.length;
  }

  /**
   * Get snapshot count.
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Get total binary size (actions + snapshots).
   */
  getTotalByteSize(): number {
    const actionSize = this.encodeActionsInternal().length;
    const snapshotSize = this.snapshots.reduce((sum, s) => sum + s.byteSize, 0);
    return actionSize + snapshotSize;
  }

  /**
   * Export match log in binary format.
   */
  export(): BinaryMatchExport {
    const binary = this.encodeActionsInternal();
    const base64 = btoa(String.fromCharCode(...binary));

    const actionLog: BinaryActionLog = {
      format: BINARY_ACTION_LOG_FORMAT,
      encoding: 'base64',
      data: base64,
      actionCount: this.actions.length,
      byteSize: binary.length,
      playerIds: this.config.playerIds,
      maxPip: this.config.maxPip,
    };

    const exported: BinaryMatchExport = {
      gameId: this.config.gameId,
      actions: actionLog,
      exportedAt: Date.now(),
    };

    if (this.snapshots.length > 0) {
      exported.snapshots = [...this.snapshots];
    }

    return exported;
  }

  /**
   * Clear accumulated data (start fresh).
   */
  clear(): void {
    this.actions = [];
    this.snapshots = [];
    this.currentRound = 1;
  }

  /**
   * Internal: Encode actions to binary.
   */
  private encodeActionsInternal(): Uint8Array {
    const ctx = {
      playerIds: this.config.playerIds,
      maxPip: this.config.maxPip,
    };
    return encodeActions(this.actions, ctx);
  }
}

/**
 * Create a binary match log from config.
 */
export function createBinaryMatchLog(config: BinaryMatchLogConfig): BinaryMatchLog {
  return new BinaryMatchLog(config);
}
