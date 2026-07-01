import type {
  GameModuleConfig,
  GameObjective,
  HouseRulesConfig,
  WarpSkillLevel,
} from 'warp12-engine';
import { DEFAULT_CAMPAIGN_ROUNDS, DEFAULT_GAME_OBJECTIVE } from 'warp12-engine';

export const LOCAL_MIN_PLAYERS = 3;
export const LOCAL_MAX_PLAYERS = 8;

export interface AiCaptainConfig {
  readonly id: string;
  readonly displayName: string;
  readonly skill: WarpSkillLevel;
  /** Experimental Class I* — ISMCTS search opponent (not TEI reference). */
  readonly class1Star?: boolean;
  /** Officer pool slot when the captain was created from {@link AI_OFFICER_POOL}. */
  readonly poolId?: string;
}

/** Options chosen at the local bridge before a simulation launches. */
export interface LocalGameConfig {
  readonly humanId: string;
  readonly humanName: string;
  /** Total captains at the table (you + AI officers). */
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
  return {
    humanId: 'you',
    humanName: humanName.trim() || 'You',
    playerCount: count,
    objective: DEFAULT_GAME_OBJECTIVE,
    campaignRounds: DEFAULT_CAMPAIGN_ROUNDS,
    modules: { salamanderPenalty: true, qContinuum: false, subspaceFracture: false, subspaceFractureScope: 'own-trail' },
    aiCaptains: buildAiCaptains(count - 1),
  };
}
