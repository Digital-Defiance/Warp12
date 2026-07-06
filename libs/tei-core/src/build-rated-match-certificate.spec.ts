import { describe, expect, it } from 'vitest';

import {
  buildCertificatePlayer,
  buildRatedMatchCertificate,
} from './build-rated-match-certificate.js';

describe('buildCertificatePlayer', () => {
  it('records human-pool deltas when no charter is set', () => {
    const player = buildCertificatePlayer({
      uid: 'u1',
      displayName: 'Captain',
      rank: 1,
      score: 42,
      teiBefore: 1200,
      teiAfter: 1212,
    });

    expect(player.humanTeiBefore).toBe(1200);
    expect(player.humanTeiAfter).toBe(1212);
    expect(player.humanTeiDelta).toBe(12);
    expect(player.crewTeiBefore).toBeUndefined();
  });

  it('records crew deltas and optional global double-write', () => {
    const player = buildCertificatePlayer({
      uid: 'u1',
      displayName: 'Captain',
      rank: 2,
      score: 18,
      teiBefore: 1180,
      teiAfter: 1172,
      charterId: 'global-official',
      globalTeiBefore: 1200,
      globalTeiAfter: 1196,
    });

    expect(player.crewTeiBefore).toBe(1180);
    expect(player.crewTeiAfter).toBe(1172);
    expect(player.crewTeiDelta).toBe(-8);
    expect(player.globalTeiBefore).toBe(1200);
    expect(player.globalTeiAfter).toBe(1196);
    expect(player.globalTeiDelta).toBe(-4);
    expect(player.humanTeiBefore).toBeUndefined();
  });
});

describe('buildRatedMatchCertificate', () => {
  it('assembles a version-1 certificate with charter metadata', () => {
    const players = [
      buildCertificatePlayer({
        uid: 'a',
        displayName: 'A',
        rank: 1,
        score: 10,
        teiBefore: 1200,
        teiAfter: 1212,
        charterId: 'crew-1',
      }),
    ];

    const cert = buildRatedMatchCertificate({
      matchCode: 'MT-TEST',
      issuedAt: '2026-07-06T00:00:00.000Z',
      objective: 'points',
      charter: {
        charterId: 'crew-1',
        name: 'Oak Street',
        slug: 'oak-street',
        rulesProfileId: 'warp12-official-v1',
        playerCount: 4,
        campaignRounds: 13,
        seasonLabel: '2026 Spring',
      },
      players,
    });

    expect(cert.version).toBe(1);
    expect(cert.matchCode).toBe('MT-TEST');
    expect(cert.charter?.slug).toBe('oak-street');
    expect(cert.players).toHaveLength(1);
  });
});
