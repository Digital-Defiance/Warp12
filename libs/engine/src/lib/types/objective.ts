/** How the fleet decides the victor — matches house rules at the table. */
export type GameObjective = 'points' | 'go-out';

export const DEFAULT_GAME_OBJECTIVE: GameObjective = 'points';

export const GAME_OBJECTIVE_LABELS: Record<GameObjective, string> = {
  'go-out': 'Go out — empty hand wins the round (sudden death or campaign)',
  points: 'Points — lowest cumulative total wins the campaign',
};

/** Short user-facing label for TEI tracks, standings, and reports. */
export const TEI_OBJECTIVE_LABEL: Record<GameObjective, string> = {
  'go-out': 'go-out',
  points: 'points',
};

export function formatCampaignPoints(total: number): string {
  // The lowest score shown is zero; a captain's raw total can dip slightly
  // negative (Module Theta / Longest Trail bonus), which is retained only to
  // break otherwise-tied standings — never displayed as a negative number.
  const shown = Math.max(0, total);
  return `${shown} point${shown === 1 ? '' : 's'}`;
}

export function formatRoundPointsDelta(points: number): string {
  if (points < 0) {
    const n = Math.abs(points);
    return `−${n} point${n === 1 ? '' : 's'}`;
  }
  return `+${points} point${points === 1 ? '' : 's'}`;
}
