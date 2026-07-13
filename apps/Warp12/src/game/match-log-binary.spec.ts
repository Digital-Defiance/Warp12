import { describe, expect, it } from 'vitest';
import { BinaryMatchLog } from './match-log-binary.js';
import type { GameAction, RoundState } from 'warp12-engine';
import { dealRoundFromShuffled, createRoundStateFromDeal, createCaptain } from 'warp12-engine';
import { generateCoordinateSet, shuffleCoordinates } from 'warp12-engine';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('BinaryMatchLog', () => {
  it('accumulates actions and exports binary format', () => {
    const log = new BinaryMatchLog({
      gameId: 'test-match',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      maxPip: 12,
    });

    const action1: GameAction = {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'p0',
      coordinate: { low: 5, high: 3 },
    };

    const action2: GameAction = {
      type: 'CHART_COORDINATE',
      playerId: 'p0',
      coordinate: { low: 12, high: 12 },
      route: { kind: 'warp-trail', playerId: 'p0' },
    };

    log.recordAction(action1);
    log.recordAction(action2);

    expect(log.getActionCount()).toBe(2);

    const exported = log.export();
    expect(exported.gameId).toBe('test-match');
    expect(exported.actions.format).toBe('binary-v1');
    expect(exported.actions.encoding).toBe('base64');
    expect(exported.actions.actionCount).toBe(2);
    expect(exported.actions.byteSize).toBeGreaterThan(0);
    expect(exported.actions.byteSize).toBeLessThan(50); // Should be very compact
  });

  it('captures state snapshots when enabled', () => {
    const log = new BinaryMatchLog({
      gameId: 'test-match',
      playerIds: ['p0', 'p1', 'p2'],
      maxPip: 12,
      captureSnapshots: true,
    });

    // Create a round state
    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(42));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
      createCaptain('p2', 'Carol'),
    ];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder: ['p0', 'p1', 'p2'],
    });
    const round = createRoundStateFromDeal(deal);

    log.recordRoundEnd(round);

    expect(log.getSnapshotCount()).toBe(1);

    const exported = log.export();
    expect(exported.snapshots).toBeDefined();
    expect(exported.snapshots?.length).toBe(1);
    expect(exported.snapshots?.[0].round).toBe(1);
    expect(exported.snapshots?.[0].byteSize).toBeGreaterThan(0);
    expect(exported.snapshots?.[0].byteSize).toBeLessThan(500);
  });

  it('does not capture snapshots when disabled', () => {
    const log = new BinaryMatchLog({
      gameId: 'test-match',
      playerIds: ['p0', 'p1'],
      maxPip: 12,
      captureSnapshots: false,
    });

    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(100));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
    ];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder: ['p0', 'p1'],
    });
    const round = createRoundStateFromDeal(deal);

    log.recordRoundEnd(round);

    expect(log.getSnapshotCount()).toBe(0);

    const exported = log.export();
    expect(exported.snapshots).toBeUndefined();
  });

  it('accumulates multiple rounds of actions', () => {
    const log = new BinaryMatchLog({
      gameId: 'multi-round',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      maxPip: 12,
    });

    // Simulate multiple rounds
    for (let round = 1; round <= 3; round++) {
      for (let i = 0; i < 10; i++) {
        const action: GameAction = {
          type: 'DRAW_FROM_UNCHARTED',
          playerId: `p${i % 4}`,
          coordinate: { low: i % 12, high: (i + 1) % 12 },
        };
        log.recordAction(action);
      }
    }

    expect(log.getActionCount()).toBe(30);

    const exported = log.export();
    expect(exported.actions.actionCount).toBe(30);
    // Even 30 actions should be under 200 bytes
    expect(exported.actions.byteSize).toBeLessThan(200);
  });

  it('reports total byte size correctly', () => {
    const log = new BinaryMatchLog({
      gameId: 'size-test',
      playerIds: ['p0', 'p1'],
      maxPip: 12,
      captureSnapshots: true,
    });

    const action: GameAction = {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'p0',
      coordinate: { low: 5, high: 3 },
    };
    log.recordAction(action);

    const coords = generateCoordinateSet(12);
    const shuffled = shuffleCoordinates(coords, seededRandom(200));
    const captains = [
      createCaptain('p0', 'Alice'),
      createCaptain('p1', 'Bob'),
    ];
    const deal = dealRoundFromShuffled({
      shuffledCoordinates: shuffled,
      roundNumber: 1,
      captains,
      turnOrder: ['p0', 'p1'],
    });
    const round = createRoundStateFromDeal(deal);

    log.recordRoundEnd(round);

    const totalSize = log.getTotalByteSize();
    expect(totalSize).toBeGreaterThan(0);
    expect(totalSize).toBeLessThan(1000); // Should be under 1KB
  });

  it('clears accumulated data', () => {
    const log = new BinaryMatchLog({
      gameId: 'clear-test',
      playerIds: ['p0', 'p1'],
      maxPip: 12,
    });

    const action: GameAction = {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'p0',
      coordinate: { low: 5, high: 3 },
    };
    log.recordAction(action);

    expect(log.getActionCount()).toBe(1);

    log.clear();

    expect(log.getActionCount()).toBe(0);
    expect(log.getSnapshotCount()).toBe(0);
  });
});
