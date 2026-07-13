# TEI Product Simplification Proposal

**Status:** Landed in product surfaces (engine ranks, UI, RULES, AGENTS/README, leaderboard). Historical logs / TEI paper still use older Class IV–II / Class Ω wording until next paper pass.  
**Related:** `docs/TEI-GRADE-SYSTEM.md`, `RULES.tex` §VIII, Academy placement, AI skills

---

## 0. Locked assumptions

- **DB is empty** → rename freely; no dual-read of Class IV / old fields; no compat shims.
- **Lean defaults** (unless you override):
  - Kill Class IV/III/II in UI + RULES player prose → **Ensign / Lieutenant / Commander**
  - **Cadet** kept for `< P25`
  - μ/σ only behind profile **Show Advanced rating details** (default off)
  - Module spike = re-eval copy, not a second rating
  - Class I → **Flag Officer** (earned); optional one-line in TEI paper
  - Rank bands as in §7 straw table
- Schema / code may use `ensign` | `lieutenant` | `commander` as the canonical skill keys (already close to this); drop user-facing “tactical class” / `classIv` wording wherever it still appears.

---

## 0b. One-sentence north star

**OpenSkill stays the engine. Users only ever need to learn one public rating: TEI (`V67`) — with a federation rank as flavor of that same path. Everything else is either Advanced or the Ensign/LT/Commander opponent·placement vocabulary.**

---

## 1. What “chrome” means

**Chrome** = the surrounding UI, not the badge math: profile header, HUD chip, post-match summary, leaderboard cell — the surfaces that always show rating.

Default chrome proposal:

```text
Veteran  V67
Lieutenant Commander
```

or compact:

```text
V67 · Lt. Commander
```

Words first (or beside), OpenSkill never in that strip.

---

## 2. Diagnosis: too many parallel ladders

Today a motivated player can meet all of these as if they were separate career systems:


| Layer                              | What it is today                        | User confusion                                              |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| TEI letter                         | σ confidence                            | “Is C better than I?” (yes for trust, not always for skill) |
| TEI number                         | global μ−3σ → 0–99                      | Fine if taught as skill                                     |
| Tactical Class IV / III / II / I   | Placement + rated buckets + prestige    | Feels like another rank ladder                              |
| AI Ensign / Lieutenant / Commander | Class IV–II flavor names + anchors      | Same words as possible player ranks                         |
| Tracks                             | Points / go-out × opponent class        | Necessary, but naming is dense                              |
| Percentile                         | Leaderboard position                    | Good; keep as secondary                                     |
| (Proposed) military ranks          | Would be a 7th story if stacked naively | Don’t stack — **merge**                                     |


**RULES bug (your call-out):** “score vs others in the same letter” was wrong vs implementation. Fix copy to: number is conservative skill on one 0–99 scale; letter is confidence.

---

## 3. Proposed information architecture (3 layers only)

### Layer A — Public (everyone)

1. **TEI badge** — `V67`
2. **Plain confidence words** — Provisional / Improving / Consistent / Veteran / Elite
3. **Federation rank** — derived from TEI path (Ensign → … → Fleet Admiral)
4. **Track label** — Points or Go-out (and which opponent tier you rated against — see merge below)

### Layer B — Situational

- Post-match delta: `V65 → V67` + optional “Promoted to Commander”
- Module re-eval banner (see §5)
- Leaderboard percentile

### Layer C — Advanced (opt-in)

- μ, σ, matches, μ−3σ raw  
- **Profile setting:** `Show Advanced rating details` (default **off**)  
- When off: tooltips stay human (“Veteran: highly reliable estimate. Score 67 = solid skill.”)  
- When on: tooltip / profile stats may show μ/σ

**Answer to your tooltip question:** yes — **do not** put μ/σ in default tooltips; put them behind an explicit Advanced setting (profile is the right place), and optionally a profile “Rating details” panel that only appears when Advanced is on.

---

## 4. Merge / replace the Class system

