# WARP 12: Navigational Operations Manual

*A double-twelve Mexican Train variant, with federation terminology.*

### A note on "official" rules

Unlike chess, Mexican Train dominoes has no governing body and no single canonical ruleset. Almost every published source, commercial app, and family table differs on the details — hand sizes, the value of the blank, when a train opens, how doubles are handled, and dozens of optional variants. There is no authority to appeal to; there is only common practice.

Warp 12 does not claim otherwise. We have studied the most widely cited sources and tournament-style conventions and tried to stay true to the *spirit* of authentic Mexican Train, while making deliberate, documented choices wherever those sources disagree. The result is meant to be two things at once:

- **A faithful, flexible base.** The most common variations are supported as configurable options, so you can tune a table toward whatever "standard" your group grew up with.
- **An opinionated house standard.** The **Official Warp 12 rules** preset (Section VI) bundles our recommended choices and adds a little fun on top — much as other domino publishers have shaped their own signature editions.

Where this manual says "standard" or "tournament practice," read it as *the common convention Warp 12 has chosen to adopt*, not a claim of sanctioned authority. This is our best attempt to honor the game, cover the popular variants, and establish a Warp 12 standard worth playing.

This document is the authoritative rules reference **for Warp 12**. **Sections I–V** follow widely published Mexican Train practice (double-twelve set, engine double set aside before the deal, personal trains, Mexican Train / Neutral Zone, train markers, doubles, boneyard, multi-round scoring). **Section VI** lists optional Warp 12 modules and the **Official Warp 12 rules** recommended preset.

> **Digital implementation note:** Warp 12 enforces these rules in software. Setup defaults to **Official Warp 12 rules** (Section VI); hosts may change any toggle before launch. This manual describes behavior when modules are **on** or **off** as stated in each section. **Section VII** describes AI officers and the tactical advisor; **Section VIII** describes solo TEI and the public leaderboard (digital play only). The app also offers **Warp 9 / 15 / 18** as **exhibition** (unrated) sets — see Section II.

---

## The Captain's Oath — Honor of the Fleet

Warp 12 has no referees. Like the living-room Mexican Train tables it descends from, it runs on the honor of the people at the table — and on an older ideal, the one every officer sworn to explore the deep black knows by heart: that *how* you serve matters as much as whether you win.

Every captain who takes the conn is expected to hold the line:

- **We play with Honor.** A clean win is the only win worth logging. We do not cheat, exploit bugs, or manipulate a match to move a rating.
- **We use sanctioned code.** Rated play runs on the official Warp 12 build and its published engine. We do not tamper with the client, spoof results, or automate our turns.
- **We earn our rating.** TEI reflects genuine, unassisted skill. We do not farm it against weak opponents, collude to feed it, or sandbag to protect it.
- **We keep the pool clean.** If we witness cheating, we name it and report it. Guarding the integrity of the leaderboard is every captain's duty, not the fleet's alone.
- **We respect the table.** Opponents, AI officers, and hosts all deserve a fair match, played to its finish.

A rated sector is a matter of record — treat it like one. Only sanctioned builds and eligible matches are ever rated; an unrated table carries no standings, but it carries the same courtesy. Play like it matters, because to a captain worth the uniform, it always does.

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
| — | **Continuum Flash** — optional Module Alpha anomaly on 0-0 |
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
   | 7–8 | 10 *(default; host may set 11 — see below)* |

   > **Large fleet hand size (7–8 captains).** This is the one setup value where widely published rule sets genuinely disagree: Masters of Games and most modern/commercial sets deal **10**, while Galt (1994) and University Games deal **11**. Warp 12 defaults to **10** (it leaves a healthier Uncharted Sectors pile — 10 tiles at 8 captains versus only 2 at 11) and lets the host opt into **11** on the setup screen. It has no effect below 7 captains.

4. **Place Spacedock** in the center.
5. **Uncharted Sectors** — all remaining tiles face down.

