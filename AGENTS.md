# Warp 12 — Agent Guide

Canonical instructions for AI assistants (Kiro, Cursor, Copilot, Codex, etc.) working in this repo. This is the single source of truth; tool-specific configs (`.kiro/steering/`, `.cursor/rules/`) just point here.

---

## 1. Product

Warp 12 is a multiplayer, federation-themed variant of standard **double-twelve Mexican Train dominoes**. It ships as a web app (warp12.app) and as a Tauri desktop/mobile app (macOS, iOS, Android). Rules are standard tournament Mexican Train reskinned with federation terminology, plus opt-in modules.

- Games are **sectors/missions**; players are **Captains**; the host runs a **fleet** (3–8 captains).
- Two objectives, chosen before launch:
  - **Points campaign** (default): 13 rounds, Spacedock double descends 12-12 → 0-0, lowest cumulative pip total wins.
  - **Go out**: first captain to empty their hand wins immediately.
- **TEI** = the Elo-like leaderboard rating. Independent **Go-out** and **Points** tracks, each split by AI **Tactical Class** (IV / III / II). Solo unassisted matches and online human-pool sectors are rated. Using the tactical advisor disqualifies a match from TEI. Online sectors are auto-rated (context B: humans anchored against Class II–IV AI) when all human seats are verified, no Class I\* is aboard, the host opts in (rated=true), and no captain used the advisor. The host may toggle **Rated sector** before launch; casual sectors never update TEI.
- **Subspace messaging** = in-game comms. Quick-phrase hails (five category groups) are always available. Free-form text + DMs are allowed in the lobby, casual active play, and post-game — but restricted to hails only during live rated play to prevent collusion. Per-user mute and rate-limiting are client-enforced; comms rules are also enforced server-side via Firestore security rules.

Authoritative rules: `RULES.md` (Sections I–V = standard Mexican Train, VI = modules + Official Warp 12 preset, VII = AI/advisor, VIII = TEI/leaderboard, IX = Subspace messaging). Full architecture/setup: `README.md`.

---

## 2. Tech stack

- **Monorepo**: Nx 23 + Yarn 4 (`yarn@4.17.0`). Root package `@warp12/source` (private). Workspaces: `apps/*`, `libs/*`, `functions`, `vendor/*`.
- **Language**: TypeScript ~5.9, `strict`, no `any`. ESM (`module`/`moduleResolution` = esnext/bundler), target es2022.
- **Frontend**: React 19, react-dom 19, react-router-dom 6.30.
- **Build**: Vite 8 (per-project `vite.config.mts`), SWC available, `vite-plugin-dts` for lib d.ts.
- **Test**: Vitest 4 (jsdom + `@testing-library/react`) for unit; Playwright for e2e. Tests are co-located `*.spec.ts(x)`.
- **Styling**: SCSS / CSS Modules (`*.module.scss`). Nx generators default `style: scss`.
- **State**: React Context (`*-context.tsx`) + hooks. No Redux/Zustand. Engine state is immutable pure-function data.
- **Desktop/mobile**: Tauri 2 (Rust edition 2021) at `apps/Warp12/src-tauri/`. Frontend is a plain SPA — game logic is all in JS; no custom Rust commands.
- **Backend**: Firebase 12 (anonymous Auth, Firestore, Functions, Hosting), project `warp-12`. Browser AI inference via onnxruntime-web (WebNN → wasm fallback).

### Module resolution (important)
There are **no tsconfig `paths`**. Resolution uses package `exports` with the custom condition `@warp12/source` pointing to each lib's `src/index.ts` (source-first). The app `vite.config.mts` adds `resolve.alias` for `doubletwelve`, `warp12-engine`, `warp12-react`, `warp12-theme` → their source.

---

## 3. Commands (run from repo root)

Scripts call Vite/Vitest **directly** and avoid `nx run` orchestration (which can hang). Prefer these over `yarn nx run …`.

**Build** (order matters — deps first):
- `yarn build:all` → doubletwelve → engine → react → theme → bridge → **functions** (`tsc` + staged vendor for Cloud Functions)
- Individual: `build:doubletwelve | build:engine | build:react | build:theme | build:bridge | build:leaderboard`
- `build:all:hosting` adds the leaderboard SPA

**Test:**
- `yarn test:engine | test:react | test:bridge`
- `yarn test:e2e` (builds bridge, then Playwright)
- `yarn test:all`

**Serve / preview:** `yarn serve:bridge` (Vite dev :4200), `yarn preview:bridge` (:4300).

**Tauri:** `tauri:dev`, `tauri:build`, `tauri:ios:dev/build`, `tauri:android:dev/build`; packaged `build:mac`, `build:android`.

**Deploy** (Firebase project `warp-12`): `deploy:firestore | deploy:functions | deploy:hosting | deploy:firebase`.

**AI training/calibration:** `calibrate:ai-tei`, `optimize:ai-weights`, `class1-star:*` (PyTorch pipeline in `tools/nn/`), `fleet-admiral:bench*`.

### If builds hang / terminal goes black
Orphaned Nx processes block runs. Recover with:
```bash
yarn nx:unlock                          # stop daemon + clear cache
pkill -f "Warp12/node_modules/nx"       # kill leftovers (safe, repo-scoped)
```
Then use the direct `yarn build:* / test:* / serve:bridge` scripts.

