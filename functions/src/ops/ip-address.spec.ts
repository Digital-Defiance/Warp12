import { describe, expect, it } from 'vitest';

import {
  buildIpKeys,
  classifyClientIp,
  ipOnlyBanId,
  normalizeIpv4,
  normalizeIpv6,
} from './ip-address';

describe('ip-address', () => {
  it('normalizes IPv4', () => {
    expect(normalizeIpv4('008.008.008.008')).toBe('8.8.8.8');
    expect(normalizeIpv4('')).toBeNull();
    expect(normalizeIpv4(null)).toBeNull();
  });

  it('rejects invalid IPv4', () => {
    expect(() => normalizeIpv4('999.1.1.1')).toThrow();
    expect(() => normalizeIpv4('not-an-ip')).toThrow();
  });

  it('normalizes IPv6', () => {
    expect(normalizeIpv6('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeIpv6('fe80::1%eth0')).toBe('fe80::1');
  });

  it('builds dual-stack keys on one subject', () => {
    expect(buildIpKeys('1.2.3.4', '2001:db8::1')).toEqual([
      'v4:1.2.3.4',
      'v6:2001:db8::1',
    ]);
  });

  it('stable ip-only ban id links v4+v6', () => {
    expect(ipOnlyBanId('1.2.3.4', '2001:db8::1')).toBe(
      'ip:v4_1_2_3_4+v6_2001_db8__1'
    );
  });

  it('classifies client addresses', () => {
    expect(classifyClientIp('8.8.8.8').ipKey).toBe('v4:8.8.8.8');
    expect(classifyClientIp('::ffff:8.8.8.8').ipv4).toBe('8.8.8.8');
    expect(classifyClientIp('2001:db8::1').ipKey).toBe('v6:2001:db8::1');
  });
});
