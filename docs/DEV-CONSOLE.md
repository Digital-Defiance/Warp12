# Dev Console Commands

Development-only browser console commands for testing and debugging local games. These commands are only available when running `yarn serve:bridge` (dev mode) and only work in local simulation mode.

## Prerequisites

1. Start the dev server: `yarn serve:bridge`
2. Launch a local simulation game
3. Sign in with Google — your account must have the Firebase Auth `**admin**` custom claim
4. Open browser console (Cmd+Option+J on Mac, F12 on Windows)
5. Unlock (once per page load):

```javascript
await window.GABBAGABBAHEY()
```

Non-admins are refused — `window.localGame` stays undefined. Successful unlock logs **CHEATER** on the sector ticker. Unlock force-refreshes the admin claim once; mutating commands then trust the unlocked session (no per-call Auth refresh — seed searches must not burn Firebase token quota).

**TEI:** Unlock reports `devToolsUsed` on the match. Non-admins never get the tools, so they cannot cheat TEI this way. Admins keep TEI eligibility — the Cloud Function re-checks the Firebase `**admin`** claim server-side and will still rate the match. Using the tactical advisor still voids TEI for everyone (including admins).

## Available Commands

After unlock, commands are on `window.localGame.*`

### Match Seed Control



#### Get Current Seed

```javascript
window.localGame.getMatchSeed()
```

Returns the current match seed. Useful for reproducing specific deals.

#### Reset Match with Specific Seed

```javascript
window.localGame.resetMatchWithSeed(12345)
```

Resets the **entire match** with a specific seed (reloads AI roster, back to round 1). The deal, AI decisions, and all randomness will be deterministic for that seed.

**Example use cases:**

- Reproduce a specific hand for testing
- Test a specific game scenario repeatedly
- Share seeds with other developers for debugging



#### Get Current Round Deal Seed

```javascript
window.localGame.getRoundSeed()
```

Returns the seed last used to deal the **current** round (`matchSeed` at launch, or the seed passed to `resetRoundWithSeed`).

#### Reset Current Round with Specific Seed

```javascript
window.localGame.resetRoundWithSeed(12345)
```

Redeals the **current round only** with a fresh shuffle seed. Preserves campaign scores, completed rounds, turn order, and AI roster (no async reload). Faster than `resetMatchWithSeed` for hand-search scripts.

**Example use cases:**

- Search for a hand with a specific tile without rematching
- Retry the same campaign round after scores are already on the board



### AI Control



#### Pause AI

```javascript
window.localGame.pauseAI()
```

Completely stops AI turn execution. AI officers will not take any actions until resumed.

#### Resume AI

```javascript
window.localGame.resumeAI()
```

Resumes AI turn execution after being paused.

#### Check AI Status

```javascript
window.localGame.isAIPaused()
```

Returns `true` if AI is paused, `false` otherwise.

### Autoplay (human seat)



#### Suggest / play one human action

```javascript
window.localGame.suggestAction('random')   // or 'advisor'
window.localGame.playHumanAction('advisor')
```

`suggestAction` returns the next `GameAction` without applying it. `playHumanAction` suggests and dispatches through the same path as a UI click.

#### Dispatch a raw action

```javascript
await window.localGame.dispatch({
  type: 'PASS_TURN',
  playerId: window.localGame.getHumanId(),
})
```



### Game State Inspection



#### Get Current Hand

```javascript
window.localGame.getHand()
```

Returns an array of coordinate objects representing the human player's current hand.

**Example output:**

```javascript
[
  { low: 4, high: 12 },
  { low: 8, high: 8 },
  { low: 0, high: 5 },
  // ... more tiles
]
```



#### Get Full Game State

```javascript
window.localGame.getGame()
```

Returns the complete game state object. Useful for deep inspection and debugging.

## Common Workflows



### Testing Module Lambda (Wormholes)

**Simple solution:** Enable the **"Round Starter Plays Two"** house rule.

With this house rule, when you go first, you play TWO tiles on your opening turn - perfect for wormhole testing!

1. **Set up a new local game with wormholes enabled AND "Round Starter Plays Two" house rule**
2. **Find a seed where you go first** (use the Hand Finding Script below)
3. **On your opening turn, play BOTH tiles:**
  - First: Play 12:8 on NZ
  - Second: Play 8:8 on NZ
  - Wormhole triggers immediately!
4. **No shields needed** - you play both tiles before any AI gets a turn

