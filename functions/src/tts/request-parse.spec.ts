import { describe, expect, it } from 'vitest';

import {
  parseSynthesizeRequest,
  speechTextFromCommentatorLine,
  ttsCacheKey,
} from './request-parse.js';

describe('tts request-parse', () => {
  const baseEntry = {
    at: '2026-01-01T00:00:05.000Z',
    kind: 'ALL_STOP',
    captainId: 'armstrong',
    effects: [] as const,
  };

  const baseRequest = {
    entry: baseEntry,
    names: { armstrong: 'Armstrong' },
    roundStartedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
    matchId: 'online-ABCD12',
    sectorCode: 'ABCD12',
  };

  it('rejects free-form text fields', () => {
    expect(() =>
      parseSynthesizeRequest({
        text: 'say whatever',
        ...baseRequest,
      })
    ).toThrow(/Free-form/);
  });

  it('requires matchId for per-match folders', () => {
    expect(() =>
      parseSynthesizeRequest({
        entry: baseEntry,
        names: { armstrong: 'Armstrong' },
        roundStartedAtMs: 0,
      })
    ).toThrow(/matchId/);
  });

  it('accepts a structured highlight entry with match folder', () => {
    const parsed = parseSynthesizeRequest(baseRequest);
    expect(parsed.entry.kind).toBe('ALL_STOP');
    expect(parsed.names.armstrong).toBe('Armstrong');
    expect(parsed.matchId).toBe('online-ABCD12');
    expect(parsed.sectorCode).toBe('ABCD12');
  });

  it('strips timestamp for speech', () => {
    expect(
      speechTextFromCommentatorLine(
        '00:05 - All Stop! Armstrong empties the hand — what a finish!'
      )
    ).toBe('All Stop! Armstrong empties the hand — what a finish!');
  });

  it('strips timestamps and speaks tile colons as words (not clock times)', () => {
    expect(
      speechTextFromCommentatorLine(
        '00:02 - Armstrong opens with a 5:12 on their own Trail!'
      )
    ).toBe('Armstrong opens with a five twelve on their own Trail!');

    expect(
      speechTextFromCommentatorLine(
        '03:00 - Lovell opens the Neutral Zone with a 3:12!'
      )
    ).toBe('Lovell opens the Neutral Zone with a three twelve!');

    expect(
      speechTextFromCommentatorLine(
        '01:45 - Earhart charts 12:7 on Captain Lovell\'s Trail!'
      )
    ).toBe('Earhart charts twelve seven on Captain Lovell\'s Trail!');

    expect(
      speechTextFromCommentatorLine(
        '07:00 - Armstrong puts up their Distress Beacon — trail open!'
      )
    ).toBe('Armstrong puts up their Distress Beacon — trail open!');

    expect(
      speechTextFromCommentatorLine(
        '07:10 - Lovell raises their shields — trail secured!'
      )
    ).toBe('Lovell raises their shields — trail secured!');
  });

  it('leaves Double hyphen notation unchanged for speech', () => {
    expect(
      speechTextFromCommentatorLine(
        '00:08 - Armstrong charts Double 0-0 on the Neutral Zone!'
      )
    ).toBe('Armstrong charts Double 0-0 on the Neutral Zone!');
  });

  it('accepts speakAs-remapped names in the TTS request', () => {
    const parsed = parseSynthesizeRequest({
      ...baseRequest,
      names: { armstrong: 'Blahtz' },
      entry: {
        ...baseEntry,
        kind: 'DEPLOY_DISTRESS_BEACON',
      },
    });
    expect(parsed.names.armstrong).toBe('Blahtz');
  });

  it('accepts structural entries with empty or omitted captainId', () => {
    const withEmpty = parseSynthesizeRequest({
      ...baseRequest,
      entry: {
        at: '2026-01-01T00:00:00.000Z',
        kind: 'ROUND_STARTED',
        captainId: '',
        roundNumber: 1,
        spacedockValue: 12,
        effects: [],
      },
    });
    expect(withEmpty.entry.kind).toBe('ROUND_STARTED');
    expect(withEmpty.entry.captainId).toBe('');

    const omitted = parseSynthesizeRequest({
      ...baseRequest,
      entry: {
        at: '2026-01-01T00:00:01.000Z',
        kind: 'MODULE_LOADOUT',
        roundNumber: 1,
        moduleLabels: ['Module Alpha · Continuum'],
        effects: [],
      },
    });
    expect(omitted.entry.kind).toBe('MODULE_LOADOUT');
    expect(omitted.entry.captainId).toBe('');
  });

  it('accepts a batched entries payload and cacheOnly flag', () => {
    const second = {
      ...baseEntry,
      kind: 'DEPLOY_DISTRESS_BEACON',
      at: '2026-01-01T00:00:06.000Z',
    };
    const parsed = parseSynthesizeRequest({
      ...baseRequest,
      entries: [baseEntry, second],
    });
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entry.kind).toBe('ALL_STOP');
    expect(parsed.cacheOnly).toBe(false);

    const probe = parseSynthesizeRequest({
      ...baseRequest,
      cacheOnly: true,
    });
    expect(probe.cacheOnly).toBe(true);

    expect(() =>
      parseSynthesizeRequest({
        ...baseRequest,
        cacheOnly: true,
        entries: [baseEntry, second],
      })
    ).toThrow(/cacheOnly/);
  });

  it('stable cache keys', () => {
    const a = ttsCacheKey('voice', 'model', 'hello');
    const b = ttsCacheKey('voice', 'model', 'hello');
    const c = ttsCacheKey('voice', 'model', 'hello!');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('includes pronunciation dictionary version in cache keys', () => {
    const none = ttsCacheKey('voice', 'model', 'hello');
    const v1 = ttsCacheKey('voice', 'model', 'hello', 'dict', 'v1');
    const v2 = ttsCacheKey('voice', 'model', 'hello', 'dict', 'v2');
    const same = ttsCacheKey('voice', 'model', 'hello', 'dict', 'v1');
    expect(v1).toBe(same);
    expect(v1).not.toBe(v2);
    expect(v1).not.toBe(none);
  });
});
