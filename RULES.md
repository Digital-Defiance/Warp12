# WARP 12: Navigational Operations Manual

*A double-twelve Mexican Train variant, with Starfleet terminology.*

### A note on "official" rules

Unlike chess, Mexican Train dominoes has no governing body and no single canonical ruleset. Almost every published source, commercial app, and family table differs on the details — hand sizes, the value of the blank, when a train opens, how doubles are handled, and dozens of optional variants. There is no authority to appeal to; there is only common practice.

Warp 12 does not claim otherwise. We have studied the most widely cited sources and tournament-style conventions and tried to stay true to the *spirit* of authentic Mexican Train, while making deliberate, documented choices wherever those sources disagree. The result is meant to be two things at once:

- **A faithful, flexible base.** The most common variations are supported as configurable options, so you can tune a table toward whatever "standard" your group grew up with.
- **An opinionated house standard.** The **Official Warp 12 rules** preset (Section VI) bundles our recommended choices and adds a little fun on top — much as other domino publishers have shaped their own signature editions.

Where this manual says "standard" or "tournament practice," read it as *the common convention Warp 12 has chosen to adopt*, not a claim of sanctioned authority. This is our best attempt to honor the game, cover the popular variants, and establish a Warp 12 standard worth playing.

This document is the authoritative rules reference **for Warp 12**. **Sections I–V** follow widely published Mexican Train practice (double-twelve set, engine double set aside before the deal, personal trains, Mexican Train / Neutral Zone, train markers, doubles, boneyard, multi-round scoring). **Section VI** lists optional Warp 12 modules and the **Official Warp 12 rules** recommended preset.

> **Digital implementation note:** Warp 12 enforces these rules in software. Setup defaults to **Official Warp 12 rules** (Section VI); hosts may change any toggle before launch. This manual describes behavior when modules are **on** or **off** as stated in each section. **Section VII** describes AI officers and the tactical advisor; **Section VIII** describes solo TEI and the public leaderboard (digital play only).

---

## Victory conditions

Fleet command chooses one objective before the sector opens:

| Mode | Goal |
| --- | --- |
| **Points campaign** *(standard)* | Thirteen rounds — Spacedock descends **12-12** through **0-0**. Lowest **cumulative points total** wins the campaign. |
| **Go out** | First captain to empty their hand in a single round wins the sector immediately (no thirteen-round tally). |

---

## I. Operations lexicon

| Mexican Train | Warp 12 |
| --- | --- |
| Dominoes | **Navigational Coordinates** |
| Engine / station double | **Spacedock** |
| Personal train | **Warp Trail** |
| Mexican Train | **Neutral Zone** |
| Train marker | **Distress Beacon** *(Shields Down)* |
| Boneyard | **Uncharted Sectors** |
| — | **Red Alert** — a double must be satisfied before normal play continues (cover tile, or stabilizers when Subspace Fracture applies) |
| — | **Subspace Fracture** — optional chicken-foot protocol on doubles (scope: Own Trail, All Captains, or All Doubles) |
| — | **Q-Flash** — optional Module Alpha anomaly on 0-0 |
| — | **All Stop!** — ceremony required after some round-winning charts (Neutral Zone, or any go-out when All Stop! echo is active) |
| — | **Drop to Impulse** — optional house-rule announce when one coordinate remains (uno / knock) |

---

## II. Mission setup

Setup matches standard double-twelve Mexican Train:

1. **Scramble** all 91 coordinates face down.
2. **Set aside Spacedock** before dealing — **12-12** (round 1), **11-11** (round 2), … **0-0** (round 13). This tile is **not** dealt.
3. **Deal hands** from the remainder:

   | Captains | Hand size |
   | --- | --- |
   | 2–4 | 15 |
   | 5–6 | 12 |
   | 7–8 | 10 |

4. **Place Spacedock** in the center.
5. **Uncharted Sectors** — all remaining tiles face down.

**Round starter:** Round 1 opener is designated by fleet command (typically the host). Each later round, the starter rotates clockwise. The starter charts first; Spacedock was still set aside before the deal.

**Optional modules** (Section VI) and **Subspace Fracture** must be agreed before launch. Digital setup defaults to the **Official Warp 12 rules** preset (see Section VI). Hosts can change any toggle before launch.

