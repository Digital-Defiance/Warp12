import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createWarpAiPlayer,
  generateCoordinateSet,
  getWarpSkillProfile,
  observe,
  scoreRound,
  shuffleCoordinates,
  startGame,
  toGameAction,
  warpCandidateGenerator,
  type GameAction,
  type GameState,
  type WarpAiAction,
  type WarpAiPlayer,
} from 'warp12-engine';

import {
  replayLocalAiHumanActions,
  type SerializableLocalGameConfig,
} from './practice-ai-replay.js';

/*
 * Regression guard for the STALE_GAME_STATE / "TEI was not saved" verification
 * failure.
 *
 * The live game and the client verifier both apply AI off-turn reactions
 * (CATCH_DROP_TO_IMPULSE when a captain forgets to announce Drop to Impulse).
 * Drop to Impulse is ON in the Official rated preset, so an AI catch happens in
 * ordinary rated matches. The server replay used to skip off-turn actions, so
 * those matches desynced and were rejected with STALE_GAME_STATE — silently
 * voiding a legitimately earned TEI result.
 *
 * The generator below mirrors the server's determinism exactly (same deal RNG,
 * roster seeding, and inter-round reshuffle stream) but drives the human toward
 * "forgetting to knock" so an off-turn catch is guaranteed. If the server ever
 * drops off-turn handling again, the recorded human moves stop lining up and
 * `replayLocalAiHumanActions` fails — turning this green test red.
 */

// --- determinism primitives (must match practice-ai-replay.ts) ---
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createMatchRoundReshuffle(seed: number): () => number {
  return mulberry32((seed ^ 0x9e3779b9) >>> 0);
}

function roundAwaitingScore(state: GameState): boolean {
  const round = state.round;
  return (
    state.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked)
  );
}

interface GeneratedMatch {
  humanActions: GameAction[];
  finalState: GameState;
  offTurnCatches: number;
}

/**
 * Play out a full local match headlessly using the same determinism the server
 * replay expects. The human "forgets" to declare Drop to Impulse whenever a
 * non-declare move is available, so AIs get to catch it off-turn.
 */
