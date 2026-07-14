import { describe, expect, it } from 'vitest';

import { practiceMatchTeiEligible } from './practice-match-tei-eligibility.js';

describe('practiceMatchTeiEligible', () => {
  it('requires eligible config', () => {
    expect(
      practiceMatchTeiEligible({
        configEligible: false,
        advisorUsed: false,
        devToolsUsed: false,
        isAdmin: true,
      })
    ).toBe(false);
  });

  it('voids when advisor was used even for admins', () => {
    expect(
      practiceMatchTeiEligible({
        configEligible: true,
        advisorUsed: true,
        devToolsUsed: false,
        isAdmin: true,
      })
    ).toBe(false);
  });

  it('voids console tools for non-admins and allows for admins', () => {
    expect(
      practiceMatchTeiEligible({
        configEligible: true,
        advisorUsed: false,
        devToolsUsed: true,
        isAdmin: false,
      })
    ).toBe(false);
    expect(
      practiceMatchTeiEligible({
        configEligible: true,
        advisorUsed: false,
        devToolsUsed: true,
        isAdmin: true,
      })
    ).toBe(true);
  });
});
