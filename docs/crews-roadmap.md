# Crews & charters — product roadmap

**Status:** Phases 1–4 **shipped** (2026-07)  
**Audience:** product, engineering, officiation volunteers  
**Related:** [TEI specification](./tei-spec.md) · [Rated matches](./rated-matches.md) · [Security model](./security-model.md) · [RULES.md §VIII](../RULES.md)

---

## Purpose

Warp 12 aims to be the **reference implementation** for serious Mexican Train: **Official rules**, open **TEI**, and tooling people trust. Global ladders alone do not match how dominoes is played — every table has house rules, fleet size, and a regular circle of friends.

**Crews** (friend groups) with **charters** (declared rules + objective + fleet size) are the primary social competition layer. **Global Official** is the same machinery with open membership and a frozen preset — the public standard.

| Capability | Status | Where |
|------------|--------|-------|
| [TEI calculator](https://leaderboard.warp12.app/calculator) crew preview | Shipped | `/calculator` — optional crew pool dropdown |
| [Rated matches](./rated-matches.md) + `charterId` | Shipped | Officiate crew selector → `groupTei` on approve |
| Online sectors + `charterId` | Shipped | Bridge lobby crew picker → `reportOnlineMatch` |
| `groupTei` on `playerStats` | Shipped | `libs/tei-core`, Cloud Functions |
| Global `humanTei` | Shipped (unchanged) | Updated only when match uses **Global Official** charter |
| `WARP12_OFFICIAL_*` preset | Shipped | `rulesProfileId: warp12-official-v1` on charters |
| Leaderboard filters (Global Official · N · objective) | Shipped | `/leaderboard` default tab |
| Season label on Global Official charter | Shipped | `seasonLabel` on charter doc |
| Season soft reset (admin) | Shipped | `resetGlobalOfficialSeason` + lazy bucket rollover |
| `CREW-` short invite codes | Shipped | UI on crews page + owner panel |
| Listed / discoverable crews | Shipped | Request + owner approve |

---

## Concepts

| Term | Meaning |
|------|---------|
| **Crew** | A persistent group of signed-in captains (friends, club night, league). |
| **Charter** | The crew’s frozen competitive contract: rules profile, objective, fleet size, default campaign length. |
| **Rules profile** | Versioned ID (e.g. `warp12-official-v1`) for modules + house rules. Rated play must match. |
| **Group TEI** | TEI earned only from matches that satisfy the charter; stored per `(uid, charterId, objective)`. |
| **Global Official** | Special open charter (`global-official`): Official preset, open membership; rated play updates **both** `groupTei` and global `humanTei`. |

**Charter line (UX):** *“Oak Street Crew — Official Warp 12 · 4 captains · Points · 13 rounds”*

---

## What people will believe in

- **Charter visible** before rated play — no surprise eligibility.
- **Unrated is normal** — wrong fleet size, guest at the table, advisor use, experimental AI → casual sector, no shame.
- **Provisional** until ~10 rated games in that crew bucket (reuse K-factor / TEI spec §9 guidance).
- **Percentile + Tactical Class** on crew boards (Phase 3 UI); raw TEI on drill-down today.
- **No shared crew password** — membership is account-based (see below).

Mexican Train will not unify on one kitchen-table ruleset. It *can* unify on: **“when we play for rating, we play Official Warp 12 under a declared charter.”**

---

## Membership & access (normative for v1)

**No crew passwords.** Passwords leak, do not identify individuals, and break TEI integrity.

| Mechanism | Status | Use |
|-----------|--------|-----|
| **Google sign-in** | Shipped | Required to join a crew and appear on its ladder |
| **Invite link** | Shipped | `leaderboard.warp12.app/crews/{slug}/join?token=…` — SHA-256 hashed server-side, revocable via `rotateCharterInvite` |
| **Short invite code** | Shipped | `CREW-7K3Q` for in-person handoff (same pattern as `MT-7K3Q`) |
| **Owner** | Shipped | Creates crew; rotates invites; cannot leave while other members remain without transferring ownership |

**Private crews (default):** join only via invite link.  
**Listed crews:** discoverable name; join via request + owner approve or invite.  
**Guests:** may play at the physical or online table; they do **not** join the crew ladder ([RULES.md §VIII](../RULES.md)).

---

## Rating layers (implemented architecture)

```
Layer 1 — Crew ladder (primary social)          [SHIPPED]
  Scope: charter members, matching rulesProfileId + objective + playerCount
  Updates: groupTei[charterId]
  Sources: officiated matches, online sectors

Layer 2 — Solo vs reference AI                  [SHIPPED — unchanged]
  Scope: unassisted practice vs Class II–IV anchors
  Updates: localAi[σ][track]

Layer 3 — Global human pool                     [SHIPPED]
  Scope: all verified humans, one TEI per track
  Updates: humanTei[track]
  Private crew matches do NOT double-write here

Layer 4 — Global Official                       [PARTIAL — Phase 3]
  Open charter: warp12-official-v1 + declared N + objective
  Shipped: charter seed, join, double-write on rated officiated + online sectors
  Next: leaderboard primary filters, season labels, soft reset
```

**Table size:** one fleet size per crew charter (e.g. always 4). Bands or multiple charters per crew are Phase 4+.

**Fair comparison:** multi-player strength uses pairwise ranks (TEI spec §6.5). Crew TEI uses the same math as the [calculator](https://leaderboard.warp12.app/calculator).

---

## Rules profiles

v1 ships one profile:

| ID | Label | Source |
|----|-------|--------|
| `warp12-official-v1` | Official Warp 12 | `WARP12_OFFICIAL_MODULES` + `WARP12_OFFICIAL_HOUSE_RULES` |

Custom crew house rules are **out of scope** — reduces “our ladder isn’t comparable” disputes.

Future: `warp12-official-v2` when preset changes; old charters pin to v1 until migrated.

---

## Firestore shape (implemented)

### `charters/{charterId}`

```typescript
interface CharterDocument {
  charterId: string;
  slug: string;                    // URL: /crews/oak-street
  name: string;
  rulesProfileId: 'warp12-official-v1';
  objective: 'points' | 'go-out';
  playerCount: number;             // 2–8
  campaignRounds: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberUids: string[];
  inviteTokenHash?: string;
  isGlobalOfficial?: boolean;      // true for global-official only
}
```

`charterMembers/{charterId}_{uid}` — membership index for “my crews” queries.

### `playerStats/{uid}` (extended)

```typescript
groupTei?: Record<string, { points?: ObjectiveTeiStats; goOut?: ObjectiveTeiStats }>;
groupRatedIds?: string[];          // idempotency: `${charterId}:${matchCode|gameId}`
```

Clients **cannot** write `groupTei` — same trust boundary as `humanTei` ([security model](./security-model.md)).

### `ratedMatches/{code}` and `games/{gameId}` (extended)

```typescript
charterId?: string;
rulesProfileId?: string;
playerCount?: number;              // on rated matches when charter set
```

Approval / `reportOnlineMatch` validates: metadata matches charter; all human uids ∈ `memberUids`.

---

## Cloud Functions (implemented)

| Callable | Notes |
|----------|-------|
| `createCharter` | Owner sets name, slug, objective, playerCount, rulesProfileId |
| `joinCharter` / `leaveCharter` | Invite token or open join for Global Official |
| `listMyCharters` / `getCharter` / `getCharterLeaderboard` | Nav, crew pages, ladder |
| `rotateCharterInvite` | Owner rotates invite hash |
| `createRatedMatch` | Optional `charterId`; pre-fills objective/rounds/N from charter |
| `approveRatedMatch` | `groupTei` when `charterId` set; also `humanTei` when Global Official |
| `reportOnlineMatch` | Charter eligibility + `groupTei`; idempotent via `groupRatedIds` |

Implementation: `functions/src/charters.ts`, `functions/src/tei/apply-group-tei.ts`.

---

## Leaderboard SPA routes

| Route | Status | Content |
|-------|--------|---------|
| `/crews` | Shipped | My crews, create crew |
| `/crews/:slug` | Shipped | Charter summary + group leaderboard |
| `/crews/:slug/join` | Shipped | Invite redemption |
| `/officiate` | Shipped | Crew selector when creating match |
| `/calculator` | Shipped | Crew preview pool dropdown |
| `/leaderboard` | Partial | Links to crews; filters in Phase 3 |

---

## Implementation phases

### Phase 1 — Crew primitive + officiated path ✅

**Shipped 2026-07.** Friend group runs a rated night; private crew TEI moves; global pool unchanged.

- `rulesProfileId` in `libs/tei-core` / `functions/src/tei`
- `charters` + callables + Firestore rules
- `approveRatedMatch` → `groupTei`
- Crew pages, calculator crew preview, docs

**Dogfood metric:** one real club runs 3+ approved charter matches end-to-end (post-deploy).

---

### Phase 2 — Online sectors for crews ✅

**Shipped 2026-07.**

- `charterId` on game documents (`game-service` / lobby)
- `reportOnlineMatch` charter validation + group TEI
- Bridge lobby crew picker; sector-complete crew TEI display
- `groupRatedIds` idempotency

---

### Phase 3 — Global Official ladder ✅ (UI shipped)

**Goal:** Public “Warp 12 standard” board without replacing friend crews.

| Item | Status |
|------|--------|
| `global-official` charter seed | Shipped |
| Open membership (`joinCharter` without token) | Shipped |
| Double-write `groupTei` + `humanTei` on rated sectors | Shipped |
| Opt-in on officiated + online rated sectors | Shipped |
| Leaderboard **Global Official** tab (default), objective + fleet filters | Shipped |
| `seasonLabel` on charter (`2026 Spring`) | Shipped |
| Per-N Global Official charters (`global-official-6p`, …) | Shipped (4p, 6p, 8p) |
| Admin season soft-reset callable | Shipped |

---

### Phase 4 — Ecosystem (shipped)

- Match certificate JSON export (standings + charter + deltas) — issued on approval
- `CREW-` short invite codes in UI (crews page join + owner panel)
- Listed crews with approve-to-join
- Profile page: crew TEI drill-down; match detail charter line
- Owner invite rotation in crew detail UI
- TEI spec §3.3 published as **Warp 12–compatible group TEI** for third-party apps
- Annual Official championship (exhibition tier — future)

---

## Relationship to Omega / AI tiers

- Class **Ω** and **I\*** remain **unrated** in crew and global ladders until promotion ([RULES.md §VIII](../RULES.md), [tei-spec](./tei-spec.md)).
- Crew matches: AI seats Class II–IV only (same as online human pool).
- Omega bench `fairShareRatio` is **not** crew TEI — it gates when Ω becomes a future reference anchor.

---

## Decisions (closed)

1. **Double-write:** Private crews → `groupTei` only. **Global Official** → `groupTei` **and** `humanTei`. UX explains both on sector complete and calculator preview.
2. **Co-official:** Any `match_official` role holder can create `MT-` codes; crew attachment requires official to be a charter member when `charterId` is set.
3. **Slug collisions:** globally unique `slug`; display `name` may duplicate.
4. **Minimum field:** crew rated match requires ≥2 checked-in members (same as global rated matches).

---

## References in repo

| Area | Path |
|------|------|
| TEI pairwise math | `libs/tei-core/src/stats-elo.ts` |
| Apply group TEI | `libs/tei-core/src/apply-group-tei.ts`, `functions/src/tei/apply-group-tei.ts` |
| Charter callables | `functions/src/charters.ts` |
| Rated matches | `functions/src/rated-matches.ts` |
| Online TEI | `functions/src/report-online-match.ts` |
| Leaderboard UI | `Warp12-leaderboard/src/app/pages/crews-*.tsx`, `officiate-page.tsx` |
| Bridge lobby | `apps/Warp12/src/app/online-lobby-page.tsx` |
| Calculator | `Warp12-leaderboard/src/lib/human-tei-calculator.ts` |
| Official preset | `apps/Warp12/src/game/warp12-preset.ts` |
| Normative TEI | `docs/tei-spec.md` §3.3 |

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-06 | Initial roadmap |
| 2026-07-06 | Phases 1–2 shipped; Phase 3 partial; Phase 4 scoped as next ecosystem work |
| 2026-07-06 | Season 5: per-fleet Global Official (4/6/8p), admin soft-reset |
