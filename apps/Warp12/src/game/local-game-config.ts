import type {
  GameModuleConfig,
  GameObjective,
  GoOutOvertimePolicy,
  GoOutStructure,
  HouseRulesConfig,
  WarpFactor,
  WarpSkillLevel,
} from 'warp12-engine';
import {
  DEFAULT_GO_OUT_OVERTIME,
  DEFAULT_GO_OUT_STRUCTURE,
  DEFAULT_GO_OUT_WINS_TO_WIN,
  defaultCampaignRounds,
  hasWarpedModules,
  neuralWeightsAvailable,
  normalizeWarpFactor,
  warpSetProfile,
} from 'warp12-engine';

import { WARP12_OFFICIAL_RULES_PROFILE_ID } from '../firebase/rules-profile.js';

import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from './warp12-preset.js';

export const LOCAL_MIN_PLAYERS = 2;
/** Absolute local fleet ceiling (Warp 18). Per-factor caps via {@link maxPlayersForFactor}. */
export const LOCAL_MAX_PLAYERS = 18;
export const PASS_AND_PLAY_MIN_PLAYERS = 2;

export interface HumanCaptainConfig {
  readonly id: string;
  readonly displayName: string;
}

export interface AiCaptainConfig {
  readonly id: string;
  readonly displayName: string;
  readonly skill: WarpSkillLevel;
  /**
   * @deprecated Commander (`commander`) is neural Ω. Kept as a synonym for older
   * saved configs; prefer `skill: 'commander'` alone.
   */
  readonly omega?: boolean;
  /** Commander only — net-guided ISMCTS (Ω+). Unrated exhibition; not for TEI. */
  readonly extendedThinking?: boolean;
  /** Officer pool slot when the captain was created from {@link AI_OFFICER_POOL}. */
  readonly poolId?: string;
}

/** Default call signs for human seats (pass-and-play setup). */
export const DEFAULT_HUMAN_CAPTAIN_NAMES: readonly string[] = [
  // The Original Eight
  'Armstrong',  // Neil Armstrong - First human on the Moon
  'Lovell',     // Jim Lovell - Commander of Apollo 13
  'Earhart',    // Amelia Earhart - Aviation pioneer
  'Yeager',     // Chuck Yeager - First pilot to break the sound barrier
  'Gagarin',    // Yuri Gagarin - First human in space
  'Ride',       // Sally Ride - First American woman in space
  'Glenn',      // John Glenn - First American to orbit the Earth
  'Collins',    // Michael Collins - Apollo 11 Command Module Pilot

  // The Fleet Expansion
  'Aldrin',     // Buzz Aldrin - Apollo 11 Lunar Module Pilot
  'Shepard',    // Alan Shepard - First American in space
  'Tereshkova', // Valentina Tereshkova - First woman in space
  'Jemison',    // Mae Jemison - First Black woman in space
  'Piccard',    // Auguste/Jean Piccard - Balloonists (The real-life inspiration for Jean-Luc Picard)
  'Leonov',     // Alexei Leonov - First human to conduct a spacewalk
  'Hadfield',   // Chris Hadfield - Iconic ISS Commander
  'Coleman',    // Bessie Coleman - First African American/Native American female pilot
  'Lindbergh',  // Charles Lindbergh - First solo transatlantic flight
  'Chawla',     // Kalpana Chawla - First woman of Indian origin in space
  'Ochoa',      // Ellen Ochoa - First Hispanic woman in space
  'Cochran',    // Jacqueline Cochran - First woman to break the sound barrier
  'Cernan',     // Gene Cernan - Last human on the Moon (Apollo 17)
  'Wright',     // Orville/Wilbur Wright - Pioneers of powered flight
  'Slayton',    // Deke Slayton - Mercury Seven pilot and NASA Director of Flight Crew Operations
  'Borman',     // Frank Borman - Commander of Apollo 8 (First mission to orbit the Moon)
];