**The complete wormhole test flow:**

```javascript
// 1. Find seed where you go first (use script below)
// 2. Play 12:8 on NZ (via UI)
// 3. Play 8:8 on NZ (via UI) - still your turn!
// 4. Wormhole triggers! No AI interference.
```

**Why this works:** The "Round Starter Plays Two" house rule lets you chart two tiles on your opening turn, so you can set up and trigger the wormhole before any AI gets to play.

### Reproducing a Bug

1. Note the seed when the bug occurs:
  ```javascript
   window.localGame.getMatchSeed()
  ```
2. Share the seed with other developers
3. They can reproduce with:
  ```javascript
   window.localGame.resetMatchWithSeed(SEED_NUMBER)
  ```



### Testing AI Behavior

1. Set up a specific scenario with a known seed
2. Pause AI to inspect the game state:
  ```javascript
   window.localGame.pauseAI()
  ```
3. Examine the game state:
  ```javascript
   window.localGame.getGame()
  ```
4. Resume and observe:
  ```javascript
   window.localGame.resumeAI()
  ```



## Utility Scripts



### Hand Finding Script

Searches for a hand with a 12:X tile and its matching X:X double, **where you go first**. Useful for testing Module Lambda (Wormholes).

Pass `true` to reset the **match** (`resetMatchWithSeed` / `getMatchSeed`), or `false` to reset the **round** (`resetRoundWithSeed` / `getRoundSeed`). Round mode is faster for hand searches; match mode reloads the AI roster.

**What it finds:** A hand containing both 12:N and N:N (e.g., 12:5 and 5:5, or 12:7 and 7:7) AND you're the first player

**Usage:** First unlock as admin (`await window.GABBAGABBAHEY()`), then paste this script. Change the trailing `false` to `true` if you want match resets:

```javascript
// Search for hand with 12:X and matching X:X double WHERE YOU GO FIRST
// Requires: await window.GABBAGABBAHEY() (admin claim)
// Arg: true = resetMatchWithSeed, false = resetRoundWithSeed
(async function(useMatch = false) {
  if (!window.localGame) {
    console.error('Unlock first: await window.GABBAGABBAHEY()');
    return;
  }
  const resetWithSeed = (seed) =>
    useMatch
      ? window.localGame.resetMatchWithSeed(seed)
      : window.localGame.resetRoundWithSeed(seed);
  const getSeed = () =>
    useMatch
      ? window.localGame.getMatchSeed()
      : window.localGame.getRoundSeed();
  const settleMs = useMatch ? 1000 : 200;

  const startSeed = Math.floor(Math.random() * 2147483647);
  console.log(
    `Starting from random seed: ${startSeed} (${useMatch ? 'match' : 'round'} reset)`
  );
  resetWithSeed(startSeed);

  await new Promise(resolve => setTimeout(resolve, settleMs));

  (async function findHandWithRequirements() {
    let attempts = 0;
    const maxAttempts = 1000;

    function hasMatchingTiles(hand) {
      if (!hand || !Array.isArray(hand)) return false;

      // Find all 12:X tiles (where X != 12)
      const twelveXTiles = hand.filter(t =>
        (t.low === 12 && t.high !== 12) || (t.high === 12 && t.low !== 12)
      );

      // Find all X:X doubles (where X != 12)
      const xxDoubles = hand.filter(t => t.low === t.high && t.low !== 12);

      // Check if any 12:X tile has a matching X:X double
      for (const tile of twelveXTiles) {
        const xValue = tile.low === 12 ? tile.high : tile.low;
        const hasMatchingDouble = xxDoubles.some(d => d.low === xValue);

        if (hasMatchingDouble) {
          return {
            found: true,
            twelveXTile: tile,
            matchingDouble: xxDoubles.find(d => d.low === xValue),
            xValue
          };
        }
      }

      return { found: false };
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForSeedChange(targetSeed, maxWaitMs = 3000) {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const currentSeed = getSeed();
        if (currentSeed === targetSeed) {
          return true;
        }
        await sleep(useMatch ? 100 : 50);
      }
      return false;
    }

    console.log('Searching for hand with 12:X and MATCHING X:X double WHERE YOU GO FIRST...');

    while (attempts < maxAttempts) {
      attempts++;

      if (attempts % 50 === 0) {
        console.log(`Checked ${attempts} seeds...`);
      }

      const game = window.localGame.getGame();
      const hand = window.localGame.getHand();

      if (!hand || !game?.round) {
        console.log('❌ No hand or round found');
        return;
      }

      // Check if you go first
      const youGoFirst = game.round.turnOrder[0] === 'you';

      if (!youGoFirst) {
        // Skip this seed, you don't go first
        const newSeed = Math.floor(Math.random() * 2147483647);
        resetWithSeed(newSeed);
        const changed = await waitForSeedChange(newSeed);
        if (!changed) {
          await sleep(settleMs);
        }
        continue;
      }

      const result = hasMatchingTiles(hand);

      if (result.found) {
        const seed = getSeed();
        console.log(`\n✓ Found after ${attempts} attempts!`);
        console.log('Seed:', seed);
        console.log('Hand:', hand.map(t => `${t.low}:${t.high}`).join(', '));
        console.log(`\n12:${result.xValue} tile:`, `${result.twelveXTile.low}:${result.twelveXTile.high}`);
        console.log(`${result.xValue}:${result.xValue} double:`, `${result.matchingDouble.low}:${result.matchingDouble.high}`);
        console.log('\n✓ YOU GO FIRST - perfect for wormhole testing!');
        return;
      }

      const newSeed = Math.floor(Math.random() * 2147483647);
      resetWithSeed(newSeed);

      const changed = await waitForSeedChange(newSeed);
      if (!changed) {
        await sleep(settleMs);
      }
    }

    console.log(`\n❌ Gave up after ${maxAttempts} attempts`);
  })();
})(false); // true = match reset, false = round reset
```

