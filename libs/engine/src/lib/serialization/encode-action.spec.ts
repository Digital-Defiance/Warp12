import { describe, it, expect } from 'vitest';
import type { GameAction } from '../types/actions.js';
import type { FlashEffectKind } from '../types/continuum.js';
import { encodeAction, encodeActions, type EncodeContext } from './encode-action.js';
import { decodeAction, decodeActions } from './decode-action.js';

describe('Binary Action Encoding', () => {
  const ctx: EncodeContext = {
    playerIds: ['player-0', 'player-1', 'player-2', 'player-3'],
    maxPip: 12,
  };

  describe('Round-trip encoding', () => {
    it('encodes and decodes CHART_COORDINATE (warp trail)', () => {
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-1',
        coordinate: { low: 3, high: 7 },
        route: { kind: 'warp-trail', playerId: 'player-2' },
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(5);

      const { action: decoded, bytesRead } = decodeAction(encoded, 0, ctx);
      expect(bytesRead).toBe(5);
      expect(decoded).toEqual(action);
    });


    it('encodes and decodes CHART_COORDINATE on Warp 18 (18-18)', () => {
      const w18: EncodeContext = { playerIds: ctx.playerIds, maxPip: 18 };
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-0',
        coordinate: { low: 18, high: 18 },
        route: { kind: 'neutral-zone' },
      };
      const encoded = encodeAction(action, w18);
      expect(encoded.length).toBe(5);
      const { action: decoded } = decodeAction(encoded, 0, w18);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes CHART_COORDINATE (neutral zone)', () => {
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-0',
        coordinate: { low: 0, high: 12 },
        route: { kind: 'neutral-zone' },
      };

      const encoded = encodeAction(action, ctx);
      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes CHART_COORDINATE (fracture stabilizer)', () => {
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-3',
        coordinate: { low: 6, high: 6 },
        route: { kind: 'fracture-stabilizer' },
      };

      const encoded = encodeAction(action, ctx);
      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes CHART_COORDINATE (red alert cover with trail)', () => {
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-1',
        coordinate: { low: 5, high: 10 },
        route: { kind: 'red-alert-cover', trailPlayerId: 'player-0' },
      };

      const encoded = encodeAction(action, ctx);
      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes CHART_COORDINATE (red alert cover neutral)', () => {
      const action: GameAction = {
        type: 'CHART_COORDINATE',
        playerId: 'player-2',
        coordinate: { low: 4, high: 8 },
        route: { kind: 'red-alert-cover', neutralZone: true },
      };

      const encoded = encodeAction(action, ctx);
      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes DRAW_FROM_UNCHARTED', () => {
      const action: GameAction = {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'player-1',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded, bytesRead } = decodeAction(encoded, 0, ctx);
      expect(bytesRead).toBe(2);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes SENSOR_SWEEP', () => {
      const action: GameAction = {
        type: 'SENSOR_SWEEP',
        playerId: 'player-0',
        coordinate: { low: 2, high: 11 },
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(4);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes SPOOL_WARP_DRIVE', () => {
      const action: GameAction = {
        type: 'SPOOL_WARP_DRIVE',
        playerId: 'player-2',
        route: { kind: 'warp-trail', playerId: 'player-1' },
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(3);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes PASS_RED_ALERT', () => {
      const action: GameAction = {
        type: 'PASS_RED_ALERT',
        playerId: 'player-3',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes PASS_TURN', () => {
      const action: GameAction = {
        type: 'PASS_TURN',
        playerId: 'player-0',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes DEPLOY_DISTRESS_BEACON', () => {
      const action: GameAction = {
        type: 'DEPLOY_DISTRESS_BEACON',
        playerId: 'player-1',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes ALL_STOP', () => {
      const action: GameAction = {
        type: 'ALL_STOP',
        playerId: 'player-2',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes DROP_TO_IMPULSE', () => {
      const action: GameAction = {
        type: 'DROP_TO_IMPULSE',
        playerId: 'player-0',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes CATCH_DROP_TO_IMPULSE', () => {
      const action: GameAction = {
        type: 'CATCH_DROP_TO_IMPULSE',
        challengerId: 'player-1',
        targetPlayerId: 'player-3',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(3);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes RAISE_SHIELDS', () => {
      const action: GameAction = {
        type: 'RAISE_SHIELDS',
        playerId: 'player-2',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes INVOKE_CONTINUUM_FLASH', () => {
      const action: GameAction = {
        type: 'INVOKE_CONTINUUM_FLASH',
        playerId: 'player-1',
        effect: 'salamander-swap',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(3);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes RESOLVE_CONTINUUM_WAGER (keepIndex 0)', () => {
      const action: GameAction = {
        type: 'RESOLVE_CONTINUUM_WAGER',
        playerId: 'player-0',
        keepIndex: 0,
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(3);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes RESOLVE_CONTINUUM_WAGER (keepIndex 1)', () => {
      const action: GameAction = {
        type: 'RESOLVE_CONTINUUM_WAGER',
        playerId: 'player-2',
        keepIndex: 1,
      };

      const encoded = encodeAction(action, ctx);
      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes PICK_FROM_PACK', () => {
      const action: GameAction = {
        type: 'PICK_FROM_PACK',
        playerId: 'player-3',
        coordinate: { low: 1, high: 9 },
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(4);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes END_ROUND (with winner)', () => {
      const action: GameAction = {
        type: 'END_ROUND',
        winnerId: 'player-2',
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes END_ROUND (blocked, no winner)', () => {
      const action: GameAction = {
        type: 'END_ROUND',
        winnerId: null,
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(2);

      const { action: decoded } = decodeAction(encoded, 0, ctx);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes LONGEST_TRAIL_BONUS (signed −3)', () => {
      const action: GameAction = {
        type: 'LONGEST_TRAIL_BONUS',
        playerId: 'player-1',
        trailLength: 19,
        points: -3,
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(5);

      const { action: decoded, bytesRead } = decodeAction(encoded, 0, ctx);
      expect(bytesRead).toBe(5);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes TEMPORAL_DEBT_PENALTY', () => {
      const action: GameAction = {
        type: 'TEMPORAL_DEBT_PENALTY',
        playerId: 'player-1',
        tokens: 8,
        points: 16,
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(5);

      const { action: decoded, bytesRead } = decodeAction(encoded, 0, ctx);
      expect(bytesRead).toBe(5);
      expect(decoded).toEqual(action);
    });

    it('round-trips LONGEST_TRAIL_BONUS through encodeActions/decodeActions', () => {
      const actions: GameAction[] = [
        {
          type: 'LONGEST_TRAIL_BONUS',
          playerId: 'player-0',
          trailLength: 7,
          points: -3,
        },
        {
          type: 'END_ROUND',
          winnerId: 'player-2',
        },
      ];
      const encoded = encodeActions(actions, ctx);
      expect(decodeActions(encoded, ctx)).toEqual(actions);
    });

    it('encodes and decodes SALAMANDER_PENALTY (holder pays)', () => {
      const action: GameAction = {
        type: 'SALAMANDER_PENALTY',
        holderId: 'player-1',
        scoredOnId: 'player-1',
        points: 48,
      };

      const encoded = encodeAction(action, ctx);
      expect(encoded.length).toBe(5);

      const { action: decoded, bytesRead } = decodeAction(encoded, 0, ctx);
      expect(bytesRead).toBe(5);
      expect(decoded).toEqual(action);
    });

    it('encodes and decodes SALAMANDER_PENALTY (swap + Warp 18 points)', () => {
      const w18: EncodeContext = { playerIds: ctx.playerIds, maxPip: 18 };
      const action: GameAction = {
        type: 'SALAMANDER_PENALTY',
        holderId: 'player-0',
        scoredOnId: 'player-3',
        points: 72,
      };

      const encoded = encodeAction(action, w18);
      expect(encoded.length).toBe(5);
      const { action: decoded } = decodeAction(encoded, 0, w18);
      expect(decoded).toEqual(action);
    });
  });

  describe('Multiple actions', () => {
    it('encodes and decodes empty action list', () => {
      const actions: GameAction[] = [];
      const encoded = encodeActions(actions, ctx);
      expect(encoded.length).toBe(4); // Just the count

      const decoded = decodeActions(encoded, ctx);
      expect(decoded).toEqual([]);
    });

    it('encodes and decodes multiple actions', () => {
      const actions: GameAction[] = [
        {
          type: 'CHART_COORDINATE',
          playerId: 'player-0',
          coordinate: { low: 0, high: 0 },
          route: { kind: 'warp-trail', playerId: 'player-0' },
        },
        {
          type: 'DRAW_FROM_UNCHARTED',
          playerId: 'player-1',
        },
        {
          type: 'CHART_COORDINATE',
          playerId: 'player-1',
          coordinate: { low: 3, high: 3 },
          route: { kind: 'neutral-zone' },
        },
        {
          type: 'END_ROUND',
          winnerId: 'player-0',
        },
      ];

      const encoded = encodeActions(actions, ctx);
      // 4 (count) + 5 (chart) + 2 (draw) + 5 (chart) + 2 (end) = 18 bytes
      expect(encoded.length).toBe(18);

      const decoded = decodeActions(encoded, ctx);
      expect(decoded).toEqual(actions);
    });

    it('encodes a realistic 200-action match efficiently', () => {
      // Simulate a typical match: ~200 actions
      const actions: GameAction[] = [];

      for (let i = 0; i < 50; i++) {
        const low = i % 13;
        const high = (i + 3) % 13;
        actions.push({
          type: 'CHART_COORDINATE',
          playerId: `player-${i % 4}`,
          coordinate: low <= high ? { low, high } : { low: high, high: low },
          route: { kind: 'warp-trail', playerId: `player-${i % 4}` },
        });
      }
      for (let i = 0; i < 30; i++) {
        actions.push({
          type: 'DRAW_FROM_UNCHARTED',
          playerId: `player-${i % 4}`,
        });
      }
      for (let i = 0; i < 10; i++) {
        actions.push({
          type: 'END_ROUND',
          winnerId: `player-${i % 4}`,
        });
      }

      const encoded = encodeActions(actions, ctx);
      
      // Expected: 4 (count) + 50*5 (charts) + 30*2 (draws) + 10*2 (ends)
      // = 4 + 250 + 60 + 20 = 334 bytes
      expect(encoded.length).toBe(334);
      
      // Compare to JSON size
      const jsonSize = JSON.stringify(actions).length;
      const compressionRatio = jsonSize / encoded.length;
      
      // Expect at least 20x compression vs JSON
      expect(compressionRatio).toBeGreaterThan(20);

      // Verify round-trip
      const decoded = decodeActions(encoded, ctx);
      expect(decoded).toEqual(actions);
    });
  });

  describe('Edge cases', () => {
    it('handles all valid coordinates for Warp 12', () => {
      for (let low = 0; low <= 12; low++) {
        for (let high = low; high <= 12; high++) {
          const action: GameAction = {
            type: 'CHART_COORDINATE',
            playerId: 'player-0',
            coordinate: { low, high },
            route: { kind: 'neutral-zone' },
          };

          const encoded = encodeAction(action, ctx);
          const { action: decoded } = decodeAction(encoded, 0, ctx);
          expect(decoded).toEqual(action);
        }
      }
    });

    it('handles all player IDs', () => {
      for (let i = 0; i < 4; i++) {
        const action: GameAction = {
          type: 'PASS_TURN',
          playerId: `player-${i}`,
        };

        const encoded = encodeAction(action, ctx);
        const { action: decoded } = decodeAction(encoded, 0, ctx);
        expect(decoded).toEqual(action);
      }
    });

    it('handles all flash effects', () => {
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
        const action: GameAction = {
          type: 'INVOKE_CONTINUUM_FLASH',
          playerId: 'player-0',
          effect,
        };

        const encoded = encodeAction(action, ctx);
        const { action: decoded } = decodeAction(encoded, 0, ctx);
        expect(decoded).toEqual(action);
      }
    });
  });
});