function generateMatch(
  config: SerializableLocalGameConfig,
  seed: number
): GeneratedMatch {
  const maxPip = config.maxPip ?? 12;
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(maxPip),
    seededRandom(seed)
  );
  const captains = [
    { id: config.humanId, displayName: config.humanName },
    ...config.aiCaptains.map((ai) => ({
      id: ai.id,
      displayName: ai.displayName,
    })),
  ];

  let state = startGame(
    {
      id: `local-${seed}`,
      captains,
      modules: config.modules,
      houseRules: config.houseRules,
      objective: config.objective,
      campaignRounds: config.campaignRounds,
    },
    { shuffledCoordinates: shuffled, roundStarterId: config.humanId }
  );

  const roster = new Map<string, WarpAiPlayer>();
  config.aiCaptains.forEach((ai, index) => {
    const rng = mulberry32(seed + (index + 1) * 997);
    const skill = getWarpSkillProfile(ai.skill, config.objective, config.playerCount);
    roster.set(ai.id, createWarpAiPlayer({ skill, objective: config.objective, rng }));
  });

  const roundReshuffle = createMatchRoundReshuffle(seed);
  const humanRng = mulberry32(seed + 31_337);
  const humanActions: GameAction[] = [];
  let offTurnCatches = 0;
  let steps = 0;
  const MAX_STEPS = 50_000;

  const apply = (
    s: GameState,
    action: GameAction
  ): ReturnType<typeof applyAction> => {
    if (action.type !== 'END_ROUND') {
      return applyAction(s, action);
    }
    if (s.phase !== 'active' || !s.round) {
      return { ok: false, violation: 'GAME_NOT_ACTIVE' };
    }
    const round = s.round;
    if (round.phase !== 'ended') {
      return { ok: false, violation: 'ROUND_NOT_PLAYING' };
    }
    return scoreRound(s, round, roundReshuffle);
  };

  const pickHumanForgetfulMove = (): GameAction | null => {
    const obs = observe(structuredClone(state), config.humanId);
    if (
      !obs ||
      obs.round.phase !== 'playing' ||
      obs.round.activePlayerId !== config.humanId
    ) {
      return null;
    }
    const candidates: readonly WarpAiAction[] = warpCandidateGenerator(obs, {
      captains: obs.captains,
      rng: humanRng,
    });
    if (candidates.length === 0) {
      return null;
    }
    const nonDeclare = candidates.filter(
      (candidate) => candidate.kind !== 'drop-to-impulse'
    );
    const chosen =
      candidates.some((candidate) => candidate.kind === 'drop-to-impulse') &&
      nonDeclare.length > 0
        ? nonDeclare[0]
        : candidates[0];
    return toGameAction(chosen, config.humanId);
  };

  while (state.phase !== 'complete' && steps < MAX_STEPS) {
    if (roundAwaitingScore(state)) {
      const round = state.round!;
      const result = apply(state, {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      });
      steps += 1;
      if (!result.ok) break;
      state = result.state;
      continue;
    }

    const round = state.round;
    if (!round || round.phase !== 'playing') break;

    // Off-turn AI catches — the exact path the server replay used to drop.
    let offTurnHandled = false;
    for (const [aiId, ai] of roster) {
      const offTurnAction = ai.decideOffTurnGameAction
        ? ai.decideOffTurnGameAction(structuredClone(state), aiId)
        : null;
      if (offTurnAction) {
        const result = apply(state, offTurnAction);
        steps += 1;
        if (!result.ok) {
          offTurnHandled = true;
          break;
        }
        if (offTurnAction.type === 'CATCH_DROP_TO_IMPULSE') {
          offTurnCatches += 1;
        }
        state = result.state;
        offTurnHandled = true;
        break;
      }
    }
    if (offTurnHandled) {
      if (state.phase === 'complete') break;
      continue;
    }

    const activeId = round.activePlayerId;
    if (activeId === config.humanId) {
      const move = pickHumanForgetfulMove();
      if (!move) break;
      const result = apply(state, move);
      steps += 1;
      if (!result.ok) break;
      humanActions.push(move);
      state = result.state;
      continue;
    }

    const ai = roster.get(activeId);
    if (!ai) break;
    const move = ai.decideGameAction(structuredClone(state), activeId);
    if (!move) break;
    const result = apply(state, move);
    steps += 1;
    if (!result.ok) break;
    state = result.state;
  }

  return { humanActions, finalState: state, offTurnCatches };
}

describe('replayLocalAiHumanActions — off-turn Drop to Impulse', () => {
  const config: SerializableLocalGameConfig = {
    humanId: 'human',
    humanName: 'Captain',
    playerCount: 3,
    objective: 'points',
    campaignRounds: 3,
    modules: {},
    // Official rated preset: Drop to Impulse announce + one-tile catch.
    houseRules: {
      dropToImpulseCall: true,
      dropToImpulseCatchPenalty: 1,
      allStopCeremony: true,
    },
    maxPip: 12,
    rated: true,
    aiCaptains: [
      { id: 'ai-1', displayName: 'Lt. Nyota', skill: 'lieutenant' },
      { id: 'ai-2', displayName: 'Lt. Sulu', skill: 'lieutenant' },
    ],
  };

  it('verifies rated matches containing off-turn AI catches', async () => {
    let matchesVerified = 0;
    let matchesWithCatch = 0;

    for (let seed = 1; seed <= 60 && matchesWithCatch < 3; seed += 1) {
      const match = generateMatch(config, seed);
      if (match.finalState.phase !== 'complete') continue;

      const replay = await replayLocalAiHumanActions({
        config,
        seed,
        humanActions: match.humanActions,
      });

      expect(
        replay.ok,
        `seed=${seed} catches=${match.offTurnCatches} violation=${
          replay.ok ? '' : replay.violation
        }`
      ).toBe(true);

      matchesVerified += 1;
      if (match.offTurnCatches > 0) matchesWithCatch += 1;
    }

    expect(matchesVerified).toBeGreaterThan(0);
    // Guarantees the off-turn catch path was actually exercised; without the
    // server-side off-turn fix these matches fail with STALE_GAME_STATE.
    expect(
      matchesWithCatch,
      'no off-turn Drop to Impulse catch was generated — test is not exercising the fix'
    ).toBeGreaterThan(0);
  }, 120_000);
});
