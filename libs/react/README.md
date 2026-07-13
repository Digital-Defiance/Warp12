# warp12-react

**React adapters for Warp** — `RoundState` to DoubleEighteen trains, tactical advisor, hand layout, and UI utilities for multi-trail Interstellar Dominoes.

Published on npm as **`warp12-react`**.

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Dominoes Federation** ([iwdf.org](https://iwdf.org)). **Warp 12** (double-twelve) is the **only IWDF-rated variant** with TEI leaderboard rankings. This library provides React-specific adapters and hooks to build Warp game clients across all variants.

## Features

- **`gameStateToTrains`** — converts engine `RoundState` to visual train layouts for DoubleEighteen rendering
- **`getCoachSuggestion`** — tactical advisor integration with human-readable move explanations
- **`useHandLayout`** — React hook for optimal hand tile arrangement
- **State management utilities** — Context providers and hooks for game state synchronization

## Install

```bash
npm install warp12-react warp12-engine double-eighteen react react-dom
```

## Usage

```ts
import { gameStateToTrains, getCoachSuggestion, useHandLayout } from 'warp12-react';
```

## Build

```bash
yarn build:react
yarn test:react
```