**What it does:**

1. Starts from a random seed
2. Checks if you go first AND have a 12:X tile with matching X:X double
3. Skips seeds where you don't go first
4. Reports the seed and matching tiles when found

**After finding a match:**

- You'll be the first player
- No need for shields - just play your 12:X on NZ, then when it cycles back, play X:X
- AI can't interfere because you play both tiles before they get a chance!

Here's another hand finding script to look for a double blank to test for Continuum.

Pass `true` for match resets, `false` for round resets (same as above). Requires admin unlock first:

```javascript
// Prefer the in-memory preview search below for Continuum+Salamander.
// Legacy React-reset loop (slow / Auth-heavy on old builds):
```

### Salamander swap — how to test

You do **not** need an AI to invent Continuum for you. Two lanes:

#### A. Scoring / log only (fastest)

1. Round 2+, Modules Alpha+Beta on.
2. Find a Salamander seed (below or existing salamander search).
3. Force the flash effect without playing 0-0:

```javascript
await window.GABBAGABBAHEY();
window.localGame.forceSalamanderSwap();
```

4. Finish the round **holding** `maxPip:maxPip` while someone else wins (or dump it and have another seat hold it — swap applies to whoever holds it who is not the round winner).
5. Expect ticker: `Salamander Penalty · <holder>'s highest double swaps to <campaign leader> · +72`  
   Holder’s round add should **not** include the 72; the leader’s should.

Campaign leader = highest current `pointsScore` (excluding round winner when needed). Dump a few points into another captain in round 1 if you want the swap target ≠ you.

#### B. Full Continuum Flash UI

Need **both** `0:0` and `maxPip:maxPip` in your hand, chart the blank, pick **Salamander swap**, then still hold Salamander at round end.

**In-memory seed search** (no React thrash; uses `previewRoundSeed`):

```javascript
// Find seed: double blank (0:0) AND Salamander (maxPip:maxPip) in YOUR hand.
// Round 2+. Modules Continuum + Salamander.
// Requires: await window.GABBAGABBAHEY()
(function findSwapSetup(maxAttempts = 5000) {
  if (!window.localGame?.previewRoundSeed) {
    console.error('Unlock + hard refresh — need previewRoundSeed / forceSalamanderSwap');
    return;
  }
  const game = window.localGame.getGame();
  const maxPip = game?.maxPip ?? 12;
  const roundNumber = game?.round?.roundNumber ?? 0;
  if (roundNumber < 2) {
    console.error('Advance to round 2+ first');
    return;
  }
  console.log(`Searching for 0:0 + ${maxPip}:${maxPip} (preview, up to ${maxAttempts})…`);
  for (let i = 0; i < maxAttempts; i++) {
    const seed = Math.floor(Math.random() * 2147483647);
    const preview = window.localGame.previewRoundSeed(seed);
    if (!preview) continue;
    const hand = preview.hand;
    const hasBlank = hand.some((t) => t.low === 0 && t.high === 0);
    const hasSal = hand.some((t) => t.low === maxPip && t.high === maxPip);
    if (hasBlank && hasSal) {
      window.localGame.resetRoundWithSeed(seed);
      console.log(`✓ Found after ${i + 1} previews`);
      console.log('Seed:', seed);
      console.log('Hand:', hand.map((t) => `${t.low}:${t.high}`).join(', '));
      console.log('Next: chart 0-0 → Continuum Flash → Salamander swap → keep', `${maxPip}:${maxPip}`);
      return;
    }
    if ((i + 1) % 250 === 0) console.log(`Checked ${i + 1}…`);
  }
  console.log('❌ Gave up');
})();
```

