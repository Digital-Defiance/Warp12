import { describe, expect, it } from 'vitest';

import { formatAiOfficerTacticalClass } from './tactical-class.js';

describe('formatAiOfficerTacticalClass', () => {
  it('maps standard skills to Class IV–II', () => {
    expect(formatAiOfficerTacticalClass('commander')).toBe('Class II');
    expect(formatAiOfficerTacticalClass('commander', { short: true })).toBe(
      'Cls II'
    );
  });

  it('shows Class I* when class1Star is set', () => {
    expect(
      formatAiOfficerTacticalClass('commander', { class1Star: true })
    ).toBe('Class I*');
    expect(
      formatAiOfficerTacticalClass('commander', {
        short: true,
        class1Star: true,
      })
    ).toBe('Cls I*');
  });
});
