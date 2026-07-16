import {
  formatAiOfficerTacticalClass,
  getTeiRank,
  getTeiRankFromFormatted,
} from 'warp12-engine';

import type { FirestoreCaptain } from '../firebase/schema.js';
import { isAiCaptain } from './ai-captain.js';
import type { LocalGameConfig } from './local-game-config.js';

/**
 * Human commission from a TEI grade string (`V67`) or legacy score-only number.
 * Score-only is treated as Provisional (P##) so we never invent a letter.
 */
function humanCommissionFromTei(
  tei: string | number | null | undefined
): { short: string; long: string } {
  if (tei == null) {
    const rank = getTeiRank({ grade: 'P', score: 0 });
    return { short: rank.short, long: rank.name };
  }
  if (typeof tei === 'string') {
    const rank = getTeiRankFromFormatted(tei);
    if (rank) {
      return { short: rank.short, long: rank.name };
    }
  }
  if (typeof tei === 'number' && Number.isFinite(tei)) {
    const score = Math.max(0, Math.min(99, Math.round(tei)));
    const rank = getTeiRank({ grade: 'P', score });
    return { short: rank.short, long: `${rank.name} (score-only)` };
  }
  const rank = getTeiRank({ grade: 'P', score: 0 });
  return { short: rank.short, long: rank.name };
}

/** Short commission labels (Ens. / Lt. JG / Cmdr.) for captains on tails and hub. */
export function buildCaptainTacticalClassAbbrevById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
  /** Human captain at the table (local seat or signed-in viewer online). */
  humanId?: string;
  /** Full TEI string (`V67`) preferred; score-only number accepted as legacy. */
  humanTei?: string | number | null;
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.humanId) {
    classes[options.humanId] = humanCommissionFromTei(options.humanTei).short;
  }

  if (options.localConfig) {
    for (const ai of options.localConfig.aiCaptains) {
      classes[ai.id] = formatAiOfficerTacticalClass(ai.skill, {
        short: true,
      });
    }
  }

  if (options.onlineCaptains) {
    for (const captain of options.onlineCaptains) {
      if (!isAiCaptain(captain)) {
        continue;
      }
      classes[captain.id] = formatAiOfficerTacticalClass(
        captain.skill ?? 'lieutenant',
        { short: true }
      );
    }
  }

  return classes;
}

/** Full commission labels for spoke tooltips and hub badges. */
export function buildCaptainTacticalClassLabelById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
  humanId?: string;
  humanTei?: string | number | null;
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.humanId) {
    classes[options.humanId] = humanCommissionFromTei(options.humanTei).long;
  }

  if (options.localConfig) {
    for (const ai of options.localConfig.aiCaptains) {
      classes[ai.id] = formatAiOfficerTacticalClass(ai.skill);
    }
  }

  if (options.onlineCaptains) {
    for (const captain of options.onlineCaptains) {
      if (!isAiCaptain(captain)) {
        continue;
      }
      classes[captain.id] = formatAiOfficerTacticalClass(
        captain.skill ?? 'lieutenant'
      );
    }
  }

  return classes;
}
