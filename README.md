# 🌌 WARP 12

**A Double-Twelve Domino Variant for the NX Epoch**

Warp 12 is a multiplayer, Star Trek-themed variant of standard Mexican Train (double-twelve) dominoes. This repository contains the game engine, client UI, domino rendering library, and Firebase-backed multiplayer infrastructure in a TypeScript Nx monorepo.

## 🏗 System Architecture

Strict separation of concerns keeps the core engine agnostic of transport and presentation:

```
warp-12/
├── apps/
│   └── Warp12/                 # The Bridge — React client (Firebase, lobby, game table)
├── libs/
│   ├── engine/                 # warp12-engine — rules, AI, advisor (npm)
│   ├── react/                  # warp12-react — adapters, coach, hand layout (npm)
│   └── theme/                  # warp12-theme — DoubleTwelve skins (npm)
├── vendor/
│   └── DoubleTwelve/           # Domino rendering submodule (own Nx workspace)
└── RULES.md                    # Navigational Operations Manual
```

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Engine** | `warp12-engine` | Deterministic state machine: turns, scoring, Distress Beacon, Subspace Fracture, Warp AI, advisor explanations |
| **React adapters** | `warp12-react` | `RoundState` → trains, tactical coach, hand layout hooks |
| **Theme** | `warp12-theme` | Star Trek domino tile presets for DoubleTwelve |
| **Rendering** | `doubletwelve` | React domino components, train layout, chicken-foot geometry, pip theming |
| **Client** | `@warp12/Warp12` | Space-themed UI, Firebase Auth + Firestore sync (private app) |
| **Multiplayer** | Firebase (`warp-12`) | Auth, game documents, action log, private hands |

### Vendor boundary (`vendor/DoubleTwelve`)

DoubleTwelve is a **git submodule** with its own Nx workspace (demo app, e2e, npm publish). Warp12 treats it as an opaque dependency:

- Parent Nx only runs `doubletwelve:build-lib` (Vite → `dist/`)
- Develop DoubleTwelve standalone: `cd vendor/DoubleTwelve && yarn start`
- Do not run parent `nx` against DoubleTwelve’s internal projects

## 🚀 Development Quickstart

Run all commands from the **monorepo root** (the directory with the top-level `package.json`, not `apps/Warp12`).

```bash
# Install dependencies (includes DoubleTwelve submodule)
yarn install
git submodule update --init vendor/DoubleTwelve

# Build everything (domino lib → engine → client)
yarn build:all

# Or step by step:
yarn build:doubletwelve   # vendor/DoubleTwelve → dist/
yarn build:engine         # libs/engine → dist/  (warp12-engine)
yarn build:react          # libs/react → dist/   (warp12-react)
yarn build:theme          # libs/theme → dist/   (warp12-theme)
yarn build:bridge         # apps/Warp12 → dist/

# Serve the client (dev server)
yarn serve:bridge

# Run tests
yarn test:engine
yarn test:react
yarn test:bridge
yarn test:e2e      # Playwright (builds bridge, then runs e2e)
yarn test:all      # all of the above
```

These scripts call **Vite/Vitest directly** and avoid Nx task orchestration (which can hang if orphaned Nx processes are blocking the lock).

### Builds hang or terminal goes black?

You're not imagining it. Repeated failed `yarn nx run …` attempts leave **orphaned Nx processes** on your machine that block every new run — often with no output.

**One-time fix:**

```bash
# 1. Clear Nx daemon + cache
yarn nx:unlock

# 2. Kill any leftover Nx processes (safe — only matches this repo)
pkill -f "Warp12/node_modules/nx"

# 3. Build with the direct scripts (not nx run)
yarn build:engine
```

If `pkill` reports no processes, skip step 2. After cleanup, prefer `yarn build:*` / `yarn test:*` / `yarn serve:bridge` over `yarn nx run …`.

<details>
<summary>Advanced: Nx targets (optional)</summary>

```bash
yarn nx run doubletwelve:build-lib
yarn nx run @warp12/Warp12-lib:build
yarn nx serve @warp12/Warp12
```

Nx 23’s TUI is disabled in `nx.json`, but the integrated terminal can still misbehave. Use `NX_TUI=false` if needed.

</details>

## 🔥 Firebase Setup

