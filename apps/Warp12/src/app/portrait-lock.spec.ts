import { describe, expect, it } from 'vitest';

import { requiresPortraitLock } from './layout-tier.js';
import { shouldShowPortraitLock } from './portrait-lock.js';

describe('portrait lock', () => {
  it('requires portrait lock only for phone landscape', () => {
    expect(requiresPortraitLock('phone', 'landscape')).toBe(true);
    expect(requiresPortraitLock('phone', 'portrait')).toBe(false);
    expect(requiresPortraitLock('tablet', 'landscape')).toBe(false);
  });

  it('shows the overlay when portrait lock is required', () => {
    expect(shouldShowPortraitLock('phone', 'landscape')).toBe(true);
    expect(shouldShowPortraitLock('phone', 'portrait')).toBe(false);
  });
});
