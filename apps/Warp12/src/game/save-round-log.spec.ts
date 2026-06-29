import { describe, expect, it } from 'vitest';

import { buildRoundLogFilename } from './save-round-log.js';

describe('save-round-log', () => {
  it('builds a .txt filename for round logs', () => {
    expect(
      buildRoundLogFilename(2, '2026-06-28T21:38:21.000Z', '8SU55R')
    ).toBe('warp12-8SU55R-round-2-log-2026-06-28-21-38-21.txt');
  });
});
