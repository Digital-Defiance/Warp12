# TEI Specification (Tactical Effectiveness Index)

**Status:** Normative — interoperable definition for Warp 12 and third-party multi-trail / Interstellar Dominoes platforms  
**Reference implementation:**

| Layer | Path |
|-------|------|
| Engine (math + grades) | `libs/engine/src/lib/rating/` (`openskill-adapter`, `anchors`, `tei-grade`, `tei-rank`, `update-ffa`, `update-team`, `update-vs-ai`) |
| Client storage / solo report | `apps/Warp12/src/firebase/stats-openskill.ts`, `stats-service.ts`, `rating-types.ts` |
| Cloud Functions | `functions/src/tei/`, `report-practice-ai.ts`, `report-online-match.ts`, `set-academy-placement.ts` |

**Supersedes:** v1.x Elo integer TEI (`R ∈ ℤ` near 1000–1800, K-factor schedule, Class I–IV from integer bands). There is **no** Elo compatibility shim; empty / reset databases are assumed.

Player-facing primer (no μ/σ): in-app **How TEI works** (`/tei`). Rules of play / eligibility language: `RULES.md` §VIII.

---

## 1. Purpose

TEI answers:

1. How strong is this captain on the **points** track (lowest campaign pip total wins)?
2. How strong is this captain on the **go-out** track (first empty hand wins the sector)?

