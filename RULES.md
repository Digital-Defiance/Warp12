# WARP 12: Navigational Operations Manual

*Standard double-twelve Mexican Train, with Starfleet terminology.*

This document is the authoritative rules reference for Warp 12. **Sections I–V** follow published Mexican Train tournament practice (double-twelve set, engine double set aside before the deal, personal trains, Mexican Train / Neutral Zone, train markers, doubles, boneyard, multi-round scoring). **Section VI** lists optional Warp 12 modules agreed before launch.

> **Digital implementation note:** Warp 12 enforces these rules in software. Live tournament directors may adopt the same text, but should confirm module toggles (Subspace Fracture, Q-Continuum, Salamander Penalty) and objective mode before play. This manual describes behavior when modules are **on** or **off** as stated in each section. **Section VII** describes AI officers and the tactical advisor (digital play only).

---

## Victory conditions

Fleet command chooses one objective before the sector opens:

| Mode | Goal |
| --- | --- |
| **Penalty campaign** *(standard)* | Thirteen rounds — Spacedock descends **12-12** through **0-0**. Lowest **cumulative penalty score** wins the campaign. |
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

**Optional modules** (Section VI) and **Subspace Fracture** must be agreed before launch. Defaults in the digital table: Salamander Penalty on; Q-Continuum and Subspace Fracture off unless enabled in the lobby.

---

## III. Standard gameplay

Play proceeds clockwise. Each turn, unless a special protocol applies (Red Alert, Subspace Fracture, Q-Flash resolution), a captain does **one** of the following:

1. **Chart** one legal coordinate, if any exist.
2. **Draw** one tile from Uncharted Sectors, then follow the draw rules below.
3. **Deploy a Distress Beacon** only when unable to chart and the draw pile is empty (or immediately after drawing, if still unable to chart).
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
- If it cannot be played, you deploy your **Distress Beacon** if the pile is now empty; otherwise your turn ends and you keep the tile.

### Distress Beacon (train marker)

Deploy your beacon when — and **only** when — you cannot make a legal chart after drawing, or when the pile is already empty and you still cannot chart.

- **Shields Down:** While your beacon is active, other captains may chart on your Warp Trail.
- **Shields Up:** Your beacon is removed **automatically** when **you** chart on **your own** Warp Trail. Charting on the Neutral Zone or another captain's trail leaves your beacon active.
- **You cannot** deploy a beacon voluntarily while you still have a legal chart elsewhere. *(Standard Mexican Train — no “strategic pass.”)*
- **Passing:** If your beacon is already up, you cannot chart, and Uncharted Sectors are empty, you may **pass** your turn without charting; your beacon stays up.

### Red Alert pass

If you cannot satisfy an active Red Alert after drawing (or with an empty pile), you deploy your Distress Beacon and **Red Alert responsibility passes** to the next captain. The alert remains until the double is satisfied.

When **Subspace Fracture** is active (Section VI), “satisfy” means **stabilizers** — not a separate cover tile. Pass Red Alert only when you cannot add the next stabilizer.

---

## IV. Doubles — Red Alert protocol

When a **double** (matching pips on both ends) is charted on any eligible route — your Warp Trail, the Neutral Zone, or an open opponent trail — announce **"Red Alert!"**

- The captain who charted the double must **satisfy** it by playing another valid tile on that double **in the same turn sequence**, unless turn rules below apply. *(Standard cover: one matching tile on the double. Subspace Fracture: three stabilizers — Section VI.)*
- **Going out:** An empty hand does **not** win the round while your chart left a double unsatisfied. Chart the cover (or final stabilizer) first; only then may an empty hand end the sector.
- If you cannot satisfy it, draw from Uncharted Sectors; if you still cannot, deploy your Distress Beacon and pass Red Alert to the next captain.
- While Red Alert is active, **no other routes** may be played until the double is satisfied.
- **Dead double:** If every tile in the set containing that pip is already charted (all thirteen tiles showing that number in a double-twelve set), the double cannot be satisfied — Red Alert ends and normal play resumes.
- Covering a double on another captain's open trail **does not** clear their Distress Beacon.

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

