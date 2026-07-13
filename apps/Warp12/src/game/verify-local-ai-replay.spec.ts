import { describe, expect, it } from 'vitest';

import { defaultLocalGameConfig } from './local-game-config.js';
import { simulateLocalAiMatch } from './simulate-local-ai-match.js';
import {
  extractHumanActions,
  replayLocalAiActionLog,
  replayLocalAiHumanActions,
} from './verify-local-ai-replay.js';
import { humanWonLocalMatch } from './local-match-stats.js';

describe('verify-local-ai-replay', () => {
  it('replays heads-up solo vs one AI (2 captains)', async () => {
    const config = {
      ...defaultLocalGameConfig('Test Captain', 2),
      campaignRounds: 1,
    };
    const simulated = await simulateLocalAiMatch({ config, seed: 7_002_001 });

    expect(simulated.finalState.phase).toBe('complete');
    expect(simulated.config.playerCount).toBe(2);

    const replay = await replayLocalAiHumanActions({
      config: simulated.config,
      seed: simulated.seed,
      humanActions: extractHumanActions(simulated.config, simulated.actionLog),
    });

    expect(replay.ok).toBe(true);
  }, 120_000);

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

    if (!replay.ok) {
      console.error('Replay failed:', replay.violation, 'at step', replay.steps);
      console.error('Human actions count:', humanActions.length);
      console.error('Action types:', humanActions.map(a => a.type).slice(0, 20));
    }

    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }

    expect(replay.finalState.phase).toBe('complete');
    expect(replay.humanWon).toBe(
      humanWonLocalMatch(simulated.finalState, simulated.config.humanId)
    );
  }, 120_000);

  it('verifies a full multi-round points campaign end to end', async () => {
    // The default config is the Official points campaign (13 rounds), so this
    // exercises the inter-round reshuffle — the path that broke when the live
    // game scored rounds with Math.random instead of the seeded stream.
    const simulated = await simulateLocalAiMatch({ seed: 7_005_001 });

    expect(simulated.finalState.phase).toBe('complete');
    // Genuinely multi-round: if the deal/verification only covered round 1 this
    // guard would (correctly) stop protecting the reshuffle path.
    expect(simulated.finalState.completedRounds).toBeGreaterThan(1);

    const replay = await replayLocalAiHumanActions({
      config: simulated.config,
      seed: simulated.seed,
      humanActions: extractHumanActions(simulated.config, simulated.actionLog),
    });

    expect(replay.ok).toBe(true);
  }, 120_000);

  it('is fully reproducible from the seed (same seed → identical action log)', async () => {
    // Server verification only works if the whole pipeline (deal, AI, inter-round
    // reshuffle) is deterministic under a fixed seed. Two runs must be identical.
    const a = await simulateLocalAiMatch({ seed: 7_005_002 });
    const b = await simulateLocalAiMatch({ seed: 7_005_002 });

    const strip = (log: typeof a.actionLog) =>
      log.map((entry) => ({
        playerId: entry.playerId,
        action: entry.action,
        ok: entry.ok,
        source: entry.source,
      }));

    expect(strip(a.actionLog)).toEqual(strip(b.actionLog));
  }, 120_000);

  it('FAILS verification when rounds were reshuffled with a non-matching stream', async () => {
    // Models the fixed bug: the live game dealt round 2+ with a different RNG
    // stream than the seeded verification replay. The deal seed matches, but the
    // reshuffle stream does not, so round 2+ hands diverge and a later human
    // chart references a tile the replay never dealt.
    const diverged = await simulateLocalAiMatch({
      seed: 7_005_003,
      reshuffleSeed: 13_000_007,
    });
    expect(diverged.finalState.phase).toBe('complete');
    expect(diverged.finalState.completedRounds).toBeGreaterThan(1);

    const replay = await replayLocalAiHumanActions({
      config: diverged.config,
      seed: diverged.seed, // correct seeded reshuffle — will not match the diverged log
      humanActions: extractHumanActions(diverged.config, diverged.actionLog),
    });

    expect(replay.ok).toBe(false);
  }, 120_000);

  it('replays go-out matches with tile-conservation invariants on every step', async () => {
    const config = {
      ...defaultLocalGameConfig('Test Captain', 6),
      objective: 'go-out' as const,
      campaignRounds: 1,
    };
    const simulated = await simulateLocalAiMatch({ config, seed: 7_006_001 });

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
    expect(replay.finalState.objective).toBe('go-out');
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
