import { describe, expect, it } from 'vitest';

import {
  formatCrewInviteCode,
  generateCrewInviteCodeShort,
  generateCrewInviteToken,
  groupRatedClaimId,
  normalizeCharterSlug,
  normalizeCrewInviteCode,
  parseGroupRatedClaimId,
} from './charter-schema.js';

describe('normalizeCharterSlug', () => {
  it('lowercases and hyphenates display names', () => {
    expect(normalizeCharterSlug('Oak Street Crew')).toBe('oak-street-crew');
  });

  it('strips leading and trailing punctuation', () => {
    expect(normalizeCharterSlug('---Beta---')).toBe('beta');
  });
});

describe('crew invite codes', () => {
  it('normalizes CREW- prefix variants', () => {
    expect(normalizeCrewInviteCode('crew-7k3q')).toBe('7K3Q');
    expect(normalizeCrewInviteCode('CREW7K3Q')).toBe('7K3Q');
    expect(normalizeCrewInviteCode(' 7k3q ')).toBe('7K3Q');
  });

  it('formats short codes for display', () => {
    expect(formatCrewInviteCode('7K3Q')).toBe('CREW-7K3Q');
  });

  it('generates four-character codes from the safe alphabet', () => {
    const code = generateCrewInviteCodeShort();
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[IO01]/);
  });

  it('generates eight-character invite tokens', () => {
    const token = generateCrewInviteToken();
    expect(token).toMatch(/^[A-Z2-9]{8}$/);
  });
});

describe('groupRatedClaimId', () => {
  it('builds and parses charter-scoped idempotency keys', () => {
    const claim = groupRatedClaimId('oak-street', 'MT-7K3Q');
    expect(claim).toBe('oak-street:MT-7K3Q');
    expect(parseGroupRatedClaimId(claim)).toEqual({
      charterId: 'oak-street',
      eventId: 'MT-7K3Q',
    });
  });

  it('includes season keys for Global Official soft resets', () => {
    const claim = groupRatedClaimId('global-official', 'MT-ABCD', '2026-fall');
    expect(claim).toBe('global-official:2026-fall:MT-ABCD');
    expect(parseGroupRatedClaimId(claim)).toEqual({
      charterId: 'global-official',
      seasonKey: '2026-fall',
      eventId: 'MT-ABCD',
    });
  });

  it('returns null for malformed claims', () => {
    expect(parseGroupRatedClaimId('no-colon')).toBeNull();
    expect(parseGroupRatedClaimId(':missing-charter')).toBeNull();
  });
});
