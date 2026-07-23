import { useCallback, useEffect, useState } from 'react';

import {
  fetchCaptainIdentityFromProfile,
  saveCaptainGender,
  saveCaptainPronouns,
  saveCaptainSpeakAs,
} from '../firebase/stats-service.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import {
  captainPilotIcon,
  type CaptainGender,
  resolveCaptainGender,
  writeCaptainGenderLocal,
} from './captain-profile.js';
import {
  type CaptainPronounPreference,
  pronounFormsFromPreference,
  resolveCaptainPronouns,
  writeCaptainPronounsLocal,
} from './captain-pronouns.js';
import {
  resolveSpeakAs,
  writeSpeakAsLocal,
} from './captain-speak-as.js';

export function useCaptainProfile() {
  const auth = useFirebaseAuth();
  const playerStats = usePlayerStats();
  const [gender, setGender] = useState<CaptainGender>(() =>
    resolveCaptainGender(playerStats.stats?.captainGender)
  );
  const [pronouns, setPronouns] = useState<CaptainPronounPreference>(() =>
    resolveCaptainPronouns(playerStats.stats?.captainPronouns)
  );
  const [speakAs, setSpeakAs] = useState<string | null>(() =>
    resolveSpeakAs(playerStats.stats?.speakAs)
  );

  // Prefer federation playerProfiles; fall back to Warp playerStats / local.
  useEffect(() => {
    const uid = auth.user?.uid;
    if (!uid) {
      const resolved = resolveCaptainGender(playerStats.stats?.captainGender);
      setGender(resolved);
      if (playerStats.stats?.captainGender) {
        writeCaptainGenderLocal(playerStats.stats.captainGender);
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const profile = await fetchCaptainIdentityFromProfile(uid);
      if (cancelled) {
        return;
      }
      const nextGender = resolveCaptainGender(
        profile?.captainGender ?? playerStats.stats?.captainGender
      );
      setGender(nextGender);
      writeCaptainGenderLocal(nextGender);

      const nextPronouns = resolveCaptainPronouns(
        profile?.captainPronouns ?? playerStats.stats?.captainPronouns
      );
      setPronouns(nextPronouns);
      writeCaptainPronounsLocal(nextPronouns);

      const nextSpeakAs = resolveSpeakAs(
        profile?.speakAs !== undefined
          ? profile.speakAs
          : playerStats.stats?.speakAs
      );
      setSpeakAs(nextSpeakAs);
      writeSpeakAsLocal(nextSpeakAs);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    auth.user?.uid,
    playerStats.stats?.captainGender,
    playerStats.stats?.captainPronouns,
    playerStats.stats?.speakAs,
  ]);

  const setCaptainGender = useCallback(
    async (next: CaptainGender) => {
      writeCaptainGenderLocal(next);
      setGender(next);
      if (auth.user) {
        try {
          await saveCaptainGender(auth.user.uid, next);
          await playerStats.refresh();
        } catch (err) {
          console.warn('[captain-profile] failed to save gender', err);
        }
      }
    },
    [auth.user, playerStats]
  );

  const setCaptainPronouns = useCallback(
    async (next: CaptainPronounPreference) => {
      writeCaptainPronounsLocal(next);
      setPronouns(next);
      if (auth.user) {
        try {
          await saveCaptainPronouns(auth.user.uid, next);
          await playerStats.refresh();
        } catch (err) {
          console.warn('[captain-profile] failed to save pronouns', err);
        }
      }
    },
    [auth.user, playerStats]
  );

  const setCaptainSpeakAs = useCallback(
    async (next: string | null) => {
      writeSpeakAsLocal(next);
      setSpeakAs(next);
      if (auth.user) {
        try {
          await saveCaptainSpeakAs(auth.user.uid, next);
          await playerStats.refresh();
        } catch (err) {
          console.warn('[captain-profile] failed to save speak-as', err);
        }
      }
    },
    [auth.user, playerStats]
  );

  return {
    gender,
    pronouns,
    speakAs,
    pronounForms: pronounFormsFromPreference(pronouns),
    pilotIconSrc: captainPilotIcon(gender),
    setCaptainGender,
    setCaptainPronouns,
    setCaptainSpeakAs,
  };
}
