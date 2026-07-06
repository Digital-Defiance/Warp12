import { describe, expect, it, vi } from 'vitest';

import {
  buildRoundLogFilename,
  downloadRoundLogJson,
} from './save-round-log.js';
import type { RoundLogExport } from 'warp12-react';

describe('save-round-log', () => {
  it('builds a .txt filename for round logs', () => {
    expect(
      buildRoundLogFilename(2, '2026-06-28T21:38:21.000Z', '8SU55R')
    ).toBe('warp12-8SU55R-round-2-log-2026-06-28-21-38-21.txt');
  });

  it('builds a .json filename for structured round logs', () => {
    expect(
      buildRoundLogFilename(2, '2026-06-28T21:38:21.000Z', '8SU55R', 'json')
    ).toBe('warp12-8SU55R-round-2-log-2026-06-28-21-38-21.json');
  });

  it('downloads structured round log entries as JSON', () => {
    const payload: RoundLogExport = {
      exportedAt: '2026-06-28T21:38:21.000Z',
      roundNumber: 2,
      sectorCode: 'local',
      roundStartedAtMs: 1_700_000_000_000,
      entries: [
        {
          at: '2026-06-28T21:38:25.000Z',
          kind: 'ROUND_STARTED',
          captainId: 'a',
          effects: [],
        },
      ],
      lines: ['00:00 — Round 2 started'],
    };
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadRoundLogJson(payload);

    expect(anchor.download).toBe(
      'warp12-local-round-2-log-2026-06-28-21-38-21.json'
    );
    expect(click).toHaveBeenCalled();
  });
});
