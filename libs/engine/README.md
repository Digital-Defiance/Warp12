# warp12-engine

[![npm](https://img.shields.io/npm/v/warp12-engine.svg)](https://www.npmjs.com/package/warp12-engine)
[![downloads](https://img.shields.io/npm/dm/warp12-engine.svg)](https://www.npmjs.com/package/warp12-engine)
[![types](https://img.shields.io/npm/types/warp12-engine.svg)](https://www.npmjs.com/package/warp12-engine)
[![license](https://img.shields.io/npm/l/warp12-engine.svg)](./LICENSE)

**Warp game engine** — deterministic rules, state machine, Warp AI, and advisor explanations for multi-trail Interstellar Dominoes.

**▶ Play:** [warp.iwgf.org](https://warp.iwgf.org) — the IWGF front door for every Warp factor (also marketed as [warp12.app](https://warp12.app)).

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Gaming Federation** ([iwgf.org](https://iwgf.org)). **Warp 12** (double-twelve) is the **only IWGF-rated variant** with TEI (OpenSkill-based) rankings. Warp 9, 15, and 18 are exhibition (unrated) sets.

This engine powers all variants with:
- Deterministic, immutable state machine
- Legal move generation and action application
- AI captains across commission tracks (Ensign / Lieutenant / Commander / Class I*)
- Tactical advisor with human-readable explanations
- Self-play and calibration infrastructure

## Warp AI

- **`createWarpAiPlayer`** — offline captains using heuristic scoring (skill tiers control blunders and move sharpness).
- **Lookahead** — optional forward search through the real rules engine with sampled hidden hands; does **not** peek at opponent tiles ([RULES §VII](https://github.com/Digital-Defiance/Warp12/blob/main/RULES.md#vii-ai-officers--tactical-advisor-digital)).
- **Class I★ neural policy** — experimental neural tier using ONNX models trained via self-play.
- **`explainWarpAiAction` / `explainTurnResolution`** — human-readable rationale for coach UI and debugging.
- **Self-play** — regression-tests full games and lookahead-vs-greedy matchups.

## Install

```bash
npm install warp12-engine double-eighteen
```

The engine is **headless** — no React required. [`double-eighteen`](https://www.npmjs.com/package/double-eighteen) is a peer dependency providing the domino core (geometry, presets, AI primitives).

## Usage

```ts
import {
  startGame,
  applyAction,
  getLegalMoves,
  explainWarpAiAction,
} from 'warp12-engine';
```

## The Warp / double-N ecosystem

| Package | Role |
|---|---|
| **warp12-engine** | Rules, state machine, AI & advisor (headless) — you are here |
| **[warp12-react](https://www.npmjs.com/package/warp12-react)** | React adapters, hooks & tactical coach |
| **[warp12-theme](https://www.npmjs.com/package/warp12-theme)** | Federation domino themes |
| **[double-eighteen](https://www.npmjs.com/package/double-eighteen)** | Headless domino core — geometry, presets, AI primitives |
| **[double-eighteen-react](https://www.npmjs.com/package/double-eighteen-react)** | Domino React components · [live demo](https://digital-defiance.github.io/double-eighteen-react/) |

## Build

```bash
yarn build:engine
yarn test:engine
```

## License

[MIT](./LICENSE) © Digital Defiance
