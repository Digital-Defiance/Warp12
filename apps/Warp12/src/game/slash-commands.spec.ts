import { describe, expect, it } from 'vitest';

import { parseSlashCommand, runSlashCommand } from './slash-commands.js';

describe('slash commands', () => {
  const ctx = { gameId: 'AB12CD', allowSpectate: true };

  it('parses command name and args', () => {
    expect(parseSlashCommand('hello')).toBeNull();
    expect(parseSlashCommand('/spectate')).toEqual({
      name: 'spectate',
      args: '',
    });
    expect(parseSlashCommand('/help more')).toEqual({
      name: 'help',
      args: 'more',
    });
  });

  it('returns spectator link for /spectate aliases', () => {
    for (const line of ['/spectate', '/spectator', '/watch']) {
      const result = runSlashCommand(line, ctx);
      expect(result?.kind).toBe('reply');
      if (result?.kind === 'reply') {
        expect(result.copyText).toMatch(/\/online\/AB12CD\/watch$/);
        expect(result.text).toContain('/watch');
      }
    }
  });

  it('lists commands on /help', () => {
    const result = runSlashCommand('/help', ctx);
    expect(result?.kind).toBe('reply');
    if (result?.kind === 'reply') {
      expect(result.text).toContain('/spectate');
      expect(result.text).toContain('/help');
    }
  });

  it('errors on unknown commands', () => {
    const result = runSlashCommand('/warpdrive', ctx);
    expect(result).toEqual({
      kind: 'error',
      text: 'Unknown command /warpdrive. Try /help.',
    });
  });
});
