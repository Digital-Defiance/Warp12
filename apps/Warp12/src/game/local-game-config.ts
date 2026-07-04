import type {
  GameModuleConfig,
  GameObjective,
  HouseRulesConfig,
  WarpSkillLevel,
} from 'warp12-engine';

import {
  WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from './warp12-preset.js';

export const LOCAL_MIN_PLAYERS = 2;
export const LOCAL_MAX_PLAYERS = 8;
export const PASS_AND_PLAY_MIN_PLAYERS = 2;

export interface HumanCaptainConfig {
  readonly id: string;
  readonly displayName: string;
}

export interface AiCaptainConfig {
  readonly id: string;
  readonly displayName: string;
  readonly skill: WarpSkillLevel;
  /** Experimental Class I* — ISMCTS search opponent (not TEI reference). */
  readonly class1Star?: boolean;
  /** Officer pool slot when the captain was created from {@link AI_OFFICER_POOL}. */
  readonly poolId?: string;
}

/** Default call signs for human seats (pass-and-play setup). */
export const DEFAULT_HUMAN_CAPTAIN_NAMES: readonly string[] = [
  'Picard',
  'Riker',
  'Troi',
  'Worf',
  'Data',
  'Crusher',
  'La Forge',
  'Uhura',
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
  /** Points campaigns only — ignored when objective is go-out. */
  readonly campaignRounds: number;
  readonly modules: GameModuleConfig;
  readonly houseRules?: HouseRulesConfig;
  readonly aiCaptains: readonly AiCaptainConfig[];
}

/** Named AI officers drawn in order when the fleet grows. */
export const AI_OFFICER_POOL: readonly {
  id: string;
  displayName: string;
}[] = [
  { id: 'riker', displayName: 'Riker' },
  { id: 'troi', displayName: 'Troi' },
  { id: 'worf', displayName: 'Worf' },
  { id: 'data', displayName: 'Data' },
  { id: 'crusher', displayName: 'Crusher' },
  { id: 'laforge', displayName: 'La Forge' },
  { id: 'uhura', displayName: 'Uhura' },
];

export function clampLocalPlayerCount(count: number): number {
  return Math.min(LOCAL_MAX_PLAYERS, Math.max(LOCAL_MIN_PLAYERS, count));
}

export function clampPassAndPlayPlayerCount(count: number): number {
  return Math.min(LOCAL_MAX_PLAYERS, Math.max(PASS_AND_PLAY_MIN_PLAYERS, count));
}

/** Two or more human seats — shared-device pass-and-play (always unrated). */
export function isPassAndPlay(config: LocalGameConfig): boolean {
  return config.humanCaptains.length >= 2;
}

/** Solo vs-AI local matches may report TEI when signed in and unassisted. */
export function isRatedLocalGame(config: LocalGameConfig): boolean {
  return !isPassAndPlay(config);
}

export function buildHumanCaptains(
  count: number,
  names: readonly string[] = DEFAULT_HUMAN_CAPTAIN_NAMES
): HumanCaptainConfig[] {
  const capped = clampPassAndPlayPlayerCount(count);
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
export function buildAiCaptains(aiCount: number): AiCaptainConfig[] {
  const capped = Math.min(aiCount, AI_OFFICER_POOL.length);
  return AI_OFFICER_POOL.slice(0, capped).map((officer, index) => ({
    ...officer,
    skill: index === capped - 1 && capped >= 2 ? 'commander' : 'lieutenant',
  }));
}

export function defaultLocalGameConfig(
  humanName: string,
  playerCount = 4
): LocalGameConfig {
  const count = clampLocalPlayerCount(playerCount);
  const human = soloHumanCaptain(humanName);
  return {
    humanId: human.id,
    humanName: human.displayName,
    humanCaptains: [human],
    playerCount: count,
    objective: WARP12_OFFICIAL_OBJECTIVE,
    campaignRounds: WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
    modules: { ...WARP12_OFFICIAL_MODULES },
    houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES },
    aiCaptains: buildAiCaptains(count - 1),
  };
}