**Round starter:** Round 1 opener is designated by fleet command (typically the host). Each later round, the starter rotates clockwise. The starter charts first; Spacedock was still set aside before the deal.

**Optional modules** (Section VI) and **Subspace Fracture** must be agreed before launch. Digital setup defaults to the **Official Warp 12 rules** preset (see Section VI). Hosts can change any toggle before launch.

### Exhibition sets *(digital — Warp 9 / 15 / 18)*

Sections I–V above describe the **double-twelve** game. The digital app also supports larger and smaller Mexican Train sets as **exhibition** sectors — same protocols, different bone count and fleet caps. These never update TEI (Section VIII).

| Factor | Set | Tiles | Fleet | Points campaign |
| --- | --- | --- | --- | --- |
| **Warp 9** | Double-9 | 55 | 2–4 | 10 rounds (9-9 → 0-0) |
| **Warp 12** | Double-12 | 91 | 2–8 | 13 rounds (12-12 → 0-0) — *rated* |
| **Warp 15** | Double-15 | 136 | 2–12 | 16 rounds (15-15 → 0-0) |
| **Warp 18** | Double-18 | 190 | 2–18 | 19 rounds (18-18 → 0-0) |

Hand sizes for Warp 9 / 15 / 18 follow the engine’s set profile. The **7–8 captain 10-vs-11** host choice still applies on Warp 15 / 18 when the fleet is exactly 7 or 8; fleets of **9+** use fixed profile sizes (9 / 8 / 7 / 6 as the table grows). Official-rules presets on exhibition factors use that factor’s full campaign length, not thirteen rounds.

---

## III. Standard gameplay

Play proceeds clockwise. Each turn, unless a special protocol applies (Red Alert, Subspace Fracture, Continuum Flash resolution), a captain does **one** of the following:

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

*(Opt-in exception — Section VI **Pass Red Alert without draw or beacon**: the captain who **charted** the double may pass it on immediately, without drawing or deploying a beacon, but only during **Yellow alert**. Once the alert has passed once, standard rules resume for everyone, including that captain when it comes back around.)*

---

## IV. Doubles — Red Alert protocol

When a **double** (matching pips on both ends) is charted on any eligible route — your Warp Trail, the Neutral Zone, or an open opponent trail — announce **"Red Alert!"**

- The captain who charted the double must **satisfy** it by playing another valid tile on that double **in the same turn sequence**, unless turn rules below apply. *(Standard cover: one matching tile on the double. Subspace Fracture: three stabilizers — Section VI.)*
- **Going out:** An empty hand does **not** win the round while your chart left a double unsatisfied. Chart the cover (or final stabilizer) first; only then may an empty hand end the sector.
- If you cannot satisfy it, draw from Uncharted Sectors; if you still cannot, deploy your Distress Beacon and pass Red Alert to the next captain.

**Worked example — pass Red Alert after already drawing.** Captain A draws once from Uncharted Sectors, then charts a double they cannot cover. The pile still has tiles, but Captain A **does not draw again** — **one draw per turn**. They deploy their Distress Beacon and **pass Red Alert** to the next captain.

**Worked example — empty hand without going out (tournament-style).** Four captains, points campaign, Red Alert only (no Subspace Fracture). Captain A's **last tile** is **12-12**. A charts it on Captain B's open Warp Trail but **does not cover** the double. A's hand is empty, but the round **does not** end — A was **not officially out**.

Red Alert responsibility is on A. A cannot cover the double, so A **passes Red Alert** (drawing first if Uncharted Sectors still hold tiles and A has not drawn this turn; otherwise deploy beacon and pass). Responsibility moves to B, then C. Captain C **covers** the double with **11-12**. Red Alert clears and normal play resumes.

Captain B still holds **one tile** and later charts it legally, emptying B's hand. **B wins the round** and scores **0** for that round. A's hand is still empty, but A is **not** the round winner.

