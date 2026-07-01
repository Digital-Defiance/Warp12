import { useCallback, useEffect, useState } from 'react';

import { saveCaptainGender } from '../firebase/stats-service.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import {
  captainPilotIcon,
  type CaptainGender,
  readCaptainGenderLocal,
  resolveCaptainGender,
  writeCaptainGenderLocal,
} from './captain-profile.js';

export function useCaptainProfile() {
  const auth = useFirebaseAuth();
  const playerStats = usePlayerStats();
  const [gender, setGender] = useState<CaptainGender>(() =>
    resolveCaptainGender(playerStats.stats?.captainGender)
  );

  useEffect(() => {
    const resolved = resolveCaptainGender(playerStats.stats?.captainGender);
    setGender(resolved);
    if (playerStats.stats?.captainGender) {
      writeCaptainGenderLocal(playerStats.stats.captainGender);
    }
  }, [playerStats.stats?.captainGender]);

  const setCaptainGender = useCallback(
    async (next: CaptainGender) => {
      writeCaptainGenderLocal(next);
      setGender(next);
      if (auth.user) {
        await saveCaptainGender(auth.user.uid, next);
        await playerStats.refresh();
      }
    },
    [auth.user, playerStats]
  );

  return {
    gender,
    pilotIconSrc: captainPilotIcon(gender),
    setCaptainGender,
    ready: playerStats.ready,
  };
}

export { readCaptainGenderLocal };
