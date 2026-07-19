import { describe, expect, it } from 'vitest';
import {
  applyAction,
  resolveGoOutOvertimeOffer,
  scoreRound,
  spacedockValueForRound,
  startGame,
  roundStarterForRound,
  resolveModules,
  generateCoordinateSet,
  shuffleCoordinates,
  type GameState,
  type RoundState,
} from 'warp12-engine';
import { makeGame, makeRound } from './test-helpers.js';

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** Full set so redeals always find the next Spacedock double. */
function fullPileRound(
  over: Parameters<typeof makeRound>[1] & { roundNumber?: number }
): RoundState {
  const roundNumber = over.roundNumber ?? 1;
  const spacedockValue = spacedockValueForRound(roundNumber, 12);
  const base = makeRound(['a', 'b'], {
    spacedockValue,
    ...over,
    roundNumber,
  });
  return {
    ...base,
    unchartedSectors: generateCoordinateSet(12).filter(
      (c) => !(c.low === spacedockValue && c.high === spacedockValue)
    ),
  };
}

describe('go-out campaign + starter index', () => {
  it('wraps Spacedock past 0-0 back to maxPip', () => {
    expect(spacedockValueForRound(13, 12)).toBe(0);
    expect(spacedockValueForRound(14, 12)).toBe(12);
    expect(spacedockValueForRound(15, 12)).toBe(11);
    expect(spacedockValueForRound(26, 12)).toBe(0);
    expect(spacedockValueForRound(27, 12)).toBe(12);
  });

  it('rotates starters from matchStarterIndex', () => {
    const order = ['a', 'b', 'c', 'd'] as const;
    expect(roundStarterForRound(order, 1, 2)).toBe('c');
    expect(roundStarterForRound(order, 2, 2)).toBe('d');
    expect(roundStarterForRound(order, 3, 2)).toBe('a');
    expect(roundStarterForRound(order, 4, 2)).toBe('b');
    expect(roundStarterForRound(order, 5, 2)).toBe('c');
  });

  it('honors matchStarterIndex at startGame without roundStarterId override', () => {
    const shuffled = shuffleCoordinates(
      generateCoordinateSet(12),
      seededRandom(42)
    );
    const game = startGame(
      {
        id: 'starter-idx',
        captains: [
          { id: 'a', displayName: 'A' },
          { id: 'b', displayName: 'B' },
          { id: 'c', displayName: 'C' },
        ],
        objective: 'go-out',
        matchStarterIndex: 1,
        modules: { continuum: false, salamanderPenalty: false },
      },
      { shuffledCoordinates: shuffled }
    );
    expect(game.matchStarterIndex).toBe(1);
    expect(game.round?.activePlayerId).toBe('b');
    expect(game.round?.table.spacedock.placedBy).toBe('b');
  });

  it('sudden-death still completes on first go-out win', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'a',
      activePlayerId: 'a',
      roundNumber: 1,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'sudden-death',
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('complete');
    expect(result.state.captains.find((c) => c.id === 'a')?.goOutWins).toBe(1);
  });

  it('first-to continues until a captain reaches the target', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'a',
      activePlayerId: 'a',
      roundNumber: 1,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'first-to',
      goOutWinsToWin: 2,
      campaignRounds: 13,
      matchStarterIndex: 0,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const first = scoreRound(state, round, () => 0.5);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.phase).toBe('active');
    expect(first.state.captains.find((c) => c.id === 'a')?.goOutWins).toBe(1);
    expect(first.state.round?.roundNumber).toBe(2);
    expect(first.state.trailMomentumClaimedBy ?? null).toBe(null);
    expect(first.state.handExchangeResolved ?? false).toBe(false);

    const round2 = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'a',
      roundNumber: 2,
    });
    const second = scoreRound(first.state, round2, () => 0.5);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.phase).toBe('complete');
    expect(second.state.captains.find((c) => c.id === 'a')?.goOutWins).toBe(2);
  });

  it('fixed-rounds forces overtime when tied after N', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'b',
      activePlayerId: 'a',
      roundNumber: 2,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      goOutOvertime: 'force',
      campaignRounds: 2,
      completedRounds: 1,
      matchStarterIndex: 0,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 1 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.goOutInOvertime).toBe(true);
    expect(result.state.round?.roundNumber).toBe(3);
    expect(result.state.round?.spacedockValue).toBe(10);
  });

  it('fixed-rounds offer overtime sets pending flag', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'b',
      activePlayerId: 'a',
      roundNumber: 2,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      goOutOvertime: 'offer',
      campaignRounds: 2,
      completedRounds: 1,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 1 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('complete');
    expect(result.state.goOutOvertimePending).toBe(true);

    const declined = resolveGoOutOvertimeOffer(result.state, false);
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.state.goOutOvertimePending).toBe(false);
    expect(declined.state.phase).toBe('complete');

    const pendingWithPile: GameState = {
      ...result.state,
      round: fullPileRound({
        phase: 'ended',
        roundWinnerId: 'b',
        roundNumber: 2,
      }),
    };
    const accepted = resolveGoOutOvertimeOffer(pendingWithPile, true, () => 0.5);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.state.phase).toBe('active');
    expect(accepted.state.goOutInOvertime).toBe(true);
  });

  it('blocked go-out round re-deals the same round number', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundBlocked: true,
      roundWinnerId: null,
      activePlayerId: 'a',
      roundNumber: 3,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      campaignRounds: 13,
      matchStarterIndex: 1,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.round?.roundNumber).toBe(3);
    expect(result.state.round?.spacedockValue).toBe(10);
    expect(result.state.completedRounds).toBe(0);
    expect(result.state.captains.every((c) => (c.goOutWins ?? 0) === 0)).toBe(
      true
    );
    expect(result.state.round?.activePlayerId).toBe('b');
  });

  it('RESOLVE_GO_OUT_OVERTIME applies via applyAction', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'a',
      roundNumber: 2,
    });
    const state: GameState = makeGame(round, {
      objective: 'go-out',
      phase: 'complete',
      goOutOvertimePending: true,
      goOutStructure: 'fixed-rounds',
      modules: resolveModules({}),
    });
    const result = applyAction(state, {
      type: 'RESOLVE_GO_OUT_OVERTIME',
      playerId: 'a',
      accept: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goOutInOvertime).toBe(true);
    expect(result.state.phase).toBe('active');
  });

  it('wraps Spacedock to maxPip when overtime continues past 0-0', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'b',
      roundNumber: 13,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      goOutOvertime: 'force',
      campaignRounds: 13,
      completedRounds: 12,
      goOutInOvertime: false,
      matchStarterIndex: 0,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 7 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 6 },
      ],
    });
    // b wins round 13 → 7-7 tie → OT round 14 wraps Spacedock to 12
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goOutInOvertime).toBe(true);
    expect(result.state.round?.roundNumber).toBe(14);
    expect(result.state.round?.spacedockValue).toBe(12);
  });

  it('clears once-per-round module flags when dealing the next campaign round', () => {
    const round = fullPileRound({
      phase: 'ended',
      roundWinnerId: 'a',
      roundNumber: 1,
    });
    const state = makeGame(round, {
      objective: 'go-out',
      goOutStructure: 'first-to',
      goOutWinsToWin: 3,
      trailMomentumClaimedBy: 'a',
      handExchangeResolved: true,
      matchStarterIndex: 0,
      captains: [
        { id: 'a', displayName: 'A', pointsScore: 0, goOutWins: 0 },
        { id: 'b', displayName: 'B', pointsScore: 0, goOutWins: 0 },
      ],
    });
    const result = scoreRound(state, round, () => 0.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('active');
    expect(result.state.trailMomentumClaimedBy).toBeNull();
    expect(result.state.handExchangeResolved).toBe(false);
  });
});
