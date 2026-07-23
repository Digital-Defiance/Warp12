# Platform achievements (PGS + Game Center)

**Goal:** Mirror Warp milestones on Google Play Games Services and Apple Game
Center without competing with TEI / iwgf.org. Firebase stays the account of
record; platform shells are flair + Level Up eligibility.

**Out of scope for this track:** Sign in with Apple (App Store 4.8 — separate),
Firebase Game Center auth, PGS/Game Center leaderboards for TEI scores.

---

## Principles

- [x] TEI is the only skill ladder (OpenSkill, rated rules, advisor gates)
- [x] One shared Warp catalog → map to Play + Game Center IDs
- [x] Unlock is one-way: game event → our code → platform APIs
- [ ] Never publish TEI letter/score as a platform leaderboard number

---

## Phase 0 — Catalog & JS API

- [x] Shared catalog (`apps/Warp12/src/platform/achievements/catalog.ts`)
  - ≥10 achievements; ≥4 reasonably doable in the first hour (Play Level Up / Quests)
  - Game Center point budget ≤ 1000 total, ≤ 100 each
  - Semantic ids stable forever (`first_sector`, `rated_sector_1`, …)
- [x] Unit tests for catalog invariants (unique ids, GC points sum, early set)
- [x] TS API: `unlockAchievement`, `progressAchievement`, `showAchievementsUi`
  - No-op on web / desktop
  - Invoke Tauri commands on iOS / Android (native plugin still Phase 2)
- [x] Local dedupe (don’t spam unlock for already-granted ids)
- [x] Rust command stubs (`achievements_unlock` / `_progress` / `_show_ui`)

---

## Phase 1 — Console setup (manual)

### Google Play Console

- [ ] Enable Play Games Services for `org.digitaldefiance.app.warp12`
- [ ] Note Games Services project ID → `game_services_project_id` string resource
- [x] Create draft achievements matching the catalog (copy + icons)
- [x] Fill `playGamesId` in catalog
- [x] Set real `game_services_project_id` in Android `strings.xml` (`527330456110`)
- [ ] Add license testers; verify unlocks on internal track
- [ ] Publish achievements with a store release (after smoke test)
- [ ] Enable Sidekick on AAB uploads (Level Up); test closed track

### App Store Connect / Xcode

- [ ] Enable Game Center capability on the App ID / app version
- [ ] Create matching achievements (prefer `.gamekit` bundle + sync)
- [ ] Fill `gameCenterId` in catalog
- [ ] Sandbox / Game Progress Manager test unlocks
- [ ] Submit Game Center components with the app for review
- [ ] Optional: enable Game Center on macOS build for parity

---

## Phase 2 — Native bridges (Tauri mobile plugin)

- [x] Scaffold `tauri-plugin-warp-achievements` (Android + iOS)
- [x] Register plugin in `apps/Warp12/src-tauri`; add capabilities permissions
- [x] **Android**
  - [x] Dependency `com.google.android.gms:play-services-games-v2` (pin 21.0.0)
  - [x] Manifest `APP_ID` meta-data + `PlayGamesSdk.initialize` (in plugin `load`)
  - [x] Commands: `unlock`, `progress`, `showUi`
  - [x] Graceful no-op when `playGamesId` unset / SDK init fails
- [x] **iOS**
  - [x] GameKit authenticate (`GKLocalPlayer.authenticateHandler`)
  - [x] Commands: `unlock`, `progress`, `showUi`
  - [x] Graceful no-op when `gameCenterId` unset / not signed in
  - [x] Game Center entitlement flag in `Entitlements.plist`
- [ ] Smoke on device / emulator with draft console achievements
- [ ] Fill real PGS project id in `strings.xml` (`game_services_project_id`)
- [ ] Fill `playGamesId` / `gameCenterId` in catalog after console create

---

## Phase 3 — Wire game milestones

Call the shared unlock API from real events (never invent TEI from platforms):

| Semantic id | Trigger sketch |
|---|---|
| `first_launch` | First Bridge session after install |
| `first_sector` | Any sector / round completes |
| `first_all_stop` | Player empties hand / All Stop |
| `first_beacon` | Local player raises distress beacon |
| `campaign_complete` | Campaign complete overlay path |
| `rated_sector_1` | Rated Warp 12 sector successfully applied |
| `rated_sector_10` | Incremental (backend or local counter) |
| `commission_ensign` | Federation commission reaches Ensign+ |
| `join_crew` | Crew join succeeds (leaderboard / bridge) |
| `exhibition_warp9` | Finish a Warp 9 exhibition sector |

- [x] Hook high-confidence events first (`first_sector`, `campaign_complete`, `first_launch`)
- [ ] `first_all_stop` / `first_beacon` from table actions
- [ ] Rated / commission hooks from TEI certificate / stats update paths
- [ ] Keep copy: “Federation TEI on iwgf.org” vs “Play / Game Center achievements”

---

## Phase 4 — Polish & Level Up

- [ ] Profile / About blurb explaining the split
- [ ] Optional “View achievements” button (opens platform UI)
- [ ] Achievement icons (federation art; unique per id)
- [ ] Sidekick production enablement after closed testing
- [ ] Revisit Quests / Play Points enrollment (optional monetization)
- [ ] Explicitly **do not** add PGS/GC leaderboards for TEI

---

## Deferred (separate tracks)

- [ ] Sign in with Apple → Firebase (App Store Guideline 4.8 when shipping Google login on iOS)
- [ ] Account linking Google ↔ Apple for one TEI profile
- [ ] Fun (non-TEI) platform leaderboards / Leagues
- [ ] Firebase Game Center auth provider (not needed for achievements)

---

## Progress log

| Date | Note |
|---|---|
| 2026-07-19 | Plan + todo; Phase 0 catalog/API/local dedupe; hooks for launch + campaign complete |
| 2026-07-19 | Phase 2: `tauri-plugin-warp-achievements` with PGS v2 (Android) + GameKit (iOS) |
