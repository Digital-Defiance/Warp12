import { describe, expect, it } from 'vitest';

import {
  aiCaptainToConfig,
  isAiCaptainId,
  onlineAiSeed,
  pickNextAiOfficer,
  toAiCaptainId,
} from './ai-captain.js';

describe('ai captain helpers', () => {
  it('uses stable synthetic ids', () => {
    expect(toAiCaptainId('riker')).toBe('ai:riker');
    expect(isAiCaptainId('ai:riker')).toBe(true);
    expect(isAiCaptainId('firebase-uid')).toBe(false);
  });

  it('maps firestore captains back to AI config', () => {
    expect(
      aiCaptainToConfig({
        id: 'ai:data',
        displayName: 'Data',
        penaltyScore: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
        isAi: true,
        skill: 'advanced',
        useLookahead: true,
      })
    ).toEqual({
      id: 'ai:data',
      displayName: 'Data',
      skill: 'advanced',
      poolId: 'data',
    });
  });

  it('skips officers already in the roster', () => {
    expect(
      pickNextAiOfficer([
        { id: 'host' },
        { id: 'ai:riker' },
        { id: 'ai:troi' },
      ])?.id
    ).toBe('worf');
  });

  it('derives a deterministic seed from the sector code', () => {
    expect(onlineAiSeed('ABC123')).toBe(onlineAiSeed('ABC123'));
    expect(onlineAiSeed('ABC123')).not.toBe(onlineAiSeed('XYZ789'));
  });
});
