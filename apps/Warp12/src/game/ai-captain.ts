import type { WarpSkillLevel } from '@warp12/Warp12-lib';

import type { FirestoreCaptain } from '../firebase/schema.js';
import type { AiCaptainConfig } from './local-game-config.js';
import { AI_OFFICER_POOL } from './local-game-config.js';

export const AI_CAPTAIN_ID_PREFIX = 'ai:';

export function toAiCaptainId(poolId: string): string {
  return `${AI_CAPTAIN_ID_PREFIX}${poolId}`;
}

export function isAiCaptainId(id: string): boolean {
  return id.startsWith(AI_CAPTAIN_ID_PREFIX);
}

export function isAiCaptain(
  captain: Pick<FirestoreCaptain, 'id' | 'isAi'>
): boolean {
  return captain.isAi === true || isAiCaptainId(captain.id);
}

export function aiCaptainToConfig(
  captain: FirestoreCaptain
): AiCaptainConfig | null {
  if (!isAiCaptain(captain)) {
    return null;
  }
  const poolId = captain.id.slice(AI_CAPTAIN_ID_PREFIX.length);
  return {
    id: captain.id,
    displayName: captain.displayName,
    skill: captain.skill ?? 'intermediate',
    useLookahead: captain.useLookahead ?? false,
    poolId: poolId || undefined,
  };
}

export function pickNextAiOfficer(
  captains: readonly Pick<FirestoreCaptain, 'id'>[]
): (typeof AI_OFFICER_POOL)[number] | null {
  const usedPoolIds = new Set(
    captains
      .filter((captain) => isAiCaptainId(captain.id))
      .map((captain) => captain.id.slice(AI_CAPTAIN_ID_PREFIX.length))
  );
  return AI_OFFICER_POOL.find((officer) => !usedPoolIds.has(officer.id)) ?? null;
}

export function onlineAiSeed(gameId: string): number {
  let hash = 0;
  for (const character of gameId) {
    hash = (Math.imul(31, hash) + character.charCodeAt(0)) | 0;
  }
  return hash >>> 0;
}

export type { WarpSkillLevel };
