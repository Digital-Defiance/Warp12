---
layout: default
title: Home
nav_order: 1
description: "Warp 12 documentation — rules engine, TEI rating, AI calibration, and research."
permalink: /
---

# Warp 12 Documentation

> *A Double-Twelve domino variant for the NX Epoch.*

Welcome to the Warp 12 documentation hub. This site covers the **Navigational Operations Manual**, the **Tactical Effectiveness Index (TEI)** rating system, AI calibration methodology, and research notes for the open `warp12-engine` package.

{: .fs-6 .fw-300 }

**Play now:** [warp.iwdf.org](https://warp.iwdf.org) · **Leaderboard:** [iwdf.org](https://iwdf.org)

{: .highlight }
For hands-on development, start with [System Architecture](architecture) and the [repository README](https://github.com/Digital-Defiance/Warp12/blob/main/README.md).
{: .highlight }

## Table of Contents

### Game

| Document | Description |
| -------- | ----------- |
| [Navigational Operations Manual](rules) | Authoritative rules — Spacedock, Warp Trails, Neutral Zone, Distress Beacon, modules, AI officers, and TEI |
| [System Architecture](architecture) | Monorepo layout: `warp12-engine`, React adapters, Bridge client, DoubleEighteen rendering, Firebase multiplayer |

### TEI & Rating

| Document | Description |
| -------- | ----------- |
| [TEI Specification](tei-spec) | Normative dual-track Elo-style rating for **points** and **go-out** campaigns — interoperable across platforms |
| [Calibration Log](calibration-log) | Living self-play record: tier-vs-tier matrices, optimizer passes, Fleet Admiral benches |
| [Rated Matches](rated-matches) | Officiated TEI for in-person play — global human pool or crew charters |
| [Crews & Charters](crews-roadmap) | Friend-group ladders (shipped); Global Official + ecosystem (Phase 3–4) |

### Research

| Document | Description |
| -------- | ----------- |
| [Paper Outline](tei-paper-outline) | Working conference/white-paper draft — TEI design, self-play calibration, Class I*, Fleet Admiral |
| [Engine Survey](mexican-train-engine-comparison) | Survey of known Mexican Train implementations and what Warp 12 can verify about engine fidelity |

### AI Development

| Document | Description |
| -------- | ----------- |
| [Class I* Neural Training](neural-training) | Offline PyTorch pipeline: trajectory collection, MLP training, ONNX export, browser inference |

## Quick links

| Resource | URL |
| -------- | --- |
| Bridge (play) | [warp.iwdf.org](https://warp.iwdf.org) |
| Leaderboard | [iwdf.org](https://iwdf.org) |
| `warp12-engine` on npm | [npmjs.com/package/warp12-engine](https://www.npmjs.com/package/warp12-engine) |
| Source repository | [github.com/Digital-Defiance/Warp12](https://github.com/Digital-Defiance/Warp12) |
