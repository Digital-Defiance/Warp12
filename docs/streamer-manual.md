---
layout: default
title: Streamer Manual
parent: Game
nav_order: 3
description: "How to stream Warp with OBS — commentator overlay, stream-safe layout, and private hand."
permalink: /streamer-manual
---

# Streamer Manual

How to broadcast Warp without leaking your hand, with the on-screen **commentator** feed for viewers.

**Play:** [warp.iwdf.org](https://warp.iwdf.org)

---

## Quick setup (recommended)

| Display | What to show |
| --- | --- |
| **Capture / OBS** | Bridge table + commentator (hand **hidden**) |
| **Off-camera** | Private hand (second monitor, phone, or pop-out) |

### In-game checklist

1. Start a match (local vs AI, or online sector).
2. Open the **sector log** (comms / log control) → **Stream setup**.
3. Click **Enable stream-safe**:
   - Hides your hand on the capture Bridge
   - Switches the log to **Commentator**
   - Opens the private-hand companion (local) or `/hand` (online)
4. Add OBS browser sources from the URLs in Stream setup (see below).
5. Crop OBS so the private-hand window is **never** in frame.

You can also cycle the HUD log: **All captains → Yourself → Commentator → Off**.

---

## OBS browser sources

Use **Browser** sources. Prefer a transparent background for commentary.

### Online sector

Replace `CODE` with your sector code (uppercase).

| Source | URL | Notes |
| --- | --- | --- |
| **Watch** (full table) | `https://warp.iwdf.org/online/CODE/watch` | Gallery view; defaults to commentator log |
| **Commentary only** | `https://warp.iwdf.org/online/CODE/commentary` | Chrome-free highlight feed — best for a lower-third |
| **Join** | `https://warp.iwdf.org/online/CODE` | Seat invite (not for OBS) |
| **Private hand** | `https://warp.iwdf.org/online/CODE/hand` | **Off-camera only** — same Firebase seat as `/play` |

Commentary and watch require the host’s **spectator gallery** to be open. If the host closes spectate, those URLs fail closed.

### Local match (vs AI / pass-and-play)

Keep the **game tab** open — local overlays use `BroadcastChannel`.

| Source | URL | Notes |
| --- | --- | --- |
| **Commentary only** | `https://warp.iwdf.org/commentary` (or your local origin + `/commentary`) | Mirrors the live Bridge |
| **Private hand** | `…/local/hand` | **Off-camera only** — playable hand strip |

On localhost / Tauri preview, Stream setup copies your current origin so links hit the running build.

---

## Private hand

### Why a second window?

Stream-safe hides tiles on the capture Bridge. You still need somewhere to play — that is the private hand.

### Online — `/online/{CODE}/hand`

- Same Firebase Auth seat as play (`uid`: anonymous guest or Google).
- **Helm strip only** (hand + controls + Continuum panels) — table stays on the capture Bridge / watch source.
- Sign in with **Google in the lobby** before rated launch (guest seats do not rate).
- Do **not** share this URL publicly.

### Local — `/local/hand` and couch seats

- Playable copy of the bottom hand panel (tiles, route picker, draw / pass / shields / spool / Drop to Impulse).
- Continuum Flash, Continuum Wager, Hand Exchange, and **Module Epsilon draft picks** open on this window when it is your seat.
- Syncs with the Bridge over BroadcastChannel — game tab must stay open.
- Pass-and-play (shared device): during handoff, confirm **Ready at helm** here (keeps the big handoff dialog off the capture Bridge when stream-safe is on).
- With stream-safe on during drafting, the capture Bridge only shows who is drafting — pack tiles stay on the private hand.
- **Never** add `/local/hand` (or seat URLs) as an OBS browser source.

### Couch mode (pass-and-play, multi-device)

When each captain has their own phone/tablet:

1. Start **local pass-and-play**.
2. Stream setup → **Enable couch mode** (or check Couch mode + **Open seat hands**).
3. Each captain opens **their** locked URL: `/local/hand/human%3A0`, `/local/hand/human%3A1`, … (Stream setup lists copy buttons).
4. The capture Bridge keeps the table + commentator; hands stay off-camera.
5. Device handoff overlays are **skipped** — each seat always sees only their redacted hand.

`/local/hand` without a seat still **follows the active captain** (streamer single companion). Prefer locked seat URLs for couch.

---

## Commentator feed

The commentator is a **highlight digest** of the game log (ringside peaks, quiet between beats) — not a full move ticker and not generative AI.

Typical highlights: All Stop / go-out, round end, Red Alert, Fracture, Continuum, beacons / shields, round opening charts, Neutral Zone open, module spikes, go-out pressure.

- HUD / watch: larger ticker, last few lines
- Sector log → **Commentator** scope → download **Highlights**
- Standalone overlay: `/commentary` or `/online/{CODE}/commentary`
- Admin audible TTS (ElevenLabs) speaks the same highlight lines; timestamps are stripped for delivery

### Spoken-as (pronunciation)

- **Humans:** Profile → **Spoken as** (plain alias, e.g. Blitz → Blahtz). Snapshotted onto the sector roster when you create/join; host sees it in the lobby and can clear a seat or disable spoken-as for the whole match before launch.
- **AI officers:** Lobby → **AI officers** → per-officer **Spoken as (TTS)** field (host only, lobby-locked at launch).
- **Fleet dictionary (Ops):** Edit `tools/tts/warp-fleet.pls`, run `yarn tts:pronunciation-dictionary`, paste printed ids into `functions/.env`, redeploy. Details: [tts-pronunciation-dictionary](tts-pronunciation-dictionary). Call signs on the table stay unchanged; TTS may substitute spoken-as / dictionary rules.

---

## Rated play & streaming

- **Warp 12** only for TEI. Warp 9 / 15 / 18 are exhibition.
- Online rated needs **verified** (Google-linked) humans — upgrade in the lobby before launch.
- Using the **tactical advisor** voids TEI for the sector (online: for everyone).
- Rated Subspace stays on **quick hails** during live play (no free-text collusion channel).
- Solo practice TEI is **local vs AI**, unassisted — not a 1-human + AI online sector.

---

## Suggested OBS layout

1. **Game capture** or browser source on `/watch` (or the Bridge window with hand hidden).
2. **Browser source** on `/commentary` — lower third, width ~960, height ~400–540, shutdown source when idle.
3. Optional: webcam / mic as usual.
4. Private hand on a second display or window **outside** the canvas.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Commentary blank (online) | Host must enable spectate; reload the overlay |
| Local commentary / hand stuck | Keep the match Bridge tab open; reopen companion |
| Hand still on camera | Stream setup → hide hand, or enable stream-safe again |
| Can’t play with hand hidden (local) | Open `/local/hand` or Stream setup → Open private hand |
| Pass-and-play on multiple devices | Stream setup → Enable couch mode / Open seat hands |
| Online hand empty / wrong seat | Same Google or guest session as the seated `/play` tab |
| Rated launch blocked as guest | Sign in with Google in the lobby (or turn off Rated sector) |

---

## Recording easter eggs

Hidden helpers for clean video takes (not shown in the UI).

### Replay end-of-match logo splash

On the **Campaign complete** / **Sector complete** label (win overlay or dock header), activate it **three times quickly** (within ~0.7s). After a 3-second beat, the Warp logo splash plays again and **stays up until you click** (or press Enter / Space / Escape). Boot splash in the desktop app still auto-dismisses on a timer.

The trigger is a non-selectable control so rapid clicks do not highlight text on camera.

### Reset Warp factor chooser

On the warp-factor landing (`/factor`), while already on **Warp 12**, tap the Warp 12 card **five times quickly**. That clears the saved factor and reloads `/factor` so you can film the full galaxy unboxing / factor pick again.

---

## In-app entry points

- **Stream setup** — sector log dialog
- **Copy links** — lobby (join / watch / commentary), table Options (stream & spectate), Stream setup
- **Log cycle** — Comms log control on the Bridge HUD
