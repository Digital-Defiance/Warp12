import { describe, expect, it } from 'vitest';

import {
  resolveTtsNameMap,
  sanitizeSpeakAs,
} from './captain-speak-as.js';

describe('sanitizeSpeakAs', () => {
  it('trims and accepts plain phonetic aliases', () => {
    expect(sanitizeSpeakAs('  Blahtz  ')).toBe('Blahtz');
    expect(sanitizeSpeakAs("O'Brien")).toBe("O'Brien");
    expect(sanitizeSpeakAs('Nguyen Win')).toBe('Nguyen Win');
  });

  it('rejects markup and empty', () => {
    expect(sanitizeSpeakAs('')).toBeNull();
    expect(sanitizeSpeakAs('   ')).toBeNull();
    expect(sanitizeSpeakAs('<phoneme>x</phoneme>')).toBeNull();
    expect(sanitizeSpeakAs('say/as')).toBeNull();
  });
});

describe('resolveTtsNameMap', () => {
  it('substitutes aliases when enabled', () => {
    expect(
      resolveTtsNameMap(
        { a: 'Blitz', b: 'Lovell' },
        { a: 'Blahtz', b: null },
        true
      )
    ).toEqual({ a: 'Blahtz', b: 'Lovell' });
  });

  it('ignores aliases when the match disables speak-as', () => {
    expect(
      resolveTtsNameMap(
        { a: 'Blitz' },
        { a: 'Blahtz' },
        false
      )
    ).toEqual({ a: 'Blitz' });
  });

  it('applies AI officer spoken-as the same way as humans', () => {
    expect(
      resolveTtsNameMap(
        { 'ai:lovell': 'Lovell', you: 'Blitz' },
        { 'ai:lovell': 'Lah-vell', you: 'Blahtz' },
        true
      )
    ).toEqual({ 'ai:lovell': 'Lah-vell', you: 'Blahtz' });
  });

  it('rejects invalid AI aliases and falls back to call sign', () => {
    expect(
      resolveTtsNameMap(
        { 'ai:earhart': 'Earhart' },
        { 'ai:earhart': '<phoneme>x</phoneme>' },
        true
      )
    ).toEqual({ 'ai:earhart': 'Earhart' });
  });
});
