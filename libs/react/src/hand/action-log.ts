import type { GameAction } from 'warp12-engine';

export type ActionLogSource = 'human' | 'ai' | 'auto';

export interface ActionLogEntry {
  at: string;
  playerId: string;
  action: GameAction;
  ok: boolean | null;
  violation?: string;
  source: ActionLogSource;
}

export interface ActionLog {
  append(entry: Omit<ActionLogEntry, 'at'> & { at?: string }): void;
  snapshot(): readonly ActionLogEntry[];
  clear(): void;
}

export function playerIdForAction(action: GameAction): string {
  if (action.type === 'END_ROUND') {
    return action.winnerId ?? '';
  }
  if (action.type === 'CATCH_DROP_TO_IMPULSE') {
    return action.challengerId;
  }
  return action.playerId;
}

export function createActionLog(): ActionLog {
  const entries: ActionLogEntry[] = [];

  return {
    append(entry) {
      entries.push({
        ...entry,
        at: entry.at ?? new Date().toISOString(),
      });
    },
    snapshot() {
      return [...entries];
    },
    clear() {
      entries.length = 0;
    },
  };
}