The client targets the [warp-12 Firebase project](https://console.firebase.google.com/project/warp-12).

1. Copy `apps/Warp12/.env.example` to `apps/Warp12/.env`
2. Fill in values from Firebase Console → Project Settings → Your apps → Web app config
3. Enable **Anonymous Auth** in Firebase Console → Authentication → Sign-in method
4. Deploy Firestore rules: `yarn deploy:firestore` (requires [Firebase CLI](https://firebase.google.com/docs/cli) and `firebase login`)
5. Without credentials, **Local simulation** still works; **Online fleet** requires the `.env` file

**Online lobby:** Host picks fleet size (3–8), objective (go-out / penalty), and modules before launch. Up to eight captains per sector; host can kick, reset, or dissolve from the waiting room. Penalty campaigns score rounds server-side (all private hands are read briefly at round end, then redealt).

**Multiplayer flow:**

1. Open The Bridge → **Online fleet**
2. Host **Open sector** (share the 6-character code)
3. Others **Join sector** with the same code
4. Host **Launch mission** when 2+ captains are aboard
5. Each client sees the shared table; only your hand is visible; moves sync via Firestore transactions

**Firestore layout:**

- `games/{gameId}` — public game state, table, hand counts, `captainIds`, lobby settings
- `games/{gameId}/hands/{playerId}` — private coordinates (readable only by that captain)
- `playerStats/{uid}` — leaderboard rankings and `localAi` buckets (ensign / lieutenant / commander)
- `playerProfiles/{uid}` — captain profile and gaming platform IDs
- `publishedLogs/{logId}` — shared round transcripts

## 🌐 Firebase Hosting

Two static SPAs on the **`warp-12`** project:

| Site | Deploy target | Build output | URL |
| ---- | ------------- | ------------ | --- |
| Bridge | `hosting:bridge` | `apps/Warp12/dist` | [warp12.app](https://warp12.app) |
| Leaderboard | `hosting:leaderboard` | `Warp12-leaderboard/dist` | [leaderboard.warp12.app](https://leaderboard.warp12.app) |

### One-time setup

1. Install the Firebase CLI and log in:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Confirm the project (already wired in `.firebaserc`):
   ```bash
   firebase use warp-12
   ```
3. Hosting targets (already configured in `.firebaserc`):
   - **Bridge** site id: `warp-12` → [warp12.app](https://warp12.app)
   - **Leaderboard** site id: `warp-12-leaderboard` → [leaderboard.warp12.app](https://leaderboard.warp12.app) (Firebase default URL: `warp-12-leaderboard.web.app`)

   Re-apply targets if needed:
   ```bash
   firebase target:apply hosting bridge warp-12 --project warp-12
   firebase target:apply hosting leaderboard warp-12-leaderboard --project warp-12
   ```
4. In [Firebase Console → Hosting](https://console.firebase.google.com/project/warp-12/hosting), attach custom domains:
   - **Bridge** (`warp-12`): `warp12.app`
   - **Leaderboard** (`warp-12-leaderboard`): `leaderboard.warp12.app`
5. Enable Hosting on both sites if prompted.

### Build + deploy

Firebase config is injected at **build time** via `.env` files. Bridge uses `apps/Warp12/.env`; leaderboard uses `Warp12-leaderboard/.env` (same `warp-12` web app credentials).

```bash
# Firestore rules + indexes
yarn deploy:firestore

# Bridge only
yarn deploy:hosting:bridge

# Leaderboard only
yarn deploy:hosting:leaderboard

# Both sites
yarn deploy:hosting

# Firestore + both sites
yarn deploy:firebase
```

Default Firebase URLs remain available (`warp-12.web.app`, `warp-12-leaderboard.web.app`) until custom domains propagate.

### Local production preview

```bash
yarn build:all
yarn preview:bridge          # bridge → http://localhost:4300

cd Warp12-leaderboard && yarn build && yarn preview   # leaderboard → http://localhost:4310
```

### SPA routing

`firebase.json` rewrites all paths to `index.html` on both sites so deep links work on refresh. Hashed assets under `/assets/` are cached long-term; `index.html` is not cached so deploys roll out quickly.

### Custom domains

Firebase Console → Hosting → select site → **Add custom domain**, then follow the DNS steps. HTTPS is provisioned automatically.

### Authorized domains (online play + leaderboard)

Firebase Console → Authentication → **Settings** → **Authorized domains** should include:

- `localhost` (dev)
- `warp12.app`
- `leaderboard.warp12.app`
- `warp-12.web.app`
- `warp-12.firebaseapp.com`
- `warp-12-leaderboard.web.app` (default Firebase URL for the leaderboard site)

Anonymous Auth will fail on a domain that is not listed there.

## 📜 Rules

See [RULES.md](./RULES.md) for the full Navigational Operations Manual — Spacedock, Warp Trails, Neutral Zone, Distress Beacon, Subspace Fracture, All Stop!, Drop to Impulse, and opt-in modules (Q-Continuum, Salamander Penalty).

## Warp AI, tactical coach & TEI

Warp 12 ships with offline AI captains and a human-facing **tactical coach**, both built on the same `warp12-engine` decision stack and validated with self-play calibration.

### Captain AI (`createWarpAiPlayer`)

Each AI officer runs entirely inside the rules engine — Distress Beacons, Red Alerts, Subspace Fractures, the Neutral Zone, house rules, and modules are all honored. Decisions use [DoubleTwelve](https://www.npmjs.com/package/doubletwelve)'s model-agnostic policy layer on top of Warp-specific heuristics (dump heavy pips, own-trail pressure, Red Alert safety, Q-Continuum timing, go-out vs penalty objective, and more).

| Setting | What it does |
|---------|----------------|
| **Tactical Class** (IV / III / II) | Controls blunder rate, heuristic weights, and **intrinsic search depth** for that simulation tier. Class IV officers make more mistakes; Class II play tighter heuristics. Lookahead is baked into the tier profile (not a separate toggle) so leaderboard TEI stays consistent. |

**Class II go-out** uses depth-2 forward search at **2 players only**; at 3+ the race is too chaotic for search to help, so those tables use greedy sprint heuristics instead. **Penalty** captains stay greedy at all table sizes. Search simulates candidate moves through the real engine with sampled hidden hands — it **does not see your tiles**. Detail: [RULES.md §VII](./RULES.md#vii-ai-officers--tactical-advisor-digital).

Self-play suites in `libs/engine` verify skill ordering, symmetric seating fairness, and 4-player focus matchups. Run the calibration report:

```bash
yarn calibrate:ai-tei          # 200 games per matchup + multi-table focus matrix
AI_CALIBRATION_GAMES=500 yarn calibrate:ai-tei   # longer run for tighter estimates
yarn calibrate:ai-tei-dti      # same report plus Drop to Impulse penalty sanity pass
yarn optimize:ai-weights       # coordinate search on go-out heuristic weights
```

### Tactical coach (`warp12-react`)

The in-game **tactical advisor** reuses the same AI stack at Class II with lookahead always on. It suggests a move plus plain-language reasons (`explainWarpAiAction`, turn-resolution hints) so humans can see *why* a line is strong — not just what to play.

### Leaderboard TEI (unassisted matches)

Solo games vs AI feed **[leaderboard.warp12.app](https://leaderboard.warp12.app)**. Two independent tracks:

| Track | When it applies |
|-------|-----------------|
| **Go-out TEI** | First player to empty their hand wins |
| **Penalty TEI** | Lowest pip count when the round ends |

Each track also splits by AI tactical class (`localAi` Class IV / III / II profiles).

**Starfleet Academy:** before the first rated match in each track, captains pick Class IV / III / II and a starting TEI within that class’s band (saved once per track — go-out and penalty are independent).

**Fixed reference TEI** (unassisted matches only):

| Track | Class IV | Class III | Class II |
|-------|----------|-----------|----------|
| Penalty | ~TEI 1000 | ~TEI 1200 | ~TEI 1400 |
| Go-out | ~TEI 1000 | ~TEI 1250 | ~TEI 1500 |

Go-out uses wider spacing because race outcomes are noisier; the leaderboard also shows **percentile** (Top X%) within each board so rank is meaningful even when raw TEI gaps compress.

Your TEI updates with a standard Elo formula; K-factor starts at **40** for the first 10 rated games, then **32** until 30 games, then **24**.

**Advisor disqualification:** if you used the tactical advisor during the match, the win still counts in general stats, but **TEI does not move** — only unassisted matches are rated. Assisted wins are tracked separately (`advisorMatches` / `advisorWins`).

Calibration self-play (`yarn calibrate:ai-tei`) compares tier-vs-tier win rates to those fixed TEI reference bands. Penalty tiers align closely (~76–91% per 200-point step). Go-out ordering is stable but gaps are compressed by race variance; table-size tweaks live in `getWarpSkillProfile(..., playerCount, tableRole)`.

Paper outline (TEI, calibration, go-out vs penalty): [docs/tei-paper-outline.md](./docs/tei-paper-outline.md) · in-app: `/paper`. Self-improvement log: [docs/calibration-log.md](./docs/calibration-log.md) · `/paper/log`. Engine survey: [docs/mexican-train-engine-comparison.md](./docs/mexican-train-engine-comparison.md). Marketing: `/about`.

Published packages: `warp12-engine` (AI + rules), `warp12-react` (coach + table adapters).

## 🤖 Agentic Development

- **Strict typing** — no `any`; engine types live in `warp12-engine`
- **Immutability** — engine state is never mutated in place; pure functions return new state
- **Specs first** — update Markdown specs in `tools/agent-specs/` before changing rules (coming soon)

## Useful links

- [Nx documentation](https://nx.dev)
- [DoubleTwelve library](./vendor/DoubleTwelve/README.md)
- [Firebase Console — warp-12](https://console.firebase.google.com/project/warp-12)
