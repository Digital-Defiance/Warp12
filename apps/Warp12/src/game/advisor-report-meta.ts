import { formatAiOfficerTacticalClass } from 'warp12-engine';

import type { LocalGameConfig } from './local-game-config.js';
import { classifyLocalAiMatchSkill } from './local-match-stats.js';

/** Human-readable opponent tier line for advisor / campaign reports. */
export function tableOpponentLabelForAdvisor(
  config: LocalGameConfig | undefined
): string | undefined {
  if (!config || config.aiCaptains.length === 0) {
    return undefined;
  }

  const top = classifyLocalAiMatchSkill(config.aiCaptains);
  return formatAiOfficerTacticalClass(top);
}
