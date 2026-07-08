---
layout: default
title: System Architecture
parent: Game
nav_order: 2
description: Monorepo layout — engine, React adapters, client, and Firebase multiplayer.
---

# System Architecture

Warp 12 is a TypeScript Nx monorepo with strict separation between rules engine, presentation, and transport.

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
└── RULES.md                    # Navigational Operations Manual (repo root)
```

## Layers

| Layer | Package | Responsibility |
| ----- | ------- | -------------- |
| **Engine** | `warp12-engine` | Deterministic state machine: turns, scoring, Distress Beacon, Subspace Fracture, Warp AI, advisor explanations |
| **React adapters** | `warp12-react` | `RoundState` → trains, tactical coach, hand layout hooks |
| **Theme** | `warp12-theme` | federation domino tile presets for DoubleTwelve |
| **Rendering** | `doubletwelve` | React domino components, train layout, chicken-foot geometry, pip theming |
| **Client** | `@warp12/Warp12` | Space-themed UI, Firebase Auth + Firestore sync |
| **Multiplayer** | Firebase (`warp-12`) | Auth, game documents, action log, private hands |

## Vendor boundary (`vendor/DoubleTwelve`)

DoubleTwelve is a **git submodule** with its own Nx workspace. Warp12 treats it as an opaque dependency:

- Parent Nx only runs `doubletwelve:build-lib` (Vite → `dist/`)
- Develop DoubleTwelve standalone: `cd vendor/DoubleTwelve && yarn start`
- Do not run parent `nx` against DoubleTwelve's internal projects

## Development quickstart

Run all commands from the **monorepo root**:

```bash
yarn install
git submodule update --init vendor/DoubleTwelve
yarn build:all
yarn serve:bridge
```

See the [repository README](https://github.com/Digital-Defiance/Warp12/blob/main/README.md) for Firebase setup, deployment, AI calibration commands, and troubleshooting.
