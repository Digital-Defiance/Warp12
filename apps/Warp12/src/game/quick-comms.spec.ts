import { describe, expect, it } from 'vitest';

import {
  QUICK_COMM_GROUPS,
  isQuickCommPhraseId,
  quickCommPhraseById,
} from './quick-comms.js';

describe('quick-comms catalog', () => {
  it('has five groups, each with an icon and phrases', () => {
    expect(QUICK_COMM_GROUPS).toHaveLength(5);
    for (const group of QUICK_COMM_GROUPS) {
      expect(group.icon).toMatch(/\.svg$/);
      expect(group.phrases.length).toBeGreaterThan(0);
    }
  });

  it('uses globally unique phrase ids', () => {
    const ids = QUICK_COMM_GROUPS.flatMap((g) => g.phrases.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves a phrase id back to its text', () => {
    expect(quickCommPhraseById('move-engage')?.text).toBe('Engage!');
    expect(isQuickCommPhraseId('move-engage')).toBe(true);
    expect(quickCommPhraseById('nope')).toBeNull();
    expect(isQuickCommPhraseId('nope')).toBe(false);
  });
});
