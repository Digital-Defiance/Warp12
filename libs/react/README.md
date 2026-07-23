# warp12-react

[![npm](https://img.shields.io/npm/v/warp12-react.svg)](https://www.npmjs.com/package/warp12-react)
[![downloads](https://img.shields.io/npm/dm/warp12-react.svg)](https://www.npmjs.com/package/warp12-react)
[![types](https://img.shields.io/npm/types/warp12-react.svg)](https://www.npmjs.com/package/warp12-react)
[![license](https://img.shields.io/npm/l/warp12-react.svg)](./LICENSE)

**React adapters for Warp** — engine `RoundState` to train layouts, tactical advisor, hand layout, and UI utilities for multi-trail Interstellar Dominoes.

**▶ Play:** [warp.iwgf.org](https://warp.iwgf.org) — the IWGF front door for every Warp factor (also marketed as [warp12.app](https://warp12.app)).

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Gaming Federation** ([iwgf.org](https://iwgf.org)). **Warp 12** (double-twelve) is the **only IWGF-rated variant** with TEI leaderboard rankings. This library provides React-specific adapters and hooks to build Warp game clients across all variants.

## Features

- **`gameStateToTrains`** — converts engine `RoundState` to visual train layouts for rendering
- **`getCoachSuggestion`** — tactical advisor integration with human-readable move explanations
- **`useHandLayout`** — React hook for optimal hand tile arrangement
- **State management utilities** — Context providers and hooks for game state synchronization

## Install

```bash
npm install warp12-react warp12-engine double-eighteen react
```

To draw the board, add **[double-eighteen-react](https://www.npmjs.com/package/double-eighteen-react)** (plus `react-dom`) — the React components that render everything [`double-eighteen`](https://www.npmjs.com/package/double-eighteen) computes. **[▶ Live demo](https://digital-defiance.github.io/double-eighteen-react/)**

## Usage

```ts
import { gameStateToTrains, getCoachSuggestion, useHandLayout } from 'warp12-react';
```

## The Warp / double-N ecosystem

| Package | Role |
|---|---|
| **[warp12-engine](https://www.npmjs.com/package/warp12-engine)** | Rules, state machine, AI & advisor (headless) |
| **warp12-react** | React adapters, hooks & tactical coach — you are here |
| **[warp12-theme](https://www.npmjs.com/package/warp12-theme)** | Federation domino themes |
| **[double-eighteen](https://www.npmjs.com/package/double-eighteen)** | Headless domino core — geometry, presets, AI primitives |
| **[double-eighteen-react](https://www.npmjs.com/package/double-eighteen-react)** | Domino React components · [live demo](https://digital-defiance.github.io/double-eighteen-react/) |

## Build

```bash
yarn build:react
yarn test:react
```

## License

[MIT](./LICENSE) © Digital Defiance