### Schema (clean break)

Canonical opponent / placement / rated-bucket key: `ensign` | `lieutenant` | `commander`.  
No parallel `classIv` user vocabulary; empty DB means we rewrite callers instead of aliasing forever.

### Change what humans see

**Retire “Class IV / III / II / I” from primary UI and RULES player-facing prose.**  
Replace with **Ensign / Lieutenant / Commander**, plus finer ranks for the player’s own TEI.


| Old user-facing  | New user-facing                                                          | Internal           |
| ---------------- | ------------------------------------------------------------------------ | ------------------ |
| Class IV         | **Ensign** (difficulty / placement tier)                                 | `ensign`           |
| Class III        | **Lieutenant**                                                           | `lieutenant`       |
| Class II         | **Commander**                                                            | `commander`        |
| Class I (earned) | **Flag** / **Flag Officer** prestige — or simply “above Commander track” | keep prestige flag |


### Academy placement (merged)

Today: pick Class IV/III/II → slider in TEI band.  
Proposed: pick **starting commission tier**:

- **Ensign track** — starting TEI in `P0`–`I25`
- **Lieutenant track** — `I25`–`C45`
- **Commander track** — `C45`–`V70`

Copy: “How would you commission against the reference fleet?” not “Select tactical class.”

Your live TEI then earns a **finer rank** inside/above that path (LTJG, LCDR, Commodore, admirals…). Placement tier ≠ current rank forever; it’s only the onboarding bucket + which rated AI ladder you start on.

### Rated buckets (merged)

Still three independent ladders (points/go-out × opponent tier), but labeled:

```text
Points TEI · vs Ensign officers    V41 · Lieutenant
Points TEI · vs Commander officers V58 · Commander
```

Not: “Class II Points TEI.”

### AI seats (merged)

Keep Ensign / Lieutenant / Commander as **opponent archetype names** — they already match anchors (`C5`, `C27`, `C51`).  
Player rank uses the **same vocabulary in the mid-band**, which is intentional: beating Commander officers while holding Commander commission should feel coherent.

### Flag Officer (was Class I)

Earned badge when TEI enters admiralty territory (e.g. ≥ `V70` or any `E`), not selectable at Academy. App says **Flag Officer**; TEI paper may note the old Class I name once if useful.

### What we delete from the user’s head

- “Tactical Class” as a thing they must understand  
- Parallel “I’m Class II but also V67 but also fighting Commanders”

### What we keep for engineers

- Three rated opponent skills  
- Fixed OpenSkill anchors  
- Separate points / go-out tracks

---

## 5. Counterintuitive moments — proposals

### 5a. `I40` ≈ `C40` (same skill, different trust)

**Copy rule:** Letter is never described as “better player.”  
Always: “more established / more reliable estimate.”

UI microcopy:

```text
I40  Improving · skill 40 (still settling)
C40  Consistent · skill 40 (stable estimate)
```

Sorting/leaderboards already use conservative skill; chrome should reinforce “number ≈ strength, letter ≈ confidence.”

### 5b. Module σ spike (`E84` → `I68`)

Don’t frame as punishment. Frame as **re-evaluation**:

- Badge may show temporary letter/score (honest TEI)
- Banner: **“Re-evaluating under this module.”**
- Optional: show **prior established TEI** in small type for N games: `Now I68 (was E84 · Standard)`
- Hysteresis already softens flicker; messaging softens emotion

**Do not** invent a second hidden rating for modules in v1 — keep one TEI, better copy.

### 5c. Letter “match count” myth in RULES

Rewrite letter section to σ/confidence language:

- Provisional — rating still establishing (high uncertainty)
- Improving — estimate moving; not locked in yet  
- Consistent — reliable enough for everyday comparison  
- Veteran — highly reliable  
- Elite — tightly anchored

Mention “usually after more play” as **tendency**, not as thresholds (“after 50 matches”).

---

## 6. Tooltips & Advanced setting


