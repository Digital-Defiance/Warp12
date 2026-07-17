# Warp Ops — Admin Console TODO

**Status**: foundations shipped (bans + `warp` CLI + Warp Ops SPA @ ops.iwdf.org)  
**Goal**: Ops console (web + Tauri) that can administer **everything** Warp writes online, with real moderation and TEI maintenance — without the Firebase console.

Reuse Firebase Auth custom claims (`admin`). Privileged mutations via Cloud Functions / Admin SDK + `opsAudit`. Clients never get raw Admin SDK.

**CLI:** `yarn warp` · **UI:** `apps/WarpOps` · **Host:** `hosting:ops` → `warp-12-ops` → **ops.iwdf.org**

---

## Shipped

- [x] Warp Ops SPA + Tauri shell + hosting target
- [x] Google sign-in + `admin` claim gate (UI)
- [x] Ban model + callables + CLI + Auth disable
- [x] **IP bans**: one record per subject with **IPv4 and/or IPv6** (+ optional uid)
- [x] Ban enforcement (uid + client IP on callables; rules for uid)
- [x] `opsAudit` append-only log
- [x] Official match **PDF certificates** (required on approve) + HMAC + `verifyMatchCertificate`
- [x] Ops dash **Sectors** tab: active sectors + historical search (id / host / phase / rated / date)
- [x] Ops dash **Captains** tab: name/uid/email search + dossier + admin notes (+/−)

---

## Priority backlog (complaint-driven moderation)

### A. Captain search & identity
- [x] **Search display names** (substring on recent `playerStats`) + uid + email
- [x] Lookup by **uid** / email (Google) / Auth provider metadata on dossier
- [x] Profile dossier: TEI/history slice, ban record, admin notes
- [x] Admin notes collection (`adminNotes/{uid}`) — add / edit / delete
- [x] Ops-edit display name (`opsSetDisplayName` + Captains dossier rename; audited)
- [ ] Related-account hints (same email, successive anon→Google link when known) — deferred (Auth enumeration)

### B. Chat search, browse, moderate
- [x] **Cross-game message search** by substring, sender uid/name, date range (`searchMessages`)
  - Collection-group indexes on `messages.at` + `from`/`at`; text/name filters are in-memory over the bounded scan (not full-text)
- [x] Jump to messages **from a complaint date** (`from`/`to` date inputs) → list hits → open sector thread
- [x] Browse full thread for a game (`listSectorMessages`) — table + DM + squad (ops Admin path)
- [x] Delete message(s) (Admin SDK; `opsAudit` `message_delete`)
- [x] Redact message(s) (keep doc, blank body; `redactSectorMessage` / `message_redact`)
- [x] **Global + in-sector mute** (server-enforced via `mutes/{uid}` + `games/{id}/mutes/{uid}` + rules on message create)
- [x] Banned-word list (ops-editable) + auto-flag on send (review only; no auto-ban/delete)
- [x] Player **report / flag** queue (in-game report message) → WarpOps Reports inbox

### C. Live sectors
- [x] **Dashboard: active games** (lobby / active / round-end) + **historical game search** (date range, id, host, phase, rated)
- [x] Live monitor start: sector detail + supervise watch link; **Inspect hands** via `getOpsHands` (Admin SDK only)
- [x] **Kick mid-mission** (`opsKickCaptain`) — strips seat/turn; unrates; soft-terminates if fleet &lt; 2
- [x] Terminate / abandon sector (`opsTerminateSector` soft|hard) + stale list/cleanup
- [x] Inspect hands via Admin path only (`getOpsHands`)

### D. TEI / ratings (hard)
- [x] **Match ledger** (append-only `ratingEvents`) — writers on official / online / squad / practice apply; ops list + soft-void marks ledger
  - Still **not** a full cascade: historical matches before deploy have no events; backfill deferred
- [x] Inspect `playerStats` tracks + `ratedMatches` (`getOpsRatedMatch` + dossier TEI tables)
- [x] Void or correct a rated match **with reason + audit** (`opsVoidRatedMatch` — soft void; μ/σ not rewound; ledger `voided` flag)
- [x] **Cascade replay** from ledger event N onward — Scope A personal timelines (`opsCascadeFromRatingEvent`, dry-run + apply); full multiplayer closure deferred
- [x] Manual rating override (set μ/σ) with mandatory reason (`opsSetCaptainRating`)
- [x] Season / charter soft-reset ops UI (`resetGlobalOfficialSeason` wired in Crews panel)

