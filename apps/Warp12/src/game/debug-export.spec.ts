import { describe, expect, it } from 'vitest';
import { type GameAction } from 'warp12-engine';

import { buildDebugFilename, processPayloadForBinaryExport } from './debug-export.js';

describe('debug-export', () => {
  it('builds a stable filename from sector code and timestamp', () => {
    expect(
      buildDebugFilename('ABCD', '2026-06-27T15:04:05.000Z')
    ).toBe('warp12-ABCD-2026-06-27-15-04-05.json');
  });

  it('encodes action logs in binary format when present in client', () => {
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
        gameState: { /* ... */ },
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
    expect(processed.client.actionLogBinary).toBeDefined();
    expect(processed.client.actionLogBinary.format).toBe('binary-v1');
    expect(processed.client.actionLogBinary.encoding).toBe('base64');
    expect(processed.client.actionLogBinary.actionCount).toBe(2);
    expect(processed.client.actionLogBinary.byteSize).toBeGreaterThan(0);
    expect(processed.client.actionLogBinary.playerIds).toEqual(['p1', 'p2']);
    expect(processed.client.actionLogBinary.maxPip).toBe(12);
    expect(typeof processed.client.actionLogBinary.data).toBe('string');
  });
});
