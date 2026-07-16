import {
  formatAiOfficerTacticalClass,
  formatTei,
} from 'warp12-engine';
import type { GameLogRosterEntry } from 'warp12-react';

import { opponentTeiGradeForObjective } from '../firebase/stats-openskill.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import type { FirestoreCaptain } from '../firebase/schema.js';
import { isAiCaptain } from './ai-captain.js';
import type { LocalGameConfig } from './local-game-config.js';

/** Solo vs-AI roster lines for the round log (human TEI + reference AI profiles). */
export function buildLocalRosterTei(
  config: LocalGameConfig,
  humanTei: string | null,
  objective: RatedObjective
): readonly GameLogRosterEntry[] {
  const humanEntry: GameLogRosterEntry = {
    captainId: config.humanId,
    tei: humanTei,
  };

  const aiEntries = config.aiCaptains.map((ai) => ({
    captainId: ai.id,
    tei: opponentTeiGradeForObjective(objective, ai.skill),
    tacticalClass: formatAiOfficerTacticalClass(ai.skill),
    reference: true as const,
  }));

  return [humanEntry, ...aiEntries];
}

/**
 * Round-log roster lines for an online sector. AI officers show their fixed
 * reference TEI + commission track (same format as local); human captains have no
 * online TEI on file, so they render as "TEI unrated".
 */
export function buildOnlineRosterClasses(
  turnOrder: readonly string[],
  onlineCaptains: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[],
  objective: RatedObjective
): readonly GameLogRosterEntry[] {
  const byId = new Map(onlineCaptains.map((captain) => [captain.id, captain]));
  return turnOrder.map((id) => {
    const captain = byId.get(id);
    if (captain && isAiCaptain(captain)) {
      const skill = captain.skill ?? 'lieutenant';
      return {
        captainId: id,
        tei: opponentTeiGradeForObjective(objective, skill),
        reference: true,
        tacticalClass: formatAiOfficerTacticalClass(skill),
      };
    }
    return { captainId: id, tei: null };
  });
}

/** True when at least one roster entry carries a commission track (an AI officer). */
export function rosterHasTacticalClasses(
  roster: readonly GameLogRosterEntry[]
): boolean {
  return roster.some((entry) => Boolean(entry.tacticalClass));
}

export { formatTei, formatAiOfficerTacticalClass as formatTacticalClass };
