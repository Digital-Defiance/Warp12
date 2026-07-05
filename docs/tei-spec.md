# TEI Specification (Tactical Effectiveness Index)

**Version:** 1.1  
**Status:** Normative — interoperable definition for Warp 12 and third-party Mexican Train platforms  
**Reference implementation:** `apps/Warp12/src/firebase/stats-elo.ts`, `functions/src/tei/stats-elo.ts` (Warp 12 v1.1)

---

## 1. Purpose

TEI is a **skill rating system** for Mexican Train / Warp 12 captains. It answers:

1. How strong is this captain on the **points** track (lowest campaign pip total wins)?
2. How strong is this captain on the **go-out** track (first empty hand wins the sector)?

TEI is **Elo-compatible**: ratings are integers, updates use the standard logistic expected-score function, and a 400-point gap implies roughly a 10:1 expected win ratio in head-to-head play.

Third parties MAY implement this spec to:

- Publish interoperable leaderboards
- Rate human-vs-human domino matches
- Anchor AI opponent tiers to fixed reference bands
- Derive display **Tactical Class I–IV** from rating

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| **Track** | One of `points` or `go-out` — ratings never cross tracks |
| **Match** | One completed **campaign** (sector): agreed round count, one victor by track rules |
| **Unassisted** | No tactical-advisor / coach assistance during rated play |
| **Reference profile** | AI tier σ ∈ {`ensign`, `lieutenant`, `commander`} ≡ Class {IV, III, II} |
| **Reference policy** | The **uniform, unsearched heuristic policy stack** for σ: greedy candidate generation over engine-legal moves, scored by the fixed `SkillProfile` + heuristic weights for that tier — **no determinized lookahead, no MCTS/expectimax, no learned residual** |
| **Reference TEI** | Fixed constant rating assigned to a reference profile (not updated) |
| **Search-enabled opponent** | Player-facing bot that adds deep search on top of σ = `commander` heuristics — e.g. **Class I\***, **Fleet Admiral** — still buckets under σ for storage but applies a **search premium** (§7.1.2) in the update loop |
| **Human TEI** | Dynamic rating for a human captain on a track |
| **K-factor** | Elo step size; decreases with experience |
| **Search premium** | Non-negative integer Δ added to `REF_TEI(T, σ)` when the rated opponent used deep search (§7.1.2) |

**Not TEI:** Chain-of-command rank names (Ensign / Lieutenant / Commander) in fiction — those map to AI simulation tiers only. Human **Tactical Class I** is earned by TEI ≥ 1450, not by title.

### 2.1 Frozen reference anchors (normative)

Reference TEI bands (§7.1) are calibrated against **reference policies only**.

1. **Heuristic-only execution.** Each σ MUST be implemented as the baseline greedy loop: `warpCandidateGenerator` (or equivalent) → heuristic scoring → skill-shaped selection. Class IV–II self-play calibration, paper benchmarks, and anchor spacing assume this stack.
2. **Search is not an anchor.** Expectimax, ISMCTS, Fleet Admiral benches, and Class I\* residual models MAY be stronger than σ = `commander` heuristics; they MUST NOT retroactively change `REF_TEI(T, σ)`.
   - **Class Ω (self-play neural, experimental).** A standalone policy/value network trained purely from self-play outcomes — no heuristic imitation, no Commander target. It is **not** a reference band in v1.1: matches against it are unrated (§4), exactly like Class I\*. If it clears the promotion bar (§9.5 of the paper: demonstrably above Class II with statistical significance across player counts and both objectives), a future spec version MAY add a fixed `REF_TEI(T, omega)` anchor (provisional target ~1700 points) — as a **new** band, never by moving Class IV–II constants.
3. **Search is a rated modifier.** When a human plays an unassisted rated match against a **search-enabled** local opponent, the opponent rating used in §6.4 is `REF_TEI(T, σ) + Δ_search` — not the raw anchor alone.
4. **Advisor is never rated.** Tactical advisor / coach suggestions disqualify the match (§4 E3) regardless of opponent policy.

