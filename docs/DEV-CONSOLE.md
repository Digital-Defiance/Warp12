# Dev Console Commands

Development-only browser console commands for testing and debugging local games. These commands are only available when running `yarn serve:bridge` (dev mode) and only work in local simulation mode.

## Prerequisites

1. Start the dev server: `yarn serve:bridge`
2. Launch a local simulation game
3. Open browser console (Cmd+Option+J on Mac, F12 on Windows)

## Available Commands

All commands are accessed via `window.localGame.*`

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
Resets the current match with a specific seed. The deal, AI decisions, and all randomness will be deterministic for that seed.

**Example use cases:**
- Reproduce a specific hand for testing
- Test a specific game scenario repeatedly
- Share seeds with other developers for debugging

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

**What it finds:** A hand containing both 12:N and N:N (e.g., 12:5 and 5:5, or 12:7 and 7:7) AND you're the first player

**Usage:** Paste this entire script into the browser console:

```javascript
// Search for hand with 12:X and matching X:X double WHERE YOU GO FIRST
(async function() {
  const startSeed = Math.floor(Math.random() * 2147483647);
  console.log('Starting from random seed:', startSeed);
  window.localGame.resetMatchWithSeed(startSeed);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
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
        const currentSeed = window.localGame.getMatchSeed();
        if (currentSeed === targetSeed) {
          return true;
        }
        await sleep(100);
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
        window.localGame.resetMatchWithSeed(newSeed);
        const changed = await waitForSeedChange(newSeed);
        if (!changed) {
          await sleep(500);
        }
        continue;
      }
      
      const result = hasMatchingTiles(hand);
      
      if (result.found) {
        const seed = window.localGame.getMatchSeed();
        console.log(`\n✓ Found after ${attempts} attempts!`);
        console.log('Seed:', seed);
        console.log('Hand:', hand.map(t => `${t.low}:${t.high}`).join(', '));
        console.log(`\n12:${result.xValue} tile:`, `${result.twelveXTile.low}:${result.twelveXTile.high}`);
        console.log(`${result.xValue}:${result.xValue} double:`, `${result.matchingDouble.low}:${result.matchingDouble.high}`);
        console.log('\n✓ YOU GO FIRST - perfect for wormhole testing!');
        return;
      }
      
      const newSeed = Math.floor(Math.random() * 2147483647);
      window.localGame.resetMatchWithSeed(newSeed);
      
      const changed = await waitForSeedChange(newSeed);
      if (!changed) {
        await sleep(500);
      }
    }
    
    console.log(`\n❌ Gave up after ${maxAttempts} attempts`);
  })();
})();
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

### Seed reset doesn't seem to work
- Wait 1-2 seconds after calling `resetMatchWithSeed()`
- The reset is asynchronous - call `getMatchSeed()` to confirm it changed

### AI shields aren't working
- The NZ shields feature has been removed
- Use the **"Round Starter Plays Two"** house rule instead for wormhole testing
- See the wormhole testing section below for the proper workflow

### Need to test wormholes but it's not my turn
- **Best solution:** Find a new seed where you go first (use the hand finding script)
- Enable **"Round Starter Plays Two"** house rule to play both tiles in one turn