### F. Admin notes (captain dossier)
- [x] `adminNotes/{uid}` — Admin SDK only (deny client)
- [x] Notes array with add / edit / delete (+/−) on Captains dossier
- [x] Surface on captain dossier; never visible to the captain
- Soft-delete flag deferred (hard-remove from array is fine)

### G. Spectate (players) + Supervision (ops)
- [x] **Spectate** — watch a sector without taking a seat; lobby host option to **disable spectators**
- [x] Spectator count visible (watch header / ops detail); spectators do **not** fill fleet seats
- [x] **Supervision** — admin silent watch via `/watch?ops=1`: not listed, not in count; bypasses allowSpectate
- [x] Ops can force allow/close spectate mid-match and **drop all spectators**
- [x] Spectators: read-only table + public table messages (`audience: table`); no hands, no DMs/squad send

### H. Match certificates (player-facing — PDF required)
- [x] Server-signed payload (HMAC) + **required PDF** on official rated-match approval (`pdf-lib`, Storage path `certificates/{code}.pdf`)
- [x] `verifyMatchCertificate` callable (signature check + signed PDF URL)
- [x] Verify page UI at iwdf.org/verify (`Warp12-leaderboard` `/verify`)
- [x] Online sector certificates on `reportOnlineMatch` / squad (`ON-{gameId}` in `ratedMatches`)

### Also: banned-word list (careful)
- [x] Word-boundary / token matching — **not** naive substring (`ass` must not hit `Cassandra`)
- [x] Separate lists: **chat** vs **display names** (+ allowlist)
- [x] Ops allowlist for false positives (real names / callsigns)
- [x] Prefer flag-for-review over auto-ban on name matches (`moderationReports` + content-review config)

### E. Crews, logs, ship
- [x] Charter list / force-remove member / close / clear join requests (WarpOps **Crews** tab + callables; audited)
- [x] Published logs — **confirmed unused** (rules + index only; no Bridge/Functions write path). Leave shell; no ops list until a publish product exists.
- [x] Document grant/revoke `admin` (`yarn warp roles` + `setUserRoles` / `bootstrapAdmin`); Tauri signed build / further hardening still optional ops polish

---

## Also worth doing

### Moderation depth
- [x] Temp ban vs permanent (`expiresAt`; blank days = permanent)
- [x] Ban appeal note field (`appealNote` on ban doc + Bans panel)
- [ ] Ban by **device / install fingerprint** (ops signals + installSightings when Bridge sends `clientInstallId`; full graph UI deferred)
- [x] Shadow-mute (messages accepted but hidden from other captains; ops-set only — never auto)
- [x] Banned-word hit → ops queue (review, not auto-ban); player reports share the same inbox
- [x] Auto-escalate: N open reports on same target → system integrity queue item (review-only)
- [x] Evidence pack export (JSON): game, messages window, uids, TEI/ledger/certificate slice

### Integrity / abuse of rating
- [x] Flag same-cohort rematches + related-IP sightings → `moderationReports` source=`system` (no auto-ban)
- [x] Surface advisor presence in sector detail (coach presence); Class I\* / unverified still via eligibility notes
- [x] “Unrate this online sector” without full cascade (`opsUnrateOnlineSector` — strip claims + void ON-/ledger)

### Platform / UX
- [ ] Stale game sweeper; Auth user browser
- [x] Ops role split: `moderator` vs full `admin`
- [x] Deep links + audit log viewer + CLI search parity

---

## Suggested build order