Implementations that ship search-enabled practice opponents without applying Δ_search will **deflate** human TEI (wins count as upsets vs an under-rated opponent). Warp 12 v1.1 normatively requires the premium where search is enabled.

---

## 3. Rating state

### 3.1 Human vs reference AI (Warp 12 v1 — implemented)

For each human captain `p`, track `T`, and reference profile σ, maintain:

```
R_ref(p, T, σ)     — integer TEI (default 1000 before seeding)
N_ref(p, T, σ)     — count of unassisted rated matches in this bucket
W_ref(p, T, σ)     — unassisted wins in this bucket
```

Storage shape (Firestore): `localAi[σ][T_key].unassistedTei` where `T_key ∈ {goOut, points}`.

**Display rule:** When showing “your TEI vs Class II”, read `R_ref(p, T, commander)`.

### 3.2 Human vs human (TEI v1 — implemented in Warp 12)

For each human captain `p` and track `T`, maintain a **pool rating**:

```
R_H(p, T)          — integer TEI
N_H(p, T)          — unassisted rated human-opponent matches
```

Storage shape (Firestore): `humanTei[T_key].unassistedTei`, idempotency via `humanRatedGameIds`.

Storage is idempotent per sector: a `gameId` recorded in `humanRatedGameIds` is never rated twice.

**Warp 12 v1.1 (2026):** Human-pool TEI for offline play uses officiated `ratedMatches` on the leaderboard — see [rated-matches.md](./rated-matches.md).

**Warp 12 v1.2 (2026):** Online sectors are auto-rated into the human pool. A completed sector is reported to the `reportOnlineMatch` Cloud Function, which re-derives the standings from the authoritative game document, re-verifies every seat, and applies §6.5 under **context B** (§10, P3). Eligibility (§4) requires two or more **verified** (non-anonymous) human captains, only Class II–IV AI at the table, and — per the unassisted rule (§4 E3) — that no captain consulted the tactical advisor (detected via the `games/{gameId}/presence` coach records). Advisor use by any single captain leaves the whole sector unrated.

---

## 4. Rated match eligibility

A match `M` is **TEI-eligible** for captain `p` on track `T` iff all hold:

| Rule | Description |
|------|-------------|
| **E1 Objective** | Campaign objective is `T` (`points` or `go-out`) |
| **E2 Completion** | Campaign reached `phase = complete` with a defined victor (§5) |
| **E3 Unassisted** | Captain `p` did not use tactical advisor / coach on any rated decision |
| **E4 Standard rules** | Same rules engine + house-rule profile as declared for the leaderboard (implementations SHOULD version their profile ID) |
| **E5 Minimum field** | At least two captains finished the campaign |
| **E6 Comms integrity** | Online: the sector's `rated` flag is `true` (host did not opt out); free-form messaging was restricted to quick-phrase hails during active play (§IX RULES.md) |

**Ineligible:** advisor-assisted games, sandbox/debug, aborted campaigns, casual (unrated) sectors, practice with custom non-standard rules (implementation-defined).

---

## 5. Match outcome and standings

### 5.1 Binary win (two-captain field)

Captain `p` **wins** iff `p` is the unique victor:

- **`points`:** lowest `pointsScore` after all campaign rounds
- **`go-out`:** `roundWinnerId` (first empty hand in the deciding round)

Score for Elo: `S_p = 1` if win, `S_p = 0` if loss.

### 5.2 Multi-captain standings (human domino table)

Let `P = {p₁,…,pₙ}`, `n ≥ 2`. Assign each captain a **competition rank** `rank(p) ∈ {1,…,n}` where **1 = best**.

**Points track:** sort by final `pointsScore` ascending (lower is better). Ties share rank (competition ranking: 1,2,2,4…).

