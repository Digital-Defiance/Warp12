# Practice AI replay verification — investigation

## Goal

Replace trusted client fields (`won: true`) in `reportPracticeAiMatch` with server-derived outcomes from deterministic replay.

## Current flow

1. `local-game-page.tsx` launches with `{ config, seed }` (`Date.now()`).
2. `bridge-table.tsx` runs the match locally (`applyAction` + `decideGameActionAsync`).
3. On `game.phase === 'complete'`, client calls `reportLocalAiMatch({ won, skill, ... })`.
4. Cloud Function `reportPracticeAiMatch` applies Elo — **does not verify the match happened**.

## What we already capture (but do not send)

- **Seed** — in `launchSession.seed`
- **Config** — `LocalGameConfig` (objective, AI tiers, modules, house rules)
- **Action log** — `actionLogRef` in `bridge-table` (human + AI + auto), included in debug export

## Proposed server payload

```typescript
interface ReportPracticeAiMatchV2 {
  config: LocalGameConfig;      // JSON-serializable
  seed: number;
  humanActions: GameAction[];   // human captain only, chronological
  advisorUsed: boolean;
  displayName?: string;
  // decisionPct / decisionGrade — optional metadata, not used for TEI
}
```

Server derives `won`, `skill`, and `objective` from config + replay. Client never sends `won`.

## Replay strategies

| Strategy | Client sends | Server does | Blocks `{ won: true }`? |
|----------|--------------|-------------|-------------------------|
| **2a Full log** | Entire `actionLog` | Replay all `applyAction` | Yes (must forge full legal log) |
| **2b Human + server AI** | `humanActions` only | Run AI from same seed | Yes (strong for standard AI) |

**Recommendation:** **2b** for production. Smaller payload; AI moves cannot be spoofed.

## Spike code (this repo)

| File | Purpose |
|------|---------|
| `apps/Warp12/src/game/verify-local-ai-replay.ts` | `replayLocalAiActionLog`, `replayLocalAiHumanActions`, `extractHumanActions` |
| `apps/Warp12/src/game/simulate-local-ai-match.ts` | Headless match simulation for tests |
| `apps/Warp12/src/game/verify-local-ai-replay.spec.ts` | Proves replay matches simulation |

Run:

```bash
cd apps/Warp12 && npx vitest run src/game/verify-local-ai-replay.spec.ts
```

**Spike result (2026-06-29):** All three tests pass. Two engine issues must be handled in production replay:

1. **Inter-round shuffle** — `scoreRound()` defaults to `Math.random` when recycling tiles. Replay must use the same seeded stream as the client (`createMatchRoundReshuffle(seed)` in `verify-local-ai-replay.ts`, matching self-play’s `mulberry32(seed ^ 0x9e3779b9)`).
2. **AI decision side effects** — `decideGameAction` reads through `observe(state)`; run AI on `structuredClone(state)` so the authoritative state matches the action log. Bridge UI should do the same before dispatching AI moves.

## Gaps before production

### Client

- [ ] Persist `seed` on `BridgeTable` (pass from `launchSession` — already available on parent).
- [ ] Filter `actionLog` to `extractHumanActions(config, log)` at match end.
- [ ] Send payload to new/updated Cloud Function instead of `won`.
- [ ] Drop academy `startingTei` client writes (separate security item).

### Cloud Function

- [ ] Add `warp12-engine` dependency to `functions/` (or move replay into shared package).
- [ ] Port `replayLocalAiHumanActions`, `applyMatchAction`, and `createMatchRoundReshuffle` (or import from built bundle).
- [ ] Memory: 512MB default; Class I* may need 1GB + 120s timeout.
- [ ] Reject Class I* for v1 verified rated play, or benchmark ISMCTS cost first.
- [ ] Long-term: teach `applyAction` / `scoreRound` to derive inter-round shuffle from match `seed` so client and server cannot drift.

### Not covered by replay

- **Advisor-assisted matches** — keep `advisorUsed: true` as unrated (no TEI change), skip strict replay or replay without rating.
- **Drop-to-impulse AI challenges** — spike driver auto-`END_ROUND` only; production driver must mirror `bridge-table` off-turn AI logic.
- **External assistance** — solver during play still possible; replay only proves move legality + outcome.

## Cost estimate (unchanged from planning)

Standard AI replay: ~2–15s CPU, **~$0.00005–0.0002/match** at Gen2 pricing. Class I* higher.

## Next implementation step

1. Run spike tests locally and note timing for ensign/lieutenant/commander.
2. Wire client payload (human actions + seed + config).
3. Extend `reportPracticeAiMatch` to replay before writing `localAi`.
