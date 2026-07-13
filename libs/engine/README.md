# warp12-engine

**Warp game engine** — deterministic rules, state machine, Warp AI, and advisor explanations for multi-trail Interstellar Dominoes.

Published on npm as **`warp12-engine`**.

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Dominoes Federation** ([iwdf.org](https://iwdf.org)). **Warp 12** (double-twelve) is the **only IWDF-rated variant** with TEI (OpenSkill-based) rankings. Warp 9, 15, and 18 are exhibition (unrated) sets.

This engine powers all variants with:
- Deterministic, immutable state machine
- Legal move generation and action application
- AI captains across commission tracks (Ensign / Lieutenant / Commander / Class I*)
- Tactical advisor with human-readable explanations
- Self-play and calibration infrastructure

## Warp AI

- **`createWarpAiPlayer`** — offline captains using heuristic scoring (skill tiers control blunders and move sharpness).
- **Lookahead** — optional forward search through the real rules engine with sampled hidden hands; does **not** peek at opponent tiles ([RULES.md §VII](../../RULES.md#vii-ai-officers--tactical-advisor-digital)).
- **Class I★ neural policy** — experimental neural tier using ONNX models trained via self-play.
- **`explainWarpAiAction` / `explainTurnResolution`** — human-readable rationale for coach UI and debugging.
- **Self-play** — `libs/engine/src/lib/ai/self-play.spec.ts` regression-tests full games and lookahead vs greedy matchups.

## Install

```bash
npm install warp12-engine double-eighteen
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
