/**
 * Comprehensive round-trip tests for action encoding/decoding.
 * Tests all action types to ensure binary format preserves data correctly.
 */

import { describe, expect, it } from 'vitest';
import { encodeActions, decodeActions } from './index.js';
import type { GameAction } from '../types/actions.js';
import type { FlashEffectKind } from '../types/continuum.js';

describe('action round-trip encoding', () => {
  const ctx = {
    playerIds: ['p0', 'p1', 'p2', 'p3'],
    maxPip: 12,
  };

  function roundTrip(actions: GameAction[]): GameAction[] {
    const binary = encodeActions(actions, ctx);
    return decodeActions(binary, ctx);
  }

  it('CHART_COORDINATE - warp trail', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p0',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'warp-trail', playerId: 'p0' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('CHART_COORDINATE - neutral zone', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p1',
        coordinate: { low: 3, high: 5 }, // Normalized: low <= high
        route: { kind: 'neutral-zone' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('CHART_COORDINATE - fracture stabilizer', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p2',
        coordinate: { low: 9, high: 9 },
        route: { kind: 'fracture-stabilizer' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('CHART_COORDINATE - red alert cover', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p3',
        coordinate: { low: 2, high: 6 }, // Normalized
        route: { kind: 'red-alert-cover', trailPlayerId: 'p1' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('CHART_COORDINATE - red alert cover on neutral zone', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p0',
        coordinate: { low: 4, high: 8 }, // Normalized
        route: { kind: 'red-alert-cover', neutralZone: true },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('DRAW_FROM_UNCHARTED', () => {
    const actions: GameAction[] = [
      {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'p1',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('SENSOR_SWEEP', () => {
    const actions: GameAction[] = [
      {
        type: 'SENSOR_SWEEP',
        playerId: 'p2',
        coordinate: { low: 7, high: 11 },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('SPOOL_WARP_DRIVE - warp trail', () => {
    const actions: GameAction[] = [
      {
        type: 'SPOOL_WARP_DRIVE',
        playerId: 'p3',
        route: { kind: 'warp-trail', playerId: 'p3' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('SPOOL_WARP_DRIVE - neutral zone', () => {
    const actions: GameAction[] = [
      {
        type: 'SPOOL_WARP_DRIVE',
        playerId: 'p0',
        route: { kind: 'neutral-zone' },
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('PASS_RED_ALERT', () => {
    const actions: GameAction[] = [
      {
        type: 'PASS_RED_ALERT',
        playerId: 'p1',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('PASS_TURN', () => {
    const actions: GameAction[] = [
      {
        type: 'PASS_TURN',
        playerId: 'p2',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('DEPLOY_DISTRESS_BEACON', () => {
    const actions: GameAction[] = [
      {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'p3',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('ALL_STOP', () => {
    const actions: GameAction[] = [
      {
        type: 'ALL_STOP',
        playerId: 'p0',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('DROP_TO_IMPULSE', () => {
    const actions: GameAction[] = [
      {
        type: 'DROP_TO_IMPULSE',
        playerId: 'p1',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('CATCH_DROP_TO_IMPULSE', () => {
    const actions: GameAction[] = [
      {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: 'p2',
        targetPlayerId: 'p1',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('RAISE_SHIELDS', () => {
    const actions: GameAction[] = [
      {
        type: 'RAISE_SHIELDS',
        playerId: 'p3',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('INVOKE_CONTINUUM_FLASH - all effects', () => {
    // Test all 9 continuum flash effects
    const effects: FlashEffectKind[] = [
      'reverse-turn-order',
      'skip-lowest-points',
      'peek-uncharted',
      'temporal-inversion',
      'distress-amplification',
      'fracture-immunity',
      'salamander-swap',
      'all-stop-echo',
      'continuum-wager',
    ];

    for (const effect of effects) {
      const actions: GameAction[] = [
        {
          type: 'INVOKE_CONTINUUM_FLASH',
          playerId: 'p0',
          effect,
        },
      ];

      const decoded = roundTrip(actions);
      expect(decoded).toEqual(actions);
    }
  });

  it('RESOLVE_CONTINUUM_WAGER - keep first', () => {
    const actions: GameAction[] = [
      {
        type: 'RESOLVE_CONTINUUM_WAGER',
        playerId: 'p1',
        keepIndex: 0,
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('RESOLVE_CONTINUUM_WAGER - keep second', () => {
    const actions: GameAction[] = [
      {
        type: 'RESOLVE_CONTINUUM_WAGER',
        playerId: 'p2',
        keepIndex: 1,
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('PICK_FROM_PACK', () => {
    const actions: GameAction[] = [
      {
        type: 'PICK_FROM_PACK',
        playerId: 'p3',
        coordinate: { low: 4, high: 10 }, // Normalized
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('END_ROUND - with winner', () => {
    const actions: GameAction[] = [
      {
        type: 'END_ROUND',
        winnerId: 'p0',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('END_ROUND - blocked (no winner)', () => {
    const actions: GameAction[] = [
      {
        type: 'END_ROUND',
        winnerId: null,
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('LONGEST_TRAIL_BONUS - signed points and trail length', () => {
    const actions: GameAction[] = [
      {
        type: 'LONGEST_TRAIL_BONUS',
        playerId: 'p1',
        trailLength: 19,
        points: -3,
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('TEMPORAL_DEBT_PENALTY - tokens and points', () => {
    const actions: GameAction[] = [
      {
        type: 'TEMPORAL_DEBT_PENALTY',
        playerId: 'p1',
        tokens: 8,
        points: 16,
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('scoring annotations batch (Salamander + Longest Trail + END_ROUND)', () => {
    const actions: GameAction[] = [
      {
        type: 'SALAMANDER_PENALTY',
        holderId: 'p2',
        scoredOnId: 'p0',
        points: 48,
      },
      {
        type: 'LONGEST_TRAIL_BONUS',
        playerId: 'p1',
        trailLength: 12,
        points: -3,
      },
      {
        type: 'LONGEST_TRAIL_BONUS',
        playerId: 'p3',
        trailLength: 12,
        points: -3,
      },
      {
        type: 'END_ROUND',
        winnerId: 'p0',
      },
    ];

    const binary = encodeActions(actions, ctx);
    expect(decodeActions(binary, ctx)).toEqual(actions);
  });

  it('mixed sequence of multiple action types', () => {
    const actions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p0',
        coordinate: { low: 12, high: 12 },
        route: { kind: 'warp-trail', playerId: 'p0' },
      },
      {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'p1',
      },
      {
        type: 'CHART_COORDINATE',
        playerId: 'p1',
        coordinate: { low: 5, high: 12 }, // Normalized
        route: { kind: 'warp-trail', playerId: 'p1' },
      },
      {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'p2',
      },
      {
        type: 'CHART_COORDINATE',
        playerId: 'p2',
        coordinate: { low: 5, high: 5 },
        route: { kind: 'neutral-zone' },
      },
      {
        type: 'PASS_TURN',
        playerId: 'p3',
      },
      {
        type: 'DROP_TO_IMPULSE',
        playerId: 'p0',
      },
      {
        type: 'ALL_STOP',
        playerId: 'p0',
      },
      {
        type: 'END_ROUND',
        winnerId: 'p0',
      },
    ];

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
  });

  it('handles all coordinate ranges (0-12 for double-twelve)', () => {
    const actions: GameAction[] = [];
    
    // Test all pip values
    for (let low = 0; low <= 12; low++) {
      for (let high = low; high <= 12; high++) {
        actions.push({
          type: 'CHART_COORDINATE',
          playerId: 'p0',
          coordinate: { low, high },
          route: { kind: 'warp-trail', playerId: 'p0' },
        });
      }
    }

    const decoded = roundTrip(actions);
    expect(decoded).toEqual(actions);
    expect(decoded.length).toBe(91); // (13 * 14) / 2 = 91 unique coordinates
  });

  it('preserves player IDs across all action types', () => {
    const actions: GameAction[] = [
      { type: 'DRAW_FROM_UNCHARTED', playerId: 'p0' },
      { type: 'DRAW_FROM_UNCHARTED', playerId: 'p1' },
      { type: 'DRAW_FROM_UNCHARTED', playerId: 'p2' },
      { type: 'DRAW_FROM_UNCHARTED', playerId: 'p3' },
    ];

    const decoded = roundTrip(actions);
    expect(decoded[0].playerId).toBe('p0');
    expect(decoded[1].playerId).toBe('p1');
    expect(decoded[2].playerId).toBe('p2');
    expect(decoded[3].playerId).toBe('p3');
  });

  it('handles large action sequences efficiently', () => {
    const actions: GameAction[] = [];
    
    // Simulate a full 200-action match
    for (let i = 0; i < 200; i++) {
      const low = Math.min(i % 13, (i + 1) % 13);
      const high = Math.max(i % 13, (i + 1) % 13);
      actions.push({
        type: 'CHART_COORDINATE',
        playerId: `p${i % 4}`,
        coordinate: { low, high }, // Ensure normalized
        route: { kind: 'warp-trail', playerId: `p${i % 4}` },
      });
    }

    const binary = encodeActions(actions, ctx);
    const decoded = decodeActions(binary, ctx);

    expect(decoded.length).toBe(200);
    expect(decoded).toEqual(actions);
    
    // Verify compression is effective
    const jsonSize = JSON.stringify(actions).length;
    const binarySize = binary.length;
    const compressionRatio = jsonSize / binarySize;
    
    expect(compressionRatio).toBeGreaterThan(20); // binary-v2 u16 coords; still >> JSON
  });
});
