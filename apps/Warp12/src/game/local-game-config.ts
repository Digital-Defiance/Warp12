import type {
  GameModuleConfig,
  GameObjective,
  WarpSkillLevel,
} from 'warp12-engine';

export const LOCAL_MIN_PLAYERS = 3;
export const LOCAL_MAX_PLAYERS = 8;

export interface AiCaptainConfig {
  readonly id: string;
  readonly displayName: string;
  readonly skill: WarpSkillLevel;
  readonly useLookahead?: boolean;
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
  readonly modules: GameModuleConfig;
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
    skill: index === capped - 1 && capped >= 2 ? 'advanced' : 'intermediate',
    useLookahead: index === capped - 1 && capped >= 2,
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
    objective: 'go-out',
    modules: { salamanderPenalty: true, qContinuum: false, subspaceFracture: false },
    aiCaptains: buildAiCaptains(count - 1),
  };
}