1. ~~**Ops dash: active games + historical game search**~~
2. ~~**Captain name search + dossier + admin notes**~~
3. ~~**Message search by word + date + sender**~~ (+ delete)
4. ~~**Server mute + ops kick**~~
5. ~~**Game terminate / stale cleanup**~~
6. ~~**Spectate (players) + Supervision (ops)**~~
7. ~~**TEI inspect + manual override + audit**~~ (soft void; cascade deferred)
8. ~~**Match ledger**~~ (append-only `ratingEvents`)
8b. ~~**Cascade replay**~~ (Scope A personal timelines; multiplayer closure deferred)
9. ~~**Player certificates**~~ (verify page + online `ON-` PDFs)
10. ~~**Report queue + careful banned-word flagging**~~ (Bridge report + WarpOps Reports tab + triggers)
11. ~~Crews~~ / logs confirmed unused / ~~admin roles docs + `warp roles`~~
12. ~~Deep links + Subspace slash commands (`/spectate`) + iwdf.org active-game counter~~
13. ~~BrightDate preference (Bridge)~~
14. ~~Ops rename / redact / hands inspect / deep-link auth UX~~
15. ~~Ops role split (`moderator`) + audit viewer + coach presence in sector detail~~

---

## Done when

Without Firebase console, ops can:

1. Find captains by name/uid and chats by word/date/sender  
2. Kick, mute, ban, delete evidence, terminate sectors  
3. Correct or void TEI with audit — and eventually cascade subsequent ratings  

---

## Notes

- Prefer extending `functions/` over new backends.
- Keep The Bridge free of ops chrome (except optional “report” entry points).
- Ban enforcement must cover **anonymous** Auth uids.
- Chat/name search will almost certainly need **denormalized search docs** or an external index; don’t pretend raw Firestore substring queries are enough.

### Resume here — TEI callables (paused mid-deploy)

**Code is in-tree and builds.** WarpOps Captains tab has TEI table + override + rated-match lookup/soft-void + **ledger inspect**.

| Callable | Purpose |
| --- | --- |
| `getOpsRatedMatch` | Load `ratedMatches/{MT-…}` for ops |
| `opsSetCaptainRating` | Manual μ/σ override (pools: human / squad / localAi / group); audit `tei_override` |
| `opsVoidRatedMatch` | Soft-void approved match: `voided` + strip claim ids + mark `ratingEvents`; **does not rewind μ/σ**; audit `tei_void_match` |
| `listCaptainRatingEvents` / `listMatchRatingEvents` | Inspect append-only ledger |
| `opsCascadeFromRatingEvent` | Scope A cascade (dryRun supported); marks event voided; rewrites personal timelines |
| `getCaptainDossier` | Enriched with claim arrays + fuller rating payload (redeploy with TEI) |

**Match ledger (`ratingEvents`)** — writers live beside TEI apply in:
`rated-matches.ts`, `report-online-match.ts`, `report-practice-ai.ts`. Rules: Admin SDK only. Indexes: `memberUids`+`playedAt`, `matchId`+`playedAt`.

**Deploy gotcha (expected):** org policy blocks Firebase setting `allUsers` invoker → deploy reports failure even when Cloud Run services exist. After deploy:

```bash
bash scripts/ensure-functions-public-invoker.sh
firebase deploy --only firestore:rules,firestore:indexes --project warp-12
yarn deploy:hosting:ops
```

**Next:** crews / logs polish (or further TEI cascade / season reset).

**Files:** `functions/src/tei/rating-ledger.ts`, `functions/src/ops/tei.ts`, `apps/WarpOps/src/firebase/tei-service.ts`, `apps/WarpOps/src/app/captains-panel.tsx`, rewrites in `scripts/firebase-callable-rewrites.json` + `firebase.json`.

### Resume here — integrity queue (review-only)

**In-tree.** Detectors never ban/mute/delete — they only open `moderationReports` with `source: 'system'`.

| Piece | Purpose |
| --- | --- |
| `openSystemIntegrityReport` | Idempotent system integrity queue writer |
| Escalate-lite (threshold 3) | N open player/auto reports → integrity item |
| `onRatingEventAbuseReview` | Same-cohort rematch heuristic → queue |
| Related-IP / install signals | `captainSignals` + `ipSightings` (+ optional `clientInstallId`) → queue |
| Shadow-mute | Ops-set `mode: 'shadow'`; hide via `shadowHidden` + rules |
| `getModerationEvidencePack` | JSON pack for human review |
| `opsUnrateOnlineSector` | Soft-unrate online sector without cascade |

