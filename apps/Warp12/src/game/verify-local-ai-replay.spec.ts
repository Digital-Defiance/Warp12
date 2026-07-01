import { describe, expect, it } from 'vitest';

import { simulateLocalAiMatch } from './simulate-local-ai-match.js';
import {
  extractHumanActions,
  replayLocalAiActionLog,
  replayLocalAiHumanActions,
} from './verify-local-ai-replay.js';
import { humanWonLocalMatch } from './local-match-stats.js';

describe('verify-local-ai-replay', () => {
  it('replays a simulated match from full action log', async () => {
    const simulated = await simulateLocalAiMatch({ seed: 7_001_001 });

    expect(simulated.finalState.phase).toBe('complete');

    const replay = replayLocalAiActionLog({
      config: simulated.config,
      seed: simulated.seed,
      actionLog: simulated.actionLog,
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }

    expect(replay.finalState.phase).toBe('complete');
    expect(replay.humanWon).toBe(
      humanWonLocalMatch(simulated.finalState, simulated.config.humanId)
    );
  }, 120_000);

  it('replays human moves only with server-run AI', async () => {
    const simulated = await simulateLocalAiMatch({ seed: 7_001_002 });
    const humanActions = extractHumanActions(
      simulated.config,
      simulated.actionLog
    );

    expect(humanActions.length).toBeGreaterThan(0);

    const replay = await replayLocalAiHumanActions({
      config: simulated.config,
      seed: simulated.seed,
      humanActions,
    });

    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }

    expect(replay.finalState.phase).toBe('complete');
    expect(replay.humanWon).toBe(
      humanWonLocalMatch(simulated.finalState, simulated.config.humanId)
    );
  }, 120_000);

  it('rejects tampered human move sequences', async () => {
    const simulated = await simulateLocalAiMatch({ seed: 7_001_003 });
    const humanActions = extractHumanActions(
      simulated.config,
      simulated.actionLog
    );
    const tampered = [...humanActions];
    tampered[0] = {
      ...tampered[0],
      type: 'PASS_TURN',
      playerId: simulated.config.humanId,
    };

    const replay = await replayLocalAiHumanActions({
      config: simulated.config,
      seed: simulated.seed,
      humanActions: tampered,
    });

    expect(replay.ok).toBe(false);
  }, 120_000);

  it('omits END_ROUND from human replay payload (server scores rounds)', async () => {
    const simulated = await simulateLocalAiMatch({ seed: 7_001_004 });
    const withEndRound = [
      ...extractHumanActions(simulated.config, simulated.actionLog),
      {
        type: 'END_ROUND' as const,
        winnerId: simulated.config.humanId,
      },
    ];

    const replayWithEndRound = await replayLocalAiHumanActions({
      config: simulated.config,
      seed: simulated.seed,
      humanActions: withEndRound,
    });
    expect(replayWithEndRound.ok).toBe(true);

    const humanActions = extractHumanActions(
      simulated.config,
      simulated.actionLog
    );
    expect(humanActions.every((action) => action.type !== 'END_ROUND')).toBe(
      true
    );
  }, 120_000);
});
