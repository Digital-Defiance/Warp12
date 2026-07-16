import { useCallback, useEffect, useState } from 'react';

import type { TeiDisplay } from 'warp12-engine';
import type { RatedObjective, PlayerStatsDocument, StoredRating } from './stats-schema.js';
import type { WarpSkillLevel } from 'warp12-engine';

import {
  canSetStartingTei as canSetStartingTeiForBucket,
  displayPlayerObjectiveTei,
  getPlayerTeiDisplay,
  getPlayerStoredRating,
  fetchPlayerStats,
  needsAcademyPlacement,
  needsAcademyPlacementForObjective,
  setAcademyPlacement,
} from './stats-service.js';
import { useFirebaseAuth } from './use-firebase-auth.js';
import { isFirebaseConfigured } from './config.js';

export interface PlayerStatsState {
  ready: boolean;
  stats: PlayerStatsDocument | null;
  refresh: () => Promise<void>;
  saveAcademyPlacement: (
    objective: RatedObjective,
    skill: WarpSkillLevel
  ) => Promise<void>;
  displayTei: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => number | null;
  getTeiDisplay: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => TeiDisplay | null;
  getStoredRating: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => StoredRating | null;
  needsAcademyPlacement: boolean;
  needsAcademyPlacementForObjective: (objective: RatedObjective) => boolean;
  canSetStartingTei: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => boolean;
}

/**
 * True for the callable's `failed-precondition` code ("academy placement is
 * already set or rated play has started"). The Functions client surfaces it as
 * either `failed-precondition` or `functions/failed-precondition`.
 */
function isAlreadyPlacedError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  return code.endsWith('failed-precondition');
}

export function usePlayerStats(): PlayerStatsState {
  const auth = useFirebaseAuth();
  const [ready, setReady] = useState(!isFirebaseConfigured());
  const [stats, setStats] = useState<PlayerStatsDocument | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.ready || !auth.user || !isFirebaseConfigured()) {
      setStats(null);
      setReady(true);
      return;
    }
    setReady(false);
    try {
      setStats(await fetchPlayerStats(auth.user.uid));
    } finally {
      setReady(true);
    }
  }, [auth.ready, auth.user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveAcademyPlacement = useCallback(
    async (objective: RatedObjective, skill: WarpSkillLevel) => {
      if (!auth.user) {
        return;
      }
      try {
        await setAcademyPlacement(auth.user.uid, objective, skill);
      } catch (err) {
        // The server already has a placement for this track (set on another
        // device, or client stats were momentarily stale right after a sign-in
        // account switch). Re-sync and treat as done — the placement form then
        // disappears — rather than surfacing a confusing error.
        if (!isAlreadyPlacedError(err)) {
          throw err;
        }
      }
      await refresh();
    },
    [auth.user, refresh]
  );

  return {
    ready,
    stats,
    refresh,
    saveAcademyPlacement,
    displayTei: (skill, objective) =>
      displayPlayerObjectiveTei(stats, skill, objective),
    getTeiDisplay: (skill, objective) =>
      getPlayerTeiDisplay(stats, skill, objective),
    getStoredRating: (skill, objective) =>
      getPlayerStoredRating(stats, skill, objective),
    needsAcademyPlacement: needsAcademyPlacement(stats),
    needsAcademyPlacementForObjective: (objective) =>
      needsAcademyPlacementForObjective(stats, objective),
    canSetStartingTei: (skill, objective) =>
      canSetStartingTeiForBucket(stats, skill, objective),
  };
}