**Source of truth** for updates is an **OpenSkill** rating `(μ, σ)` per rating bucket (Weng–Lin / TrueSkill-style Bayesian model via [`openskill`](https://openskill.me/)).

**Public display** is a **TEI grade** — letter + score, e.g. `V67` — derived from `(μ, σ)`. **Federation commission** (Cadet → Fleet Admiral) is a further presentation layer over that grade.

Third parties MAY implement this spec to:

- Publish interoperable leaderboards (compatible grade bands + optional μ/σ)
- Rate human-vs-human and human-vs-reference-AI matches
- Anchor AI opponent tiers to fixed `(μ, σ)` reference ratings
- Derive commission ranks from TEI grades

### 1.1 OpenSkill primer

| Symbol | Meaning |
|--------|---------|
| **μ (mu)** | Skill estimate (Gaussian mean). Higher = stronger. Default **25.0**. |
| **σ (sigma)** | Uncertainty (Gaussian std. dev.). Default **25/3 ≈ 8.333**. Falls with rated experience; can rise after long gaps or rule changes. |
| **Conservative skill** | `μ − 3σ` (clamped ≥ 0). Used for score normalization and cached `displayRating`. |
| **Ordinal (matchmaking)** | `μ − σ` (engine helper); OpenSkill’s stock `ordinal` is `μ − 3σ`. |
| **TEI letter** | Confidence band from **σ** (with unidirectional hysteresis). |
| **TEI score** | Integer **0–99** from normalized `μ − 3σ`. |

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| **Track** | One of `points` or `go-out` — ratings never cross tracks |
| **Match / sector** | One completed campaign with a defined victor by track rules |
| **Unassisted** | No tactical-advisor / coach assistance during rated play |
| **Anchor key σ** | Reference AI tier ∈ {`ensign`, `lieutenant`, `commander`} — engine identifier, **not** OpenSkill’s uncertainty symbol. In prose, prefer “profile” or “skill key” when ambiguous. |
| **Reference policy** | Deployed AI for that key. **Commander** is the Ω neural policy (`createOmegaPlayer`); Ensign / Lieutenant remain calibrated heuristic (or equivalent) policies. |
| **Reference anchor** | Fixed `PlayerRating` for `(track, skill key)` — never updated by match outcomes |
| **Human bucket rating** | Dynamic `PlayerRating` for a human in a specific storage bucket |
| **TEI grade** | `{ grade: E\|V\|C\|I\|P, score: 0–99, formatted: "V67" }` |
| **Commission** | Naval rank flavor derived from TEI grade path — not a second ladder |
| **Opponent / placement track** | Coarse Ensign / Lieutenant / Commander choice for Academy and solo AI buckets |
| **Flag Officer** | Prestige label for Rear Admiral and above (earned via TEI, not Academy-selectable) |

**Not TEI:** Seat role **Captain**; experimental **Class I\*** search; **Ω+** extended thinking (exhibition / unrated when used as opponent policy).

### 2.1 Frozen reference anchors

1. **Anchors are constants.** `getAIAnchor(track, skill)` returns fixed `(μ, σ, matches=999)`. Match updates **must discard** any OpenSkill output for AI seats.
2. **Commander = Ω (shipped).** Same storage key `commander` and player-facing **Commander** label; implementation is neural. Recalibration of `(μ, σ)` requires a new `rulesProfileId` / published anchor table — not silent drift.
3. **Search / Class I\* is not an anchor.** Rated practice against Class I\* is **rejected** (Cloud Function `reportPracticeAiMatch`). Ω+ is not a separate rated tier.
4. **Advisor never rates.** Invoking the tactical advisor disqualifies the match for TEI (§4 E3).

### 2.2 Ladder principles

| Principle | Rule |
|-----------|------|
| **TEI-first** | Stored state is `(μ, σ, matches)` (+ cached display fields). Letter, score, and commission are **views**. |
| **Human identity** | Solo play is **split by AI skill key** (`localAi[skill][track]`). Human-pool play is **one rating per track** (`humanRating[track]`), not split by fleet size (2–8). |
| **Anchor keys** | Stable: `ensign` \| `lieutenant` \| `commander`. Add weaker tiers via new keys + profile id; do not renumber human history. |
| **Display class** | Public **TEI grade** + **federation commission**. Do **not** map humans to “Class I–IV” from legacy integer thresholds. |
| **Crew charters** | Optional scoped `groupTei[charterId][track]` (§3.3). |
| **Rules profile** | Document the anchor table version (Warp 12: anchors calibrated **2026-07-12**, `ANCHORS_CALIBRATED = true`). |

---

## 3. Rating state

### 3.1 Types

```typescript
interface PlayerRating {
  mu: number;
  sigma: number;
  matches: number; // experience count in this bucket
}

type RatingTrack = 'goOut' | 'points'; // storage keys
type RatedObjective = 'go-out' | 'points';  // API / objective strings

/** Firestore / API stored form */
interface StoredRating {
  mu: number;
  sigma: number;
  matches: number;
  displayRating: number;      // cached max(0, μ − 3σ)
  displayGrade?: 'E'|'V'|'C'|'I'|'P'; // hysteresis memory
}
```

**Default new rating** (no Academy seed):

```
μ = 25.0
σ = 25 / 3 ≈ 8.333
matches = 0
displayRating = 0
```

### 3.2 Human vs reference AI (solo / practice)

For each human `p`, track `T`, and skill key `skill ∈ {ensign, lieutenant, commander}`:

```
rating_ref(p, T, skill)   — StoredRating (unassisted only)
wins_ref(p, T, skill)     — unassisted wins in bucket
N = rating.matches
```

Firestore (Firestore): `playerStats/{uid}.localAi[skill][T_key]` where `T_key ∈ {goOut, points}`.

**Display:** “TEI vs Commander (points)” reads that bucket’s rating → `getTeiDisplay(...)`.

### 3.3 Human vs human (online pool)

For each human `p` and track `T`:

```
rating_H(p, T)            — StoredRating
N_H = rating.matches
```

Storage: `playerStats/{uid}.humanRating[T_key]`.  
Idempotency: `humanRatedGameIds` (sector `gameId` applied at most once).

Online sectors are auto-rated via `reportOnlineMatch` when eligibility holds (§4). Mixed tables use context B (§10).

### 3.4 Group TEI — crew charters

Friend-group charters freeze `rulesProfileId`, objective `T`, fleet size `N`, campaign length. Rated events update scoped ratings:

```
groupTei[charterId][T_key].rating   — StoredRating
groupRatedIds                       — idempotency keys `${charterId}:${matchOrGameId}`
```

Update math is the same OpenSkill FFA pass as §6.3, reading opponents from the **same** crew bucket (humans) or fixed anchors (AI). Clients MUST NOT write these fields directly.

Default: private crew events update `groupTei` only. When `charterId = global-official`, apply **both** group and global human-pool updates (each against its own prior).

See [crews-roadmap.md](./crews-roadmap.md).

---

## 4. Rated match eligibility

A match `M` is **TEI-eligible** for captain `p` on track `T` iff all hold:

| Rule | Description |
|------|-------------|
| **E1 Objective** | Campaign objective is `T` (`points` or `go-out`) |
| **E2 Completion** | Campaign reached `phase = complete` with a defined victor (§5) |
| **E3 Unassisted** | Captain `p` did not use tactical advisor / coach on rated decisions |
| **E4 Set** | Double-twelve (**Warp 12**, `maxPip = 12`). Warp 9 / 15 / 18 are exhibition |
| **E5 Minimum field** | At least two captains finished the campaign |
| **E6 Opponents** | Every AI seat is Ensign / Lieutenant / Commander. **Class I\*** (or equivalent search exhibition) → whole match ineligible |
| **E7 Online integrity** | Online: `rated = true`; verified (non-anonymous) accounts for rated seats; hail-only free-form during live rated play (`RULES` §IX) |
| **E8 Modules** | No **Warped** house modules (e.g.\ Module Epsilon drafting, Module Kappa score inversion — `RULES` §VI). **Module Zeta (Squadrons):** rated when `SQUADRONS_RATING_CALIBRATED` — writes **squadRating** only (§6.5), never FFA `humanRating` |

**Ineligible:** advisor-assisted, sandbox/debug, aborted, casual/unrated, nonstandard house profiles (implementation-defined), Class I\* / Ω+ as rated opponents, Warped modules, squadron sectors while the squad-rating gate is off.

---

## 5. Match outcome and standings

### 5.1 Binary win (two-captain)

- **`points`:** lowest `pointsScore` after campaign rounds  
- **`go-out`:** first empty hand (`roundWinnerId`)

### 5.2 Multi-captain ranks

Assign competition rank `rank(p)` with **1 = best**.

- **Points:** ascending `pointsScore`; ties share ranks (1,2,2,4…).
- **Go-out:** victor rank 1; others MAY order by remaining hand size or share rank 2.

OpenSkill `rate(..., { rank })` consumes these ranks directly (no separate pairwise Elo pass).

---

## 6. Core update mathematics

### 6.1 Library

Warp 12 uses the **`openskill`** JavaScript package with default dynamics:

| Option | Typical default | Role |
|--------|-----------------|------|
| `beta` | ≈ 4.167 | Skill-class width |
| `tau` | ≈ 0.0833 | Dynamics / skill drift |

Warp currently passes **library defaults** (`DEFAULT_OPTIONS` empty). Custom options MAY be versioned later under a new rules profile.

Convert:

```
toOpenSkillRating(r) → { mu, sigma }
rate(teams, { rank }) → updated teams
fromOpenSkillRating(r, prevMatches) → { mu, sigma, matches: prevMatches + 1 }
```

### 6.2 Solo vs reference AI

```
teams = [ [human], [anchor] ]
ranks = humanWon ? [1, 2] : [2, 1]
updated = rate(teams, { rank: ranks })
human' = fromOpenSkillRating(updated[0][0], human.matches)
# discard updated[1] — anchor is immutable
```

Reference: `updateVsAI(...)`.

### 6.3 Free-for-all (human table)

Each captain is a team of one:

```
teams = players.map(p => [p.rating])
ranks = players.map(p => p.rank)
updated = rate(teams, { rank: ranks })
```

Reference: `updateFFARatings(...)`.

### 6.4 Mixed human + AI (online context B)

Build one FFA list of humans (live ratings) and AI (anchors). Run `rate` on the full field; **persist only human** rows. If any seat is Class I\* / search-exhibition, **do not rate** the sector.

Reference: `updateMixedTable(...)` / `reportOnlineMatch`.

### 6.5 Team / squadron updates (Module Zeta)

OpenSkill natively rates **teams of multiple captains**. Engine API:

```
teams = [ { members: [{ id, rating }, …], rank }, … ]
updated = updateTeamRatings(teams)  // Map<playerId, PlayerRating>
```

Each squad is one OpenSkill team; individual μ/σ still move (per-seat credit within the team). Convenience: `updateTwoTeamMatch(teamA, teamB, teamAWon)`.

**Shipping gate:** `SQUADRONS_RATING_CALIBRATED` in `anchors.ts` is **`true`** (2026-07-13). Eligible Zeta sectors write OpenSkill updates to **`squadRating`** via `updateTeamRatings` / `apply-squad-tei`. While the flag is false, Cloud Functions MUST NOT apply squadron TEI — play stays exhibition. Calibration: points 2v2 Cmdr vs Lt ≈62% (FFA parity), Cmdr vs Ensign ≈88%; luck/skill matrix ~2.94/4 skill-promote.

Until then, FFA human-pool and solo vs-AI remain the only rating paths.

### 6.6 Initial rating and Academy seed

Before first rated match in a bucket (`matches = 0`):

```
R_effective = R_stored if matches > 0
            else R_academy if startingRating[T] set
            else DEFAULT_RATING
```

**Academy (shipped):** `setAcademyPlacement(objective, skill)` copies **`getAIAnchor(track, skill)`** into `startingRating[T_key]` once per track (server-authoritative). UI commission tracks:

| Placement track | Illustrative TEI band (RULES / UI) |
|-----------------|-------------------------------------|
| Ensign | P0–I25 |
| Lieutenant | I25–C45 |
| Commander | C45–V70 |

Exact seed `(μ, σ)` = the anchor table (§7.1), not a free-typed integer.

After `matches > 0`, academy seed is ignored for that bucket.

**Skipped Academy:** first unassisted rated match begins at `DEFAULT_RATING` (displays ≈ **P0**).

---

## 7. Constants and derived labels

### 7.1 Reference AI anchors (fixed)

Calibrated **2026-07-12** (`INITIAL_ANCHORS` / `getAIAnchor`).

#### Points

| Skill key | μ | σ |
|-----------|---|---|
| `ensign` | **18.0** | **4.0** |
| `lieutenant` | **26.5** | **3.5** |
| `commander` | **35.0** | **3.0** |

#### Go-out

| Skill key | μ | σ |
|-----------|---|---|
| `ensign` | **17.5** | **4.5** |
| `lieutenant` | **28.0** | **4.0** |
| `commander` | **41.5** | **3.5** |

Anchors use elevated `matches` (999) as a sentinel; they never update.

### 7.2 TEI grade from `(μ, σ)`

#### Letter (confidence from σ)

Immediate promotion thresholds (`σ < …`):

| Letter | Name | Promote when | Demote exit (hysteresis) |
|--------|------|--------------|---------------------------|
| **E** | Elite | σ &lt; 0.5 | σ &gt; 0.7 |
| **V** | Veteran | σ &lt; 1.5 | σ &gt; 1.7 |
| **C** | Consistent | σ &lt; 2.5 | σ &gt; 2.7 |
| **I** | Improving | σ &lt; 4.0 | σ &gt; 4.5 |
| **P** | Provisional | otherwise | — |

**Unidirectional hysteresis:** promotions apply immediately; demotions wait until σ exceeds the **exit** threshold for the current letter. Persist `displayGrade` on `StoredRating` and pass it into `getTeiGrade(σ, currentGrade)`.

`isTeiProvisional(rating)` ⇔ `σ ≥ 4.0` (P-band).  
Optional UI badge for high uncertainty: engine also exposes `PROVISIONAL_SIGMA_THRESHOLD = 6.0` (`σ > 6`).

#### Score (0–99)

```
conservative = μ − k · σ          // k = 3
score = clamp( round( (conservative − minMu) / (maxMu − minMu) · 99 ) , 0, 99 )
```

Default config (`DEFAULT_TEI_CONFIG`):

```
minMu = 10.0
maxMu = 50.0
conservativeK = 3.0
```

Formatted: `` `${grade}${score}` `` → `V67`. Same score ≈ same conservative skill across letters (`I40` ≈ `C40` skill; C is more settled).

### 7.3 Federation commission (display only)

Derived from TEI path **P &lt; I &lt; C &lt; V &lt; E**, then score ascending. **Elite uses Veteran score thresholds** for banding (so E73 sits with high admiralty).

| Commission | Short | From (inclusive) |
|------------|-------|------------------|
| Cadet | Cdt. | P0 |
| Ensign | Ens. | P25 |
| Lieutenant Junior Grade | Lt. JG | I25 |
| Lieutenant | Lt. | I40 |
| Lieutenant Commander | Lt. Cmdr. | C45 |
| Commander | Cmdr. | C55 |
| Commodore | Cdore. | V63 |
| Rear Admiral | R. Adm. | V70 |
| Vice Admiral | V. Adm. | V80 |
| Admiral | Adm. | V90 |
| Fleet Admiral | F. Adm. | V99 |

**Flag Officer** = Rear Admiral and above. Not selectable at Academy.

Reference: `getTeiRank` / `TEI_RANKS` in `tei-rank.ts`.

### 7.4 Opponent tracks vs personal commission

| Concept | Values | Role |
|---------|--------|------|
| Opponent / Academy track | Ensign / Lieutenant / Commander | Solo buckets + placement |
| Personal commission | Cadet … Fleet Admiral | Flavor over TEI grade |
| Flag Officer | R.Adm+ | Prestige subset of commission |

---

## 8. Conformance checks

Implementations SHOULD pass (tolerance ±0 for integers; ±1e-6 relative for floats where noted).

### 8.1 TEI score / grade (no update)

Using `DEFAULT_TEI_CONFIG` and immediate grades (no prior `displayGrade`):

| μ | σ | Grade | Score | Notes |
|---|---|-------|-------|-------|
| 25.0 | 8.333 | **P** | **0** | Default new player |
| 30.0 | 2.0 | **C** | **35** | |
| 35.0 | 1.2 | **V** | **53** | |
| 40.0 | 0.4 | **E** | **71** | |

### 8.2 Hysteresis

Rating at `σ = 1.6` with current grade **V**: remains **V** (exit is 1.7).  
Same rating with current grade **C**: immediate grade is **V** → promote to **V**.

### 8.3 Anchor immutability

After `updateVsAI(human, anchor, …)`, only the human `(μ, σ, matches)` changes; the returned AI seat MUST NOT be written back over `getAIAnchor`.

### 8.4 OpenSkill directionality (smoke)

Equal prior ratings, two players: winner’s μ increases; both σ decrease. Exact deltas depend on library version — pin `openskill` and compare against Warp’s `update-ffa.spec.ts` / `update-vs-ai` tests rather than hardcoded Elo integers.

---

## 9. Leaderboard and percentile display

### 9.1 Sorting

Prefer sort keys:

1. Public: TEI **path** (letter order P→E, then score), or cached `displayRating` (`μ − 3σ`) for numeric boards  
2. Advanced / research: raw μ with σ shown when **Advanced Rating Statistics** is on

Do **not** publish legacy Elo integers.

### 9.2 Percentile

For rank `r` of `N` rated captains on the same board:

```
displayPercentile = max(1, min(100, round(100 · r / N)))
label = "Top {displayPercentile}%"
```

Go-out **MUST** show a percentile (or equivalent) alongside TEI — racing variance compresses skill gaps. Points **SHOULD** when `N` is large.

**Cross-track rule:** `V67` points and `V67` go-out are **not** the same mastery. UI MUST label the track.

### 9.3 Provisional / low sample

When letter is **P** or `matches` is low, prefer provisional labeling and cohort percentile over absolute mastery claims. Academy seed is not a “win” until `matches > 0`.

---

## 10. Mixed tables (AI + human)

| Policy | Rule |
|--------|------|
| **P1 Local training** | Rate human vs the reference skill key played (`updateVsAI` / per-bucket `localAi`) |
| **P2 Online humans-only** | FFA OpenSkill on live human ratings (§6.3) |
| **P3 Online mixed (context B)** | Rank full table; AI seats use fixed anchors; persist humans only. Exclude sector if any Class I\* / unverified human / advisor foul |

Context B keeps the online pool on the same absolute scale as solo anchors.

---

## 11. Worked example — four-human points campaign

**Field:** Armstrong, Lovell, Earhart, Yeager — 13-round points, unassisted.

| Captain | pointsScore | rank |
|---------|-------------|------|
| Armstrong | 42 | 1 |
| Lovell | 58 | 2 |
| Earhart | 61 | 3 |
| Yeager | 79 | 4 |

**Priors (illustrative):** each holds a `StoredRating` on `humanRating.points`.  
**Update:** `updateFFARatings([{ id, rating, rank }, …])` → write new `StoredRating` including refreshed `displayRating` and `displayGrade` via `getTeiDisplay(rating, previousDisplayGrade)`.

Exact μΔ depends on priors and the pinned `openskill` version; golden vectors live in engine specs.

---

## 12. Reference code map

| Spec section | Warp 12 module |
|--------------|----------------|
| §6.1–6.4 | `libs/engine/.../openskill-adapter.ts`, `update-ffa.ts`, `update-vs-ai.ts` |
| §6.5 Teams / Zeta gate | `update-team.ts`, `anchors.ts` (`SQUADRONS_RATING_CALIBRATED`), `functions/.../apply-squad-tei.ts` |
| §6.6 Academy | `functions/src/set-academy-placement.ts` |
| §7.1 | `libs/engine/.../anchors.ts` |
| §7.2 | `libs/engine/.../tei-grade.ts` |
| §7.3 | `libs/engine/.../tei-rank.ts` |
| Solo report | `functions/src/report-practice-ai.ts` |
| Online report | `functions/src/report-online-match.ts` |
| Storage types | `apps/Warp12/src/firebase/rating-types.ts`, `functions/src/tei/rating-types.ts` |
| Player page | `/tei`, Profile Advanced Rating Statistics |

---

*Digital Defiance / Warp 12 — research paper: [`tei-paper.tex`](./tei-paper.tex) / [`tei-paper.pdf`](./tei-paper.pdf); calibration notes under `docs/`. Player explainer: app route `/tei`.*