---

## III. Standard gameplay

Play proceeds clockwise. Each turn, unless a special protocol applies (Red Alert, Subspace Fracture, Q-Flash resolution), a captain does **one** of the following:

1. **Chart** one legal coordinate, if any exist.
2. **Draw** one tile from Uncharted Sectors, then follow the draw rules below.
3. **Deploy a Distress Beacon** — after drawing your one tile and still being unable to chart, your marker goes down and your turn ends. (With **Manual shield control**, Section VI, you may also lower shields voluntarily during your turn.)
4. **Pass** only when their Distress Beacon is already active, they still cannot chart, and Uncharted Sectors are empty.

### Must play when able

If you hold a coordinate that can be legally charted, you **must** chart one tile this turn. You may **not** skip charting while legal moves exist.

### Eligible routes

When charting, you may play on:

1. **Your own Warp Trail** (or start it from Spacedock on your first matching play).
2. **The Neutral Zone** — communal line; any captain may start or extend it with a matching end.
3. **Another captain's Warp Trail** — **only while their Distress Beacon is active** (Shields Down).

You may choose **any** eligible route when more than one is legal — you are not required to chart on your own trail.

### Opening the round

On the first turn of a round, a captain who can play must open **their own Warp Trail** or the **Neutral Zone** with a coordinate matching Spacedock (e.g. any tile containing twelve when Spacedock is 12-12). If they cannot play, they draw once; if the drawn tile is playable, they must chart it immediately (choosing any legal route). If they still cannot play, they deploy their Distress Beacon.

### Drawing from Uncharted Sectors

When you cannot chart and tiles remain in the pile, you **must draw** one coordinate.

- If the drawn tile can be played, you **must** chart it immediately (any legal route).
- If it cannot be played, you deploy your **Distress Beacon** (shields down) and your turn ends. You draw **one** tile per turn — you do not keep drawing, and the marker goes down after that single failed draw regardless of how many tiles remain in Uncharted Sectors.

### Distress Beacon (train marker)

Deploy your beacon when — and **only** when — you cannot make a legal chart after drawing, or when the pile is already empty and you still cannot chart.

- **Shields Down:** While your beacon is active, other captains may chart on your Warp Trail.
- **Shields Up:** Your beacon is removed **automatically** when **you** chart on **your own** Warp Trail. Charting on the Neutral Zone or another captain's trail leaves your beacon active.
- **You cannot** deploy a beacon voluntarily while you still have a legal chart elsewhere. *(Standard Mexican Train — no “strategic pass.”)* With **Manual shield control** (Section VI), you may drop shields voluntarily after starting your own trail — see that house rule.
- **Passing:** If your beacon is already up, you cannot chart, and Uncharted Sectors are empty, you may **pass** your turn without charting; your beacon stays up.

### Red Alert pass

If you cannot satisfy an active Red Alert after drawing (or with an empty pile), you deploy your Distress Beacon and **Red Alert responsibility passes** to the next captain. The alert remains until the double is satisfied.

When **Subspace Fracture** is active (Section VI), “satisfy” means **stabilizers** — not a separate cover tile. Pass Red Alert only when you cannot add the next stabilizer.

*(Opt-in exception — Section VI **Pass Red Alert without draw or beacon**: the captain who **charted** the double may pass it on immediately, without drawing or deploying a beacon, but only during the **Caution** phase. Once the alert has passed once, standard rules resume for everyone, including that captain when it comes back around.)*

---

## IV. Doubles — Red Alert protocol

When a **double** (matching pips on both ends) is charted on any eligible route — your Warp Trail, the Neutral Zone, or an open opponent trail — announce **"Red Alert!"**

- The captain who charted the double must **satisfy** it by playing another valid tile on that double **in the same turn sequence**, unless turn rules below apply. *(Standard cover: one matching tile on the double. Subspace Fracture: three stabilizers — Section VI.)*
- **Going out:** An empty hand does **not** win the round while your chart left a double unsatisfied. Chart the cover (or final stabilizer) first; only then may an empty hand end the sector.
- If you cannot satisfy it, draw from Uncharted Sectors; if you still cannot, deploy your Distress Beacon and pass Red Alert to the next captain.
- While Red Alert is active, **no other routes** may be played until the double is satisfied.
- **Dead double:** If every tile in the set containing that pip is already charted (all thirteen tiles showing that number in a double-twelve set), the double cannot be satisfied — Red Alert ends and normal play resumes.
- Covering a double on another captain's open trail **does not** clear their Distress Beacon.