| Surface             | Default                                          | Advanced on                       |
| ------------------- | ------------------------------------------------ | --------------------------------- |
| Profile / HUD badge | `V67` + rank + confidence word                   | unchanged                         |
| Tooltip             | confidence blurb + “Skill score 67/99” + matches | + μ, σ, μ−3σ                      |
| Profile → Rating    | human summary                                    | “Advanced details” panel          |
| RULES / paper       | human model                                      | μ/σ in technical subsections only |


**Setting:** Profile → **Show Advanced rating details** (boolean, default off).  
Same flag gates tooltip OpenSkill lines and any debug-ish profile rows.

---

## 7. Federation ranks (flavor of TEI — not a third ladder)

Ranks are **purely derived** from TEI grade path (letter order `P<I<C<V<E`, then score), aligned to Academy bands:


| Rank             | Approx TEI band | Notes                                   |
| ---------------- | --------------- | --------------------------------------- |
| Cadet            | `< P25`         | optional                                |
| **Ensign**       | `P25`–`I25`     | ≈ old Class IV                          |
| Lt. Junior Grade | `I25`–`I40`     |                                         |
| **Lieutenant**   | `I40`–`C45`     | ≈ old Class III mid                     |
| Lt. Commander    | `C45`–`C55`     |                                         |
| **Commander**    | `C55`–`V63`     | ≈ old Class II mid; AI Commander ~`C51` |
| Commodore        | `V63`–`V70`     | skip seat-word “Captain”                |
| Rear Admiral     | `V70`–`V80`     | past old Class II ceiling               |
| Vice Admiral     | `V80`–`V90`     |                                         |
| Admiral          | `V90`–`V99`     |                                         |
| Fleet Admiral    | `V99` / top `E` | ceiling                                 |


Placement tiers Ensign / Lieutenant / Commander are **onboarding + opponent ladder names**.  
Personal rank is **current TEI readout**. Same word family, one story.

---

## 8. RULES / docs fixes (when approved)

1. Fix score copy: global conservative skill, **not** within-letter.
2. Fix letter copy: confidence/σ, not fixed match-count gates.
3. Replace Class IV–II player prose with Ensign / Lieutenant / Commander tracks.
4. Add short “Federation commission” subsection: ranks derived from TEI.
5. Point Advanced / μσ to app setting + TEI paper, not tip-of-tongue UI.

---

## 9. Phased rollout (suggested)

1. **Copy & tooltip pass** — RULES + default tooltips + Advanced setting (highest UX ROI, low risk).
2. **Rename Classes → Ensign/LT/Commander** in Academy, setup, profile, leaderboard labels (schema can wait).
3. **Ship derived ranks** in chrome once bands locked.
4. **Class I → Flag Officer** badge when ready.
5. Optional later: reduce visible track clutter (e.g. “primary track” summary).

---

## 10. Decisions (locked by lean defaults + empty DB)


| Item                        | Decision                                   |
| --------------------------- | ------------------------------------------ |
| Class IV/III/II UI language | **Gone** → Ensign / Lieutenant / Commander |
| Cadet                       | **Yes**, `< P25`                           |
| Advanced μ/σ                | Profile toggle, default off                |
| Module spike                | Re-eval copy; honest TEI; no second rating |
| Class I                     | **Flag Officer** (earned)                  |
| Rank edges                  | §7 straw table                             |
| Backwards compat            | **None** — empty DB, clean renames         |


Override any row before implementation if needed.

---

## 11. Lean recommendation → build order

1. **Copy & Advanced** — RULES score/letter lies; default tooltips human-only; profile Advanced flag
2. **Rename Classes → Ensign/LT/Commander** across Academy, setup, profile, leaderboard, RULES
3. **Derived ranks** in chrome (`getTeiRank(tei)` + display)
4. **Flag Officer** badge when TEI crosses admiralty threshold

Collapses the stack to: **TEI + commission**, with opponent difficulty using the same mid-rank words.