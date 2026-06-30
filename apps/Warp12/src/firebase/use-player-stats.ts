import { useCallback, useEffect, useState } from 'react';

import type { RatedObjective, PlayerStatsDocument } from './stats-schema.js';
import type { WarpSkillLevel } from 'warp12-engine';

import {
  canSetStartingTei as canSetStartingTeiForBucket,
  displayPlayerObjectiveTei,
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
    skill: WarpSkillLevel,
    tei: number
  ) => Promise<void>;
  displayTei: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => number | null;
  needsAcademyPlacement: boolean;
  needsAcademyPlacementForObjective: (objective: RatedObjective) => boolean;
  canSetStartingTei: (
    skill: WarpSkillLevel,
    objective: RatedObjective
  ) => boolean;
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
    async (objective: RatedObjective, skill: WarpSkillLevel, tei: number) => {
      if (!auth.user) {
        return;
      }
      await setAcademyPlacement(auth.user.uid, objective, skill, tei);
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
    needsAcademyPlacement: needsAcademyPlacement(stats),
    needsAcademyPlacementForObjective: (objective) =>
      needsAcademyPlacementForObjective(stats, objective),
    canSetStartingTei: (skill, objective) =>
      canSetStartingTeiForBucket(stats, skill, objective),
  };
}
