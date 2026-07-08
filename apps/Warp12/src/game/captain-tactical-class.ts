import {
  formatAiOfficerTacticalClass,
  formatTacticalClass,
  playerTacticalClassTagline,
  teiToPlayerTacticalClass,
} from 'warp12-engine';

import type { FirestoreCaptain } from '../firebase/schema.js';
import { isAiCaptain } from './ai-captain.js';
import type { LocalGameConfig } from './local-game-config.js';

function humanTacticalClassAbbrev(tei: number | null | undefined): string {
  return formatTacticalClass(teiToPlayerTacticalClass(tei ?? null), {
    short: true,
  });
}

function humanTacticalClassLabel(tei: number | null | undefined): string {
  const tacticalClass = teiToPlayerTacticalClass(tei ?? null);
  return `${formatTacticalClass(tacticalClass)} — ${playerTacticalClassTagline(tacticalClass)}`;
}

/** Short tactical class labels (Cls IV) for captains on tails and hub. */
export function buildCaptainTacticalClassAbbrevById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
  /** Human captain at the table (local seat or signed-in viewer online). */
  humanId?: string;
  /** Solo TEI for the human on the current objective track (null → Class IV). */
  humanTei?: number | null;
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.humanId) {
    classes[options.humanId] = humanTacticalClassAbbrev(options.humanTei);
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

/** Full tactical class labels for spoke tooltips and hub badges. */
export function buildCaptainTacticalClassLabelById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
  humanId?: string;
  humanTei?: number | null;
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.humanId) {
    classes[options.humanId] = humanTacticalClassLabel(options.humanTei);
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
