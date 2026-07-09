# Mexican Train — engine conformance against online sources

This document records how the Warp 12 rules engine (RULES.md Sections I–V, the
standard Mexican Train layer) was validated against the most widely cited online
rule sets, and where Warp 12 makes a deliberate, documented choice when those
sources disagree.

Mexican Train has **no governing body and no single canonical ruleset** — every
published source differs on some details. This is not an appeal to authority; it
is a "consensus reading" exercise. Where a rule is essentially universal, the
engine matches it and a test enforces it. Where sources conflict, the engine
picks a convention (usually tournament-style) and the divergence is called out
here and in the test comments.

## Sources consulted

| Tag | Source | URL |
| --- | --- | --- |
| **[W]** | Wikipedia, "Mexican Train" (Galt/Parsons 1994, Bauguess 2012 consensus) | https://en.wikipedia.org/wiki/Mexican_Train |
| **[MoG]** | Masters of Games | https://www.mastersofgames.com/rules/mexican-train-dominoes-rules.htm |
| **[UBG]** | UltraBoardGames ("Official Rules") | https://www.ultraboardgames.com/mexican-train/game-rules.php |
| **[GC]** | The Game Cabinet (Galt-derived) | http://www.gamecabinet.com/rules/MexicanTrains.html |
| **[DP]** | domino-play.com | http://www.domino-play.com/Games/MexicanTrain.htm |
| **[SC]** | The Spruce Crafts | https://www.thesprucecrafts.com/mexican-train-dominoes-complete-rules-410911 |
| **[MTR]** | mexicantrainrulesandstrategies.com (tournament PDF) | https://mexicantrainrulesandstrategies.com/mexican_train_rules.pdf |

## Automated verification

Two engine test suites keep this document honest:

- **`mexican-train-conformance.spec.ts`** — one scripted scenario per rule below,
  each citing the source(s) it validates. Run `yarn test:engine`.
- **`random-play-harness.spec.ts`** — a random-legal-move fuzzer that plays full
  games across every player count (2–8), both objectives, and all module /
  house-rule combinations, asserting **tile conservation** (the 91-tile
  double-twelve set is never created, lost, or duplicated) plus structural
  invariants after *every* action.

## Conformance matrix — standard rules (RULES.md I–V)

Legend: **Match** = universal across sources and enforced by a test.
**Choice** = sources disagree; Warp 12 adopts one convention (noted).