*If B had not gone out:* play would continue around the table. A is still **not** out of the sector. On A's later turns with **no legal charts** and the beacon up: if Uncharted Sectors are **empty**, A may **pass**; if tiles **remain**, A **must draw one** before passing (same stuck-with-no-play rule as everyone else) and re-enters the round with a tile in hand. The round ends when someone **legally** goes out or the sector is **blocked** (Section V).

*Points campaign:* A may still win the **sector** on lowest cumulative penalty even when another captain wins this round — **round winner** and **sector winner** are different tallies (Section V).

- While Red Alert is active, **no other routes** may be played until the double is satisfied.
- **Dead double:** If every tile in the set containing that pip is already charted (all thirteen tiles showing that number in a double-twelve set), the double cannot be satisfied — Red Alert ends and normal play resumes.
- Covering a double on another captain's open trail **does not** clear their Distress Beacon.

**One double at a time.** Warp 12 resolves doubles one at a time: chart a double, satisfy it (cover tile, or three stabilizers under Subspace Fracture), and your turn ends. Because a cover must match the double's pip and no other double shares that pip, a cover is always a non-double — you never chain into a fresh Red Alert, and you do not play multiple doubles in a single turn. (Some casual house rules let a captain lay several doubles in one turn as long as the last is covered by a non-double; Warp 12 follows the tournament-style single-double resolution instead.)

### Yellow alert and Red Alert *(digital status)*

The rules engine treats every uncovered double as **Red Alert** — the same protocol throughout. On the bridge display and in the sector log, you will see two **status labels** for the same alert:

- **Yellow alert** — the double was just charted; the responsible captain has **not** yet passed Red Alert to someone else.
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

The round ends when one captain charts their **last** coordinate (empty hand) **and** no Red Alert or Subspace Fracture on that chart still requires satisfaction. You **cannot** go out on an open double — cover it (or complete three stabilizers when Subspace Fracture applies) before the sector closes. See the worked example in **Section IV** (empty hand without going out).

**All Stop!** When the house rule is **on** (default), a round-winning chart on the **Neutral Zone** — or any go-out while **All Stop! echo** is active — ends the sector immediately and the app **automatically** logs and announces **All Stop!** (sound + round log). No helm hold and no manual button.

Turn **All Stop! ceremony** off in game options for pure standard Mexican Train: Neutral Zone go-outs end the round silently, with no announcement.

**All Stop! echo** (Continuum Flash Module Alpha): when active, **any** round-winning chart triggers the same auto ceremony when the house rule is on.

**Drop to Impulse** *(house rule — off by default)*: when a captain charts down to **one** coordinate remaining, they are **at impulse** — their turn **continues**, but they **cannot chart again** on that turn. This matches standard Mexican Train **knock**: reaching one tile does not let you silently play that last coordinate.

They must **Drop to Impulse!** (announce and **pass helm** with one tile still in hand) or **pass** without announcing and risk a **catch**. On a **later** turn they may chart their last coordinate under normal rules — including going out when the hand empties.

If they **pass** without having announced, any other captain may **catch** the miss while the catch window is open. A successful catch forces the forgetful captain to draw from Uncharted Sectors (1 or 2 tiles per game setup, if any remain) — they **return to warp** (no longer at impulse). The window opens when they pass without announcing and **closes** when the **next** captain passes helm (if no one caught). This is separate from **All Stop!** ceremony.

If they **cannot play** their last coordinate and **draw** from Uncharted Sectors while at impulse, that draw **returns them to warp** — there is no need to announce first; drawing already ends the impulse state.

### Blocked sector

If Uncharted Sectors are empty and **no captain** can make a legal chart (after dead doubles are resolved), the round ends **without** a domino winner. **Every** captain scores the pip total of tiles in hand — no exempt captain. All table tiles, hands, and any remaining pile are shuffled for the next round's deal (standard Mexican Train recycle — trails are not trimmed to open ends).

### Round scoring *(points campaign)*

When a round ends with a winner, every **other** captain totals pip values in hand and adds that to their campaign score. The round winner scores **0** for that round.

