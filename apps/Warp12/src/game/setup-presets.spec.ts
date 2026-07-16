import { beforeEach, describe, expect, it } from 'vitest';

import type { CreateLobbyOptions } from '../firebase/index.js';
import {
  createLobbyOptionsToPreset,
  defaultSetupPreset,
  localSnapshotToPreset,
  newPresetId,
  passAndPlaySnapshotToPreset,
  presetToCreateLobbyOptions,
  presetToLocalSnapshot,
  presetToPassAndPlaySnapshot,
  readLocalNamedPresets,
  resolveLastUsedPreset,
  sanitizeSetupPreset,
  writeLastUsedPreset,
  writeLocalNamedPresets,
  type LocalSetupSnapshot,
  type NamedSetupPreset,
  type PassAndPlaySetupSnapshot,
  type WarpSetupPreset,
} from './setup-presets.js';

const localSnapshot: LocalSetupSnapshot = {
  callSign: 'Riker',
  playerCount: 5,
  objective: 'go-out',
  campaignRounds: 13,
  modules: {
    salamanderPenalty: true,
    continuum: false,
    longestTrail: true,
    subspaceFracture: true,
    subspaceFractureScope: 'all-captains',
  },
  houseRules: { doubleZeroScore: 25, allStopCeremony: false },
  aiTiers: { chen: 'commander', nguyen: 'ensign' },
  aiExtendedThinking: { chen: true },
  ratedPlay: false,
};

const pnpSnapshot: PassAndPlaySetupSnapshot = {
  playerCount: 4,
  aiFillCount: 1,
  humanNames: ['Kirk', 'Spock', 'McCoy'],
  objective: 'points',
  campaignRounds: 10,
  modules: { salamanderPenalty: true, doubleDown: true },
  houseRules: { doubleZeroScore: 0 },
};

beforeEach(() => {
  localStorage.clear();
});

describe('defaultSetupPreset', () => {
  it('uses Official Warp rules and rates only Warp 12', () => {
    const twelve = defaultSetupPreset(12);
    expect(twelve.objective).toBe('points');
    expect(twelve.rated).toBe(true);
    expect(twelve.modules.salamanderPenalty).toBe(true);
    expect(twelve.modules.continuum).toBe(true);

    const fifteen = defaultSetupPreset(15);
    expect(fifteen.rated).toBe(false);
    expect(fifteen.maxPip).toBe(15);
  });
});

describe('local adapter round-trip', () => {
  it('preserves shared rules and local extras', () => {
    const preset = localSnapshotToPreset(localSnapshot, 12);
    const restored = presetToLocalSnapshot(preset, 12);
    expect(restored.callSign).toBe('Riker');
    expect(restored.playerCount).toBe(5);
    expect(restored.objective).toBe('go-out');
    expect(restored.modules.longestTrail).toBe(true);
    expect(restored.modules.subspaceFractureScope).toBe('all-captains');
    expect(restored.houseRules.doubleZeroScore).toBe(25);
    expect(restored.aiTiers).toEqual({ chen: 'commander', nguyen: 'ensign' });
    expect(restored.aiExtendedThinking).toEqual({ chen: true });
  });

  it('never rates on an exhibition factor', () => {
    const preset: WarpSetupPreset = {
      ...localSnapshotToPreset(localSnapshot, 12),
      rated: true,
    };
    expect(presetToLocalSnapshot(preset, 12).ratedPlay).toBe(true);
    expect(presetToLocalSnapshot(preset, 15).ratedPlay).toBe(false);
  });

  it('clamps fleet size to the target factor', () => {
    const big: WarpSetupPreset = {
      ...defaultSetupPreset(18),
      fleetSize: 18,
    };
    // Warp 9 caps well below 18.
    expect(presetToLocalSnapshot(big, 9).playerCount).toBeLessThan(18);
  });
});

describe('pass-and-play adapter round-trip', () => {
  it('preserves human seats and AI fill', () => {
    const preset = passAndPlaySnapshotToPreset(pnpSnapshot, 12);
    const restored = presetToPassAndPlaySnapshot(preset, 12);
    expect(restored.playerCount).toBe(4);
    expect(restored.aiFillCount).toBe(1);
    expect(restored.humanNames.slice(0, 3)).toEqual(['Kirk', 'Spock', 'McCoy']);
    expect(restored.modules.doubleDown).toBe(true);
    expect(restored.houseRules.doubleZeroScore).toBe(0);
  });

  it('always marks the preset unrated', () => {
    expect(passAndPlaySnapshotToPreset(pnpSnapshot, 12).rated).toBe(false);
  });

  it('clamps AI fill so at least two humans remain', () => {
    const preset: WarpSetupPreset = {
      ...passAndPlaySnapshotToPreset(pnpSnapshot, 12),
      fleetSize: 3,
      aiFillCount: 10,
    };
    const restored = presetToPassAndPlaySnapshot(preset, 12);
    expect(restored.aiFillCount).toBeLessThanOrEqual(restored.playerCount - 2);
  });
});

