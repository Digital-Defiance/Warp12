import { describe, expect, it } from 'vitest';

import { buildDebugFilename } from './debug-export.js';

describe('debug-export', () => {
  it('builds a stable filename from sector code and timestamp', () => {
    expect(
      buildDebugFilename('ABCD', '2026-06-27T15:04:05.000Z')
    ).toBe('warp12-ABCD-2026-06-27-15-04-05.json');
  });
});