**Double-blank (0-0):** a double-blank caught in hand scores by the **Double-blank score** setting — **50** (tournament standard, the default for hand-built rule sets), **25**, or **0** (pips). The **Official Warp 12 rules** preset uses **0** so the 0-0 stays safe to hold as the Continuum trigger (Module Alpha). This is independent of the Salamander Penalty, which only affects **12-12**.

**Next round:** Spacedock steps down one double (12-12 → 11-11 → … → 0-0). After round 13, lowest cumulative points total wins.

### How to tally the score *(step by step)*

The app does this automatically at round end and shows a summary before the next deal. The procedure below is for understanding the math (and for tabletop play with physical tiles).

1. **Decide who counts.** When a captain goes out (empty hand), that **round winner scores 0**. Every **other** captain counts the tiles left in their hand. In a **blocked sector** (no winner), there is no exemption — **every** captain counts their hand.
2. **Count a hand.** A tile is worth the **total number of pips on it — both ends added together**. A blank end counts as **0**. So:
   - `5-3` = **8**, `6-0` (blank) = **6**, `0-0` (double-blank) = **0 pips**.
   - A **double counts both halves**: `9-9` = **18**, `12-12` = **24**.
   - Add every tile in the hand to get that captain's **round score**.
3. **Apply special-tile settings** (if enabled — see Section VI):
   - **Double-blank (0-0):** scored by the **Double-blank score** setting — **50** (tournament standard, the default for hand-built rule sets), **25**, or **0** (its 0 pips). The **Official Warp 12 rules** preset uses **0**.
   - **Salamander Penalty (Module Beta):** a held **12-12** scores **double — 48** (from round 2 onward). See **Section VI → Module Beta**. It affects only the 12-12 tile.
4. **Add to the campaign total.** Add each captain's round score to their running cumulative total. Lower is better.
5. **Advance the round.** Step Spacedock down one double (`12-12 → 11-11 → … → 0-0`), re-deal, and play the next round. There are **13 rounds** in a full points campaign.
6. **Declare the winner.** After round 13, the captain with the **lowest cumulative total** wins the sector. If two or more captains tie on the lowest total, they **share** the victory.

**Worked example (round 5, Salamander off).** Armstrong goes out → **0**. Lovell holds `5-3`, `9-9`, `6-0` → 8 + 18 + 6 = **23**. Earhart holds `0-0` and `4-2` with Double-blank score = 50 → 50 + 6 = **56**. Those round scores are added to each captain's campaign total; Armstrong adds nothing.

**Go out mode.** There is **no pip tally** — the first captain to empty their hand in any single round wins the sector immediately.

---

## VI. Optional directives and variants

*Agree before launch. Unless noted, these are **not** part of standard Mexican Train tournament practice — though **Sections I–V** (trains, marker, draw, doubles, scoring) still apply underneath.*

### Official Warp 12 rules *(recommended preset)*

This is the **encouraged default** for Warp 12 — living-room tables, online sectors, and any future **Warp 12–branded** play. It is **not** a claim of sanctioned third-party tournament rules; it is the rules bundle this project recommends when you want the full Warp 12 experience without assembling toggles by hand.

In the app, choose **Official Warp 12 rules** on the setup screen (or accept the defaults). Everything in **Sections I–V** applies; the preset only turns on the extras below.

| Setting | Official Warp 12 preset |
| --- | --- |
| **Module Alpha — Continuum** | **On** |
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

**Fracture immunity** (Continuum Flash Module Alpha): the next double on your own trail opens Red Alert but **does not** open Subspace Fracture (regardless of scope).

### House rules *(Deluxe-style — off in Official Warp 12 preset)*

Hosts may enable any combination before launch.

