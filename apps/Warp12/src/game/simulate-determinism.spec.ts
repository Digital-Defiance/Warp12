import { describe, expect, it, vi } from 'vitest';

import { simulateLocalAiMatch } from './simulate-local-ai-match.js';

describe('simulateLocalAiMatch determinism', () => {
  it('does not call Math.random during simulation', async () => {
    const spy = vi.spyOn(Math, 'random');
    await simulateLocalAiMatch({ seed: 7_005_002 });
    expect(spy.mock.calls.length).toBe(0);
    vi.restoreAllMocks();
  });

  it('matches itself across two runs after prior tests would have run', async () => {
    await simulateLocalAiMatch({ seed: 7_001_001 });
    await simulateLocalAiMatch({ seed: 7_001_002 });
    await simulateLocalAiMatch({ seed: 7_005_001 });

    const strip = (log: Awaited<ReturnType<typeof simulateLocalAiMatch>>['actionLog']) =>
      log.map((entry) => ({
        playerId: entry.playerId,
        action: entry.action,
        ok: entry.ok,
        source: entry.source,
      }));

    const a = await simulateLocalAiMatch({ seed: 7_005_002 });
    const b = await simulateLocalAiMatch({ seed: 7_005_002 });
    expect(strip(a.actionLog)).toEqual(strip(b.actionLog));
  }, 120_000);
});
