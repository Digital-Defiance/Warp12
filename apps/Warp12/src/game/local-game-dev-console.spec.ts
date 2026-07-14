import { describe, expect, it } from 'vitest';

import {
  assistanceVoidsPracticeTei,
  consoleUnlockVoidsTei,
  DEV_CONSOLE_UNLOCK_COMMAND,
} from './local-game-dev-console.js';

describe('local-game-dev-console', () => {
  it('uses the DESCENT unlock phrase', () => {
    expect(DEV_CONSOLE_UNLOCK_COMMAND).toBe('GABBAGABBAHEY');
  });

  it('voids TEI for non-admins on console unlock', () => {
    expect(consoleUnlockVoidsTei({ isAdmin: false })).toBe(true);
    expect(consoleUnlockVoidsTei({ isAdmin: true })).toBe(false);
  });

  it('advisor always voids; console voids only without admin', () => {
    expect(
      assistanceVoidsPracticeTei({
        advisorUsed: true,
        devToolsUsed: false,
        isAdmin: true,
      })
    ).toBe(true);
    expect(
      assistanceVoidsPracticeTei({
        advisorUsed: false,
        devToolsUsed: true,
        isAdmin: false,
      })
    ).toBe(true);
    expect(
      assistanceVoidsPracticeTei({
        advisorUsed: false,
        devToolsUsed: true,
        isAdmin: true,
      })
    ).toBe(false);
  });
});
