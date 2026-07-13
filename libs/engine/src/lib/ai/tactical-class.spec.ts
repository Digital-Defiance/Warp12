import { describe, expect, it } from 'vitest';

import { formatAiOfficerTacticalClass, formatTacticalClass } from './tactical-class.js';

describe('formatTacticalClass', () => {
  it('uses Ensign / Lieutenant / Commander labels', () => {
    expect(formatTacticalClass('IV')).toBe('Ensign');
    expect(formatTacticalClass('III')).toBe('Lieutenant');
    expect(formatTacticalClass('II')).toBe('Commander');
    expect(formatTacticalClass('I')).toBe('Flag Officer');
  });

  it('uses HUD abbreviations Ens. / Lt. / Cmdr.', () => {
    expect(formatTacticalClass('IV', { short: true })).toBe('Ens.');
    expect(formatTacticalClass('III', { short: true })).toBe('Lt.');
    expect(formatTacticalClass('II', { short: true })).toBe('Cmdr.');
    expect(formatTacticalClass('I', { short: true })).toBe('Flag');
  });
});

describe('formatAiOfficerTacticalClass', () => {
  it('maps standard skills to Ensign–Commander', () => {
    expect(formatAiOfficerTacticalClass('commander')).toBe('Commander');
    expect(formatAiOfficerTacticalClass('commander', { short: true })).toBe(
      'Cmdr.'
    );
    expect(formatAiOfficerTacticalClass('lieutenant', { short: true })).toBe(
      'Lt.'
    );
    expect(formatAiOfficerTacticalClass('ensign', { short: true })).toBe(
      'Ens.'
    );
  });

  it('shows I* when class1Star is set', () => {
    expect(
      formatAiOfficerTacticalClass('commander', { class1Star: true })
    ).toBe('Class I*');
    expect(
      formatAiOfficerTacticalClass('commander', {
        short: true,
        class1Star: true,
      })
    ).toBe('I*');
  });

  it('shows Ω when omega is set', () => {
    expect(formatAiOfficerTacticalClass('commander', { omega: true })).toBe(
      'Ω'
    );
    expect(
      formatAiOfficerTacticalClass('commander', { short: true, omega: true })
    ).toBe('Ω');
  });
});