| Toggle | When enabled |
| --- | --- |
| **Require own trail first** | You must chart at least one tile on **your own** Warp Trail before playing on an opponent's open trail. The Neutral Zone and your own trail are unaffected. |
| **Neutral Zone after all trails started** | The Neutral Zone cannot be started until **every** captain has at least one tile on their own Warp Trail. |
| **Beacon clears on any play** | Any legal chart removes **your** Distress Beacon — not only a chart on your own trail. |
| **Round starter plays two** | The round starter must chart **two tiles on their own Warp Trail** on their opening turn (Spacedock + two from hand). If the first tile is a double, the Red Alert cover counts as the second. If you cannot play the second tile, deploy your Distress Beacon — no extra draw. Cannot start the Neutral Zone or opponent trails until both are played. |
| **Drop to Impulse** | At one coordinate left (**at impulse**), your turn continues but you **cannot chart** until you **Drop to Impulse!** (announce and pass helm) or **pass** without announcing (opponents may **catch** — 1 or 2 tile penalty per setup). Draw while stuck at impulse → **return to warp**. Catch window closes when the next captain passes helm. |
| **Pass Red Alert without draw or beacon** | Only the captain who **charted the double** gets this break, and only while the alert is still in **Yellow alert** (before it has passed to anyone). If they cannot cover their own double, they may pass responsibility to the next captain **without drawing** from Uncharted Sectors and **without** deploying their Distress Beacon. Red Alert then proceeds normally: every other captain — and the original captain when it cycles back to them — must follow standard rules (draw when tiles remain, deploy the beacon on pass). |
| **Manual shield control** | Replaces the automatic "shields rise when you chart your own trail" behavior with manual control, all **during** your turn (never between turns). **Open (Shields down):** you may open your own Warp Trail at any time, for any reason — even with legal plays in hand and even before you've started your trail. **Close (Shields up):** after you drop shields you must chart at least one tile on **your own** Warp Trail before you may raise them again (that own-trail chart may be this turn or a later one); charting your own trail does **not** auto-raise. **One shield change per turn** — a single open **or** a single close, never both and never repeated. Shield changes never pass helm on their own; adjust, then chart or **Pass**. Standard draw/marker rules still apply when you cannot chart (a forced marker after a failed draw ends your turn). |

### Module Alpha — The Continuum *(on in Official Warp 12 preset)*

When **enabled**, charting **0-0 on your own Warp Trail** triggers a **Continuum Flash** before helm passes. That captain immediately chooses **one** directive for the rest of the round (cleared when the sector scores):

| Continuum Flash | Effect |
| --- | --- |
| **Reverse turn order** | Helm passes counter-clockwise for the rest of the round. |
| **Skip lowest points** | The captain with the lowest campaign points score skips their next turn. |
| **Peek Uncharted Sector** | The invoker sees the top tile in Uncharted Sectors (hidden from others). |
| **Temporal inversion** | Turn order reverses until the next double is charted on the table. |
| **Distress amplification** | All warp trails are open to every captain without a Distress Beacon. |
| **Fracture immunity** | The next double on an own trail will not open Subspace Fracture (Red Alert still applies). |
| **Salamander swap** *(requires Module Beta)* | If anyone holds 12-12 at round end, the full 48-point Salamander penalty lands on the highest-points captain instead — the holder pays nothing for that tile. |
| **All Stop! echo** | Any captain going out this round must call All Stop! before the sector closes. |
| **Q's gamble** | Draw two tiles from Uncharted Sectors — keep one, return the other face-down. |

0-0 charted on the Neutral Zone or an opponent's trail does **not** trigger Continuum Flash. A winning 0-0 on your own trail still requires Continuum Flash resolution before the sector can close.

### Module Beta — The Salamander Penalty *(on in Official Warp 12 preset)*

If a round ends and a captain holds **12-12** in hand, that tile scores **double its pips — 48** (its normal both-ends value is 24). Round 1 never applies (12-12 is Spacedock). From round 2 onward, 12-12 is in circulation.