---

## 4. Structure

```
apps/
  Warp12/            @warp12/Warp12 — "The Bridge" React/Firebase client + Tauri host (private)
  Warp12-e2e/        Playwright e2e
libs/
  engine/            warp12-engine — rules state machine, AI, advisor (published)
  react/             warp12-react  — RoundState→trains adapters, tactical coach, hand layout (published)
  theme/             warp12-theme  — federation domino skins (published)
  tei-core/          @warp12/tei-core — TEI/Elo core (private, src-only)
vendor/
  DoubleTwelve/      git submodule, own Nx workspace — domino rendering (opaque dependency)
functions/           @warp12/functions — Firebase Cloud Functions
Warp12-leaderboard/  separate SPA (own build) → iwdf.org
tools/nn/            Class I* neural training pipeline (Python/PyTorch → ONNX)
docs/                Jekyll docs site (calibration log, TEI paper)
```

### Client app layout (`apps/Warp12/src/`)
- `app/` — UI: pages, dialogs, HUD, table view, coach panel, comms panel, contexts (`*-context.tsx`).
- `firebase/` — auth, `game-service`, sync, `schema`, stats/Elo, serialize, `messages` (subspace comms).
- `game/` — local game orchestration, AI captain wiring, sounds, match stats, presets, `quick-comms` (phrase catalog), `comms-mode`, `message-rate-limit`.
- `ai/` — ONNX Class I* model loading (`ort-session`, `load-class1-star-scorer`).
- `content/` — rules/paper/privacy markdown sources. `theme/`, `test/`.

### Lib layout
`libs/<name>/src/index.ts` barrel → `src/lib/**`. Each lib has `tsconfig.json` + `tsconfig.lib.json` + `tsconfig.spec.json` + `vite.config.mts`. Files use **kebab-case**.

### Vendor boundary
`vendor/DoubleTwelve` is a submodule with its own Nx workspace. Treat it as opaque: parent only runs `build:doubletwelve`. Do not run parent `nx` against its internal projects; develop it standalone (`cd vendor/DoubleTwelve && yarn start`).

---

## 5. Game engine & domain (`libs/engine/src/lib/`)

Deterministic, immutable rules engine. **Never mutate state in place** — pure functions return new state. All engine types (`GameState`, `RoundState`, `TableState`) are `readonly`.

- `types/` — `game-state.ts`, `actions.ts`, `trails.ts`, `anomalies.ts`, `player.ts`, `objective.ts`, `modules.ts`, `house-rules.ts`, `continuum.ts`, `coordinate.ts`.
- `setup/create-game.ts` + `constants/setup.ts` — deal, hand sizes, Spacedock.
- `engine/` — the state machine: `apply-action.ts` (reducer), `legal-moves.ts`, `beacon.ts`, `scoring.ts`, `round-resolution.ts`, `drop-to-impulse.ts`, `continuum.ts`, `house-rules.ts`.
- `table/` — `table-state.ts`, `pip-inventory.ts`, `fracture-stabilizers.ts`.
- `domino/coordinates.ts` — tile model.
- `ai/` — `create-warp-ai.ts`, heuristics, skill/tactical-class profiles, lookahead, ISMCTS, advisor (`explain-*`), Class I* neural (`class1-star-policy.ts`, `feature-encoder.ts`, `residual-scorer.ts`), calibration/self-play, `fleet-admiral.ts`.

### Federation lexicon (standard term → Warp 12)
| Standard | Warp 12 |
|---|---|
| Domino | Navigational Coordinate |
| Engine/station double | Spacedock |
| Personal train | Warp Trail |
| Mexican Train | Neutral Zone |
| Train marker | Distress Beacon (Shields Down) |
| Boneyard | Uncharted Sectors |

Warp-specific mechanics: **Red Alert** (unsatisfied double), **Subspace Fracture** (optional chicken-foot on doubles; scope Own Trail / All Captains / All Doubles), **Flash / Continuum** (Module Alpha anomaly on 0-0), **All Stop!** (round-win ceremony), **Drop to Impulse** (uno/knock announce). "Warp 12" = the double-twelve set (max pip). AI officers rated **Tactical Class IV/III/II**; experimental neural tier is **Class I\***; **Fleet Admiral** is the benchmark harness.

---

## 6. Conventions & guardrails

- **Strict typing** — no `any`. Engine domain types live in `warp12-engine`.
- **Immutability** — engine state is never mutated in place.
- **Tests co-located** as `*.spec.ts(x)`; add/update tests with behavior changes and run the relevant `test:*` script.
- **Kebab-case** filenames; SCSS modules `*.module.scss`.
- Firestore layout: `games/{gameId}` (public) + `/hands/{playerId}` (private) + `/messages/{id}` (subspace comms) + `/presence/{playerId}` (coach presence), `playerStats/{uid}`, `playerProfiles/{uid}`, `publishedLogs/{logId}`, `ratedMatches/{code}`. Config at root: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.
- Prefer the direct `yarn` scripts over `nx run`. Build lib deps before dependents.