**Go-out track:** victor has rank 1. Non-victors MAY be ordered by remaining hand size (fewer tiles = better rank) or assigned a shared rank 2 if only the winner matters for your UI.

**Pairwise score** between distinct captains `p` and `q`:

```
S(p, q) = 1   if rank(p) < rank(q)
        = ½   if rank(p) = rank(q)
        = 0   if rank(p) > rank(q)
```

---

## 6. Core update mathematics

### 6.1 Expected score (Elo logistic)

For ratings `R_a`, `R_b`:

```
E(R_a, R_b) = 1 / (1 + 10^((R_b - R_a) / 400))
```

**Reference implementation:**

```typescript
function expectedEloScore(playerTei: number, opponentTei: number): number {
  return 1 / (1 + 10 ** ((opponentTei - playerTei) / 400));
}
```

### 6.2 K-factor schedule

Experience count `N` = unassisted matches already played in the bucket **before** this match:

```
K(N) = 40   if N < 10
     = 32   if 10 ≤ N < 30
     = 24   if N ≥ 30
```

### 6.3 Single-opponent update (head-to-head)

Given current rating `R`, opponent rating `R_opp`, actual score `S ∈ {0, 1}` (or fractional for ties), experience `N`:

```
R' = round(R + K(N) · (S − E(R, R_opp)))
```

**Reference implementation:** `updateTeiScore(playerTei, opponentTei, score, k)`.

### 6.4 Reference-opponent update (vs AI tier σ)

Used when the only rated opponent is reference profile σ on track `T`:

```
R_opp = REF_TEI(T, σ) + Δ_search(T, context)     — §7.1 + §7.1.2
S     = 1 if human won campaign, else 0
N     = N_ref(p, T, σ)
R'    = round(R + K(N) · (S − E(R, R_opp)))
```

Then set `N ← N + 1`, update win count if `S = 1`.

**Search context** `context` MUST record at minimum: `{ searchEnabled: boolean, objective: T, playerCount: n, searchEngine?: 'none' | 'expectimax' | 'ismcts' }`.

**Class I\* / Fleet Admiral:** Opponent still buckets under σ = `commander` for storage (`localAi.commander`). Set `opponentClass1Star: true` (or equivalent) in match metadata. When `searchEnabled = true`, apply Δ_search from §7.1.2 — **do not** treat search strength as a new reference profile or move `REF_TEI`.

**Example (normative):** 2-player points campaign vs Class I\* with expectimax → `R_opp = 1400 + 100 = 1500`. A human at `R = 1400` who wins ~50% is correctly rated near Commander anchor strength against a search opponent, not deflated as if they beat a 1400 heuristic bot.

### 6.5 Multi-opponent pairwise update (human table)

For captain `p` with current human-pool rating `R_p`, rank `rank(p)`, and opponents `q ≠ p` with ratings `R_q`:

```
Δ_p = (K(N_p) / (n − 1)) · Σ_{q ≠ p} ( S(p,q) − E(R_p, R_q) )

R_p' = round(R_p + Δ_p)
```

Each captain in `P` is updated using their own `N_p` and `K(N_p)`.

**Two-player case:** reduces to §6.3 with `R_opp = R_q` and `S = S(p,q)`.

**Reference implementation:** `updateTeiMultiplayerPairwise(...)`.

### 6.6 Initial rating and Academy seed

Before the first rated match in a bucket (`N = 0`):

```
R_effective = R_stored ?? R_academy ?? 1000
```

- **`R_academy`:** optional one-time self-reported seed per track (Starfleet Academy), clamped to band for chosen profile (§7.3)
- **`1000`:** `DEFAULT_UNASSISTED_TEI`

After the first rated match (`N > 0`), `R_stored` MUST be used; academy seed is ignored.

---

## 7. Constants and derived labels

### 7.1 Reference opponent TEI (fixed, never updated)

