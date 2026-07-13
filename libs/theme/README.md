# warp12-theme

**Federation-styled domino themes for Warp** — visual theming presets for [DoubleEighteen](https://www.npmjs.com/package/double-eighteen) across all Warp factors.

Published on npm as **`warp12-theme`**.

## About Warp

**Warp** is multiplayer, federation-themed multi-trail dominoes supporting **Warp factors 9 / 12 / 15 / 18** (double-N domino sets), governed by the **Interstellar Warp Dominoes Federation** ([iwdf.org](https://iwdf.org)). **Warp 12** (double-twelve) is the **only IWDF-rated variant**. This library provides the visual identity — color palettes, pip styles, and themed domino rendering — that transforms standard dominoes into Navigational Coordinates for Interstellar Dominoes.

## Features

- **`createWarpDominoTheme`** — generates DoubleEighteen-compatible theme configs with federation styling
- **`WARP_PIP_COLORS`** — canonical Warp color palette for pip values 0–18
- **Pre-built theme presets** — ready-to-use configurations for all Warp factors
- **Customizable** — extend base themes with your own variants

## Install

```bash
npm install warp12-theme double-eighteen
```

## Usage

```ts
import { createWarpDominoTheme, WARP_PIP_COLORS } from 'warp12-theme';
```

## Build

```bash
yarn build:theme
```
