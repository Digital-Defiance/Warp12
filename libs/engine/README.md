# warp12-engine

Warp 12 game engine — deterministic rules, state machine, Warp AI, and advisor explanations.

Published on npm as **`warp12-engine`**.

## Warp AI

- **`createWarpAiPlayer`** — offline captains using heuristic scoring (skill tiers control blunders and move sharpness).
- **Lookahead** — optional forward search through the real rules engine with sampled hidden hands; does **not** peek at opponent tiles ([RULES.md §VII](../../RULES.md#vii-ai-officers--tactical-advisor-digital)).
- **`explainWarpAiAction` / `explainTurnResolution`** — human-readable rationale for coach UI and debugging.
- **Self-play** — `libs/engine/src/lib/ai/self-play.spec.ts` regression-tests full games and lookahead vs greedy matchups.

## Install

```bash
npm install warp12-engine doubletwelve
```

## Usage

```ts
import { startGame, applyAction, getLegalMoves, explainWarpAiAction } from 'warp12-engine';
import { createDemoGame } from 'warp12-engine';
```

## Build

```bash
yarn build:engine
yarn test:engine
```
