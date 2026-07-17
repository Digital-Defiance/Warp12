import { HttpsError } from 'firebase-functions/v2/https';
import { isIP } from 'node:net';

/** Normalize and validate IPv4 → dotted-quad, or null if empty. */
export function normalizeIpv4(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? '';
  if (!s) {
    return null;
  }
  // Strip leading zeros per octet before validation (008.008.008.008 → 8.8.8.8).
  const stripped = s.includes('.')
    ? s
        .split('.')
        .map((octet) => String(Number(octet)))
        .join('.')
    : s;
  if (isIP(stripped) !== 4) {
    throw new HttpsError('invalid-argument', `Invalid IPv4 address: ${s}`);
  }
  return stripped;
}

/** Normalize and validate IPv6 → lowercase, or null if empty. */
export function normalizeIpv6(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? '';
  if (!s) {
    return null;
  }
  // Strip zone id (fe80::1%eth0).
  const bare = s.split('%')[0] ?? s;
  if (isIP(bare) !== 6) {
    throw new HttpsError('invalid-argument', `Invalid IPv6 address: ${bare}`);
  }
  return bare.toLowerCase();
}

export function ipKeyV4(ipv4: string): string {
  return `v4:${ipv4}`;
}

export function ipKeyV6(ipv6: string): string {
  return `v6:${ipv6}`;
}

export function buildIpKeys(
  ipv4: string | null,
  ipv6: string | null
): string[] {
  const keys: string[] = [];
  if (ipv4) {
    keys.push(ipKeyV4(ipv4));
  }
  if (ipv6) {
    keys.push(ipKeyV6(ipv6));
  }
  return keys;
}

/**
 * Classify a client address (from X-Forwarded-For / request.ip) into v4/v6.
 * Returns nulls when missing or unparseable (do not throw — enforcement soft-fails open on bad headers).
 */
export function classifyClientIp(raw: string | null | undefined): {
  ipv4: string | null;
  ipv6: string | null;
  ipKey: string | null;
} {
  const first = (raw ?? '').split(',')[0]?.trim() ?? '';
  if (!first) {
    return { ipv4: null, ipv6: null, ipKey: null };
  }
  try {
    if (isIP(first) === 4) {
      const ipv4 = normalizeIpv4(first);
      return { ipv4, ipv6: null, ipKey: ipv4 ? ipKeyV4(ipv4) : null };
    }
    if (isIP(first) === 6 || first.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 → treat as v4 when possible.
      const mapped = first.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
      if (mapped?.[1]) {
        const ipv4 = normalizeIpv4(mapped[1]);
        return { ipv4, ipv6: null, ipKey: ipv4 ? ipKeyV4(ipv4) : null };
      }
      const ipv6 = normalizeIpv6(first);
      return { ipv4: null, ipv6, ipKey: ipv6 ? ipKeyV6(ipv6) : null };
    }
  } catch {
    return { ipv4: null, ipv6: null, ipKey: null };
  }
  return { ipv4: null, ipv6: null, ipKey: null };
}

/** Stable doc id for IP-only bans (no uid). One idiot → one id from their address pair. */
export function ipOnlyBanId(ipv4: string | null, ipv6: string | null): string {
  const parts: string[] = [];
  if (ipv4) {
    parts.push(`v4_${ipv4.replace(/\./g, '_')}`);
  }
  if (ipv6) {
    parts.push(`v6_${ipv6.replace(/:/g, '_')}`);
  }
  if (parts.length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'IP-only ban requires ipv4 and/or ipv6.'
    );
  }
  return `ip:${parts.join('+')}`;
}
