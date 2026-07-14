import { describe, expect, it } from 'vitest';
import { type GameAction } from 'warp12-engine';

import {
  buildDebugFilename,
  processPayloadForBinaryExport,
  unwrapLoggedActions,
} from './debug-export.js';

describe('debug-export', () => {
  it('builds a stable filename from sector code and timestamp', () => {
    expect(
      buildDebugFilename('ABCD', '2026-06-27T15:04:05.000Z')
    ).toBe('warp12-ABCD-2026-06-27-15-04-05.json');
  });

  it('unwraps ActionLogEntry wrappers and bare GameActions', () => {
    const bare: GameAction = {
      type: 'DRAW_FROM_UNCHARTED',
      playerId: 'you',
    };
    const wrapped = {
      at: '2026-01-01T00:00:00.000Z',
      playerId: 'you',
      action: {
        type: 'CHART_COORDINATE',
        playerId: 'you',
        coordinate: { low: 18, high: 18 },
        route: { kind: 'warp-trail', playerId: 'you' },
      } satisfies GameAction,
      ok: true,
      source: 'human' as const,
    };
    expect(unwrapLoggedActions([wrapped, bare, { garbage: true }])).toEqual([
      wrapped.action,
      bare,
    ]);
  });

  it('encodes local human seat ids (you) on Warp 18 trails', () => {
    const payload = {
      client: {
        gameState: {
          maxPip: 18,
          round: { turnOrder: ['you', 'ai-1'] },
        },
        actionLog: [
          {
            at: '2026-01-01T00:00:02.000Z',
            playerId: 'you',
            action: {
              type: 'CHART_COORDINATE',
              playerId: 'you',
              coordinate: { low: 18, high: 18 },
              route: { kind: 'warp-trail', playerId: 'you' },
            } satisfies GameAction,
            ok: true,
            source: 'human',
          },
        ],
      },
    };

    const processed = processPayloadForBinaryExport(payload) as {
      client: {
        actionLogBinary: { format: string; maxPip: number; actionCount: number };
      };
    };
    expect(processed.client.actionLogBinary.format).toBe('binary-v2');
    expect(processed.client.actionLogBinary.maxPip).toBe(18);
    expect(processed.client.actionLogBinary.actionCount).toBe(1);
  });

  it('encodes bare GameAction arrays in binary-v2 format', () => {
    const sampleActions: GameAction[] = [
      {
        type: 'CHART_COORDINATE',
        playerId: 'p1',
        coordinate: { low: 6, high: 6 },
        route: { kind: 'warp-trail', playerId: 'p1' },
      },
      {
        type: 'DRAW_FROM_UNCHARTED',
        playerId: 'p2',
      },
    ];

    const payload = {
      exportedAt: '2026-01-01T00:00:00.000Z',
      mode: 'local',
      sectorCode: 'TEST',
      client: {
        gameState: { maxPip: 12 },
        actionLog: sampleActions,
      },
    };

    const processed = processPayloadForBinaryExport(payload) as {
      client: {
        actionLog: string;
        actionLogBinary: {
          format: string;
          encoding: string;
          data: string;
          actionCount: number;
          byteSize: number;
          playerIds: string[];
          maxPip: number;
        };
      };
    };

    expect(processed.client.actionLog).toContain('2 actions');
    expect(processed.client.actionLogBinary.format).toBe('binary-v2');
    expect(processed.client.actionLogBinary.encoding).toBe('base64');
    expect(processed.client.actionLogBinary.actionCount).toBe(2);
    expect(processed.client.actionLogBinary.byteSize).toBeGreaterThan(0);
    expect(processed.client.actionLogBinary.playerIds).toEqual(['p1', 'p2']);
    expect(processed.client.actionLogBinary.maxPip).toBe(12);
    expect(typeof processed.client.actionLogBinary.data).toBe('string');
  });

  it('encodes ActionLogEntry snapshots including Warp 18 Salamander', () => {
    const payload = {
      exportedAt: '2026-01-01T00:00:00.000Z',
      mode: 'local',
      sectorCode: 'local',
      client: {
        gameState: {
          maxPip: 18,
          round: { turnOrder: ['player-0', 'player-1'] },
        },
        actionLog: [
          {
            at: '2026-01-01T00:00:01.000Z',
            playerId: 'player-0',
            action: {
              type: 'DRAW_FROM_UNCHARTED',
              playerId: 'player-0',
            } satisfies GameAction,
            ok: true,
            source: 'human',
          },
          {
            at: '2026-01-01T00:00:02.000Z',
            playerId: 'player-0',
            action: {
              type: 'CHART_COORDINATE',
              playerId: 'player-0',
              coordinate: { low: 18, high: 18 },
              route: { kind: 'warp-trail', playerId: 'player-0' },
            } satisfies GameAction,
            ok: true,
            source: 'human',
          },
        ],
      },
    };

    const processed = processPayloadForBinaryExport(payload) as {
      client: {
        actionLog: string;
        actionLogBinary: {
          format: string;
          actionCount: number;
          maxPip: number;
          playerIds: string[];
          data: string;
        };
      };
    };

    expect(processed.client.actionLog).toContain('2 actions');
    expect(processed.client.actionLogBinary.format).toBe('binary-v2');
    expect(processed.client.actionLogBinary.actionCount).toBe(2);
    expect(processed.client.actionLogBinary.maxPip).toBe(18);
    expect(processed.client.actionLogBinary.playerIds).toEqual([
      'player-0',
      'player-1',
    ]);
    expect(processed.client.actionLogBinary.data.length).toBeGreaterThan(0);
  });
});
