import { describe, expect, it } from 'vitest';

import {
  isPhoneLandscape,
  requiresPortraitLock,
  resolveLayoutOrientation,
  resolveLayoutTier,
} from './layout-tier.js';

describe('resolveLayoutTier', () => {
  it('classifies narrow phones in either orientation', () => {
    expect(resolveLayoutTier(390, 844)).toBe('phone');
    expect(resolveLayoutTier(844, 390)).toBe('phone');
  });

  it('classifies tablets between phone and desktop thresholds', () => {
    expect(resolveLayoutTier(768, 1024)).toBe('tablet');
    expect(resolveLayoutTier(1024, 768)).toBe('tablet');
  });

  it('classifies wide layouts as desktop', () => {
    expect(resolveLayoutTier(1280, 1024)).toBe('desktop');
    expect(resolveLayoutTier(1920, 1080)).toBe('desktop');
  });
});

describe('resolveLayoutOrientation', () => {
  it('detects landscape when width exceeds height', () => {
    expect(resolveLayoutOrientation(844, 390)).toBe('landscape');
    expect(resolveLayoutOrientation(390, 844)).toBe('portrait');
  });
});

describe('isPhoneLandscape', () => {
  it('is true only for phone tier in landscape', () => {
    expect(isPhoneLandscape('phone', 844, 390)).toBe(true);
    expect(isPhoneLandscape('phone', 390, 844)).toBe(false);
    expect(isPhoneLandscape('tablet', 1024, 768)).toBe(false);
  });
});

describe('requiresPortraitLock', () => {
  it('is true only for phone tier in landscape', () => {
    expect(requiresPortraitLock('phone', 'landscape')).toBe(true);
    expect(requiresPortraitLock('phone', 'portrait')).toBe(false);
    expect(requiresPortraitLock('tablet', 'landscape')).toBe(false);
  });
});
