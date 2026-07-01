import { CLASS1_STAR_DISPLAY_NAME } from 'warp12-engine';

import type { LocalGameConfig } from './local-game-config.js';

/** Human-readable opponent tier line for advisor / campaign reports. */
export function tableOpponentLabelForAdvisor(
  config: LocalGameConfig | undefined
): string | undefined {
  if (!config || config.aiCaptains.length === 0) {
    return undefined;
  }

  const class1StarCount = config.aiCaptains.filter((ai) => ai.class1Star).length;
  if (class1StarCount === config.aiCaptains.length) {
    return `${CLASS1_STAR_DISPLAY_NAME} (experimental ISMCTS search)`;
  }
  if (class1StarCount > 0) {
    return `mixed roster (${class1StarCount}× ${CLASS1_STAR_DISPLAY_NAME})`;
  }

  return 'Class II reference officers';
}