| Profile σ | Class | Points track | Go-out track |
|-----------|-------|--------------|--------------|
| `ensign` | IV | **1000** | **1000** |
| `lieutenant` | III | **1200** | **1250** |
| `commander` | II | **1400** | **1500** |

```typescript
REF_TEI.points.ensign      = 1000
REF_TEI.points.lieutenant  = 1200
REF_TEI.points.commander   = 1400
REF_TEI.go-out.ensign      = 1000
REF_TEI.go-out.lieutenant  = 1250
REF_TEI.go-out.commander   = 1500
```

These values are calibrated so a captain near `R ≈ REF_TEI(T, σ)` wins ~50% vs that AI tier over many matches **under the reference policy (§2.1)**.

### 7.1.1 Reference anchors are heuristic-only (frozen)

`REF_TEI(T, σ)` is tied to the **heuristic officer profiles** (Class IV–II), not to the strongest deployable search engine.

| Layer | Rated as | Updates `REF_TEI`? |
|-------|----------|-------------------|
| σ = ensign / lieutenant / commander **heuristic** bots | `REF_TEI(T, σ)` | No — anchors are constants |
| Class I\*, Fleet Admiral, expectimax, ISMCTS | `REF_TEI(T, commander) + Δ_search` | No — premium only affects `R_opp` in §6.4 |
| Human-pool online match | live `R_H(q)` | No |
| Tactical advisor | ineligible (§4 E3) | No |

Improving simulation quality makes local practice harder; it does **not** change anchor constants. Maintainers who recalibrate anchors MUST re-run heuristic-only self-play and publish a new profile version + migration — not fold search wins into σ.

### 7.1.2 Search premium Δ_search (normative)

When `searchEnabled = true` for a rated reference-opponent match, add Δ_search to the opponent rating in §6.4:

| Track | Players | Search engine (interactive / app) | Δ_search |
|-------|---------|-----------------------------------|----------|
| `points` | 2 | `expectimax` (Class I\*, Fleet Admiral default) | **+100** |
| `points` | 3+ | `ismcts` | **+50** (provisional — calibrate in self-play) |
| `go-out` | 2 | `expectimax` | **+75** (provisional — high race variance) |
| `go-out` | 3+ | `ismcts` | **+50** (provisional) |
| any | any | heuristic only (`searchEnabled = false`) | **0** |

```typescript
function opponentTeiForRatedMatch(
  objective: RatedObjective,
  skill: AiSkillLevel,
  context: SearchContext
): number {
  const base = REF_TEI[objective][skill];
  return base + searchPremium(objective, context);
}
```

**Rationale:** A +100 shift on 2p points expectimax approximates one Elo “class” of extra strength (~64% Commander win rate in Fleet Admiral benches) without collapsing distinct σ buckets or inflating anchor constants. Go-out premiums are labeled provisional until percentile-smoothed calibration (§9) confirms spacing.

**Conformance:** Implementations MUST apply Δ_search > 0 whenever rated play uses deep search; storing `opponentClass1Star: true` alone is insufficient for v1.1 conformance.

### 7.2 Human Tactical Class (display only)

From human-pool or primary display TEI on a track:

| TEI range | Tactical Class |
|-----------|----------------|
| `R < 1100` | IV — Provisional / New Profile |
| `1100 ≤ R < 1350` | III — Competent / Standard |
| `1350 ≤ R < 1450` | II — Veteran / Sharp |
| `R ≥ 1450` | I — Elite / Master |

AI opponent **Class I\*** is experimental search tier — **not** a reference TEI band. **Class Ω** is the self-play neural opponent (when promoted, reference ~1700).

### 7.3 Academy placement bands (starting TEI clamp)

Self-reported seed before first rated match, by chosen profile σ and track `T`:

| Track | σ = ensign | σ = lieutenant | σ = commander |
|-------|------------|----------------|---------------|
| Points | 400–1050 (default 1000) | 1050–1300 (default 1200) | 1300–1800 (default 1400) |
| Go-out | 400–1125 (default 1000) | 1125–1375 (default 1250) | 1375–1800 (default 1500) |

```
R_academy = clamp(round(userPick), band.min, band.max)
```

---

## 8. Conformance test vectors

Implementations SHOULD pass these vectors (tolerance ±0 for integers, ±1e-5 for floats).

### 8.1 Expected score

| R_player | R_opp | E |
|----------|-------|---|
| 1200 | 1200 | 0.5 |
| 1000 | 1400 | 0.24 (≈) |
| 1400 | 1000 | 0.76 (≈) |

### 8.2 Head-to-head vs reference (K = 32)

| R | R_opp | S | R' |
|---|-------|---|-----|
| 1000 | 1400 | 1 | **1029** |
| 1000 | 1000 | 0 | **984** |

(`E(1000,1400) = 1/11`; `1029 = round(1000 + 32 × (1 − 1/11))`)

### 8.2.1 Search premium (2p points vs Class I\*)

Human `R = 1400`, opponent `R_opp = 1400 + 100 = 1500`, win `S = 1`, `K = 32`:

```
E(1400, 1500) = 1 / (1 + 10^(100/400)) ≈ 0.36
R' = round(1400 + 32 × (1 − 0.36)) ≈ 1420
```

Without Δ_search, the same win would use `E(1400, 1400) = 0.5` → `R' = 1416` — understating upside vs search.

### 8.3 Multiplayer 3-player

Ranks: A=1, B=2, C=3. TEI: A=1200, B=1200, C=1000. All `K=32`, `n=3`.

| Captain | R | R' |
|---------|---|-----|
| A | 1200 | **1212** |
| B | 1200 | **1196** |
| C | 1000 | **992** |

---

## 9. Leaderboard and percentile display

Raw TEI is the authoritative rating state for updates (§6). **Public leaderboards SHOULD NOT expose raw TEI alone** — especially on the go-out track, where race variance compresses skill gaps and identical integers imply different mastery across tracks.

### 9.1 Sorting (ordinal rank)

For track `T` and reference profile σ, sort descending by `R_ref(p,T,σ)` among captains with `N_ref > 0`. Human-pool boards sort by `R_H(p,T)`.

### 9.2 Percentile label (required for go-out, recommended for points)

For rank `r` of `N` rated captains on the same board:

```
displayPercentile = max(1, min(100, round(100 · r / N)))
label = "Top {displayPercentile}%"
```

Go-out **MUST** show a percentile (or equivalent ordinal band) alongside or instead of raw TEI in primary UI. Points **SHOULD** do the same when `N` is large enough for stable ordinals.

**Cross-track rule:** A displayed value of 1500 on `points` and 1500 on `go-out` are **not** comparable mastery levels. UI copy MUST distinguish tracks (e.g. “Points TEI” vs “Go-out TEI”) and MUST NOT merge into one global ladder without explicit dual-track labeling.

### 9.3 Smoothed display TEI (percentile-augmented thesis)

To reduce single-match whiplash while preserving §6 update math, implementations MAY publish a **display-only** smoothed value `R̂` derived from stored `R` and recent history:

```
R̂(p, T) = round( α · R(p,T) + (1 − α) · mean(R_history(p,T, last m matches)) )
```

Recommended defaults: `α = 0.7`, `m = 10`. Smoothed values MUST NOT feed back into §6 updates.

Alternatively, show **leaderboard percentile as the primary badge** and raw TEI only on profile drill-down — the paper’s recommended presentation for go-out and acceptable for points at scale.

### 9.4 Provisional and low-sample captains

When `N < 10` in a bucket, label TEI **Provisional** and prefer percentile within the local cohort over absolute integers. Academy seed (§7.3) is not a rated result until `N > 0`.

---

## 10. Mixed tables (AI + human)

