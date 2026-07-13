# Binary Match Logs

Comprehensive match logging system using compact binary format for efficient storage, transfer, and replay.

## Overview

The binary match log system achieves **50-500x compression** over JSON, enabling:
- Local storage of thousands of matches in IndexedDB
- Cross-device sync via Firestore
- Shareable match links (1-2KB for typical game)
- Full match replay with round-boundary checkpoints

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Match Logging                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Game Play → BinaryMatchLog → Binary Export            │
│                     ↓                                   │
│              ┌──────┴──────┐                           │
│              ↓             ↓                            │
│         IndexedDB      Firestore                        │
│         (local)        (cloud)                          │
│              ↓             ↓                            │
│         Replay      Cross-device                        │
│                        Sync                             │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Binary Action Encoding (`libs/engine/src/lib/serialization/`)

**Encodes GameActions to 2-5 bytes each:**

```typescript
import { encodeActions, decodeActions } from 'warp12-engine';

const ctx = { playerIds: ['p0', 'p1', 'p2', 'p3'], maxPip: 12 };
const actions: GameAction[] = [...]; // 200 actions

// Encode to binary (~600 bytes for typical match)
const binary = encodeActions(actions, ctx);

// Decode back to full objects
const decoded = decodeActions(binary, ctx);
```

**Supported Actions:**
- ✅ All 15 core action types
- ✅ All 9 continuum flash effects
- ✅ All module actions (Gamma sensor, Delta spool, Epsilon drafting, Zeta impulse)
- ✅ House rules (shield control)

### 2. State Snapshot Encoding

**Encodes RoundState/GameState to ~300 bytes:**

```typescript
import { encodeRoundState, decodeRoundState } from 'warp12-engine';

const ctx = { maxPip: 12 };
const round: RoundState = {...};

// Encode (~200-400 bytes)
const binary = encodeRoundState(round, ctx);

// Decode back
const decoded = decodeRoundState(binary, { 
  maxPip: 12, 
  playerIds: ['p0', 'p1', 'p2', 'p3'] 
});
```

### 3. Match Log Accumulator (`apps/Warp12/src/game/match-log-binary.ts`)

**Accumulates actions + optional state snapshots:**

```typescript
import { BinaryMatchLog } from './game/match-log-binary.js';

const log = new BinaryMatchLog({
  gameId: 'match-123',
  playerIds: ['p0', 'p1', 'p2', 'p3'],
  maxPip: 12,
  captureSnapshots: true, // Optional round checkpoints
});

// During game
log.recordAction(action);
log.recordRoundEnd(roundState); // Captures checkpoint

// Export
const exported = log.export();
console.log(`${exported.actions.byteSize} bytes`);
```

### 4. IndexedDB Storage (`apps/Warp12/src/storage/match-log-db.ts`)

**Local storage for thousands of matches:**

```typescript
import { openMatchLogDB, storeMatch, listRecentMatches } from './storage/match-log-db.js';

const db = await openMatchLogDB();

// Store
await storeMatch(db, matchLog);

// Retrieve recent
const recent = await listRecentMatches(db, 50);

// Query by player
const myMatches = await findMatchesByPlayer(db, 'player-123');
```

### 5. Base64 Export/Import (`apps/Warp12/src/game/match-log-transfer.ts`)

**Shareable match logs as compact strings:**

```typescript
import { 
  exportMatchToBase64Url, 
  importMatchFromBase64,
  createShareableLink 
} from './game/match-log-transfer.js';

// Export for sharing
const base64 = exportMatchToBase64Url(matchLog);
// Copy/paste or generate link
const link = createShareableLink(matchLog);
// https://warp.iwdf.org?match=eyJnYW1l...

// Import
const imported = importMatchFromBase64(base64);
const fromUrl = extractMatchFromUrl(window.location.href);
```

### 6. Cloud Sync (`apps/Warp12/src/storage/match-sync.ts`)

**Cross-device match history:**

```typescript
import { createMatchSyncService } from './storage/match-sync.js';

const sync = await createMatchSyncService(firestore, uid);

// Store locally and sync to cloud
await sync.storeAndSync(matchLog);

// Pull matches from other devices
const pulled = await sync.pullFromCloud();
console.log(`Downloaded ${pulled} new matches`);

// Sync all pending
const stats = await sync.syncPending();
console.log(`Uploaded: ${stats.uploaded}, Errors: ${stats.errors}`);
```

## Compression Ratios

| Component | JSON Size | Binary Size | Ratio |
|-----------|-----------|-------------|-------|
| Single CHART action | ~120 bytes | 4 bytes | 30x |
| 200-action match | ~30KB | ~600 bytes | 50x |
| Round state snapshot | ~20KB | ~300 bytes | 66x |
| Full match with 10 snapshots | ~250KB | ~3.5KB | 70x |

## Export Formats

### Standard Export (JSON + Binary)

