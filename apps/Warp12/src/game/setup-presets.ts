/**
 * Cross-mode game-setup presets.
 *
 * A {@link WarpSetupPreset} is a portable snapshot of every host-configurable
 * value on a setup screen (objective, campaign length, fleet size, modules,
 * house rules, rated intent) plus the type-specific extras (call sign, human
 * seats, AI commission tiers). Presets round-trip through all three setup
 * surfaces — Local, Pass-and-play, and Online — via the adapters below.
 *
 * Two persistence concerns share this model:
 *   1. Named presets the captain saves by hand (Firestore when verified,
 *      localStorage otherwise — see `setup-preset-service.ts` / `use-setup-presets`).
 *   2. The last configuration launched per setup type, auto-restored on the
 *      next visit with a cross-type fallback chain ({@link resolveLastUsedPreset}).
 */
import {
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  defaultCampaignRounds,
  normalizeWarpFactor,
  resolveHouseRules,
  type GameModuleConfig,
  type GameObjective,
  type HouseRulesConfig,
  type WarpFactor,
  type WarpSkillLevel,
} from 'warp12-engine';

import type { CreateLobbyOptions } from '../firebase/index.js';
import {
  clampLocalPlayerCount,
  clampPassAndPlayPlayerCount,
  DEFAULT_HUMAN_CAPTAIN_NAMES,
  PASS_AND_PLAY_MIN_PLAYERS,
} from './local-game-config.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from './warp12-preset.js';

/** Bump when the persisted shape changes incompatibly. */
export const SETUP_PRESET_VERSION = 1;

/** The three setup surfaces a preset can be authored from / applied to. */
export type GameSetupType = 'local' | 'pass-and-play' | 'online';

const SKILL_LEVELS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

/**
 * Portable, JSON-serializable snapshot of a full setup. Shared fields are
 * always present; the type-specific extras are only populated when captured
 * from a surface that exposes them, and ignored when applied to one that does
 * not.
 */
export interface WarpSetupPreset {
  readonly version: number;
  /** Warp factor the preset was authored under (context for round/fleet clamps). */
  readonly maxPip?: WarpFactor;
  readonly objective: GameObjective;
  /** Points campaigns only; carried through even for go-out so a switch back keeps it. */
  readonly campaignRounds: number;
  /** Total captains at the table (maps to online maxPlayers / local playerCount). */
  readonly fleetSize: number;
  readonly modules: GameModuleConfig;
  readonly houseRules: HouseRulesConfig;
  /** Host intent to rate (Local solo / Online). Pass-and-play is always unrated. */
  readonly rated?: boolean;
  // --- type-specific extras -------------------------------------------------
  /** Solo/host call sign (Local, Online). */
  readonly callSign?: string;
  /** Pass-and-play per-seat human names, in seat order. */
  readonly humanNames?: readonly string[];
  /** Pass-and-play count of AI officers filling empty seats. */
  readonly aiFillCount?: number;
  /** Local per-AI commission tiers, keyed by officer pool id. */
  readonly aiTiers?: Readonly<Record<string, WarpSkillLevel>>;
  /** Local per-AI extended-thinking flags, keyed by officer pool id. */
  readonly aiExtendedThinking?: Readonly<Record<string, boolean>>;
}

/** A captain-named preset entry (Firestore doc field or localStorage row). */
export interface NamedSetupPreset {
  readonly id: string;
  readonly name: string;
  /** Which surface it was saved from — shown as a hint, not a restriction. */
  readonly sourceType: GameSetupType;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly preset: WarpSetupPreset;
}

// ---------------------------------------------------------------------------
// Form snapshots — mirror the local component state so pages can round-trip
// without threading dozens of individual fields.
// ---------------------------------------------------------------------------

export interface LocalSetupSnapshot {
  callSign: string;
  playerCount: number;
  objective: GameObjective;
  campaignRounds: number;
  modules: GameModuleConfig;
  houseRules: HouseRulesConfig;
  aiTiers: Record<string, WarpSkillLevel>;
  aiExtendedThinking: Record<string, boolean>;
  ratedPlay: boolean;
}

