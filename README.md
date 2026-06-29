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

## 🌐 Firebase Hosting

The bridge app is a static SPA (React + React Router). Firebase Hosting serves `apps/Warp12/dist` after a production build.

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
3. In [Firebase Console → Hosting](https://console.firebase.google.com/project/warp-12/hosting), click **Get started** if you have not enabled Hosting yet (no extra config required in Console beyond that).

### Build + deploy

Firebase config is injected at **build time** via `apps/Warp12/.env`. Make sure that file exists with your web app credentials before building for production.

```bash
# Rules only
yarn deploy:firestore

# Static site only (builds DoubleTwelve + engine + bridge, then deploys)
yarn deploy:hosting

# Both rules and site
yarn deploy:firebase
```

After deploy, the CLI prints your live URL (typically `https://warp-12.web.app` and `https://warp-12.firebaseapp.com`).

### Local production preview

```bash
yarn build:all
yarn preview:bridge
```

Open `http://localhost:4300` to verify routes (`/`, `/local`, `/online`) before deploying.

### SPA routing

`firebase.json` rewrites all paths to `index.html` so deep links like `/online/ABC123/play` work on refresh. Hashed assets under `/assets/` are cached long-term; `index.html` is not cached so deploys roll out quickly.

### Custom domain (optional)

Firebase Console → Hosting → **Add custom domain**, then follow the DNS steps (usually a few TXT/CNAME records). HTTPS is provisioned automatically.

### Authorized domains (online play)

Firebase Console → Authentication → **Settings** → **Authorized domains** should include:

- `localhost` (dev)
- `warp12.app`
- `warp-12.web.app`
- `warp-12.firebaseapp.com`

Anonymous Auth will fail on a domain that is not listed there.

## 📜 Rules

See [RULES.md](./RULES.md) for the full Navigational Operations Manual — Spacedock, Warp Trails, Neutral Zone, Distress Beacon, Subspace Fracture, All Stop!, Drop to Impulse, and opt-in modules (Q-Continuum, Salamander Penalty).

## Warp AI & tactical coach

Warp 12 ships with offline AI captains and a human-facing **tactical coach**, both built on the same `warp12-engine` decision stack and validated with self-play tests.

### Captain AI (`createWarpAiPlayer`)

Each AI officer runs entirely inside the rules engine — Distress Beacons, Red Alerts, Subspace Fractures, the Neutral Zone, house rules, and modules are all honored. Decisions use [DoubleTwelve](https://www.npmjs.com/package/doubletwelve)'s model-agnostic policy layer on top of Warp-specific heuristics (dump heavy pips, own-trail pressure, Red Alert safety, Q-Continuum timing, go-out vs penalty objective, and more).

| Setting | What it does |
|---------|----------------|
| **Skill** (Beginner / Intermediate / Advanced) | Controls blunder rate and how sharply the bot prefers high-scoring moves. Beginners make more mistakes; Advanced plays tighter heuristics. |
| **Lookahead** (per-captain checkbox) | Opts into **forward search** instead of greedy one-ply scoring. The bot simulates candidate moves through the real engine, guesses plausible opponent holdings (same hand counts, random tiles from the unseen pool) and draw order several times, and evaluates outcomes ~2 plies ahead. **It does not see your tiles.** Slower, but it can reason about consequences. Full detail: [RULES.md §VII](./RULES.md#vii-ai-officers--tactical-advisor-digital). |

Without Lookahead, captains use the fast heuristic policy. With Lookahead enabled, the client uses a bounded search (depth 2, a handful of determinizations and branches per node). Self-play suites in `libs/engine` verify that lookahead captains beat greedy beginners heads-up and that full games stay legal end-to-end.

### Tactical coach (`warp12-react`)

The in-game **tactical advisor** reuses the same AI stack at Advanced skill with lookahead always on. It suggests a move plus plain-language reasons (`explainWarpAiAction`, turn-resolution hints) so humans can see *why* a line is strong — not just what to play.

Published packages: `warp12-engine` (AI + rules), `warp12-react` (coach + table adapters).

## 🤖 Agentic Development

- **Strict typing** — no `any`; engine types live in `warp12-engine`
- **Immutability** — engine state is never mutated in place; pure functions return new state
- **Specs first** — update Markdown specs in `tools/agent-specs/` before changing rules (coming soon)

## Useful links

- [Nx documentation](https://nx.dev)
- [DoubleTwelve library](./vendor/DoubleTwelve/README.md)
- [Firebase Console — warp-12](https://console.firebase.google.com/project/warp-12)
