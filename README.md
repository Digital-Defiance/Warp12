# 🌌 WARP 12

**Interstellar Dominoes — Warp factors 9 / 12 / 15 / 18**

Warp 12 is multiplayer, federation-themed **multi-trail Interstellar Dominoes**. The Bridge client supports **double-9, double-12, double-15, and double-18** sets (choose a Warp factor on first launch or from the home screen). This repository contains the game engine, client UI, domino rendering library, and Firebase-backed multiplayer infrastructure in a TypeScript Nx monorepo.

Online sectors include **subspace messaging** — quick-phrase hails (always available, even during rated play) plus free-form text and DMs (lobby, casual, and post-game). Rated sectors restrict comms to hails to prevent collusion. See [Subspace messaging in RULES.md](RULES.md#ix-subspace-messaging-digital--online-sectors).

Complete Ecosystem:

- Game:
  <img width="1728" height="1084" alt="Screenshot 2026-07-17 at 8 23 27 AM" src="https://github.com/user-attachments/assets/d5e1816b-142c-4fc4-9534-6fbfdf752f89" />

- Debug extension:
  <img width="1728" height="1039" alt="Screenshot 2026-07-16 at 1 29 16 PM" src="https://github.com/user-attachments/assets/31455f3a-4d14-41fc-b080-b703a24a6355" />
  <img width="1720" height="1004" alt="Screenshot 2026-07-16 at 1 29 31 PM" src="https://github.com/user-attachments/assets/fae65fa4-de5b-4631-b6af-0b90a5bcd8b8" />

- Build tool:
  <img width="1119" height="752" alt="Screenshot 2026-07-16 at 12 06 20 PM" src="https://github.com/user-attachments/assets/458ee254-1159-4082-8190-d634e0bc716b" />

- Admin tool:
  <img width="1728" height="1084" alt="Screenshot 2026-07-17 at 8 18 22 AM" src="https://github.com/user-attachments/assets/b931f14f-79c0-48ec-9db9-480a8db5523e" />


### Warp factors

Captains pick a set before play (`/factor`, or **Choose your Warp Factor** on the home page). The choice is stored in `localStorage` (`warp-factor`) and drives tile count, campaign length, and fleet caps:

| Factor | Set | Tiles | Fleet | Points campaign | TEI |
| --- | --- | --- | --- | --- | --- |
| **Warp 9** | Double-9 | 55 | 2–4 | 10 rounds (9-9 → 0-0) | Exhibition (unrated) |
| **Warp 12** | Double-12 | 91 | 2–8 | 13 rounds (12-12 → 0-0) | **Rated** (default) |
| **Warp 15** | Double-15 | 136 | 2–12 | 16 rounds (15-15 → 0-0) | Exhibition (unrated) |
| **Warp 18** | Double-18 | 190 | 2–18 | 19 rounds (18-18 → 0-0) | Exhibition (unrated) |

Engine profiles live in `libs/engine` (`warpSetProfile` / `WARP_FACTORS`). The Bridge wires the selection through `apps/Warp12/src/app/warp-factor.ts`. Hub layout scales with fleet size (Neutral Zone is the last spoke). See [RULES.md §II — Exhibition sets](RULES.md#exhibition-sets-digital--warp-9--15--18).

**TEI is Warp 12 only.** Warp 9 / 15 / 18 are exhibition: the lobby forces unrated, Academy/TEI UI is hidden, and Cloud Functions reject TEI reports for non-12 sets.

## 🖖 The Captain's Oath

Warp 12 has no referees — it runs on the honor of the captains at the table. Rated play is a matter of record, so we hold to a simple code: **play with honor, use sanctioned code, earn your rating, and keep the pool clean.** We don't cheat, tamper with the client, farm or sandbag TEI, and if we see cheating we report it. Only the official build and eligible matches are ever rated. See [The Captain's Oath in RULES.md](RULES.md#the-captains-oath--honor-of-the-fleet) for the full oath.

## 🏗 System Architecture

Strict separation of concerns keeps the core engine agnostic of transport and presentation:

```
warp-12/
├── apps/
│   └── Warp12/                 # The Bridge — React client (Firebase, lobby, game table)
├── libs/
│   ├── engine/                 # warp12-engine — rules, AI, advisor (npm)
│   ├── react/                  # warp12-react — adapters, coach, hand layout (npm)
│   └── theme/                  # warp12-theme — DoubleEighteen skins (npm)
├── vendor/
│   └── double-eighteen/           # Domino rendering submodule (own Nx workspace)
└── RULES.md                    # Navigational Operations Manual
```

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Engine** | `warp12-engine` | Deterministic state machine: turns, scoring, Distress Beacon, Subspace Fracture, Warp AI, advisor explanations |
| **React adapters** | `warp12-react` | `RoundState` → trains, tactical coach, hand layout hooks |
| **Theme** | `warp12-theme` | federation domino tile presets for double-eighteen |
| **Rendering** | `double-eighteen` | React domino components, train layout, chicken-foot geometry, pip theming |
| **Client** | `@warp12/Warp12` | Space-themed UI, Firebase Auth + Firestore sync (private app) |
| **Multiplayer** | Firebase (`warp-12`) | Auth, game documents, action log, private hands |

### Vendor boundary (`vendor/double-eighteen`)

double-eighteen is a **git submodule** with its own Nx workspace (demo app, e2e, npm publish). Warp12 treats it as an opaque dependency:

- Parent Nx only runs `double-eighteen:build-lib` (Vite → `dist/`)
- Develop double-eighteen standalone: `cd vendor/double-eighteen && yarn start`
- Do not run parent `nx` against DoubleEighteen’s internal projects

## 🚀 Development Quickstart

Run all commands from the **monorepo root** (the directory with the top-level `package.json`, not `apps/Warp12`).

```bash
# Install dependencies (includes DoubleEighteen submodule)
yarn install
git submodule update --init vendor/double-eighteen

# Build everything (domino lib → engine → client)
yarn build:all

# Or step by step:
yarn build:double-eighteen # vendor/double-eighteen → dist/
yarn build:engine          # libs/engine → dist/  (warp12-engine)
yarn build:react           # libs/react → dist/   (warp12-react)
yarn build:theme           # libs/theme → dist/   (warp12-theme)
yarn build:bridge          # apps/Warp12 → dist/

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
yarn nx run double-eighteen:build-lib
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

**Online lobby:** Host picks fleet size (3–8), objective (points / go-out; **points is default**), and modules before launch. Up to eight captains per sector; host can kick, reset, or dissolve from the waiting room. Points campaigns score rounds server-side (all private hands are read briefly at round end, then redealt).

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
| Bridge | `hosting:bridge` | `apps/Warp12/dist` | [warp.iwdf.org](https://warp.iwdf.org) |
| Leaderboard | `hosting:leaderboard` | `Warp12-leaderboard/dist` | [iwdf.org](https://iwdf.org) |
| Warp Ops | `hosting:ops` | `apps/WarpOps/dist` | [ops.iwdf.org](https://ops.iwdf.org) |

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
   - **Bridge** site id: `warp-12` → [warp.iwdf.org](https://warp.iwdf.org)
   - **Leaderboard** site id: `warp-12-leaderboard` → [iwdf.org](https://iwdf.org) (Firebase default URL: `warp-12-leaderboard.web.app`)
   - **Warp Ops** site id: `warp-12-ops` → [ops.iwdf.org](https://ops.iwdf.org)

   Re-apply targets if needed:
   ```bash
   firebase target:apply hosting bridge warp-12 --project warp-12
   firebase target:apply hosting leaderboard warp-12-leaderboard --project warp-12
   firebase target:apply hosting ops warp-12-ops --project warp-12
   ```
4. In [Firebase Console → Hosting](https://console.firebase.google.com/project/warp-12/hosting), attach custom domains:
   - **Bridge** (`warp-12`): `warp.iwdf.org`
   - **Leaderboard** (`warp-12-leaderboard`): `iwdf.org` (and `www` if used)
   - **Warp Ops** (`warp-12-ops`): `ops.iwdf.org`
5. Enable Hosting on the sites if prompted.

### Build + deploy

Firebase config is injected at **build time** via `.env` files. Bridge and Warp Ops use `apps/Warp12/.env`; leaderboard uses `Warp12-leaderboard/.env` (same `warp-12` web app credentials).

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
- `warp.iwdf.org`
- `warp-12.web.app`
- `warp-12.firebaseapp.com`
- `warp-12-leaderboard.web.app` (default Firebase URL for the leaderboard site)
- `iwdf.org`
- `leaderboard.warp12.app`

Anonymous Auth will fail on a domain that is not listed there.

## 📜 Rules

See [RULES.md](./RULES.md) for the full Navigational Operations Manual — Spacedock, Warp Trails, Neutral Zone, Distress Beacon, Subspace Fracture, All Stop!, Drop to Impulse, opt-in modules (Continuum, Salamander Penalty), and **exhibition sets** (Warp 9 / 15 / 18).

## Warp AI, tactical coach & TEI

Warp 12 ships with offline AI captains and a human-facing **tactical coach**, both built on the same `warp12-engine` decision stack and validated with self-play calibration.

### Captain AI

| Tier | Engine | Rated? |
|------|--------|--------|
| **Ensign / Lieutenant** | Heuristic `createWarpAiPlayer` | Yes |
| **Commander** | Neural **Ω** (`createOmegaPlayer`, greedy policy) | Yes — `warp12-official-v2` anchors |
| **Extended thinking (Ω+)** | Same Ω weights + net-guided search (`createOmegaSearchPlayer`) | **No** — local exhibition only |
| **Class I\*** | Heuristic + search/residual research | No |

Ensign–Lieutenant officers use double-eighteen heuristics on the real engine (Distress Beacons, Red Alert, modules, house rules). **Commander is Ω** — a self-play neural policy, not a separate lobby tier. Optional **extended thinking** on Commander in local simulation runs Ω+ search; those matches do not update TEI.

Self-play suites verify skill ordering and fairness. Heuristic tier calibration:

```bash
yarn calibrate:ai-tei          # Ensign–Lieutenant vs legacy heuristic Commander bands
```

Ω promotion gates: `yarn omega:bench` (champion vs legacy Commander).

### Tactical coach (`warp12-react`)

The **tactical advisor** follows Commander **Ω** (greedy policy) when weights are loaded, then explains the line with plain-language heuristic reasons (`explainWarpAiAction`, turn-resolution hints). Assisted matches never move TEI.

### Leaderboard TEI (unassisted matches)

Solo games vs AI feed **[iwdf.org](https://iwdf.org)** when the sector is **Warp 12** (double-twelve). Warp 9 / 15 / 18 never update TEI. Two independent tracks:

| Track | When it applies |
|-------|-----------------|
| **Go-out TEI** | First player to empty their hand wins |
| **Points TEI** | Lowest pip count when the round ends |

Each track also splits by AI commission track (`localAi` Ensign / Lieutenant / Commander profiles).

**Federation Academy:** before the first rated match in each track, captains pick Ensign / Lieutenant / Commander and a starting TEI within that class’s band (saved once per track — go-out and points are independent).

**Fixed reference TEI** (`warp12-official-v2`, unassisted matches only):

| Track | Ensign | Lieutenant | Commander |
|-------|-------------------|------------------------|----------------------|
| Points | μ=18.0, σ=4.0 | μ=26.5, σ=3.5 | μ=35.0, σ=3.0 |
| Go-out | μ=17.5, σ=4.5 | μ=28.0, σ=4.0 | μ=41.5, σ=3.5 |

Legacy crews pinned to `warp12-official-v1` keep old reference bands. Stored human ratings are **not** re-banded — only the opponent rating in the update formula changes for new play.

Go-out uses wider spacing because race outcomes are noisier; the leaderboard also shows **percentile** (Top X%) within each board so rank is meaningful even when raw TEI gaps compress.

Your TEI updates using **OpenSkill** (Bayesian rating with μ ± σ). The system displays a conservative rating (μ - 3σ) as your **TEI Grade** (e.g., "V67", "C42") where the letter represents confidence (E/V/C/I/P based on σ) and the number is your normalized skill score. New players start with high uncertainty (σ) which decreases with more matches, making your grade more stable.

**Advisor disqualification:** if you used the tactical advisor during the match, the win still counts in general stats, but **TEI does not move** — only unassisted **Warp 12** matches are rated. Assisted wins are tracked separately (`advisorMatches` / `advisorWins`). Exhibition sets (9 / 15 / 18) are never rated, with or without the advisor.

Calibration: heuristic tiers via `yarn calibrate:ai-tei`; Commander Ω via champion fair-share benches (`tools/nn/data/omega-champion-score.txt`). Go-out compresses skill gaps — percentile boards help.

### Class I* — experimental research tier

**Class I\*** (local only) is a separate research track: heuristics + expectimax/ISMCTS and optional learned residuals — **not** the shipped Commander Ω officer. The tactical advisor does **not** use Class I\*; it follows Ω.

| Piece | Location |
|-------|----------|
| Engine policy | `libs/engine/src/lib/ai/class1-star-policy.ts` |
| Offline training | `tools/nn/` — collect → PyTorch train → ONNX + JSON |
| Browser inference | ONNX Runtime Web (WebNN → wasm → TS fallback) |

```bash
yarn class1-star:setup              # Python venv (once)
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:deep   # imitation (points default)
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:go-out # go-out alternate
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:deepblue  # RL regret pass (256×256, α=3)
```

**What we are learning:** imitation of Commander picks (~74% train top-1) changes ~17% of decisions but **does not beat Commander in 2p go-out** (~48–50% win rate over hundreds of games). Points imitation converges to a near-perfect Commander clone (98% top-1, 1.4% flip) with **no win-rate edge**. The **Deep Q** pass (`pipeline:deepblue`) collects Class I* vs Commander games, trains with **regret targets** (reinforce winning deviations, learn Commander on losses), a **256×256** MLP, and **α=3.0** so the residual can override heuristics. Class I* is **not** a TEI reference tier until it wins with statistical significance. Details: [tools/nn/README.md](./tools/nn/README.md), [docs/calibration-log.md](./docs/calibration-log.md), paper §4.5.

Paper outline (TEI, calibration, Class I*, go-out vs points): [docs/tei-paper-outline.md](./docs/tei-paper-outline.md) · in-app: `/paper`. Self-improvement log: [docs/calibration-log.md](./docs/calibration-log.md) · `/paper/log`. Engine survey: [docs/mexican-train-engine-comparison.md](./docs/mexican-train-engine-comparison.md). Marketing: `/about`.

Published packages: `warp12-engine` (AI + rules), `warp12-react` (coach + table adapters).

## 🤖 Agentic Development

- **Strict typing** — no `any`; engine types live in `warp12-engine`
- **Immutability** — engine state is never mutated in place; pure functions return new state
- **Specs first** — update Markdown specs in `tools/agent-specs/` before changing rules (coming soon)

## Useful links

- [Documentation site](https://docs.warp12.app) (Jekyll + Just the Docs — `docs/`)
- [Nx documentation](https://nx.dev)
- [DoubleEighteen library](./vendor/double-eighteen/README.md)
- [Firebase Console — warp-12](https://console.firebase.google.com/project/warp-12)

## 📦 Install (macOS)

Warp 12 ships as a macOS app via a Homebrew **cask** on the Digital Defiance tap:

```bash
brew tap digital-defiance/tap
brew trust --cask digital-defiance/tap/warp12
brew install --cask warp12
```

Or as a single command — installing a fully-qualified cask name taps and trusts just that item:

```bash
brew install --cask digital-defiance/tap/warp12
```

> **Why `brew trust`?** Since [Homebrew 6.0.0](https://docs.brew.sh/Tap-Trust), non-official taps must be explicitly trusted before installing. `brew trust --cask …` authorizes only the Warp 12 cask (not every current/future package in the tap).

Update or remove later:

```bash
brew upgrade --cask warp12
brew uninstall --cask warp12
```

## Architecture & Development Notice

This is a hobby project, but a systems engineer's hobby project is basically an enterprise-grade, end-to-end lesson in software engineering.

Warp 12 is architected and overseen by a veteran systems engineer, with the heavy lifting of code generation handled by AI. We use Kiro for strict Spec-Driven Development, meaning this isn't haphazard "vibe coding"—every module is deliberately guided, heavily tested, and rigorously validated against our design parameters.

That being said, like any complex software engine, edge cases and bugs can still slip through. If you spot an oversight or a regression, please file an [issue](https://github.com/Digital-Defiance/Warp12/issues) on GitHub.
