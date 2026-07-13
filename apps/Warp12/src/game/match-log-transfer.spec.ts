import { describe, expect, it } from 'vitest';
import {
  exportMatchToBase64,
  exportMatchToBase64Url,
  importMatchFromBase64,
  getMatchExportSize,
  isValidMatchBase64,
  createShareableLink,
  extractMatchFromUrl,
} from './match-log-transfer.js';
import type { BinaryMatchExport } from './match-log-binary.js';

describe('match-log-transfer', () => {
  const sampleMatch: BinaryMatchExport = {
    gameId: 'test-match-123',
    actions: {
      format: 'binary-v1',
      encoding: 'base64',
      data: 'AQIDBAUG', // Small sample
      actionCount: 5,
      byteSize: 6,
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      maxPip: 12,
    },
    exportedAt: 1700000000000,
  };

  it('exports to base64 and imports back correctly', () => {
    const base64 = exportMatchToBase64(sampleMatch);
    expect(base64).toBeTruthy();
    expect(base64.length).toBeGreaterThan(0);

    const imported = importMatchFromBase64(base64);
    expect(imported.gameId).toBe(sampleMatch.gameId);
    expect(imported.actions.actionCount).toBe(sampleMatch.actions.actionCount);
    expect(imported.actions.data).toBe(sampleMatch.actions.data);
  });

  it('exports to URL-safe base64 (no + / =)', () => {
    const urlSafe = exportMatchToBase64Url(sampleMatch);
    expect(urlSafe).toBeTruthy();
    expect(urlSafe).not.toContain('+');
    expect(urlSafe).not.toContain('/');
    expect(urlSafe).not.toContain('=');
  });

  it('imports URL-safe base64 correctly', () => {
    const urlSafe = exportMatchToBase64Url(sampleMatch);
    const imported = importMatchFromBase64(urlSafe);
    expect(imported.gameId).toBe(sampleMatch.gameId);
  });

  it('imports standard base64 correctly', () => {
    const standard = exportMatchToBase64(sampleMatch);
    const imported = importMatchFromBase64(standard);
    expect(imported.gameId).toBe(sampleMatch.gameId);
  });

  it('throws on invalid base64', () => {
    expect(() => importMatchFromBase64('invalid!!!')).toThrow();
  });

  it('throws on malformed JSON', () => {
    const invalid = btoa('{malformed}');
    expect(() => importMatchFromBase64(invalid)).toThrow();
  });

  it('throws on invalid structure', () => {
    const invalid = btoa(JSON.stringify({ foo: 'bar' }));
    expect(() => importMatchFromBase64(invalid)).toThrow('Invalid match log structure');
  });

  it('throws on unsupported format', () => {
    const unsupported = {
      ...sampleMatch,
      actions: { ...sampleMatch.actions, format: 'binary-v2' as any },
    };
    const base64 = btoa(JSON.stringify(unsupported));
    expect(() => importMatchFromBase64(base64)).toThrow('Unsupported format');
  });

  it('calculates export size correctly', () => {
    const size = getMatchExportSize(sampleMatch);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(1000); // Sample should be small
  });

  it('validates match base64 format', () => {
    const valid = exportMatchToBase64(sampleMatch);
    expect(isValidMatchBase64(valid)).toBe(true);

    expect(isValidMatchBase64('abc')).toBe(false); // Too short
    expect(isValidMatchBase64('invalid chars!!!')).toBe(false);
  });

  it('creates shareable link with match embedded', () => {
    const link = createShareableLink(sampleMatch, 'https://warp.iwdf.org');
    expect(link).toContain('https://warp.iwdf.org');
    expect(link).toContain('?match=');
    
    // Extract just the match parameter to verify URL-safe encoding
    const url = new URL(link);
    const matchParam = url.searchParams.get('match');
    expect(matchParam).not.toContain('+');
    expect(matchParam).not.toContain('/');
  });

  it('extracts match from URL', () => {
    const link = createShareableLink(sampleMatch, 'https://warp.iwdf.org');
    const extracted = extractMatchFromUrl(link);
    expect(extracted).not.toBeNull();
    expect(extracted?.gameId).toBe(sampleMatch.gameId);
  });

  it('returns null when no match in URL', () => {
    const extracted = extractMatchFromUrl('https://warp.iwdf.org');
    expect(extracted).toBeNull();
  });

  it('returns null on invalid URL match param', () => {
    const extracted = extractMatchFromUrl('https://warp.iwdf.org?match=invalid');
    expect(extracted).toBeNull();
  });

  it('preserves snapshots in round-trip', () => {
    const matchWithSnapshots: BinaryMatchExport = {
      ...sampleMatch,
      snapshots: [
        {
          round: 1,
          data: 'AQIDBAUG',
          byteSize: 300,
          timestamp: 1700000001000,
        },
        {
          round: 2,
          data: 'BwgJCgsM',
          byteSize: 310,
          timestamp: 1700000002000,
        },
      ],
    };

    const base64 = exportMatchToBase64(matchWithSnapshots);
    const imported = importMatchFromBase64(base64);

    expect(imported.snapshots).toBeDefined();
    expect(imported.snapshots?.length).toBe(2);
    expect(imported.snapshots?.[0].round).toBe(1);
    expect(imported.snapshots?.[1].round).toBe(2);
  });
});
