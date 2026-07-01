# Warp 12 roadmap

## Completed (recent)

- Server-verified practice AI TEI (replay on `reportPracticeAiMatch`)
- Firestore lockdown for competitive stats fields
- Offline vs-AI play with queued TEI sync when connectivity returns
- Leaderboard verified-pool labels and fleet totals from TEI buckets only
- [Security model](./security-model.md) (trust boundaries + native leaderboard path)

## TODO (after current work)

### Local pass-and-play (multiple human players)

Add a local table mode where 2+ humans share one device and take turns at the bridge — no network required. Unrated by default; optional sign-in + sync only if we later add a verified pass-and-play path.

**Why it should be straightforward:** The local game engine already supports multiple captain seats; `LocalGameConfig` only needs a “human seat” list instead of AI fill-ins, and the bridge UI already routes actions by `currentPlayerId`.

**Rough scope:**

1. Setup screen: pick player count, assign human names per seat (remainder can stay AI).
2. Turn UX: clear “whose turn” indicator; optional hand-off confirm between humans.
3. Match end: local standings only unless signed in and online (reuse offline queue patterns if we ever rate it).
