# warp12-theme

[![npm](https://img.shields.io/npm/v/warp12-theme.svg)](https://www.npmjs.com/package/warp12-theme)
[![downloads](https://img.shields.io/npm/dm/warp12-theme.svg)](https://www.npmjs.com/package/warp12-theme)
[![types](https://img.shields.io/npm/types/warp12-theme.svg)](https://www.npmjs.com/package/warp12-theme)
[![license](https://img.shields.io/npm/l/warp12-theme.svg)](./LICENSE)

**Federation-styled domino themes for Warp** — visual theming presets for [`double-eighteen`](https://www.npmjs.com/package/double-eighteen) dominoes across all Warp factors.

**▶ Play:** [warp.iwdf.org](https://warp.iwdf.org) — the IWDF front door for every Warp factor (also marketed as [warp12.app](https://warp12.app)).

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Dominoes Federation** ([iwdf.org](https://iwdf.org)). **Warp 12** (double-twelve) is the **only IWDF-rated variant**. This library provides the visual identity — color palettes, pip styles, and themed domino rendering — that transforms standard dominoes into Navigational Coordinates for Interstellar Dominoes.

## Features

- **`createWarpDominoTheme`** — generates [`double-eighteen`](https://www.npmjs.com/package/double-eighteen)-compatible theme configs with federation styling
- **`WARP_PIP_COLORS`** — canonical Warp color palette for pip values 0–18
- **Pre-built theme presets** — ready-to-use configurations for all Warp factors
- **Customizable** — extend base themes with your own variants

## Install

```bash
npm install warp12-theme double-eighteen
```

Themes feed the [`double-eighteen-react`](https://www.npmjs.com/package/double-eighteen-react) renderer. **[▶ Live demo](https://digital-defiance.github.io/double-eighteen-react/)**

## Usage

```ts
import { createWarpDominoTheme, WARP_PIP_COLORS } from 'warp12-theme';
```

## The Warp / double-N ecosystem

| Package | Role |
|---|---|
| **[warp12-engine](https://www.npmjs.com/package/warp12-engine)** | Rules, state machine, AI & advisor (headless) |
| **[warp12-react](https://www.npmjs.com/package/warp12-react)** | React adapters, hooks & tactical coach |
| **warp12-theme** | Federation domino themes — you are here |
| **[double-eighteen](https://www.npmjs.com/package/double-eighteen)** | Headless domino core — geometry, presets, AI primitives |
| **[double-eighteen-react](https://www.npmjs.com/package/double-eighteen-react)** | Domino React components · [live demo](https://digital-defiance.github.io/double-eighteen-react/) |

## Build

```bash
yarn build:theme
```

## License

[MIT](./LICENSE) © Digital Defiance