**All Stop!** If that winning chart was on the **Neutral Zone**, the winner must announce **"All Stop!"** before the sector closes. Helm is **held** until they do — no other captain may take a turn. Calling All Stop! ends the round and scores normally.

If the winner does not call All Stop!, they may accept a penalty instead: draw **one** tile from Uncharted Sectors, clear the pending win, and the round **continues** (they do not win yet). On the digital table this is **Return to warp**. If Uncharted Sectors is empty, the penalty cannot be drawn until tiles are available or the sector blocks.

**All Stop! echo** (Q-Flash Module Alpha): when active, **any** round-winning chart (not only the Neutral Zone) requires calling All Stop! before scoring — same hold, penalty, and Return to warp rules as above.

**Drop to Impulse** *(house rule — off by default)*: when a captain charts down to **one** coordinate remaining, their turn **continues** — they may still chart, draw, cover Red Alert, or pass. They **may** announce **"Drop to Impulse!"** at any point that turn; announcing does **not** end the turn. They are **not** required to announce before passing.

If they **pass** without announcing, any other captain may **catch** the miss while the catch window is open. A successful catch forces the forgetful captain to draw **one** penalty tile from Uncharted Sectors (if any remain). The window opens when they pass without announcing and **closes** when the **next** captain passes helm (if no one caught). This is separate from **All Stop!** (Neutral Zone / echo go-out ceremony).

### Blocked sector

If Uncharted Sectors are empty and **no captain** can make a legal chart (after dead doubles are resolved), the round ends **without** a domino winner. **Every** captain scores the pip total of tiles in hand — no exempt captain. All table tiles, hands, and any remaining pile are shuffled for the next round's deal (standard Mexican Train recycle — trails are not trimmed to open ends).

### Penalty scoring *(penalty campaign)*

When a round ends with a winner, every **other** captain totals pip values in hand and adds that to their campaign score. The round winner scores **0** for that round.

**Next round:** Spacedock steps down one double (12-12 → 11-11 → … → 0-0). After round 13, lowest cumulative penalty wins.

---

## VI. Optional directives and variants

*Agree before launch. Unless noted, these are **not** part of standard Mexican Train.*

### Subspace Fracture *(chicken foot — off by default)*

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

### House rules *(Deluxe-style — off by default)*

Hosts may enable any combination before launch. Defaults match **standard Mexican Train**.

| Toggle | When enabled |
| --- | --- |
| **Require own trail first** | You must chart at least one tile on **your own** Warp Trail before playing on an opponent's open trail. The Neutral Zone and your own trail are unaffected. |
| **Neutral Zone after all trails started** | The Neutral Zone cannot be started until **every** captain has at least one tile on their own Warp Trail. |
| **Beacon clears on any play** | Any legal chart removes **your** Distress Beacon — not only a chart on your own trail. |
| **Round starter plays two** | The round starter must chart **two tiles on their own Warp Trail** on their opening turn (Spacedock + two from hand). If the first tile is a double, the Red Alert cover counts as the second. If you cannot play the second tile, deploy your Distress Beacon — no extra draw. Cannot start the Neutral Zone or opponent trails until both are played. |
| **Drop to Impulse** | When you chart down to one coordinate, your turn continues. You may announce **Drop to Impulse!** voluntarily; announcing does not end the turn. If you pass without announcing, opponents may **catch** you for one draw from Uncharted Sectors. The catch window closes when the next captain passes helm. |

### Module Alpha — The Q-Continuum *(off by default)*

When **enabled**, charting **0-0 on your own Warp Trail** triggers a **Q-Flash** before helm passes. That captain immediately chooses **one** directive for the rest of the round (cleared when the sector scores):