**Salamander-only preview search** (then use lane A):

```javascript
(function findSalamanderOnly(maxAttempts = 2000) {
  if (!window.localGame?.previewRoundSeed) {
    console.error('Unlock + hard refresh first');
    return;
  }
  const maxPip = window.localGame.getGame()?.maxPip ?? 12;
  if ((window.localGame.getGame()?.round?.roundNumber ?? 0) < 2) {
    console.error('Round 2+ required');
    return;
  }
  for (let i = 0; i < maxAttempts; i++) {
    const seed = Math.floor(Math.random() * 2147483647);
    const preview = window.localGame.previewRoundSeed(seed);
    if (!preview?.hand.some((t) => t.low === maxPip && t.high === maxPip)) continue;
    window.localGame.resetRoundWithSeed(seed);
    console.log(`✓ Salamander seed ${seed} after ${i + 1}`);
    console.log(preview.hand.map((t) => `${t.low}:${t.high}`).join(', '));
    console.log('Optional: window.localGame.forceSalamanderSwap()');
    return;
  }
  console.log('❌ Gave up');
})();
```

AI note: if an **AI** charts 0-0 while **they** hold Salamander, flash heuristics strongly prefer salamander-swap (score 20). You can also just play the blank yourself.

Here's the older React-reset Continuum blank search (prefer preview above):

```javascript
// Search for hand with double blank (0:0)
// Requires: await window.GABBAGABBAHEY() (admin claim)
// Arg: true = resetMatchWithSeed, false = resetRoundWithSeed
(async function(useMatch = false) {
  if (!window.localGame) {
    console.error('Unlock first: await window.GABBAGABBAHEY()');
    return;
  }
  const resetWithSeed = (seed) =>
    useMatch
      ? window.localGame.resetMatchWithSeed(seed)
      : window.localGame.resetRoundWithSeed(seed);
  const getSeed = () =>
    useMatch
      ? window.localGame.getMatchSeed()
      : window.localGame.getRoundSeed();
  const settleMs = useMatch ? 1000 : 200;

  const startSeed = Math.floor(Math.random() * 2147483647);
  console.log(
    `Starting from random seed: ${startSeed} (${useMatch ? 'match' : 'round'} reset)`
  );
  resetWithSeed(startSeed);

  await new Promise(resolve => setTimeout(resolve, settleMs));

  (async function findHandWithDoubleBlank() {
    let attempts = 0;
    const maxAttempts = 1000;

    function findDoubleBlank(hand) {
      if (!hand || !Array.isArray(hand)) return null;
      return hand.find(t => t.low === 0 && t.high === 0) ?? null;
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForSeedChange(targetSeed, maxWaitMs = 3000) {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const currentSeed = getSeed();
        if (currentSeed === targetSeed) {
          return true;
        }
        await sleep(useMatch ? 100 : 50);
      }
      return false;
    }

    console.log('Searching for hand with double blank (0:0)...');

    while (attempts < maxAttempts) {
      attempts++;

      if (attempts % 50 === 0) {
        console.log(`Checked ${attempts} seeds...`);
      }

      const hand = window.localGame.getHand();

      if (!hand) {
        console.log('❌ No hand found');
        return;
      }

      const doubleBlank = findDoubleBlank(hand);

      if (doubleBlank) {
        const seed = getSeed();
        console.log(`\n✓ Found after ${attempts} attempts!`);
        console.log('Seed:', seed);
        console.log('Hand:', hand.map(t => `${t.low}:${t.high}`).join(', '));
        console.log('Double blank:', `${doubleBlank.low}:${doubleBlank.high}`);
        return;
      }

      const newSeed = Math.floor(Math.random() * 2147483647);
      resetWithSeed(newSeed);

      const changed = await waitForSeedChange(newSeed);
      if (!changed) {
        await sleep(settleMs);
      }
    }

    console.log(`\n❌ Gave up after ${maxAttempts} attempts`);
  })();
})(false); // true = match reset, false = round reset
```



