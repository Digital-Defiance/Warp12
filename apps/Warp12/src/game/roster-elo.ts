import {
  formatAiOfficerTacticalClass,
  formatTei,
} from 'warp12-engine';
import type { GameLogRosterEntry } from 'warp12-react';

import { opponentTeiForObjective } from '../firebase/stats-elo.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import type { LocalGameConfig } from './local-game-config.js';

/** Solo vs-AI roster lines for the round log (human TEI + reference AI profiles). */
export function buildLocalRosterTei(
  config: LocalGameConfig,
  humanTei: number | null,
  objective: RatedObjective
): readonly GameLogRosterEntry[] {
  const humanEntry: GameLogRosterEntry = {
    captainId: config.humanId,
    tei: humanTei,
  };

  const aiEntries = config.aiCaptains.map((ai) => ({
    captainId: ai.id,
    tei: opponentTeiForObjective(objective, ai.skill),
    tacticalClass: formatAiOfficerTacticalClass(ai.skill, {
      class1Star: ai.class1Star,
    }),
    reference: true as const,
  }));

  return [humanEntry, ...aiEntries];
}

export { formatTei, formatAiOfficerTacticalClass as formatTacticalClass };
