import { describe, expect, it } from 'vitest';

import { defaultManualViewForTier } from './manual-viewer';

describe('defaultManualViewForTier', () => {
  it('defaults to HTML on phone (PDF embeds are unreliable)', () => {
    expect(defaultManualViewForTier('phone')).toBe('html');
  });

  it('defaults to the typeset PDF on tablet and desktop', () => {
    expect(defaultManualViewForTier('tablet')).toBe('pdf');
    expect(defaultManualViewForTier('desktop')).toBe('pdf');
  });
});