With **Salamander swap** (Continuum, Module Alpha), the **entire 48-point penalty** transfers to the highest-points captain instead — the 12-12 holder pays **nothing** for that tile, and the leader eats the full 48.

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
| **Class II** | Veteran / sharp — self-play neural policy (Ω): greedy inference, ms/move. Same Class II / σ=`commander` label — not a separate “Commander+” tier. |

Controls how often the officer blunders and how sharply it prefers high-scoring lines. All classes still obey the same legal-move and rules-engine constraints.

### Lookahead (per-officer opt-in)

When **Lookahead** is **off**, the officer uses a fast **greedy** policy: score each legal move for this turn with heuristics (shed heavy pips, own-trail pressure, Red Alert safety, objective mode, modules, and so on) and pick among them.

When **Lookahead** is **on**, the officer **forward-searches** before acting:

1. For each candidate move, it runs the move through the **real Warp 12 rules engine** a few turns ahead.
2. Because opponent hands and the draw order are hidden, each simulation **guesses** plausible holdings: opponents receive a random assignment from the pool of tiles not on the table and not in the AI's hand, while preserving each opponent's **actual hand count**. Uncharted Sectors are filled from the same unseen pool.
3. The search repeats that guess several times (**determinizations**), averages the outcomes, and picks the move that tends to work best across those possible worlds.

Lookahead is **imperfect-information search** — not clairvoyance. It is slower but can reason about consequences (for example, whether a play sets up an opponent to go out). Tactical class still applies on top (blunders and noisy tie-breaking).

### Tactical advisor

The tactical advisor suggests one move plus plain-language reasons so humans can see *why* a line is strong, not only what to play.

**Today:** it uses the **Class II** simulation profile with **Lookahead** enabled (heuristic stack).

**Planned:** a hybrid neural–heuristic model **distilled from Ω** — trained to agree with the Class II neural officer's picks and explain them in named game concepts. It does **not** imitate legacy Commander heuristics. Assisted play remains unrated (below).

Invoking the tactical advisor **during live play** marks the match as **assisted** for rating purposes (Section VIII). Post-match advisor reports and campaign downloads do **not** affect whether a match is rated.

### Ω+ extended thinking *(planned, exhibition)*

The same Ω neural weights can run with **extended thinking** — Commander-free PUCT search (Omega policy prior + value leaves) with a per-move iteration budget. Stronger than greedy Class II play when the value head is competent; slower. Intended for exhibition / casual hard mode, not as a separate rated anchor.

---

## VIII. TEI & leaderboard *(digital)*

