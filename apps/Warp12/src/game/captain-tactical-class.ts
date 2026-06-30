import {
  aiSkillToTacticalClass,
  formatTacticalClass,
  type WarpSkillLevel,
} from 'warp12-engine';

import type { FirestoreCaptain } from '../firebase/schema.js';
import { isAiCaptain } from './ai-captain.js';
import type { LocalGameConfig } from './local-game-config.js';

/** Short tactical class labels (Cls IV) for AI officers on tails. */
export function buildCaptainTacticalClassAbbrevById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.localConfig) {
    for (const ai of options.localConfig.aiCaptains) {
      classes[ai.id] = formatTacticalClass(aiSkillToTacticalClass(ai.skill), {
        short: true,
      });
    }
  }

  if (options.onlineCaptains) {
    for (const captain of options.onlineCaptains) {
      if (!isAiCaptain(captain)) {
        continue;
      }
      classes[captain.id] = formatTacticalClass(
        aiSkillToTacticalClass(captain.skill ?? 'lieutenant'),
        { short: true }
      );
    }
  }

  return classes;
}

/** Full tactical class labels for spoke tooltips. */
export function buildCaptainTacticalClassLabelById(options: {
  localConfig?: LocalGameConfig;
  onlineCaptains?: readonly Pick<FirestoreCaptain, 'id' | 'isAi' | 'skill'>[];
}): Readonly<Record<string, string>> {
  const classes: Record<string, string> = {};

  if (options.localConfig) {
    for (const ai of options.localConfig.aiCaptains) {
      classes[ai.id] = formatTacticalClass(
        aiSkillToTacticalClass(ai.skill)
      );
    }
  }

  if (options.onlineCaptains) {
    for (const captain of options.onlineCaptains) {
      if (!isAiCaptain(captain)) {
        continue;
      }
      classes[captain.id] = formatTacticalClass(
        aiSkillToTacticalClass(captain.skill ?? 'lieutenant')
      );
    }
  }

  return classes;
}