describe('online adapter round-trip', () => {
  it('maps CreateLobbyOptions through a preset and back', () => {
    const options: CreateLobbyOptions = {
      objective: 'points',
      maxPlayers: 6,
      campaignRounds: 16,
      maxPip: 12,
      rated: true,
      modules: { continuum: true, squadrons: true, squadronSize: 3 },
      houseRules: { doubleZeroScore: 25 },
    };
    const preset = createLobbyOptionsToPreset(options, { callSign: 'Picard' });
    expect(preset.callSign).toBe('Picard');
    const restored = presetToCreateLobbyOptions(preset, 12);
    expect(restored.objective).toBe('points');
    expect(restored.maxPlayers).toBe(6);
    expect(restored.campaignRounds).toBe(16);
    expect(restored.modules?.squadrons).toBe(true);
    expect(restored.modules?.squadronSize).toBe(3);
    expect(restored.rated).toBe(true);
  });

  it('forces unrated on exhibition factors and preserves base charter fields', () => {
    const preset = defaultSetupPreset(12);
    const restored = presetToCreateLobbyOptions(preset, 15, {
      charterId: 'crew-1',
      rulesProfileId: 'warp12-official-v2',
      verified: true,
    });
    expect(restored.rated).toBe(false);
    expect(restored.charterId).toBe('crew-1');
    expect(restored.verified).toBe(true);
  });
});

describe('cross-type application', () => {
  it('carries shared rules from an online preset into a local snapshot', () => {
    const online = createLobbyOptionsToPreset({
      objective: 'go-out',
      maxPlayers: 3,
      maxPip: 12,
      modules: { longestTrail: true, temporalDebt: true },
      houseRules: { doubleZeroScore: 25 },
    });
    const local = presetToLocalSnapshot(online, 12);
    expect(local.objective).toBe('go-out');
    expect(local.playerCount).toBe(3);
    expect(local.modules.longestTrail).toBe(true);
    expect(local.modules.temporalDebt).toBe(true);
    // Local-only extras default when absent from the source preset.
    expect(local.aiTiers).toEqual({});
  });
});

describe('resolveLastUsedPreset fallback chain', () => {
  const local = { ...defaultSetupPreset(12), callSign: 'L' };
  const pnp = { ...defaultSetupPreset(12), callSign: 'P' };
  const online = { ...defaultSetupPreset(12), callSign: 'O' };

  it('prefers the requested type', () => {
    const store = { local, 'pass-and-play': pnp, online };
    expect(resolveLastUsedPreset('local', store)?.callSign).toBe('L');
    expect(resolveLastUsedPreset('pass-and-play', store)?.callSign).toBe('P');
    expect(resolveLastUsedPreset('online', store)?.callSign).toBe('O');
  });

  it('local falls back pnp then online', () => {
    expect(resolveLastUsedPreset('local', { 'pass-and-play': pnp })?.callSign).toBe('P');
    expect(resolveLastUsedPreset('local', { online })?.callSign).toBe('O');
  });

  it('pass-and-play falls back local then online', () => {
    expect(resolveLastUsedPreset('pass-and-play', { local })?.callSign).toBe('L');
    expect(resolveLastUsedPreset('pass-and-play', { online })?.callSign).toBe('O');
  });

  it('online falls back local then pnp', () => {
    expect(resolveLastUsedPreset('online', { local })?.callSign).toBe('L');
    expect(resolveLastUsedPreset('online', { 'pass-and-play': pnp })?.callSign).toBe('P');
  });

  it('returns null when nothing is stored', () => {
    expect(resolveLastUsedPreset('local', {})).toBeNull();
  });
});

describe('last-used persistence', () => {
  it('round-trips through localStorage', () => {
    const preset = { ...defaultSetupPreset(12), callSign: 'Sisko' };
    writeLastUsedPreset('online', preset);
    expect(resolveLastUsedPreset('online')?.callSign).toBe('Sisko');
    // Cross-type: local should fall back to the online entry.
    expect(resolveLastUsedPreset('local')?.callSign).toBe('Sisko');
  });
});

describe('named-preset local storage', () => {
  it('round-trips and drops corrupt rows', () => {
    const good: NamedSetupPreset = {
      id: newPresetId(),
      name: 'My chaos game',
      sourceType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preset: localSnapshotToPreset(localSnapshot, 12),
    };
    writeLocalNamedPresets([good]);
    const read = readLocalNamedPresets();
    expect(read).toHaveLength(1);
    expect(read[0]?.name).toBe('My chaos game');
    expect(read[0]?.preset.objective).toBe('go-out');
  });
});

describe('sanitizeSetupPreset', () => {
  it('rejects non-objects and bad objectives', () => {
    expect(sanitizeSetupPreset(null)).toBeNull();
    expect(sanitizeSetupPreset({ objective: 'bogus' })).toBeNull();
  });

  it('coerces a minimal valid payload with defaults', () => {
    const preset = sanitizeSetupPreset({ objective: 'points' });
    expect(preset).not.toBeNull();
    expect(preset?.fleetSize).toBe(4);
    expect(preset?.modules.subspaceFractureScope).toBe('own-trail');
  });

  it('drops invalid AI tiers but keeps valid ones', () => {
    const preset = sanitizeSetupPreset({
      objective: 'points',
      aiTiers: { chen: 'commander', bad: 'admiral' },
    });
    expect(preset?.aiTiers).toEqual({ chen: 'commander' });
  });
});