export interface PassAndPlaySetupSnapshot {
  playerCount: number;
  aiFillCount: number;
  humanNames: string[];
  objective: GameObjective;
  campaignRounds: number;
  modules: GameModuleConfig;
  houseRules: HouseRulesConfig;
  aiTiers: Record<string, WarpSkillLevel>;
  aiExtendedThinking: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Flatten module toggles to explicit booleans so a sparse saved preset cannot
 * leave UI state and launch config disagreeing (e.g. `?? true` on Continuum
 * while `resolveModules` treats missing as off).
 */
export function normalizeModuleConfig(
  modules: GameModuleConfig = {}
): GameModuleConfig {
  return {
    continuum: modules.continuum === true,
    salamanderPenalty: modules.salamanderPenalty === true,
    sensorGrid: modules.sensorGrid === true,
    ...(typeof modules.sensorGridSize === 'number'
      ? { sensorGridSize: modules.sensorGridSize }
      : {}),
    warpDriveSpool: modules.warpDriveSpool === true,
    drafting: modules.drafting === true,
    ...(typeof modules.draftingPackSize === 'number'
      ? { draftingPackSize: modules.draftingPackSize }
      : {}),
    squadrons: modules.squadrons === true,
    ...(typeof modules.squadronSize === 'number'
      ? { squadronSize: modules.squadronSize }
      : {}),
    ...(modules.squadronNames ? { squadronNames: modules.squadronNames } : {}),
    ...(modules.squadronRosters
      ? { squadronRosters: modules.squadronRosters }
      : {}),
    longestTrail: modules.longestTrail === true,
    ...(typeof modules.longestTrailBonus === 'number'
      ? { longestTrailBonus: modules.longestTrailBonus }
      : {}),
    doubleDown: modules.doubleDown === true,
    ...(typeof modules.doubleDownDrawCount === 'number'
      ? { doubleDownDrawCount: modules.doubleDownDrawCount }
      : {}),
    temporalDebt: modules.temporalDebt === true,
    ...(typeof modules.temporalDebtCost === 'number'
      ? { temporalDebtCost: modules.temporalDebtCost }
      : {}),
    temporalInversion: modules.temporalInversion === true,
    wormholes: modules.wormholes === true,
    subspaceFracture: modules.subspaceFracture === true,
    subspaceFractureScope: resolveFractureScope(modules),
  };
}

/** Expand partial house-rule patches to a full explicit config. */
export function normalizeHouseRulesConfig(
  rules: HouseRulesConfig = {}
): HouseRulesConfig {
  const resolved = resolveHouseRules(rules);
  return {
    requireOwnTrailFirst: resolved.requireOwnTrailFirst,
    neutralZoneAfterAllTrails: resolved.neutralZoneAfterAllTrails,
    beaconClearsOnAnyPlay: resolved.beaconClearsOnAnyPlay,
    roundStarterPlaysTwo: resolved.roundStarterPlaysTwo,
    roundStarterOwnTrailOnly: resolved.roundStarterOwnTrailOnly,
    dropToImpulseCall: resolved.dropToImpulseCall,
    dropToImpulseCatchPenalty: resolved.dropToImpulseCatchPenalty,
    allStopCeremony: resolved.allStopCeremony,
    passRedAlertWithoutDraw: resolved.passRedAlertWithoutDraw,
    manualShieldControl: resolved.manualShieldControl,
    doubleZeroScore: resolved.doubleZeroScore,
    largeFleetHandSize: resolved.largeFleetHandSize,
  };
}

/** The Warp-defaults preset for a given factor (Official Warp rules bundle). */
export function defaultSetupPreset(maxPip: number): WarpSetupPreset {
  const factor = normalizeWarpFactor(maxPip);
  return {
    version: SETUP_PRESET_VERSION,
    maxPip: factor,
    objective: WARP12_OFFICIAL_OBJECTIVE,
    campaignRounds: defaultCampaignRounds(factor),
    fleetSize: 4,
    modules: normalizeModuleConfig({ ...WARP12_OFFICIAL_MODULES }),
    houseRules: normalizeHouseRulesConfig({ ...WARP12_OFFICIAL_HOUSE_RULES }),
    rated: factor === 12,
  };
}

// ---------------------------------------------------------------------------
// Local adapter
// ---------------------------------------------------------------------------

export function localSnapshotToPreset(
  snapshot: LocalSetupSnapshot,
  maxPip: number
): WarpSetupPreset {
  return {
    version: SETUP_PRESET_VERSION,
    maxPip: normalizeWarpFactor(maxPip),
    objective: snapshot.objective,
    campaignRounds: snapshot.campaignRounds,
    fleetSize: snapshot.playerCount,
    modules: normalizeModuleConfig(snapshot.modules),
    houseRules: normalizeHouseRulesConfig(snapshot.houseRules),
    rated: snapshot.ratedPlay,
    callSign: snapshot.callSign,
    aiTiers: { ...snapshot.aiTiers },
    aiExtendedThinking: { ...snapshot.aiExtendedThinking },
  };
}

export function presetToLocalSnapshot(
  preset: WarpSetupPreset | null,
  maxPip: number
): LocalSetupSnapshot {
  const factor = normalizeWarpFactor(maxPip);
  const base = preset ?? defaultSetupPreset(factor);
  return {
    callSign: base.callSign?.trim() || DEFAULT_HUMAN_CAPTAIN_NAMES[0] || 'Armstrong',
    playerCount: clampLocalPlayerCount(base.fleetSize, factor),
    objective: base.objective,
    campaignRounds: resolveCampaignRounds(base.campaignRounds, factor),
    modules: normalizeModuleConfig(base.modules),
    houseRules: normalizeHouseRulesConfig(base.houseRules),
    aiTiers: { ...(base.aiTiers ?? {}) },
    aiExtendedThinking: { ...(base.aiExtendedThinking ?? {}) },
    // Only Warp 12 may rate; never force it on for exhibition sets.
    ratedPlay: factor === 12 && (base.rated ?? false),
  };
}

// ---------------------------------------------------------------------------
// Pass-and-play adapter
// ---------------------------------------------------------------------------

export function passAndPlaySnapshotToPreset(
  snapshot: PassAndPlaySetupSnapshot,
  maxPip: number
): WarpSetupPreset {
  return {
    version: SETUP_PRESET_VERSION,
    maxPip: normalizeWarpFactor(maxPip),
    objective: snapshot.objective,
    campaignRounds: snapshot.campaignRounds,
    fleetSize: snapshot.playerCount,
    modules: normalizeModuleConfig(snapshot.modules),
    houseRules: normalizeHouseRulesConfig(snapshot.houseRules),
    rated: false,
    humanNames: [...snapshot.humanNames],
    aiFillCount: snapshot.aiFillCount,
    aiTiers: { ...snapshot.aiTiers },
    aiExtendedThinking: { ...snapshot.aiExtendedThinking },
  };
}

export function presetToPassAndPlaySnapshot(
  preset: WarpSetupPreset | null,
  maxPip: number
): PassAndPlaySetupSnapshot {
  const factor = normalizeWarpFactor(maxPip);
  const base = preset ?? defaultSetupPreset(factor);
  const playerCount = clampPassAndPlayPlayerCount(base.fleetSize, factor);
  const maxAi = playerCount - PASS_AND_PLAY_MIN_PLAYERS;
  const aiFillCount = clampInt(base.aiFillCount ?? 0, 0, Math.max(0, maxAi));
  return {
    playerCount,
    aiFillCount,
    humanNames: buildHumanNames(base.humanNames, playerCount),
    objective: base.objective,
    campaignRounds: resolveCampaignRounds(base.campaignRounds, factor),
    modules: normalizeModuleConfig(base.modules),
    houseRules: normalizeHouseRulesConfig(base.houseRules),
    aiTiers: { ...(base.aiTiers ?? {}) },
    aiExtendedThinking: { ...(base.aiExtendedThinking ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Online adapter (CreateLobbyOptions)
// ---------------------------------------------------------------------------

export function createLobbyOptionsToPreset(
  options: CreateLobbyOptions,
  extras: { callSign?: string } = {}
): WarpSetupPreset {
  const factor = normalizeWarpFactor(options.maxPip ?? 12);
  return {
    version: SETUP_PRESET_VERSION,
    maxPip: factor,
    objective: options.objective ?? WARP12_OFFICIAL_OBJECTIVE,
    campaignRounds: options.campaignRounds ?? defaultCampaignRounds(factor),
    fleetSize: options.maxPlayers ?? 4,
    modules: normalizeModuleConfig(options.modules ?? WARP12_OFFICIAL_MODULES),
    houseRules: normalizeHouseRulesConfig(
      options.houseRules ?? WARP12_OFFICIAL_HOUSE_RULES
    ),
    rated: options.rated ?? factor === 12,
    ...(extras.callSign ? { callSign: extras.callSign } : {}),
  };
}

/**
 * Apply a preset over base online options. Charter-related fields on `base`
 * (charterId / rulesProfileId / verified) are preserved — presets only touch
 * host-configurable rules. Fleet size is left to the caller to clamp against
 * the live factor ceiling.
 */
export function presetToCreateLobbyOptions(
  preset: WarpSetupPreset | null,
  maxPip: number,
  base: CreateLobbyOptions = {}
): CreateLobbyOptions {
  const factor = normalizeWarpFactor(maxPip);
  const source = preset ?? defaultSetupPreset(factor);
  return {
    ...base,
    objective: source.objective,
    campaignRounds: resolveCampaignRounds(source.campaignRounds, factor),
    maxPlayers: source.fleetSize,
    maxPip: factor,
    modules: normalizeModuleConfig(source.modules),
    houseRules: normalizeHouseRulesConfig(source.houseRules),
    rated: factor === 12 ? (source.rated ?? true) : false,
  };
}

// ---------------------------------------------------------------------------
// Last-used persistence (localStorage) + cross-type fallback
// ---------------------------------------------------------------------------

const LAST_USED_KEY = 'warp12-setup-last';
const NAMED_PRESETS_KEY = 'warp12-setup-presets';

type LastUsedStore = Partial<Record<GameSetupType, WarpSetupPreset>>;

/** Own type first, then the caller's requested fallback order, then defaults. */
const FALLBACK_ORDER: Record<GameSetupType, readonly GameSetupType[]> = {
  local: ['local', 'pass-and-play', 'online'],
  'pass-and-play': ['pass-and-play', 'local', 'online'],
  online: ['online', 'local', 'pass-and-play'],
};

function readLastUsedStore(): LastUsedStore {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }
    const store: LastUsedStore = {};
    for (const type of ['local', 'pass-and-play', 'online'] as const) {
      const candidate = sanitizeSetupPreset(parsed[type]);
      if (candidate) {
        store[type] = candidate;
      }
    }
    return store;
  } catch {
    return {};
  }
}

/** Persist the last configuration launched for a given setup type. */
export function writeLastUsedPreset(
  type: GameSetupType,
  preset: WarpSetupPreset
): void {
  try {
    const store = readLastUsedStore();
    store[type] = preset;
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Resolve the preset to seed a setup screen with: this type's last-used, then
 * the cross-type fallback chain, then `null` (caller applies Warp defaults).
 */
export function resolveLastUsedPreset(
  type: GameSetupType,
  store: LastUsedStore = readLastUsedStore()
): WarpSetupPreset | null {
  for (const candidate of FALLBACK_ORDER[type]) {
    const preset = store[candidate];
    if (preset) {
      return preset;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Named-preset local fallback (used when the captain is not signed in)
// ---------------------------------------------------------------------------

export function readLocalNamedPresets(): NamedSetupPreset[] {
  try {
    const raw = localStorage.getItem(NAMED_PRESETS_KEY);
    if (!raw) {
      return [];
    }
    return sanitizeNamedPresetList(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Coerce an untrusted array (localStorage row or Firestore field) into presets. */
export function sanitizeNamedPresetList(raw: unknown): NamedSetupPreset[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(sanitizeNamedPreset)
    .filter((row): row is NamedSetupPreset => row !== null);
}

export function writeLocalNamedPresets(presets: readonly NamedSetupPreset[]): void {
  try {
    localStorage.setItem(NAMED_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignore quota / private mode
  }
}

/** Create a stable id for a new named preset. */
export function newPresetId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `preset-${Date.now().toString(36)}-${rand}`;
}

// ---------------------------------------------------------------------------
// Validation / sanitization
// ---------------------------------------------------------------------------

/** Coerce untrusted stored/remote data into a safe preset, or null if invalid. */
export function sanitizeSetupPreset(raw: unknown): WarpSetupPreset | null {
  if (!isRecord(raw)) {
    return null;
  }
  const objective = raw.objective;
  if (objective !== 'points' && objective !== 'go-out') {
    return null;
  }
  const modules = normalizeModuleConfig(
    isRecord(raw.modules)
      ? (raw.modules as GameModuleConfig)
      : { ...WARP12_OFFICIAL_MODULES }
  );
  const houseRules = normalizeHouseRulesConfig(
    isRecord(raw.houseRules)
      ? (raw.houseRules as HouseRulesConfig)
      : { ...WARP12_OFFICIAL_HOUSE_RULES }
  );
  const fleetSize = toPositiveInt(raw.fleetSize, 4);
  const campaignRounds = toPositiveInt(raw.campaignRounds, defaultCampaignRounds(12));

  const preset: Mutable<WarpSetupPreset> = {
    version: typeof raw.version === 'number' ? raw.version : SETUP_PRESET_VERSION,
    objective: objective as GameObjective,
    campaignRounds,
    fleetSize,
    modules,
    houseRules,
  };
  if (isWarpFactorLike(raw.maxPip)) {
    preset.maxPip = normalizeWarpFactor(raw.maxPip);
  }
  if (typeof raw.rated === 'boolean') {
    preset.rated = raw.rated;
  }
  if (typeof raw.callSign === 'string' && raw.callSign.trim()) {
    preset.callSign = raw.callSign.slice(0, 24);
  }
  if (Array.isArray(raw.humanNames)) {
    preset.humanNames = raw.humanNames
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.slice(0, 24));
  }
  if (typeof raw.aiFillCount === 'number' && Number.isFinite(raw.aiFillCount)) {
    preset.aiFillCount = Math.max(0, Math.floor(raw.aiFillCount));
  }
  const aiTiers = sanitizeTierMap(raw.aiTiers);
  if (aiTiers) {
    preset.aiTiers = aiTiers;
  }
  const aiExtended = sanitizeBoolMap(raw.aiExtendedThinking);
  if (aiExtended) {
    preset.aiExtendedThinking = aiExtended;
  }
  return preset;
}

function sanitizeNamedPreset(raw: unknown): NamedSetupPreset | null {
  if (!isRecord(raw)) {
    return null;
  }
  const preset = sanitizeSetupPreset(raw.preset);
  if (!preset) {
    return null;
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newPresetId();
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 60)
      : 'Untitled preset';
  const sourceType = isSetupType(raw.sourceType) ? raw.sourceType : 'local';
  const createdAt =
    typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  return { id, name, sourceType, createdAt, updatedAt, preset };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSetupType(value: unknown): value is GameSetupType {
  return value === 'local' || value === 'pass-and-play' || value === 'online';
}

function isWarpFactorLike(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return fallback;
}

function resolveCampaignRounds(value: number, maxPip: number): number {
  return value > 0 && Number.isFinite(value)
    ? Math.floor(value)
    : defaultCampaignRounds(maxPip);
}

function resolveFractureScope(modules: GameModuleConfig) {
  const scope = modules.subspaceFractureScope;
  return scope === 'own-trail' || scope === 'all-captains' || scope === 'all-doubles'
    ? scope
    : DEFAULT_SUBSPACE_FRACTURE_SCOPE;
}

function buildHumanNames(
  stored: readonly string[] | undefined,
  count: number
): string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      stored?.[index]?.trim() ||
      DEFAULT_HUMAN_CAPTAIN_NAMES[index] ||
      `Captain ${index + 1}`
  );
}

function sanitizeTierMap(
  raw: unknown
): Record<string, WarpSkillLevel> | null {
  if (!isRecord(raw)) {
    return null;
  }
  const map: Record<string, WarpSkillLevel> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SKILL_LEVELS.includes(value as WarpSkillLevel)) {
      map[key] = value as WarpSkillLevel;
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

function sanitizeBoolMap(raw: unknown): Record<string, boolean> | null {
  if (!isRecord(raw)) {
    return null;
  }
  const map: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') {
      map[key] = value;
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}