/** Options chosen at the local bridge before a simulation launches. */
export interface LocalGameConfig {
  readonly humanId: string;
  readonly humanName: string;
  /** Human seats at the table — one for solo vs AI, two or more for pass-and-play. */
  readonly humanCaptains: readonly HumanCaptainConfig[];
  /** Total captains at the table (humans + AI officers). */
  readonly playerCount: number;
  readonly objective: GameObjective;
  /**
   * Points campaigns: length in rounds.
   * Go-out fixed-rounds: Spacedock descent length.
   */
  readonly campaignRounds: number;
  /** Go-out sector structure — defaults to 'sudden-death'. */
  readonly goOutStructure?: GoOutStructure;
  /** Go-out first-to: wins required. */
  readonly goOutWinsToWin?: number;
  /** Go-out fixed-rounds: tie-break overtime policy. */
  readonly goOutOvertime?: GoOutOvertimePolicy;
  /**
   * Index into the captain roster for the match's first-round starter.
   * -1 or undefined = engine default (host / first seat).
   */
  readonly matchStarterIndex?: number;
  readonly modules: GameModuleConfig;
  readonly houseRules?: HouseRulesConfig;
  readonly aiCaptains: readonly AiCaptainConfig[];
  /** Frozen TEI anchor set — defaults to `warp12-official-v2`. */
  readonly rulesProfileId?: string;
  /** Double-N max pip for this sector (9 / 12 / 15 / 18). */
  readonly maxPip: WarpFactor;
  /**
   * When true (default), solo Warp-12 play reports TEI and the advisor UI is
   * hidden. Uncheck in the lobby for a casual session with the advisor available.
   * Ignored for pass-and-play, exhibition sets, and Ω+ extended thinking.
   */
  readonly rated?: boolean;
}

/** Named AI officers drawn in order when the fleet grows. */
export const AI_OFFICER_POOL: readonly {
  id: string;
  displayName: string;
}[] = [
  { id: 'chen', displayName: 'Chen' },
  { id: 'nguyen', displayName: 'Nguyen' },
  { id: 'smith', displayName: 'Smith' },
  { id: 'garcia', displayName: 'Garcia' },
  { id: 'rossi', displayName: 'Rossi' },
  { id: 'muller', displayName: 'Müller' },
  { id: 'kim', displayName: 'Kim' },
  { id: 'patel', displayName: 'Patel' },
  { id: 'okafor', displayName: 'Okafor' },
  { id: 'silva', displayName: 'Silva' },
  { id: 'ivanov', displayName: 'Ivanov' },
  { id: 'berg', displayName: 'Berg' },
  { id: 'suzuki', displayName: 'Suzuki' },
  { id: 'hassan', displayName: 'Hassan' },
  { id: 'novak', displayName: 'Novak' },
  { id: 'owens', displayName: 'Owens' },
  { id: 'park', displayName: 'Park' },
  { id: 'dubois', displayName: 'Dubois' },     // French
  { id: 'sato', displayName: 'Sato' },         // Japanese
  { id: 'haddad', displayName: 'Haddad' },     // Levantine/Arabic
  { id: 'cruz', displayName: 'Cruz' },         // Spanish/Latin American/Filipino
  { id: 'kowalski', displayName: 'Kowalski' }, // Polish
  { id: 'wong', displayName: 'Wong' },         // Cantonese/Chinese
  { id: 'diallo', displayName: 'Diallo' },     // West African
  { id: 'sharma', displayName: 'Sharma' },     // Indian
  { id: 'hansen', displayName: 'Hansen' },     // Scandinavian
  { id: 'reyes', displayName: 'Reyes' },       // Filipino/Spanish
  { id: 'cohen', displayName: 'Cohen' },       // Jewish/Israeli
  { id: 'costa', displayName: 'Costa' },       // Portuguese/Italian
  { id: 'ndlovu', displayName: 'Ndlovu' },     // Southern African
  { id: 'jones', displayName: 'Jones' },       // Welsh/English/American
  { id: 'mensah', displayName: 'Mensah' },     // Ghanaian
  { id: 'becker', displayName: 'Becker' },     // German
  { id: 'ali', displayName: 'Ali' },           // Arabic/Global
  { id: 'flores', displayName: 'Flores' },     // Hispanic/Latin American
];

export function maxPlayersForFactor(maxPip: number): number {
  return Math.min(LOCAL_MAX_PLAYERS, warpSetProfile(maxPip).maxPlayers);
}

export function minPlayersForFactor(maxPip: number): number {
  return warpSetProfile(maxPip).minPlayers;
}

export function clampLocalPlayerCount(
  count: number,
  maxPip = 12
): number {
  const profile = warpSetProfile(maxPip);
  const max = Math.min(LOCAL_MAX_PLAYERS, profile.maxPlayers);
  return Math.min(max, Math.max(profile.minPlayers, count));
}

export function clampPassAndPlayPlayerCount(
  count: number,
  maxPip = 12
): number {
  return clampLocalPlayerCount(
    Math.max(PASS_AND_PLAY_MIN_PLAYERS, count),
    maxPip
  );
}

/** Two or more human seats — shared-device pass-and-play (always unrated). */
export function isPassAndPlay(config: LocalGameConfig): boolean {
  return config.humanCaptains.length >= 2;
}