Local solo sectors against **AI officers** can report results to **[iwdf.org](https://iwdf.org)** when the client is signed in to Firebase. Team campaigns, unrated lobby modes, and builds without a working stats backend do not update the public boards.

Warp 12 keeps **three rating contexts**, each split into **Go-out** and **Points** tracks:

- **Solo pool** — unassisted matches against reference AI officers (Class IV / III / II).
- **Human pool** — online sectors and officiated matches **without** a crew charter (global `humanTei`).
- **Crew charters** — friend-group ladders on [iwdf.org/crews](https://iwdf.org/crews); scoped **group TEI** per charter. See [Crews & charters](docs/crews-roadmap.md).

The normative rating math (Elo update, reference bands, multi-captain human tables) is defined in **[docs/tei-spec.md](docs/tei-spec.md)** for third-party interoperability.

### Online sectors (human pool)

A completed online sector is rated into the **human pool** when it meets every condition below; otherwise it plays out normally but changes no ratings. The lobby shows a live **rated / unrated** banner so the fleet knows before launch.

- **The set is double-twelve (Warp 12).** Warp 9 / 15 / 18 are **exhibition** — the lobby forces unrated and the server rejects TEI reports for those sets.
- **Two or more captains are signed in with an account.** Guests (anonymous sign-in) can play, but a guest at the table makes the whole sector unrated — a rating that can't persist across devices isn't a rating.
- **Every AI officer is Class IV / III / II.** These have fixed reference strength and serve as rating **anchors**: finishing above or below them moves your TEI, which keeps online results on the same scale as solo play. An experimental **Class I\*** search officer makes the sector unrated. (Class II is a neural policy — still rated, same σ=`commander` anchor.)
- **The objective is Points or Go-out.** Other modes are unrated.
- **No captain consulted the tactical advisor.** Just as in solo play, invoking the in-game advisor during live turns makes a match *assisted* — and online, one assisted captain leaves the **whole** sector unrated. You are warned the moment you engage it.

When the sector ends, every signed-in captain's TEI is updated with a single pairwise pass over the final standings (see the spec, §6.5 / §10). The server re-derives the result from the authoritative game record and re-checks each seat, so no captain can report a score they didn't earn. Ratings are applied once per sector.

### Crews & charters (group TEI)

A **crew** is a persistent friend group with a **charter** — a frozen contract: Official Warp 12 rules (`warp12-official-v1`), objective (Points or Go-out), fleet size (2–8), and campaign length. When a rated match or online sector is played **under a crew charter**, TEI updates go to that crew's ladder (`groupTei`), not the global human pool.

- **Create / join** at [iwdf.org/crews](https://iwdf.org/crews). **Google sign-in required.** No shared crew passwords — invite links only (owner can rotate).
- **Officiated nights:** the match official selects the crew when creating an `MT-` code. All checked-in captains must be crew members. Approval moves **crew TEI only**.
- **Online sectors:** the host selects a crew in the lobby waiting room; fleet size, objective, and rules lock to the charter. Sector must match exactly or it stays unrated (`charter_mismatch`).
- **Guests** at the table do not earn crew TEI (same as global human pool).
- **Global Official** is a special open charter (`global-official`). Rated play under it updates **both** the Global Official crew ladder **and** global human-pool TEI.

The [TEI calculator](https://iwdf.org/calculator) can preview crew-ladder outcomes without saving anything. Full design: [docs/crews-roadmap.md](docs/crews-roadmap.md).

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

### Federation Academy placement

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

Before your **first rated** match in each track, complete **Federation Academy placement** for that track: pick Class IV, Class III, or Class II, then save a starting TEI within that class’s band. Tracks are independent — strong at go-out but new to points campaigns is fine. If you skip placement and play unassisted, the first match in that track’s bucket begins from **TEI 1000**.

### What counts as rated

**Solo pool** — only **unassisted double-twelve** matches update TEI:

- **Rated:** Warp 12, played without invoking the in-game **tactical advisor** during live turns.
- **Assisted:** you requested a coach suggestion during play. The win or loss still appears in your profile and general stats, but **TEI does not move**. Assisted wins are tracked separately (`advisorMatches` / `advisorWins`).
- **Exhibition:** Warp 9 / 15 / 18 never update TEI, with or without the advisor.

Downloading a post-match advisor report or campaign analysis does **not** disqualify a match.

**Human pool** — an online sector is rated when it clears the eligibility bar above (Warp 12, two or more signed-in captains, only Class IV / III / II AI, Points or Go-out, **and no captain used the advisor**). Any guest, experimental Class I\* seat, exhibition set, or advisor consult leaves the whole sector unrated.

**Crew charter** — same eligibility bar, plus: host attached a `charterId`; sector settings match the charter (fleet size, objective, campaign length, rules profile); every human captain is a signed-in **member** of that crew. Private crew matches update crew TEI only. **Global Official** also updates global human-pool TEI.

> **Class II is neural Ω.** Greedy `createOmegaPlayer` is the Class II officer (local, online host, pass-and-play). TEI still uses σ=`commander`; publish `warp12-official-v2` when recalibrated `REF_TEI` ships. Ω+ extended thinking (PUCT) is unrated exhibition. See [docs/omega-handoff.md](docs/omega-handoff.md) and [docs/tei-spec.md](docs/tei-spec.md) §7.1.3.

### After the sector

When a rated match completes, the sector summary shows TEI **before → after** and the delta when applicable. If Firebase is unavailable, local decision-quality feedback may still run, but the TEI is not saved.

---

## IX. Subspace messaging *(digital — online sectors)*

Online sectors include a persistent comms channel — **subspace messaging** — so captains can coordinate before launch, react during play, and debrief afterward. Messaging is designed to preserve the integrity of rated sectors while keeping casual games social.

### Comms modes

| Context | Mode | What's available |
| --- | --- | --- |
| **Lobby** (rated or casual) | Full | Quick-phrase hails, free-form text, DMs |
| **Active play — casual sector** | Full | Quick-phrase hails, free-form text, DMs |
| **Active play — rated sector** | Quick-only | Public quick-phrase hails only. No free text, no DMs. |
| **Post-game** (rated or casual) | Full | All comms re-open once standings are final |

The restriction during rated active play exists to prevent collusion — free text or private messages between opponents could be used to coordinate play, which would undermine TEI. The quick-phrase catalog is intentionally social and expressive, never strategic.

### Quick-phrase hails

Five groups, each with a category icon:

- **Acknowledge** — Aye Captain · Acknowledged · Make it so · Course laid in
- **Get moving** — Engage! · Punch it · Warp speed · Ahead full · Steady as she goes
- **Sportsmanship** — Well played · A fine maneuver · The needs of the many… · Fly well, Captain
- **Drama** — Red Alert! · Shields up! · All Stop! · Distress beacon away · She's breaking up! · Fascinating… · Bold. Very bold.
- **Cheeky** — You're playing a dangerous game · Persistence is futile · Resistance is… noted · I have the conn now · Q would be proud

Phrases are broadcast publicly and logged in the sector record. They cannot convey hand information or coordinate play, only camaraderie and table talk.

### Free-form text and DMs

Available in the lobby, casual active play, and after the sector completes. Messages are visible to all sector members (including DMs — transparency over privacy, consistent with The Captain's Oath). A per-recipient picker lets you direct a message, but every captain at the table can read it.

### Moderation

- **Per-user mute:** hide a captain's messages for the remainder of the session.
- **Rate limiting:** a cooldown prevents message flooding (burst of 3, then 3 seconds between sends).
- Future: report action tied to The Captain's Oath's "we identify cheaters and bad actors."

### Rated sector toggle

The host can opt out of rating at any time before launch by unchecking **Rated sector** in the lobby. When unchecked:

- TEI will not change regardless of the sector's outcome.
- Full comms (text + DMs) remain available during active play.
- The lobby and bridge show a "Casual sector" banner so all captains know the match is unrated.

---

## Quick reference — standard vs Warp 12 extras

**Official Warp 12 rules** (recommended preset) — see **Section VI** — enables Continuum, Salamander, Drop to Impulse (1-tile catch), and All Stop! ceremony on standard **Sections I–V** gameplay.

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
| 0-0 anomaly | — | Continuum — Official Warp 12 preset |
| 12-12 Salamander Penalty | — | Salamander — Official Warp 12 preset |
| NZ win announcement | — | All Stop! ceremony — Official Warp 12 preset |
| One tile left announce | — | Drop to Impulse — Official Warp 12 preset (1-tile catch) |
| Double-blank (0-0) score | 50 (tournament standard) | Setup option 50 / 25 / 0 — Official Warp 12 preset uses 0 (Continuum trigger) |
| Blocked boneyard | Round ends, all score | Blocked sector — same |
| AI officers / tactical advisor | — | Section VII — digital only |
| Solo TEI vs AI | — | Section VIII — iwdf.org; unassisted matches only |
| Online TEI (human pool) | — | Section VIII — auto-rated when all captains are signed in and any AI are Class II–IV |
| Crew / charter TEI | — | Section VIII — group TEI via leaderboard crews + officiated or online rated sectors |
| Global Official TEI | — | Section VIII — open charter; updates crew + global human pool |
| Subspace messaging | — | Section IX — quick hails always; free-form/DMs in lobby, casual, and post-game only |