When a campaign includes both humans and AI:

| Policy | Rule |
|--------|------|
| **P1 Local training** | Rate human vs **highest reference profile σ** at the table (Warp 12 v1) |
| **P2 Online humans-only** | Use human-pool update (§6.5) |
| **P3 Online mixed (context B)** | Rank the **full** table (humans + AI). Update each verified human with the §6.5 pairwise sum, treating every **Class II–IV** AI seat as a **fixed-`REF_TEI` anchor opponent** (`REF_TEI(T, σ)`, no `Δ_search`). AI ratings never move — they inject absolute scale so results stay commensurable with the solo ladder. **Exclude the whole sector** from rating if any seat is a **Class I\*** / search opponent, or if any human is unverified. |

**Context B rationale:** a humans-only table is purely relative and can drift; anchoring against fixed-rating Class II–IV officers ties the online human pool to the same scale as solo play and the Academy bands. Because a below-rating anchor yields a small positive expected delta with no losing counterparty, anchor-farming is a known (bounded) abuse vector — mitigated by the verified-account requirement, per-sector idempotency, and fair-play review. This supersedes the earlier "pick one context" guidance.

---

## 11. Worked example — four-human points campaign

**Field:** Picard, Riker, Troi, Worf — 13-round points campaign, unassisted.

**Final points (lower wins):**

| Captain | pointsScore | rank |
|---------|-------------|------|
| Picard | 42 | 1 |
| Riker | 58 | 2 |
| Troi | 61 | 3 |
| Worf | 79 | 4 |

**Prior human-pool TEI (points):** Picard 1240, Riker 1180, Troi 1200, Worf 1100.  
**Experience:** all `N = 15` → `K = 32`.

**Picard (rank 1):** beats all three → each pairwise S=1  
Δ = (32/3) · Σ_q (1 − E(1240, R_q))  
Update Riker, Troi, Worf similarly with mixed win/loss pairwise scores.

After update, publish new `R_H(p, points)` on leaderboard.

---

## 12. Reference code map

| Spec section | Warp 12 module |
|--------------|----------------|
| §6.1–6.3 | `stats-elo.ts`: `expectedEloScore`, `updateTeiScore`, `kFactor` |
| §6.4, §7.1.2 | `stats-elo.ts`: `opponentTeiForObjective` + `searchPremium` (v1.1); `report-practice-ai.ts` |
| §6.5 | `stats-elo.ts`: `updateTeiMultiplayerPairwise`, `rankCompetition` |
| §7.1 | `stats-elo.ts`: `AI_OPPONENT_TEI_*`, `opponentTeiForObjective` |
| §7.2 | `tactical-class.ts`: `teiToPlayerTacticalClass` |
| §7.3 | `tactical-class.ts`: `ACADEMY_TEI_BANDS`, `clampAcademyTei` |
| §9.2–9.3 | Leaderboard UI: percentile badge + track-specific labels (`profile-page.tsx`, rated match history) |

**Implementation note (Warp 12 v1.1):** `reportPracticeAiMatch` applies heuristic-only `opponentTeiForObjective` today; search premium (§7.1.2) is normative in this spec and SHOULD be wired when `opponentClass1Star` / search context is reported.

---

## 13. Versioning

| Version | Changes |
|---------|---------|
| **1.1** | Frozen heuristic reference policies (§2.1); search premium Δ_search for Class I\* / Fleet Admiral (§6.4, §7.1.2); percentile-augmented leaderboard requirements (§9) |
| **1.0** | Initial normative spec: dual tracks, reference AI buckets, human pairwise multiplayer, K-schedule, academy bands |

Future versions MAY add: TrueSkill-style multi-player, draw handling for identical points campaigns, online human-pool Firestore schema.

---

*Digital Defiance / Warp 12 — [tei-paper-outline.md](./tei-paper-outline.md) for research context and calibration history.*