Here's the same pattern for **Salamander** (Module Beta) — the held **highest double for the Warp Factor** (`maxPip:maxPip`), not a hardcoded 12:12.

**Important:** Round 1 never deals that tile (it is Spacedock). Advance to round 2+ first, then use **round** reset only (`false`). Match reset drops you back to round 1, so it cannot find a Salamander.

```javascript
// Search for hand with Salamander (highest double for maxPip, eg 12:12 / 18:18)
// Requires: await window.GABBAGABBAHEY() (admin claim)
// Must be round 2+ — round 1 Spacedock is never in hand.
// Arg: true = resetMatchWithSeed (useless here), false = resetRoundWithSeed
(async function(useMatch = false) {
  if (!window.localGame) {
    console.error('Unlock first: await window.GABBAGABBAHEY()');
    return;
  }
  if (useMatch) {
    console.error(
      'Match reset returns to round 1 (Salamander is Spacedock). Use false for round reset on round 2+.'
    );
    return;
  }

  const resetWithSeed = (seed) => window.localGame.resetRoundWithSeed(seed);
  const getSeed = () => window.localGame.getRoundSeed();
  const settleMs = 200;

  const bootstrap = window.localGame.getGame();
  const maxPip = bootstrap?.maxPip ?? 12;
  const roundNumber = bootstrap?.round?.roundNumber ?? 0;
  if (roundNumber < 2) {
    console.error(
      `Round ${roundNumber || '?'} — Salamander (${maxPip}:${maxPip}) is Spacedock. Advance to round 2+ first.`
    );
    return;
  }

  const startSeed = Math.floor(Math.random() * 2147483647);
  console.log(
    `Looking for ${maxPip}:${maxPip} from seed ${startSeed} (round ${roundNumber} reset)`
  );
  resetWithSeed(startSeed);

  await new Promise(resolve => setTimeout(resolve, settleMs));

  (async function findHandWithSalamander() {
    let attempts = 0;
    const maxAttempts = 1000;

    function findSalamander(hand, pip) {
      if (!hand || !Array.isArray(hand)) return null;
      return hand.find(t => t.low === pip && t.high === pip) ?? null;
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForSeedChange(targetSeed, maxWaitMs = 3000) {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const currentSeed = getSeed();
        if (currentSeed === targetSeed) {
          return true;
        }
        await sleep(50);
      }
      return false;
    }

    console.log(`Searching for hand with Salamander (${maxPip}:${maxPip})…`);

    while (attempts < maxAttempts) {
      attempts++;

      if (attempts % 50 === 0) {
        console.log(`Checked ${attempts} seeds...`);
      }

      const lg = window.localGame;
      if (!lg) {
        console.error('localGame vanished — unlock again: await window.GABBAGABBAHEY()');
        return;
      }

      const game = lg.getGame();
      const hand = lg.getHand();
      const pip = game?.maxPip ?? maxPip;

      if (!hand) {
        console.log('❌ No hand found');
        return;
      }

      const salamander = findSalamander(hand, pip);

      if (salamander) {
        const seed = getSeed();
        const penalty = pip * 2 * 2; // double both-ends value
        console.log(`\n✓ Found after ${attempts} attempts!`);
        console.log('Seed:', seed);
        console.log('Hand:', hand.map(t => `${t.low}:${t.high}`).join(', '));
        console.log(
          'Salamander:',
          `${salamander.low}:${salamander.high}`,
          `(scores ${penalty} with Module Beta)`
        );
        return;
      }

      const newSeed = Math.floor(Math.random() * 2147483647);
      resetWithSeed(newSeed);

      const changed = await waitForSeedChange(newSeed);
      if (!changed) {
        await sleep(settleMs);
      }
    }

    console.log(`\n❌ Gave up after ${maxAttempts} attempts`);
  })();
})(false); // must stay false — round reset on round 2+
```

**Prefer** `previewRoundSeed` (see Continuum section above) for faster searches that do not thrash React / Auth.

#### Continuum Salamander swap after finding a Salamander hand

Recipe for Module Beta + Continuum **salamander-swap** scoring / ticker:

1. Start a local points match with **Continuum (Alpha)** and **Salamander (Beta)** on.
2. Unlock: `await window.GABBAGABBAHEY()`.
3. Autoplay (or finish) **round 1**, then **Score Round** into round 2.
4. On round 2+, run the Salamander hand search above (or the preview search) until you hold `maxPip:maxPip`.
5. Patch the Continuum effect without playing 0-0:

```javascript
window.localGame.forceSalamanderSwap();
```

6. Play out the round **still holding** Salamander while **someone else** wins the round.
   Use **Hold-Salamander autoplay** below so console play does not dump `maxPip:maxPip`.
   Important: swap only **transfers** if you are **not** the highest campaign score among non-winners.
   If you are already the campaign leader (excluding the round winner), the ticker stays on
   “holds highest double” / “swap no-ops” — that is expected, not a missed force.
7. Confirm on the sector ticker:

`Salamander Penalty · <holder>'s highest double swaps to <campaign leader> · +72`

(Warp 12 → `+48`.) The holder’s round add should **not** include that doubled penalty; the leader’s should.

If the ticker instead says `holds highest double (already campaign leader; swap no-ops)`, force worked but you were the swap target — put more campaign points on another captain in round 1, or dump points before testing.

For the full Continuum Flash UI path (chart `0:0` → pick Salamander swap), see **Salamander swap — how to test** earlier in this doc.



### Round Autoplay Script

Plays **your** seat through the current round. AI officers keep moving on their turns. Pass `'random'` or `'advisor'`. Requires admin unlock first.

```javascript
// Autoplay your seat until the round ends.
// Requires: await window.GABBAGABBAHEY() (admin claim)
// mode: 'random' | 'advisor'
(async function playMyRound(mode = 'random') {
  if (!window.localGame) {
    console.error('Unlock first: await window.GABBAGABBAHEY()');
    return;
  }
  const humanId = window.localGame.getHumanId();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const maxSteps = 500;
  let steps = 0;

  console.log(`Autoplaying human seat as ${mode}…`);
  window.localGame.resumeAI();

  while (steps < maxSteps) {
    steps += 1;
    const lg = window.localGame;
    if (!lg) {
      console.error('localGame vanished — unlock again: await window.GABBAGABBAHEY()');
      return;
    }
    const game = lg.getGame();
    const round = game?.round;

    if (!game || game.phase !== 'active' || !round) {
      console.log('No active game/round');
      return;
    }
    if (round.phase !== 'playing') {
      console.log(`Round phase is ${round.phase} — stopping`);
      return;
    }

    if (round.activePlayerId !== humanId) {
      // Wait for AI (or teammates) to finish their turn.
      await sleep(150);
      continue;
    }

    const action = await lg.playHumanAction(mode);
    if (!action) {
      console.log('Stuck — no legal human action. Pausing.');
      lg.pauseAI();
      return;
    }

    // Brief settle so React + AI runners advance.
    await sleep(mode === 'advisor' ? 80 : 40);
  }

  console.log(`Stopped after ${maxSteps} steps`);
})('random'); // or 'advisor'
```

**Tips:**

- Leave AI **resumed** so opponents play; the script only acts on your turn.
- `advisor` uses the same coach stack as the tactical advisor (concept net / Ω / heuristics).
- `random` picks a uniform legal chart; ensign AI covers draw / pass / beacon.
- Call `window.localGame.pauseAI()` first if you want to step one action at a time with `playHumanAction`.
- After HMR / dep refresh, `localGame` stays installed for the unlocked session — re-run `GABBAGABBAHEY` only if you see it vanish.

### Hold-Salamander autoplay

Same as round autoplay, but **refuses to chart** anything that involves `maxPip` — the Salamander double (`maxPip:maxPip`) **and** “lead-in” tiles (`x:maxPip`). Retries with `random` until another legal action exists. Use after you find a Salamander seed / `forceSalamanderSwap()` so the penalty (or swap) still fires at round end.

If every legal chart involves `maxPip`, the script will play one and log a warning — pause AI and finish manually if that happens mid-test.

