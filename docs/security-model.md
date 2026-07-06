# Warp 12 security model

This document describes what the fleet can trust today, what remains client-influenced, and the path to native platform leaderboards.

## Summary

| Surface | Affects TEI? | Authority |
|--------|--------------|-----------|
| Practice vs AI (unassisted) | Yes | **Server replay** (`reportPracticeAiMatch`) |
| Human pool (officiated) | Yes | **Match official + Cloud Functions** |
| Human pool (online sectors) | Yes | **`reportOnlineMatch`** — server re-derives standings from game doc |
| Crew / charter TEI | Yes | Same paths with `charterId`; **`groupTei`** via Functions only |
| Academy starting TEI | Yes (seed only) | **`setAcademyPlacement` callable** |
| Online multiplayer sync | No (TEI) | Client-synced Firestore game docs; TEI applied only at sector complete |
| Advisor-assisted practice | No (unrated) | Logged locally; optional server write without TEI |
| Offline practice queue | Yes (when synced) | Same replay path after upload |
| Fleet win counters (legacy) | No longer client-writable | Server merges on verified writes only |

## Practice AI TEI

1. Client draws a CSPRNG **match seed** and records **human actions** during play.
2. On match end, client calls `reportPracticeAiMatch` with `seed`, `config`, and `humanActions` — not `won`.
3. Cloud Function replays the match with `warp12-engine` and derives the outcome.
4. Rated TEI updates require **Google sign-in** (non-anonymous). Advisor use forces unrated.
5. Firestore rules block client writes to `localAi`, `startingTei`, `matchHistory`, and aggregate counters.

**Offline:** Reports queue in `localStorage` and flush when the app is online and signed in.

## Human-pool TEI

1. A **match official** (custom claim) creates a rated match code.
2. Players check in with Google accounts.
3. Official submits standings; approval applies TEI via Cloud Functions.
4. Clients cannot write `humanTei`, `humanRatedGameIds`, `groupTei`, or `groupRatedIds`.

## Crew / charter TEI

1. Crew owners create charters via `createCharter`; members join with invite links (verified Google accounts).
2. Officiated matches may carry `charterId`; approval applies **`groupTei[charterId]`** when set.
3. Online sectors with `charterId` on the game document are rated via `reportOnlineMatch` when charter metadata and membership validate.
4. **Global Official** updates both `groupTei` and `humanTei`. Private crews update `groupTei` only.

See [crews-roadmap.md](./crews-roadmap.md) and [tei-spec.md](./tei-spec.md) §3.3.

## Online sectors

Multiplayer lobbies and active games live in Firestore `games/{id}`. Clients sync moves; **TEI is not client-reported**. At sector complete, `reportOnlineMatch` reads the authoritative game document, re-verifies seats, and applies §6.5 once per `gameId` (and per charter via `groupRatedIds`).

## Firestore `playerStats` lockdown

Clients may only create empty competitive profiles and update cosmetic fields (`displayName`, `captainGender`). All rated fields are unchanged on client update — only Admin SDK / Cloud Functions may mutate them.

## Leaderboard display

The public leaderboard (`leaderboard.warp12.app`) ranks **verified pools only**:

- **Human pool** — officiated matches and verified online sectors
- **Crew ladders** — `groupTei` per charter at `/crews`
- **Practice vs AI** — replay-verified unassisted matches per skill tier
- **Verified fleet** — sum of the above (excludes legacy client-reported totals)

## Native leaderboards (future)

Post-launch, platform stores can mirror verified TEI without replacing Firebase as source of truth:

### Apple Game Center (iOS / macOS Tauri)

- Use **Game Center Leaderboards** for display/discovery in the App Store ecosystem.
- Submit scores from Cloud Functions after verified TEI updates (or a thin client submit after successful callable response).
- Store `gamingIds.appleGameCenter` on `playerProfiles` (already scaffolded on leaderboard profile page).
- Prefer **server-side or attested submit**; avoid trusting client-only score posts for competitive boards.

### Google Play Games (Android Tauri)

- Same pattern with **Play Games Services** leaderboards.
- Link via `gamingIds.googlePlayGames`.
- Use Play Games sign-in where it aligns with Firebase Auth, or map accounts in profile.

### Xbox Live (Windows desktop)

- Optional third mirror for Windows builds via Xbox Live stats APIs.
- Profile field `gamingIds.xboxLive` already reserved.

**Recommended architecture:** Firebase remains authoritative; a Cloud Function fan-out (or scheduled job) pushes normalized TEI snapshots to each platform API when `playerProfiles.gamingIds` is set. Native boards are **read-mostly mirrors**, not separate rating systems.

## Operational checklist

Deploy together when changing trust boundaries:

```bash
yarn build:engine
cd functions && npm run build
firebase deploy --only functions,firestore:rules --project warp-12
yarn deploy:hosting:bridge
yarn deploy:hosting:leaderboard
```

## Related docs

- [Crews & charters](./crews-roadmap.md)
- [Practice AI replay investigation](./practice-ai-replay-investigation.md)
- [Roadmap](./roadmap.md)
