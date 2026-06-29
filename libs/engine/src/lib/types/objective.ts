/** How the fleet decides the victor — matches house rules at the table. */
export type GameObjective = 'penalty' | 'go-out';

export const DEFAULT_GAME_OBJECTIVE: GameObjective = 'penalty';

export const GAME_OBJECTIVE_LABELS: Record<GameObjective, string> = {
  'go-out': 'Go out — first empty hand wins the sector',
  penalty: 'Points — lowest cumulative penalty wins the campaign',
};
