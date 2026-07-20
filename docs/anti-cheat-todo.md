# Sector-locked commentary + hand trust

## Immediate: pronouns 403 (profile page)

Local `[firestore.rules](firestore.rules)` already allows `captainPronouns` in `clientProfileFieldsOnly()`, but **production still has the old allow-list** (`displayName`, `captainGender`, `updatedAt` only). That matches the failing write:

`updateMask: captainPronouns.preset, updatedAt` → permission-denied.

**Fix:** deploy rules (file is modified locally, not live yet):

```bash
yarn deploy:firestore
```

Client save path already writes only cosmetic fields and catches the error in `[use-captain-profile.ts](apps/Warp12/src/game/use-captain-profile.ts)`.

------

## Agreed: anti-cheat is a separate track

Online submits today: client `applyAction` inside Firestore tx; rules do **not** enforce legal moves. Better integrity later (authoritative Function apply / verified host) is **not** bundled into commentary TTS. Commentary can ship on the honest-client trust model first; anti-cheat is its own project (~8–9/10 if full server authority).

------

## Commentary shape (later)

Lobby-locked flag → actor submit → Functions TTS → shared cache → humans/spectators/OBS play. Difficulty **~7–8/10**. Admin silent pre-warm alone remains **~3/10**.

## Hand lying (status quo)

Honest Bridge + client `applyAction` only. Firestore rules do not prove tile∈hand. Malicious clients can forge.

## Sequencing

1. **Now:** `yarn deploy:firestore` → pronouns save works.
2. Cheap stream help: admin silent pre-warm (~3/10).
3. Later: lobby-locked sector TTS (~7–8/10).
4. Parallel/later: authoritative apply anti-cheat (~8–9/10).