# TEI Specification (Tactical Effectiveness Index)

**Version:** 1.0  
**Status:** Normative — interoperable definition for Warp 12 and third-party Mexican Train platforms  
**Reference implementation:** `apps/Warp12/src/firebase/stats-elo.ts` (Warp 12 v1)

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
| **Reference TEI** | Fixed constant rating assigned to a reference profile (not updated) |
| **Human TEI** | Dynamic rating for a human captain on a track |
| **K-factor** | Elo step size; decreases with experience |

**Not TEI:** Chain-of-command rank names (Ensign / Lieutenant / Commander) in fiction — those map to AI simulation tiers only. Human **Tactical Class I** is earned by TEI ≥ 1650, not by title.

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

Implementations MAY defer human-pool storage until online rated play ships; the update math in §6 is still normative for interoperability.

**Warp 12 v1.1 (2026):** Human-pool TEI for offline play uses officiated `ratedMatches` on the leaderboard — see [rated-matches.md](./rated-matches.md).

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

**Ineligible:** advisor-assisted games, sandbox/debug, aborted campaigns, practice with custom non-standard rules (implementation-defined).

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
R_opp = REF_TEI(T, σ)     — constant from §7.1
S     = 1 if human won campaign, else 0
N     = N_ref(p, T, σ)
R'    = round(R + K(N) · (S − E(R, R_opp)))
```

Then set `N ← N + 1`, update win count if `S = 1`.

**Class I\* note:** Experimental search opponents still bucket under σ = `commander`; store `opponentClass1Star: true` in match metadata for display only — **reference TEI unchanged**.

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

These values are calibrated so a captain near `R ≈ REF_TEI(T, σ)` wins ~50% vs that AI tier over many matches.

### 7.1.1 AI engine strength does not move reference TEI

Reference TEI constants (§7.1) are **fixed anchors** tied to **heuristic officer profiles** (Class IV–II), not to the strongest available search engine.

| Change | Effect on reference TEI | Effect on human ratings |
|--------|-------------------------|-------------------------|
| Stronger play AI (expectimax, ISMCTS, Class I\*) | **None** — still bucket under σ = `commander` at 1400/1500 | **None** for existing `R_ref` unless you deliberately recalibrate |
| Human-pool online match | N/A | Uses live opponent `R_H`, not AI strength |
| Display metadata | `opponentClass1Star: true` for Class I\* | Separate from rating math |

Improving simulation quality makes local practice harder; it does **not** retroactively inflate or deflate TEI unless maintainers publish a new reference profile version and migrate buckets intentionally.

### 7.2 Human Tactical Class (display only)

From human-pool or primary display TEI on a track:

| TEI range | Tactical Class |
|-----------|----------------|
| `R < 1100` | IV — Provisional / New Profile |
| `1100 ≤ R < 1350` | III — Competent / Standard |
| `1350 ≤ R < 1650` | II — Veteran / Sharp |
| `R ≥ 1650` | I — Elite / Master |

AI opponent **Class I\*** is experimental search tier — **not** a reference TEI band.

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

### 8.3 Multiplayer 3-player

Ranks: A=1, B=2, C=3. TEI: A=1200, B=1200, C=1000. All `K=32`, `n=3`.

| Captain | R | R' |
|---------|---|-----|
| A | 1200 | **1212** |
| B | 1200 | **1196** |
| C | 1000 | **992** |

---

## 9. Leaderboard and percentile display

### 9.1 Sorting

For track `T` and reference profile σ, sort descending by `R_ref(p,T,σ)` among captains with `N_ref > 0`.

### 9.2 Percentile label (go-out track recommended)

For rank `r` of `N` rated captains:

```
displayPercentile = max(1, min(100, round(100 · r / N)))
label = "Top {displayPercentile}%"
```

Go-out raw TEI gaps compress; percentile preserves ordinal meaning.

---

## 10. Mixed tables (AI + human)

When a campaign includes both humans and AI:

| Policy | Rule |
|--------|------|
| **P1 Local training** | Rate human vs **highest reference profile σ** at the table (Warp 12 v1) |
| **P2 Online humans-only** | Use human-pool update (§6.5) |
| **P3 Online mixed** | Implementations SHOULD NOT blend reference and human updates in one step; pick one context per match report |

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
| §6.4 | `stats-service.ts`: `incrementLocalAiSkillStats` |
| §6.5 | `stats-elo.ts`: `updateTeiMultiplayerPairwise`, `rankCompetition` |
| §7.1 | `stats-elo.ts`: `AI_OPPONENT_TEI_*`, `opponentTeiForObjective` |
| §7.2 | `tactical-class.ts`: `teiToPlayerTacticalClass` |
| §7.3 | `tactical-class.ts`: `ACADEMY_TEI_BANDS`, `clampAcademyTei` |

---

## 13. Versioning

| Version | Changes |
|---------|---------|
| **1.0** | Initial normative spec: dual tracks, reference AI buckets, human pairwise multiplayer, K-schedule, academy bands |

Future versions MAY add: TrueSkill-style multi-player, draw handling for identical points campaigns, online human-pool Firestore schema.

---

*Digital Defiance / Warp 12 — [tei-paper-outline.md](./tei-paper-outline.md) for research context and calibration history.*
