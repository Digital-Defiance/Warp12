/** How the fleet decides the victor — matches house rules at the table. */
export type GameObjective = 'points' | 'go-out';

export const DEFAULT_GAME_OBJECTIVE: GameObjective = 'points';

export const GAME_OBJECTIVE_LABELS: Record<GameObjective, string> = {
  'go-out': 'Go out — first empty hand wins the sector',
  points: 'Points — lowest cumulative total wins the campaign',
};

/** Short user-facing label for TEI tracks, standings, and reports. */
export const TEI_OBJECTIVE_LABEL: Record<GameObjective, string> = {
  'go-out': 'go-out',
  points: 'points',
};

export function formatCampaignPoints(total: number): string {
  return `${total} point${total === 1 ? '' : 's'}`;
}

export function formatRoundPointsDelta(points: number): string {
  return `+${points} point${points === 1 ? '' : 's'}`;
}
