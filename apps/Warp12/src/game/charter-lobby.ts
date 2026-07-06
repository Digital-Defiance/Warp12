import type { CreateLobbyOptions } from '../firebase/index.js';
import type { PublicCharterView } from '../firebase/charter-service.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
} from './warp12-preset.js';

/** Apply a crew charter's frozen lobby settings for sector create or waiting room. */
export function lobbyOptionsFromCharter(
  crew: PublicCharterView,
  base: CreateLobbyOptions = {}
): CreateLobbyOptions {
  const modules = crew.modules ?? WARP12_OFFICIAL_MODULES;
  const houseRules = crew.houseRules ?? WARP12_OFFICIAL_HOUSE_RULES;
  return {
    ...base,
    charterId: crew.charterId,
    rulesProfileId: crew.rulesProfileId,
    objective: crew.objective,
    campaignRounds: crew.campaignRounds,
    maxPlayers: crew.playerCount,
    modules: { ...modules },
    houseRules: { ...houseRules },
    rated: base.rated ?? true,
  };
}