```json
{
  "gameId": "match-123",
  "actions": {
    "format": "binary-v1",
    "encoding": "base64",
    "data": "AQIDBAUG...",
    "actionCount": 200,
    "byteSize": 612,
    "playerIds": ["p0", "p1", "p2", "p3"],
    "maxPip": 12
  },
  "snapshots": [
    {
      "round": 1,
      "data": "AgMEBQYH...",
      "byteSize": 287,
      "timestamp": 1700000001000
    }
  ],
  "exportedAt": 1700000000000
}
```

### URL-Safe Base64

```
eyJnYW1lSWQiOiJtYXRjaC0xMjMiLCJhY3Rpb25zIjp7ImZvcm1hdCI6ImJpbmFyeS12MSIsImVuY29kaW5nIjoiYmFzZTY0IiwiZGF0YSI6IkFRSURCQVVHIiwiYWN0aW9uQ291bnQiOjIwMCwiYnl0ZVNpemUiOjYxMiwicGxheWVySWRzIjpbInAwIiwicDEiLCJwMiIsInAzIl0sIm1heFBpcCI6MTJ9LCJleHBvcnRlZEF0IjoxNzAwMDAwMDAwMDAwfQ
```

## Firestore Schema

```
userMatchLogs/{uid}/matches/{matchId}
  - gameId: string
  - actions: map (binary format)
  - snapshots: array (optional)
  - exportedAt: timestamp
  - uploadedAt: timestamp
```

## Usage Examples

### Basic Match Logging

```typescript
// Setup
const log = new BinaryMatchLog({
  gameId: game.id,
  playerIds: game.captains.map(c => c.id),
  maxPip: game.maxPip,
});

// During game
applyAction(game, action);
log.recordAction(action);

// At round end
if (game.round?.phase === 'ended') {
  log.recordRoundEnd(game.round);
}

// Export when game complete
const exported = log.export();
await storeMatch(db, exported);
```

### Match Replay

```typescript
// Load from IndexedDB
const match = await getMatchesByGameId(db, 'match-123')[0];

// Decode actions
const ctx = {
  playerIds: match.actions.playerIds,
  maxPip: match.actions.maxPip,
};
const binary = atob(match.actions.data);
const uint8 = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) {
  uint8[i] = binary.charCodeAt(i);
}
const actions = decodeActions(uint8, ctx);

// Replay game
let state = createInitialGameState(...);
for (const action of actions) {
  state = applyAction(state, action).state;
}
```

### Cross-Device Sync

```typescript
// On device A: Store and sync
const sync = await createMatchSyncService(firestore, user.uid);
await sync.storeAndSync(matchLog);

// On device B: Pull new matches
const pulled = await sync.pullFromCloud();
console.log(`Synced ${pulled} matches from other devices`);

// Check sync status
const status = await sync.getSyncStatus();
console.log(`${status.synced}/${status.total} matches synced`);
```

### Share via URL

```typescript
// Create shareable link
const link = createShareableLink(matchLog);
// https://warp.iwdf.org?match=eyJnYW1l...

// Copy to clipboard
navigator.clipboard.writeText(link);

// Recipient opens link
const match = extractMatchFromUrl();
if (match) {
  // Store locally and replay
  await storeMatch(db, match);
}
```

## Testing

Run comprehensive tests:

```bash
# Action round-trip (all 15 types, all 9 flash effects)
yarn vitest run libs/engine/src/lib/serialization/action-roundtrip.spec.ts

# State encoding
yarn vitest run libs/engine/src/lib/serialization/encode-state.spec.ts
yarn vitest run libs/engine/src/lib/serialization/decode-state.spec.ts

# Match log accumulator
yarn vitest run apps/Warp12/src/game/match-log-binary.spec.ts

# Transfer/export
yarn vitest run apps/Warp12/src/game/match-log-transfer.spec.ts
```

## Security

### Firestore Rules

User match logs are private:
- Users can only read/write their own logs
- Anonymous matches stored with auth UID
- See `firestore-match-logs.rules`

### Data Privacy

- Match logs contain no personal data (player IDs are local)
- Binary format is deterministic (no secrets embedded)
- Base64 URLs are safe to share publicly
- Cloud sync requires authentication

## Performance

**Storage:**
- 1000 matches ~= 600KB - 3MB (with snapshots)
- IndexedDB handles 10K+ matches easily

**Transfer:**
- Typical match: 1-2KB
- Fast sync over cellular
- CloudFlare CDN for Firebase Hosting

**Replay:**
- Decode 200 actions: <1ms
- Full match replay: <10ms
- State snapshot restore: <1ms

## Future Enhancements

- Compression (gzip) for cloud storage
- Incremental sync (only new rounds)
- Selective sync (by date range, player, objective)
- Match analysis metadata (win rates, average scores)
- Batch export for AI training
- Tournament bracket tracking