export function localMatchHasExtendedThinking(
  aiCaptains: readonly AiCaptainConfig[]
): boolean {
  return aiCaptains.some((ai) => ai.extendedThinking === true);
}

/**
 * Whether this local setup is eligible to offer a Rated TEI lobby toggle
 * (Warp 12 solo vs AI, no Ω+). Exhibition / pass-and-play never offer it.
 */
export function localGameCanOfferRated(config: Pick<
  LocalGameConfig,
  'maxPip' | 'humanCaptains' | 'aiCaptains' | 'modules'
>): boolean {
  return (
    config.maxPip === 12 &&
    !isPassAndPlay(config as LocalGameConfig) &&
    !localMatchHasExtendedThinking(config.aiCaptains) &&
    !hasWarpedModules(config.modules)
  );
}

/**
 * Solo vs-AI local matches may report TEI when signed in and unassisted.
 * TEI ladders are Warp 12 only (product rule) — exhibition sets never rate.
 * Host may opt out via `config.rated === false` (casual + advisor available).
 */
export function isRatedLocalGame(config: LocalGameConfig): boolean {
  return (
    config.rated !== false &&
    localGameCanOfferRated(config)
  );
}

/**
 * Whether neural Ω / Class I* / advisor nets can load for this set.
 * Independent of TEI — today only Warp 12 ships weights.
 */
export function neuralAiSupported(maxPip: number): boolean {
  return neuralWeightsAvailable(maxPip);
}

export function buildHumanCaptains(
  count: number,
  names: readonly string[] = DEFAULT_HUMAN_CAPTAIN_NAMES,
  maxPip = 12
): HumanCaptainConfig[] {
  const capped = clampPassAndPlayPlayerCount(count, maxPip);
  return Array.from({ length: capped }, (_, index) => ({
    id: `human:${index}`,
    displayName: names[index]?.trim() || `Captain ${index + 1}`,
  }));
}

export function soloHumanCaptain(displayName: string): HumanCaptainConfig {
  const trimmed = displayName.trim() || 'You';
  return { id: 'you', displayName: trimmed };
}

/** Build `aiCount` AI captain slots with sensible defaults. */
export function buildAiCaptains(
  aiCount: number,
  maxPip = 12
): AiCaptainConfig[] {
  const capped = Math.min(aiCount, AI_OFFICER_POOL.length);
  const allowOmega = neuralAiSupported(maxPip);
  return AI_OFFICER_POOL.slice(0, capped).map((officer, index) => ({
    ...officer,
    skill:
      allowOmega && index === capped - 1 && capped >= 2
        ? 'commander'
        : 'lieutenant',
  }));
}

/** Apply lobby tier / Ω+ picks onto the default officer roster. */
export function applyAiTierOverrides(
  aiCaptains: readonly AiCaptainConfig[],
  tiers: Readonly<Record<string, WarpSkillLevel>>,
  extendedThinking: Readonly<Record<string, boolean>>,
  allowNeural: boolean
): AiCaptainConfig[] {
  return aiCaptains.map((ai) => {
    const tier = tiers[ai.id] ?? ai.skill;
    const thinking =
      allowNeural && tier === 'commander'
        ? extendedThinking[ai.id] === true
        : false;
    return { ...ai, skill: tier, omega: false, extendedThinking: thinking };
  });
}

export function defaultLocalGameConfig(
  humanName: string,
  playerCount = 4,
  maxPip: WarpFactor = 12
): LocalGameConfig {
  const factor = normalizeWarpFactor(maxPip);
  const count = clampLocalPlayerCount(playerCount, factor);
  const human = soloHumanCaptain(humanName);
  return {
    humanId: human.id,
    humanName: human.displayName,
    humanCaptains: [human],
    playerCount: count,
    objective: WARP12_OFFICIAL_OBJECTIVE,
    campaignRounds: defaultCampaignRounds(factor),
    goOutStructure: DEFAULT_GO_OUT_STRUCTURE,
    goOutWinsToWin: DEFAULT_GO_OUT_WINS_TO_WIN,
    goOutOvertime: DEFAULT_GO_OUT_OVERTIME,
    matchStarterIndex: undefined,
    modules: { ...WARP12_OFFICIAL_MODULES },
    houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES },
    aiCaptains: buildAiCaptains(count - 1, factor),
    rulesProfileId: WARP12_OFFICIAL_RULES_PROFILE_ID,
    maxPip: factor,
    rated: factor === 12,
  };
}
