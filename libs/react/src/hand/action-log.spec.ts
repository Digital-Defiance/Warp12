import { describe, expect, it } from 'vitest';

import {
  createActionLog,
  playerIdForAction,
} from './action-log.js';

describe('action-log', () => {
  it('records entries with ISO timestamps', () => {
    const log = createActionLog();
    log.append({
      playerId: 'you',
      action: { type: 'DRAW_FROM_UNCHARTED', playerId: 'you' },
      ok: true,
      source: 'human',
    });

    const [entry] = log.snapshot();
    expect(entry.playerId).toBe('you');
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('resolves END_ROUND player id from winnerId', () => {
    expect(
      playerIdForAction({
        type: 'END_ROUND',
        winnerId: 'ai:riker',
      })
    ).toBe('ai:riker');
  });
});
