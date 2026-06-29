import { describe, expect, it } from 'vitest';

import {
  COMPUTER_BEEP_IDS,
  computerBeepUrl,
  pickRandomComputerBeepId,
} from './computer-beeps.js';

describe('pickRandomComputerBeepId', () => {
  it('returns only IDs with files in the beep library', () => {
    const id = pickRandomComputerBeepId(() => 0);
    expect(COMPUTER_BEEP_IDS).toContain(id);
    expect(computerBeepUrl(id)).toMatch(/^\/beeps\/computerbeep_\d+\.mp3$/);
  });

  it('covers the full library across the unit interval', () => {
    const seen = new Set<number>();
    for (let i = 0; i < COMPUTER_BEEP_IDS.length; i += 1) {
      const id = pickRandomComputerBeepId(
        () => i / COMPUTER_BEEP_IDS.length
      );
      seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