| Q-Flash | Effect |
| --- | --- |
| **Reverse turn order** | Helm passes counter-clockwise for the rest of the round. |
| **Skip lowest penalty** | The captain with the lowest campaign penalty score skips their next turn. |
| **Peek Uncharted Sector** | The invoker sees the top tile in Uncharted Sectors (hidden from others). |
| **Temporal inversion** | Turn order reverses until the next double is charted on the table. |
| **Distress amplification** | All warp trails are open to every captain without a Distress Beacon. |
| **Fracture immunity** | The next double on an own trail will not open Subspace Fracture (Red Alert still applies). |
| **Salamander swap** *(requires Module Beta)* | If anyone holds 12-12 at round end, that Salamander penalty applies to the highest-penalty captain instead. |
| **All Stop! echo** | Any captain going out this round must call All Stop! before the sector closes. |
| **Q's gamble** | Draw two tiles from Uncharted Sectors — keep one, return the other face-down. |

0-0 charted on the Neutral Zone or an opponent's trail does **not** trigger Q-Flash. A winning 0-0 on your own trail still requires Q-Flash resolution before the sector can close.

### Module Beta — The Salamander Penalty *(on by default in digital play)*

If a round ends and a captain holds **12-12** in hand, that tile scores **24** penalty points instead of 12. Round 1 never applies (12-12 is Spacedock). From round 2 onward, 12-12 is in circulation.

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

### Skill (Beginner / Intermediate / Advanced)

Controls how often the officer blunders and how sharply it prefers high-scoring lines. All skill levels still obey the same legal-move and rules-engine constraints.

### Lookahead (per-officer opt-in)

When **Lookahead** is **off**, the officer uses a fast **greedy** policy: score each legal move for this turn with heuristics (shed heavy pips, own-trail pressure, Red Alert safety, objective mode, modules, and so on) and pick among them.

When **Lookahead** is **on**, the officer **forward-searches** before acting:

1. For each candidate move, it runs the move through the **real Warp 12 rules engine** a few turns ahead.
2. Because opponent hands and the draw order are hidden, each simulation **guesses** plausible holdings: opponents receive a random assignment from the pool of tiles not on the table and not in the AI's hand, while preserving each opponent's **actual hand count**. Uncharted Sectors are filled from the same unseen pool.
3. The search repeats that guess several times (**determinizations**), averages the outcomes, and picks the move that tends to work best across those possible worlds.

Lookahead is **imperfect-information search** — not clairvoyance. It is slower but can reason about consequences (for example, whether a play sets up an opponent to go out). Skill level still applies on top (blunders and noisy tie-breaking).

### Tactical advisor

The tactical advisor always uses **Advanced** skill with **Lookahead** enabled. It suggests one move plus plain-language reasons so humans can see *why* a line is strong, not only what to play.

---

## Quick reference — standard vs Warp 12 extras

| Rule | Standard Mexican Train | Warp 12 |
| --- | --- | --- |
| Train marker when stuck | Required | Distress Beacon — same |
| Voluntary marker while able to play | **No** | **No** |
| Play elsewhere while marked | Allowed; marker stays | Same |
| Play on own trail while marked | Marker **must** come off | Shields Up — same |
| Doubles | Must satisfy / cover | Red Alert — same |
| Chicken foot on doubles | Optional house variant | Subspace Fracture — opt-in; scope: Own Trail / All Captains / All Doubles |
| Own trail before opponents | Optional Deluxe variant | House rule — opt-in |
| NZ after all trails | Optional Deluxe variant | House rule — opt-in |
| Beacon clears on any play | Optional Deluxe variant | House rule — opt-in |
| Round starter plays two | Optional Deluxe variant | House rule — opt-in |
| 0-0 anomaly | — | Q-Continuum — opt-in |
| 12-12 hand penalty | — | Salamander — opt-in (default on) |
| NZ win announcement | — | All Stop! (helm held until called or Return to warp penalty) |
| One tile left announce | — | Drop to Impulse — house rule, opt-in |
| Blocked boneyard | Round ends, all score | Blocked sector — same |
| AI officers / tactical advisor | — | Section VII — digital only |
