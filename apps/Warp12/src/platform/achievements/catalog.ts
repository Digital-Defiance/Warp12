/**
 * Shared Warp achievement catalog.
 *
 * Semantic ids are stable forever. Play Games / Game Center platform ids are
 * filled after console setup (Phase 1 in docs/platform-achievements-todo.md).
 * TEI remains the only skill ladder — these are flair / Level Up mirrors.
 */

export type WarpAchievementId =
  | 'first_launch'
  | 'first_sector'
  | 'first_all_stop'
  | 'first_beacon'
  | 'campaign_complete'
  | 'rated_sector_1'
  | 'rated_sector_10'
  | 'commission_ensign'
  | 'join_crew'
  | 'exhibition_warp9';

export interface WarpAchievement {
  readonly id: WarpAchievementId;
  readonly title: string;
  readonly description: string;
  /**
   * Game Center point value (max 100 each; catalog total must be ≤ 1000).
   * Decorative only — not TEI.
   */
  readonly gameCenterPoints: number;
  /** When set, progress is reported as current/steps (PGS increment / GC %). */
  readonly steps?: number;
  /** Hidden until unlocked (both platforms support this). */
  readonly hidden?: boolean;
  /**
   * True when a typical new player can earn this within ~1 hour of play.
   * Play Level Up / Quests want ≥4 of these.
   */
  readonly earlyHour?: boolean;
  /** Filled from Play Console after creation. */
  readonly playGamesId?: string;
  /** Filled from App Store Connect / .gamekit after creation. */
  readonly gameCenterId?: string;
}

export const WARP_ACHIEVEMENTS: readonly WarpAchievement[] = [
  {
    id: 'first_launch',
    title: 'Bridge Online',
    description: 'Launch Warp and open the Bridge for the first time.',
    gameCenterPoints: 5,
    earlyHour: true,
    playGamesId: 'CgkIruTguqwPEAIQAQ',
  },
  {
    id: 'first_sector',
    title: 'First Sector',
    description: 'Complete any sector at the table.',
    gameCenterPoints: 10,
    earlyHour: true,
    playGamesId: 'CgkIruTguqwPEAIQAg',
  },
  {
    id: 'first_all_stop',
    title: 'All Stop!',
    description: 'Empty your hand and call All Stop!',
    gameCenterPoints: 15,
    earlyHour: true,
    playGamesId: 'CgkIruTguqwPEAIQAw',
  },
  {
    id: 'first_beacon',
    title: 'Shields Down',
    description: 'Raise a distress beacon on your Warp Trail.',
    gameCenterPoints: 10,
    earlyHour: true,
    playGamesId: 'CgkIruTguqwPEAIQBA',
  },
  {
    id: 'campaign_complete',
    title: 'Mission Complete',
    description: 'Finish a Points or Go-out campaign.',
    gameCenterPoints: 25,
    playGamesId: 'CgkIruTguqwPEAIQBQ',
  },
  {
    id: 'rated_sector_1',
    title: 'Rated Deployment',
    description: 'Complete one rated Warp 12 sector (TEI eligible).',
    gameCenterPoints: 25,
    playGamesId: 'CgkIruTguqwPEAIQBg',
  },
  {
    id: 'rated_sector_10',
    title: 'Veteran of the Fleet',
    description: 'Complete 10 rated Warp 12 sectors.',
    gameCenterPoints: 50,
    steps: 10,
    playGamesId: 'CgkIruTguqwPEAIQBw',
  },
  {
    id: 'commission_ensign',
    title: 'Ensign',
    description: 'Reach federation commission Ensign or higher on TEI.',
    gameCenterPoints: 25,
    playGamesId: 'CgkIruTguqwPEAIQCA',
  },
  {
    id: 'join_crew',
    title: 'Crew Manifest',
    description: 'Join a crew on the federation leaderboard.',
    gameCenterPoints: 15,
    playGamesId: 'CgkIruTguqwPEAIQCQ',
  },
  {
    id: 'exhibition_warp9',
    title: 'Warp Factor 9',
    description: 'Finish an exhibition sector on the double-nine set.',
    gameCenterPoints: 20,
    hidden: true,
    playGamesId: 'CgkIruTguqwPEAIQCg',
  },
] as const;

const byId = new Map(
  WARP_ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])
);

export function getWarpAchievement(
  id: WarpAchievementId
): WarpAchievement | undefined {
  return byId.get(id);
}

export function listEarlyHourAchievements(): readonly WarpAchievement[] {
  return WARP_ACHIEVEMENTS.filter((a) => a.earlyHour);
}

export function totalGameCenterPoints(): number {
  return WARP_ACHIEVEMENTS.reduce((sum, a) => sum + a.gameCenterPoints, 0);
}
