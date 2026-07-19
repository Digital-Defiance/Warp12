import {
  isModuleAvailableForObjective,
  type GameObjective,
} from 'warp12-engine';

/** Lobby / setup labels that fork by objective (RULES §VI Points vs Go-out). */
export function goOutAwareModuleLabel(
  module:
    | 'beta'
    | 'theta'
    | 'eta'
    | 'epsilon'
    | 'kappa',
  objective: GameObjective
): string {
  const goOut = objective === 'go-out';
  switch (module) {
    case 'beta':
      return goOut
        ? 'Module Beta — Salamander Surge'
        : 'Module Beta — Salamander penalty';
    case 'theta':
      return goOut
        ? 'Module Theta — Trail Momentum'
        : 'Module Theta — Longest Trail Bonus';
    case 'eta':
      return goOut
        ? 'Module Eta — Desperation Dig'
        : 'Module Eta — Temporal Debt';
    case 'epsilon': {
      const label = 'Module Epsilon — Tactical Requisition (Drafting)';
      return isModuleAvailableForObjective('drafting', objective)
        ? label
        : `${label} — unavailable in Go-out`;
    }
    case 'kappa':
      return goOut
        ? 'Module Kappa — Hand Exchange (Warped/Exhibition)'
        : 'Module Kappa — Temporal Inversion (Warped/Exhibition)';
  }
}