**One double at a time.** Warp 12 resolves doubles one at a time: chart a double, satisfy it (cover tile, or three stabilizers under Subspace Fracture), and your turn ends. Because a cover must match the double's pip and no other double shares that pip, a cover is always a non-double — you never chain into a fresh Red Alert, and you do not play multiple doubles in a single turn. (Some casual house rules let a captain lay several doubles in one turn as long as the last is covered by a non-double; Warp 12 follows the tournament-style single-double resolution instead.)

### Caution and Red Alert *(digital status)*

The rules engine treats every uncovered double as **Red Alert** — the same protocol throughout. On the bridge display and in the sector log, you will see two **status labels** for the same alert:

- **Caution** — the double was just charted; the responsible captain has **not** yet passed Red Alert to someone else.
- **Red Alert** — responsibility has passed at least once (typically after a Distress Beacon deploy and pass). The double still must be satisfied.

This is presentation only. Gameplay, sounds, and scoring follow the Red Alert rules above in both phases.

### Subspace Fracture interaction *(Section VI — opt-in)*

When Subspace Fracture is **enabled**, scope is chosen at launch:

| Scope | Doubles that open Subspace Fracture |
| --- | --- |
| **Own Trail** *(default)* | Only on **your own** Warp Trail |
| **All Captains** | On **any** Warp Trail (yours or an opponent's open trail) |
| **All Doubles** | On any Warp Trail **or** the Neutral Zone |

When a double in scope is charted:

1. **Subspace Fracture and Red Alert open together** on that double.
2. While the fracture is open (fewer than three stabilizers), the responsible captain may play **only stabilizers** — not a cover tile, not other routes.
3. The **third stabilizer satisfies the double** and clears **both** Subspace Fracture and Red Alert. No fourth tile is required on the trail to “cover” the double.
4. If the responsible captain cannot stabilize, draw and/or pass Red Alert as usual; the next responsible captain continues adding stabilizers until all three are placed.

Doubles **outside** the chosen scope never open Subspace Fracture — Red Alert cover rules in this section apply unchanged.

When Subspace Fracture is **off**, all doubles use **Red Alert only** (single cover tile).

---

## V. End of round and scoring

### Winning the round

The round ends when one captain charts their **last** coordinate (empty hand) **and** no Red Alert or Subspace Fracture on that chart still requires satisfaction. You **cannot** go out on an open double — cover it (or complete three stabilizers when Subspace Fracture applies) before the sector closes.

**All Stop!** When the house rule is **on** (default), a round-winning chart on the **Neutral Zone** — or any go-out while **All Stop! echo** is active — ends the sector immediately and the app **automatically** logs and announces **All Stop!** (sound + round log). No helm hold and no manual button.

Turn **All Stop! ceremony** off in game options for pure standard Mexican Train: Neutral Zone go-outs end the round silently, with no announcement.

**All Stop! echo** (Q-Flash Module Alpha): when active, **any** round-winning chart triggers the same auto ceremony when the house rule is on.

**Drop to Impulse** *(house rule — off by default)*: when a captain charts down to **one** coordinate remaining, they are **at impulse** — their turn **continues**. They may **play that last tile** without announcing (including to go out). They may press **Drop to Impulse!** to announce and **pass helm**; announcing is optional until they pass. They are **not** required to announce before playing the last tile or before passing.

If they **pass** without having announced, any other captain may **catch** the miss while the catch window is open. A successful catch forces the forgetful captain to draw from Uncharted Sectors (1 or 2 tiles per game setup, if any remain) — they **return to warp** (no longer at impulse). The window opens when they pass without announcing and **closes** when the **next** captain passes helm (if no one caught). This is separate from **All Stop!** ceremony.

If they **cannot play** their last coordinate and **draw** from Uncharted Sectors while at impulse, that draw **returns them to warp** — there is no need to announce first; drawing already ends the impulse state.

### Blocked sector

If Uncharted Sectors are empty and **no captain** can make a legal chart (after dead doubles are resolved), the round ends **without** a domino winner. **Every** captain scores the pip total of tiles in hand — no exempt captain. All table tiles, hands, and any remaining pile are shuffled for the next round's deal (standard Mexican Train recycle — trails are not trimmed to open ends).

### Round scoring *(points campaign)*

When a round ends with a winner, every **other** captain totals pip values in hand and adds that to their campaign score. The round winner scores **0** for that round.

**Double-blank (0-0):** a double-blank caught in hand scores by the **Double-blank score** setting — **50** (tournament standard, the default for hand-built rule sets), **25**, or **0** (pips). The **Official Warp 12 rules** preset uses **0** so the 0-0 stays safe to hold as the Q-Continuum trigger (Module Alpha). This is independent of the Salamander Penalty, which only affects **12-12**.

**Next round:** Spacedock steps down one double (12-12 → 11-11 → … → 0-0). After round 13, lowest cumulative points total wins.

---

## VI. Optional directives and variants

*Agree before launch. Unless noted, these are **not** part of standard Mexican Train tournament practice — though **Sections I–V** (trains, marker, draw, doubles, scoring) still apply underneath.*

### Official Warp 12 rules *(recommended preset)*

This is the **encouraged default** for Warp 12 — living-room tables, online sectors, and any future **Warp 12–branded** play. It is **not** a claim of sanctioned third-party tournament rules; it is the rules bundle this project recommends when you want the full Warp 12 experience without assembling toggles by hand.

In the app, choose **Official Warp 12 rules** on the setup screen (or accept the defaults). Everything in **Sections I–V** applies; the preset only turns on the extras below.

| Setting | Official Warp 12 preset |
| --- | --- |
| **Module Alpha — Q-Continuum** | **On** |
| **Module Beta — Salamander Penalty** | **On** |
| **Drop to Impulse** | **On** — **1-tile catch** when opponents catch a missed announce |
| **All Stop! ceremony** | **On** — auto log/sound after Neutral Zone wins and All Stop! echo go-outs |
| **Subspace Fracture** | **Off** (hosts may enable separately) |
| **Deluxe house rules** | **Off** (own trail first, NZ after all trails, beacon on any play, round starter plays two) |
| **Manual shield control** | **Off** |
| **Pass Red Alert without draw or beacon** | **Off** |
| **Double-blank (0-0) score** | **0** (pips) — hand-built/standard rule sets default to **50** (tournament standard) |
| **Objective** | **Points campaign** (thirteen rounds) — *Go out* remains an optional lobby mode |

Hosts may mix and match any toggle; the preset is a one-click reset to the recommended bundle.

### Subspace Fracture *(chicken foot — off in Official Warp 12 preset)*

When **enabled**, choose a **fracture scope** before launch:

| Scope | Doubles that open Subspace Fracture |
| --- | --- |
| **Own Trail** *(default)* | Only on **your own** Warp Trail |
| **All Captains** | On **any** Warp Trail |
| **All Doubles** | On any Warp Trail **or** the Neutral Zone |

When a double in scope is charted, **Subspace Fracture** and **Red Alert** open together:

- Fleet navigation halts until the fracture is **stabilized** (three branches from the double).
- While the fracture is open, the captain holding Red Alert responsibility may play **only stabilizers** matching the fracture pip — no cover tile, no other routes.
- Each stabilizer must match the double's pip (e.g. any tile containing nine on a 9-9 fracture).
- If you cannot add a stabilizer, draw; if still unable, deploy your Distress Beacon and pass Red Alert. The next responsible captain continues stabilizing.
- Layout: the first two stabilizers branch from the double; the **third stabilizer is the center foot** and continues the warp trail from the double.
- The **third stabilizer satisfies the double** — it clears both Subspace Fracture and Red Alert. **No separate cover tile** is required afterward.
- When the third stabilizer is placed, normal play resumes across all routes from the center foot's open end.

When Subspace Fracture is **off**, doubles use **Red Alert only** (one cover tile on the double).

**Fracture immunity** (Q-Flash Module Alpha): the next double on your own trail opens Red Alert but **does not** open Subspace Fracture (regardless of scope).

### House rules *(Deluxe-style — off in Official Warp 12 preset)*

Hosts may enable any combination before launch.

| Toggle | When enabled |
| --- | --- |
| **Require own trail first** | You must chart at least one tile on **your own** Warp Trail before playing on an opponent's open trail. The Neutral Zone and your own trail are unaffected. |
| **Neutral Zone after all trails started** | The Neutral Zone cannot be started until **every** captain has at least one tile on their own Warp Trail. |
| **Beacon clears on any play** | Any legal chart removes **your** Distress Beacon — not only a chart on your own trail. |
| **Round starter plays two** | The round starter must chart **two tiles on their own Warp Trail** on their opening turn (Spacedock + two from hand). If the first tile is a double, the Red Alert cover counts as the second. If you cannot play the second tile, deploy your Distress Beacon — no extra draw. Cannot start the Neutral Zone or opponent trails until both are played. |
| **Drop to Impulse** | At one coordinate left (**at impulse**), your turn continues. You may **play that last tile** without announcing. **Drop to Impulse!** announces and passes helm. Pass without announcing → opponents may **catch** (1 or 2 tile penalty per setup). Draw while stuck at impulse → **return to warp** (no announce needed). Catch window closes when the next captain passes helm. |
| **Pass Red Alert without draw or beacon** | Only the captain who **charted the double** gets this break, and only while the alert is still in the **Caution** phase (before it has passed to anyone). If they cannot cover their own double, they may pass responsibility to the next captain **without drawing** from Uncharted Sectors and **without** deploying their Distress Beacon. Red Alert then proceeds normally: every other captain — and the original captain when it cycles back to them — must follow standard rules (draw when tiles remain, deploy the beacon on pass). |
| **Manual shield control** | Replaces the automatic "shields rise when you chart your own trail" behavior with manual control, all **during** your turn (never between turns). **Open (Shields down):** you may open your own Warp Trail at any time, for any reason — even with legal plays in hand and even before you've started your trail. **Close (Shields up):** after you drop shields you must chart at least one tile on **your own** Warp Trail before you may raise them again (that own-trail chart may be this turn or a later one); charting your own trail does **not** auto-raise. **One shield change per turn** — a single open **or** a single close, never both and never repeated. Shield changes never pass helm on their own; adjust, then chart or **Pass**. Standard draw/marker rules still apply when you cannot chart (a forced marker after a failed draw ends your turn). |

### Module Alpha — The Q-Continuum *(on in Official Warp 12 preset)*

When **enabled**, charting **0-0 on your own Warp Trail** triggers a **Q-Flash** before helm passes. That captain immediately chooses **one** directive for the rest of the round (cleared when the sector scores):

| Q-Flash | Effect |
| --- | --- |
| **Reverse turn order** | Helm passes counter-clockwise for the rest of the round. |
| **Skip lowest points** | The captain with the lowest campaign points score skips their next turn. |
| **Peek Uncharted Sector** | The invoker sees the top tile in Uncharted Sectors (hidden from others). |
| **Temporal inversion** | Turn order reverses until the next double is charted on the table. |
| **Distress amplification** | All warp trails are open to every captain without a Distress Beacon. |
| **Fracture immunity** | The next double on an own trail will not open Subspace Fracture (Red Alert still applies). |
| **Salamander swap** *(requires Module Beta)* | If anyone holds 12-12 at round end, that Salamander penalty applies to the highest-points captain instead. |
| **All Stop! echo** | Any captain going out this round must call All Stop! before the sector closes. |
| **Q's gamble** | Draw two tiles from Uncharted Sectors — keep one, return the other face-down. |

0-0 charted on the Neutral Zone or an opponent's trail does **not** trigger Q-Flash. A winning 0-0 on your own trail still requires Q-Flash resolution before the sector can close.

### Module Beta — The Salamander Penalty *(on in Official Warp 12 preset)*

If a round ends and a captain holds **12-12** in hand, that tile scores **24** points instead of 12. Round 1 never applies (12-12 is Spacedock). From round 2 onward, 12-12 is in circulation.

---

## VII. AI officers & tactical advisor *(digital)*

Local simulation and online sectors can fill empty chairs with **AI officers**. The in-game **tactical advisor** uses the same decision stack to suggest moves and explain reasoning. This section describes what those systems know and how **Lookahead** works.

### What an AI officer can see

An AI captain has the same **public** information you do:

- Its **own** hand (coordinates held).
- Every coordinate already **charted** on the table (all Warp Trails, Neutral Zone, fracture stabilizers).
- How many tiles each opponent is **holding** (hand count only — not which coordinates).
- How many tiles remain in **Uncharted Sectors**.

An AI officer **cannot** see which specific coordinates are in an opponent's hand. It does not read hidden tiles from the game state when choosing a move.

### Tactical Class (IV / III / II)

Everyone at the table is a **Captain** (seat role). **Tactical Class** is proficiency on file — not chain-of-command rank:

| Class | Profile |
| --- | --- |
| **Class IV** | Provisional / new profile — more blunders, lighter heuristics |
| **Class III** | Competent / standard |
| **Class II** | Veteran / sharp — tighter heuristics and deeper search where enabled |

Controls how often the officer blunders and how sharply it prefers high-scoring lines. All classes still obey the same legal-move and rules-engine constraints.

### Lookahead (per-officer opt-in)

When **Lookahead** is **off**, the officer uses a fast **greedy** policy: score each legal move for this turn with heuristics (shed heavy pips, own-trail pressure, Red Alert safety, objective mode, modules, and so on) and pick among them.

When **Lookahead** is **on**, the officer **forward-searches** before acting:

1. For each candidate move, it runs the move through the **real Warp 12 rules engine** a few turns ahead.
2. Because opponent hands and the draw order are hidden, each simulation **guesses** plausible holdings: opponents receive a random assignment from the pool of tiles not on the table and not in the AI's hand, while preserving each opponent's **actual hand count**. Uncharted Sectors are filled from the same unseen pool.
3. The search repeats that guess several times (**determinizations**), averages the outcomes, and picks the move that tends to work best across those possible worlds.

Lookahead is **imperfect-information search** — not clairvoyance. It is slower but can reason about consequences (for example, whether a play sets up an opponent to go out). Tactical class still applies on top (blunders and noisy tie-breaking).

### Tactical advisor

The tactical advisor always uses the **Class II** simulation profile with **Lookahead** enabled. It suggests one move plus plain-language reasons so humans can see *why* a line is strong, not only what to play.

Invoking the tactical advisor **during live play** marks the match as **assisted** for rating purposes (Section VIII). Post-match advisor reports and campaign downloads do **not** affect whether a match is rated.

---

## VIII. Solo TEI & leaderboard *(digital)*

Local solo sectors against **AI officers** can report results to **[leaderboard.warp12.app](https://leaderboard.warp12.app)** when the client is signed in to Firebase. Team campaigns, unrated lobby modes, and builds without a working stats backend do not update the public boards.

The normative rating math (Elo update, reference bands, multi-captain human tables) is defined in **[docs/tei-spec.md](docs/tei-spec.md)** for third-party interoperability.

### Lexicon

| Term | Meaning |
| --- | --- |
| **Captain** | Seat at the table — every player is a Captain |
| **TEI** (Tactical Efficiency Index) | Your displayed solo rating number |
| **Tactical Class I–IV** | Proficiency on file — not military rank. Class IV–II map to AI simulation tiers; **Class I** is elite human prestige earned through high TEI |

### Two independent tracks

Your solo TEI is **not** one number — the app keeps separate ratings for each **objective** and each **AI tactical class** you face:

| Track | When it applies |
| --- | --- |
| **Go-out TEI** | First captain to empty their hand wins the sector |
| **Points TEI** | Lowest cumulative points total when the campaign ends *(or the round, in single-round solo)* |

Each track is further split by opponent profile: **Class IV**, **Class III**, and **Class II**. Beating Class II officers does not move your Class IV bucket.

### Starfleet Academy placement

Before your first rated match in each track, the app asks for a **tactical classification** separately for **go-out** and **points**. Choose **Class IV**, **Class III**, or **Class II** on each track (with a short self-description), then fine-tune a **starting TEI** within that class’s band. You might place as Class II for go-out and Class IV for points. Each track is saved **once**; after you save placement for a track — or after your first unassisted rated match in that track — its starting TEI field locks. **Class I** is not selectable at onboarding — it is earned.

| Class | Self-description | Points TEI band | Go-out TEI band |
| --- | --- | --- | --- |
| **Class IV** | New to dominoes | 400–1050 | 400–1125 |
| **Class III** | Knows Mexican Train | 1050–1300 | 1125–1375 |
| **Class II** | Seasoned strategist | 1300–1800 | 1375–1800 |

### Fixed opponent reference TEI

Unassisted matches are scored against **fixed** reference ratings — not the other chairs' live TEI:

| Track | Class IV | Class III | Class II |
| --- | --- | --- | --- |
| **Points** | ~TEI 1000 | ~TEI 1200 | ~TEI 1400 |
| **Go-out** | ~TEI 1000 | ~TEI 1250 | ~TEI 1500 |

Go-out uses wider steps because race outcomes are noisier than points campaigns. The leaderboard also shows **percentile** (top X%) within each board so rank stays meaningful when raw TEI gaps compress.

### How your TEI moves

After each **rated** match, the app applies a standard Elo update: expected score from the rating gap, then adjust by win (1) or loss (0). **K-factor** (how fast TEI moves) depends on how many unassisted matches you have already played in that bucket:

| Unassisted matches in bucket | K-factor |
| --- | --- |
| First 10 | 40 |
| 11–30 | 32 |
| 31+ | 24 |

Early games swing more; veterans stabilize.

### Starting TEI *(Academy)*

Before your **first rated** match in each track, complete **Starfleet Academy placement** for that track: pick Class IV, Class III, or Class II, then save a starting TEI within that class’s band. Tracks are independent — strong at go-out but new to points campaigns is fine. If you skip placement and play unassisted, the first match in that track’s bucket begins from **TEI 1000**.

### What counts as rated

Only **unassisted** solo matches update TEI:

- **Rated:** you played without invoking the in-game **tactical advisor** during live turns.
- **Assisted:** you requested a coach suggestion during play. The win or loss still appears in your profile and general stats, but **TEI does not move**. Assisted wins are tracked separately (`advisorMatches` / `advisorWins`).

Downloading a post-match advisor report or campaign analysis does **not** disqualify a match.

### After the sector

When a rated match completes, the sector summary shows TEI **before → after** and the delta when applicable. If Firebase is unavailable, local decision-quality feedback may still run, but the TEI is not saved.

---

## Quick reference — standard vs Warp 12 extras

**Official Warp 12 rules** (recommended preset) — see **Section VI** — enables Q-Continuum, Salamander, Drop to Impulse (1-tile catch), and All Stop! ceremony on standard **Sections I–V** gameplay.

| Rule | Standard Mexican Train | Warp 12 |
| --- | --- | --- |
| Train marker when stuck | Required | Distress Beacon — same |
| Voluntary marker while able to play | **No** | **No** (unless **Manual shield control** — own trail required) |
| Play elsewhere while marked | Allowed; marker stays | Same |
| Play on own trail while marked | Marker **must** come off | Shields Up — same |
| Doubles | Must satisfy / cover | Red Alert — same |
| Chicken foot on doubles | Optional house variant | Subspace Fracture — opt-in; scope: Own Trail / All Captains / All Doubles |
| Own trail before opponents | Optional Deluxe variant | House rule — opt-in |
| NZ after all trails | Optional Deluxe variant | House rule — opt-in |
| Beacon clears on any play | Optional Deluxe variant | House rule — opt-in |
| Round starter plays two | Optional Deluxe variant | House rule — opt-in |
| 0-0 anomaly | — | Q-Continuum — Official Warp 12 preset |
| 12-12 Salamander Penalty | — | Salamander — Official Warp 12 preset |
| NZ win announcement | — | All Stop! ceremony — Official Warp 12 preset |
| One tile left announce | — | Drop to Impulse — Official Warp 12 preset (1-tile catch) |
| Double-blank (0-0) score | 50 (tournament standard) | Setup option 50 / 25 / 0 — Official Warp 12 preset uses 0 (Q-Continuum trigger) |
| Blocked boneyard | Round ends, all score | Blocked sector — same |
| AI officers / tactical advisor | — | Section VII — digital only |
| Solo TEI vs AI | — | Section VIII — leaderboard.warp12.app; unassisted matches only |