| # | Rule | Sources | Warp 12 | Status | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | Double-twelve set = 91 unique tiles, 2–8 players | [W][MoG][UBG][SC] | 91-tile set | **Match** | `Setup — the set is a 91-tile double-twelve` |
| 2 | Hand size 15 (2–4) / 12 (5–6) | [W][MoG][GC][DP] | 15 / 12 | **Match** | `Setup — hand sizes` |
| 3 | Hand size for 7–8 players | [MoG]=10, [GC]/University=11 | **10 default, host may pick 11** | **Configurable** (`largeFleetHandSize` house rule) | `Setup — hand sizes` + `deals 11 tiles…` |
| 4 | Highest double set aside before the deal, opens the station | [W] (also 1994 Galt alt: dealt & holder opens) | Set aside, not dealt; starter rotates | **Match** (Wikipedia primary method) | `Setup — highest double set aside` |
| 5 | Spacedock steps down each round; double-blank is the last; 13 rounds | [W] | 12-12 → 0-0, 13 rounds | **Match** | `Setup — Spacedock descends` |
| 6 | First player rotates each round | [W][GC] | Starter rotates clockwise | **Match** | (covered by setup rotation) |
| 7 | Must play if you legally can; no strategic pass | [W BR3][MTR] | Enforced (beacon/pass blocked while a chart exists) | **Match** | `Play — must play when able` |
| 8 | When stuck: draw exactly one; play it if possible; else marker; one draw/turn | [W r4][UBG][DP] | Enforced; draw + forced marker resolves atomically | **Match** | `Play — draw one, then play it or mark` |
| 9 | Your marker clears only when *you* play on *your own* train | [W][UBG] | Own-trail chart clears; NZ/opponent leaves it up | **Match** | `Play — marker clears only on your own trail` |
| 10 | You may play on a rival train only while its marker is down | [W][UBG][DP] | Enforced | **Match** | `Play — an opponent's trail is playable only while marked` |
| 11 | A played double must be covered before any other route is playable | [W][MTR][UBG][DP] | Only the cover play is legal while Red Alert is open | **Match** | `Doubles — an open double blocks all other routes` |
| 12 | The cover tile must be played **on** the double | [W] (casual [GC][DP][walnut] allow it anywhere) | Cover must be on the double | **Choice** (follows Wikipedia/tournament) | `Doubles — an open double blocks all other routes` |
| 13 | Responsibility to cover passes player-to-player; each failer marks their train | [W][UBG][MTR][DP] | Pass Red Alert deploys beacon, moves responsibility | **Match** | `rules-worked-examples.spec.ts` + `Red Alert pass` |
| 14 | A "dead" double (last tile of that pip) need not be covered | [W][MTR] | `isRedAlertDoubleDead` clears the alert | **Match** | `Doubles — a dead double need not be covered` |
| 15 | Only one double resolved per turn (no chaining) | [W][MTR] tournament (casual [GC][DP] allow chaining) | One double per turn | **Choice** (tournament) | `random-play-harness` (never chains) |
| 16 | You cannot go out on an unsatisfied double | [W][MTR] (casual [UBG][DP] allow it) | Empty hand does not win with an open double | **Choice** (tournament) | `Doubles — you cannot go out on an unsatisfied double` |
| 17 | Round ends when a player empties their hand | [W][UBG] | Round ends, winner recorded | **Match** | `Doubles — you cannot go out…` (negative) + fuzz completions |
| 18 | Round also ends when the boneyard is empty and no one can play (blocked) | [W][UBG] | Blocked sector; everyone scores | **Match** | `Scoring — blocked sector scores every captain` |
| 19 | Winner scores 0; others score the pip sum of their hand | [W][MoG] | Enforced | **Match** | `Scoring — winner scores 0, others sum their pips` |
| 20 | Blocked round: no exemption — every player scores their hand | [W][MTR] | Enforced | **Match** | `Scoring — blocked sector scores every captain` |
| 21 | Lowest cumulative total after all rounds wins | [W] | Points campaign winner = min cumulative | **Match** | round-13 completion + `self-play` winner logic |
| 22 | A tile counts both ends; a double counts both halves | [W][MoG] | `coordinatePipValue` | **Match** | scoring tests (9-9 = 18, etc.) |

## Documented divergences (Warp 12 house standard)

These are the points where Warp 12 intentionally departs from *some* online
sources. All are within the range of common practice and are chosen to match
tournament-style play; each is enforced by a test so the choice cannot silently
regress.

1. **7–8 player hand size = 10 by default, host-configurable to 11.** This is the
   one setup value where major sources genuinely conflict — Masters of Games and
   most modern/commercial sets deal 10, while Galt 1994 and University Games deal
   11. Warp 12 defaults to 10 (10-tile boneyard at 8 players vs only 2 at 11) and
   exposes a `largeFleetHandSize` house rule so hosts can opt into 11. Surfaced in
   the setup UI (local, pass-and-play, and online lobby) only for 7–8 captain
   fleets.
2. **Cover must be played on the double** (not "anywhere on the layout"). Follows
   Wikipedia/tournament; several casual sources allow the second tile anywhere.
3. **One double resolved per turn** (no chaining multiple doubles in a turn).
   Tournament-style; some casual rules allow chains.
4. **No going out on an unsatisfied double.** Tournament-style; UltraBoardGames
   and domino-play permit a final-double go-out.
5. **Spacedock set aside before the deal + rotating starter.** Wikipedia lists
   this as a standard method; the Galt 1994 alternative deals the engine double
   and lets its holder open. Warp 12 uses the set-aside method for every round so
   the round double is deterministic and never sits in a hand.
6. **Tie handling.** Wikipedia breaks ties (most 0-point rounds, then lowest
   non-zero round); Warp 12 declares a **shared** victory on an exact
   cumulative-total tie (RULES.md V, step 6). This is a presentation choice for a
   digital leaderboard, not a play-rule difference.

## Warp 12–specific layers (out of scope for standard conformance)

RULES.md Sections VI–IX (Continuum, Salamander Penalty, Subspace Fracture,
Drop to Impulse catch window, All Stop! ceremony, Manual shield control, TEI,
Subspace messaging) are Warp 12 inventions or opt-in modules with no external
standard to validate against. They are covered by their own unit tests and by
the fuzz harness (which enables every module/house-rule combination and still
holds tile conservation and turn-order invariants).