**Deploy:** functions (callables + triggers) + `firestore:rules,firestore:indexes` + invoker script + `yarn deploy:hosting:ops`.

### Resume here — moderation reports + review terms

**In-tree.** Review-first only (never auto-ban/delete on term hits).

| Piece | Purpose |
| --- | --- |
| `submitModerationReport` | Bridge captain reports a sector message (rate-limited; evidence copied server-side) |
| `listModerationReports` / `updateModerationReport` | WarpOps Reports inbox |
| `getContentReviewConfig` / `updateContentReviewConfig` | Ops-editable chat / display-name / allowlist |
| `onMessageContentReview` / `onDisplayNameContentReview` | Firestore triggers → open `moderationReports` |
| Bridge `CommsPanel` Report | Player entry point |
| WarpOps **Reports** tab | Inbox + list editor + mute/delete actions |

**Deploy:** functions (callables + triggers) + `firestore:rules,firestore:indexes` + invoker script + `yarn deploy:hosting:ops` (+ Bridge hosting if report UI not live yet).

### `warp` CLI (today)

```bash
yarn warp ban <uid> --reason "…" [--ipv4 …] [--ipv6 …] [--days N] [--notes "…"] [--keep-auth]
yarn warp unban <uid|banId> [--keep-disabled]
yarn warp ban-status <uid|banId> | --ipv4 … | --ipv6 …
yarn warp ban-list [--all] [--limit N]
yarn warp roles <uid>                 # show claims
yarn warp roles <uid> --set admin[,moderator][,match_official]
yarn warp roles <uid> --clear
```

### Grant / revoke admin

1. **Preferred (ops already admin):** `yarn warp roles <uid> --set admin` (or callable `setUserRoles` from any signed-in admin). Moderators: `--set moderator`.
2. **First admin / recovery:** `bootstrapAdmin` callable with `BOOTSTRAP_ADMIN_SECRET` (see `functions/.env` / `scripts/bootstrap-admin-claims.mjs`).
3. Captains must **refresh claims** (sign out/in or Warp Ops “Refresh claim”) after role changes.
4. Roles live in Auth custom claims `{ roles: ['admin' | 'moderator' | 'match_official'] }` — never grant via Firestore client rules.
5. **Moderator** may mute/kick/reports/audit/soft-terminate/spectate; **admin** keeps bans (Auth disable), hard delete, hands peek, TEI mutate, season reset, review-term lists, charter mutate.

---

## Bridge + leaderboard product (before BrightDate)

Player-facing / public site — not Warp Ops chrome.

### Deep links & invitations
- [x] Shareable **deep links** for sector invitations — join as **player** or open as **spectator** (web + Tauri/mobile scheme where applicable)
- [x] Stable URL shapes (e.g. `/online/:gameId` play/join vs `/online/:gameId/watch`); copy/share from lobby and in-mission
- [x] Handle invite open when not signed in / wrong seat / spectate closed gracefully (anon auth wait; failed-auth panel; spectate-closed copy)

### In-game slash commands (Subspace)
- [x] Extensible **slash-command** path in comms (parse `/command …` before free-text send) — designed so more commands can land later without one-offs
- [x] First command: `/spectate` / `/spectator` / `/watch` replies with (and copies) the sector’s public watch link
- [x] Help / unknown-command UX; rated-play keeps free text blocked but allows local `/` commands

### Leaderboard home (iwdf.org)
- [x] **Active game counter** on the leaderboard home page (`countActiveSectors` public callable)

---

## Related Bridge product (not ops)

These are The Bridge / player-facing — track separately from Warp Ops.

### BrightDate display preference
- [x] Sitewide profile option: show all date/times as **BrightDates** ([brightdate.org](https://brightdate.org); npm `@brightchain/brightdate`)
- [x] Homage to Stardates / immersive federation feel — copy clear they are **not** Stardates (trademark / legal) and that BrightDates have real astronomical meaning (J2000.0 / TAI)
- [x] Recommend the option to users (profile first-time tip)
- [x] Wire TS lib in Bridge; keep ISO/locale as toggle fallback; use decimal BrightDate spans in the game log