```javascript
// Autoplay your seat but hold Salamander / avoid maxPip lead-ins.
// Skips charting maxPip:maxPip AND any tile with a maxPip end (eg 5:18).
// Requires: await window.GABBAGABBAHEY()
// mode: 'random' | 'advisor'  (advisor may still suggest dump; we override)
(async function playMyRoundHoldingSalamander(mode = 'random') {
  if (!window.localGame) {
    console.error('Unlock first: await window.GABBAGABBAHEY()');
    return;
  }
  const lg0 = window.localGame;
  const humanId = lg0.getHumanId();
  const maxPip = lg0.getGame()?.maxPip ?? 12;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const touchesMaxPip = (c) =>
    c && (c.low === maxPip || c.high === maxPip);
  const isSalamander = (c) =>
    c && c.low === maxPip && c.high === maxPip;
  const chartsMaxPipTile = (action) =>
    action?.type === 'CHART_COORDINATE' && touchesMaxPip(action.coordinate);

  async function pickHoldingSalamander() {
    const first = window.localGame.suggestAction(mode);
    if (!first) return null;
    if (!chartsMaxPipTile(first)) {
      await window.localGame.dispatch(first);
      return first;
    }
    // Reject Salamander / maxPip lead-ins — sample random alternatives.
    for (let i = 0; i < 40; i++) {
      const alt = window.localGame.suggestAction('random');
      if (!alt) break;
      if (!chartsMaxPipTile(alt)) {
        console.log(
          `Holding ${maxPip}-suit — skipped`,
          first.coordinate
            ? `${first.coordinate.low}:${first.coordinate.high}`
            : first.type,
          '→',
          alt.type
        );
        await window.localGame.dispatch(alt);
        return alt;
      }
    }
    // Only legal charts touch maxPip.
    console.warn(
      `No non-${maxPip} chart available — forced`,
      first.coordinate
        ? `${first.coordinate.low}:${first.coordinate.high}`
        : first.type
    );
    await window.localGame.dispatch(first);
    return first;
  }

  console.log(
    `Autoplaying human seat as ${mode}, holding ${maxPip}-suit (Salamander + lead-ins)…`
  );
  window.localGame.resumeAI();

  const maxSteps = 500;
  for (let steps = 0; steps < maxSteps; steps++) {
    const lg = window.localGame;
    if (!lg) {
      console.error('localGame vanished — unlock again');
      return;
    }
    const game = lg.getGame();
    const round = game?.round;
    if (!game || game.phase !== 'active' || !round) {
      console.log('No active game/round');
      return;
    }
    if (round.phase !== 'playing') {
      const hand = lg.getHand() ?? [];
      const stillHolds = hand.some(isSalamander);
      console.log(
        `Round phase is ${round.phase} — stopping` +
          (stillHolds
            ? ` (still holding ${maxPip}:${maxPip} ✓)`
            : ` (Salamander no longer in hand)`)
      );
      return;
    }
    if (round.activePlayerId !== humanId) {
      await sleep(150);
      continue;
    }
    const action = await pickHoldingSalamander();
    if (!action) {
      console.log('Stuck — no legal human action. Pausing.');
      lg.pauseAI();
      return;
    }
    await sleep(mode === 'advisor' ? 80 : 40);
  }
  console.log(`Stopped after ${maxSteps} steps`);
})('random'); // or 'advisor'
```



## Notes

- **Dev mode only:** These commands are automatically disabled in production builds
- **Local games only:** Commands only work in local simulation mode, not online sectors
- **Hot reload:** Commands are reset when you reload the page - you'll need to call them again
- **Hard refresh:** After rebuilding the bridge (`yarn build:bridge`), do a hard refresh (Cmd+Shift+R) to see changes



## Troubleshooting



### "localGame is not defined"

- Make sure you're in dev mode (`yarn serve:bridge`)
- Ensure you've launched a local simulation game
- Check that you're on the game page (not the lobby)
- Call `await window.GABBAGABBAHEY()` first — requires a Google-signed account with Firebase `**admin**` claim
- Without admin, unlock is refused and tools are never installed



### Seed reset doesn't seem to work

- Prefer `resetRoundWithSeed()` for hand searches — it updates synchronously
- After `resetMatchWithSeed()`, wait briefly (AI roster reload is async) and confirm with `getMatchSeed()`
- After a round reset, confirm with `getRoundSeed()` / `getHand()`



### AI shields aren't working

- The NZ shields feature has been removed
- Use the **"Round Starter Plays Two"** house rule instead for wormhole testing
- See the wormhole testing section below for the proper workflow



### Need to test wormholes but it's not my turn

- **Best solution:** Find a new seed where you go first (use the hand finding script)
- Enable **"Round Starter Plays Two"** house rule to play both tiles in one turn

