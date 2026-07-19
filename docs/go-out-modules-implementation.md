# Go-out modules + spool abort — implementation checklist

**Source of truth:** `RULES.tex` → §VI **Go-out — Modules** and both Delta **Warp Drive Engagement (Spool)** blocks (Points + Go-out).  
**Scope:** Engine first, then lobby/UI, then AI/advisor, then tests. Do not ship RULES-ahead behavior as “done” until the matching engine box is checked.

Track progress by flipping `- [ ]` → `- [x]`. Prefer small PRs / commits per phase if splitting later.

---

## Phase 0 — Shared: Delta spool abort (both objectives)

RULES: mismatch stops the draw; undrawn stay in Uncharted. If a matching double cannot be covered (or Fracture cannot finish), **retrieve the double** (+ failed cover/stabilizer draws) to hand, revert endpoint, **no Red Alert / no Fracture** left on the table.

- [x] `executeWarpDriveSpool` (`libs/engine/src/lib/engine/warp-drive-spool.ts`): on failed cover / empty after double / incomplete Fracture → pop double from `tilesPlayed`, add to `tilesSentToHand`, `redAlertActive=false`, `fractureActive=false`, restore endpoint
- [x] `apply-action` spool path: confirm it does not re-open RA/Fracture when spool returns abort flags false
- [x] Specs: update/add cases in `warp-drive-spool.spec.ts` (+ integration if needed)
- [x] Align any advisor / game-log copy that says leftovers or “uncovered double stays”

---

## Phase 1 — Engine: Go-out Continuum (Alpha)

Catalog when `objective === 'go-out'`:

| Points flash | Go-out |
|---|---|
| Skip lowest points | **Skip Lightest Hand** (all tied lightest skip, incl. invoker if tied) |
| Salamander swap | **removed** |
| — | **Force Draw** (choose opposing captain → draw 1 Uncharted / Sensor Grid) |
| Other flashes | unchanged (round→sector wording in UI) |

- [x] Extend `FlashEffectKind` + `FLASH_CATALOG` (`types/continuum.ts`)
- [x] `getAvailableFlashEffects` / `buildQFlashEffect` / `applyQFlashEffect` objective-aware
- [x] Action / serialization codes for new kinds (`serialization/action-codes.ts`)
- [x] Force Draw: targeted pick UI hook + legal targets (opponents with draw pool)
- [x] Specs: continuum go-out catalog + skip-lightest + force-draw
- [x] Flash panel + AI/random-play force-draw targets

---

## Phase 2 — Engine: Go-out Salamander Surge (Beta)

- [x] On chart of `maxPip-maxPip` from hand (not Spacedock / opening engine), if go-out + Beta on → each opponent draws 1 (Uncharted, else Sensor Grid); turn-order from next captain; partial if pool empties
- [x] Ensure points path still scores held Salamander at round end (unchanged)
- [x] Specs

---

## Phase 3 — Engine: Go-out Hot Potato pass (Delta)

- [x] On pass while holding hazard, go-out: draw 2 (Uncharted / Sensor Grid); if both empty → add to `skipNextTurnFor` instead of incrementing pass-count score
- [x] Points path: keep +5 via `hazardMarkerPassCount` (unchanged)
- [x] Specs (`hot-potato.spec.ts` / `go-out-modules.spec.ts`)

---

## Phase 4 — Engine: Go-out Trail Momentum (Theta)

- [x] Track claim once/sector; when personal trail length ≥ 5 after chart/spool, grant immediate extra turn (helm does not advance / re-activate)
- [x] Points path: keep −3 longest-trail scoring (unchanged; already skipped for go-out)
- [x] Specs

---

## Phase 5 — Engine: Go-out Desperation Dig (Eta)

- [x] When must draw from Uncharted and Eta on + go-out: optional dig up to 3 one-at-a-time; stop and **chart** first playable; beacon open for invoker’s **next two turns**
- [x] Empty mid-dig → pass + full beacon cost
- [x] Sensor Sweep is not a dig
- [x] Points path: keep debt tokens at scoring (unchanged; already skipped for go-out)
- [x] Specs
- [x] UI affordance (button / confirm) — helm **Desperation Dig** when go-out + Eta + must draw

---

## Phase 6 — Engine: Go-out Hand Exchange (Kappa)

- [x] Once/sector: first non-Spacedock double charted → unique most vs unique fewest hand sizes exchange (random take 1, choose give-back 1); ties skip for sector
- [x] Points path: keep even-round inversion scoring (unchanged)
- [x] Specs + mid-exchange UI (`HandExchangePanel` + Firestore serialize)

---

## Phase 7 — Lobby / setup gates

- [x] Go-out: force `drafting` off / hide or disable Epsilon toggle (`lobby-form.tsx`, local, pass-and-play, online lobby)
- [x] Rename labels for go-out via `go-out-module-labels.ts` (Salamander Surge, Trail Momentum, Desperation Dig, Hand Exchange)
- [x] Module catalog / help strings (`module-catalog.ts`) objective-aware where needed
- [x] Online create payload: strip drafting if go-out (client clears on objective change + lobby checkbox gate)
- [x] Local / pass-and-play setup: same Epsilon gate as lobby

---

## Phase 8 — AI / advisor / a11y

- [x] Heuristics / random harness: legal dig + hand-exchange give-back (non-crash); force-draw flash targets
- [x] Warp AI: `resolve-hand-exchange` + `desperation-dig` candidates; give-back heuristic; self-play / local / host-AI pending-actor routing
- [x] Advisor explanations for go-out module names/notes (`advisor-report.ts`)
- [x] `useAnnounce` for Hand Exchange give-back dialog (assertive); Dig/Force Draw exposed via labelled controls

---

## Phase 9 — Verification

- [x] `yarn test:engine` (incl. `go-out-modules.spec.ts`, hand-exchange AI, integration random-play)
- [x] Unit: helm-controls, go-out labels, serialize-rules, advisor-report
- [x] `yarn build:engine`
- [ ] Manual: go-out sector with Alpha/Beta/Delta/Theta/Eta/Kappa toggles; points sector regression for Salamander/Debt/Theta/Kappa scoring
- [x] Confirm RULES ↔ engine parity for Phase 0–6

---

## Follow-up — Go-out module skill/luck matrix (285k-class)

Same instrument as the points study. Commands and paper follow-ups live in
[`docs/MODULE-MATRIX-RERUN.md`](MODULE-MATRIX-RERUN.md) (separate data dirs for
points re-run vs go-out first matrix).

```bash
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/go-out-modules \
  MODULE_OBJECTIVE=go-out MODULE_GAMES=500 MODULE_WORKERS=12 \
  bash tools/nn/run-module-analysis-parallel.sh
```

---

## Explicitly out of scope (unchanged under Go-out)

- Gamma Sensor Grid, Iota Double Down, Lambda Wormholes, Zeta Squadrons (victory already empty-hand), Subspace Fracture, house rules — no mechanic fork beyond existing go-out win.

---

## Progress log

| Date | Note |
|---|---|
| 2026-07-18 | Checklist created from RULES proof; implementation starting Phase 0. |
| 2026-07-18 | Phase 0 engine done: `warp-drive-spool.ts` retrieves unfinished doubles; specs green. |
| 2026-07-18 | Phase 1: Go-out Alpha flashes (Skip Lightest Hand, Force Draw); flash panel + AI. |
| 2026-07-18 | Phase 2–3: Salamander Surge + Delta go-out pass→draw2; lobby Epsilon gate. |
| 2026-07-18 | Phase 4: Trail Momentum (Theta) — extra turn at trail ≥5 once/sector. |
| 2026-07-18 | Phase 5 engine: Desperation Dig action + forced-open beacon; UI pending. |
| 2026-07-18 | Phase 5 UI: Desperation Dig helm button. Next: Kappa Hand Exchange. |
| 2026-07-18 | Phase 6–9: Hand Exchange + lobby labels/catalog + advisor + full engine suite 688/688; integration random-play; build:engine green. |
| 2026-07-18 | Phase 0 copy: advisor + game-log + toast for spool abort retrieve (no Red Alert); `spoolAbortRetrieve` pulse serialized. |
| 2026-07-18 | Hand Exchange AI: candidates + give-back heuristic; self-play/host/local pending-actor; go-out 285k command noted. |
| 2026-07-18 | AI teaching: spool re-enabled; abort risk; Surge/Momentum/Hot Potato; see `docs/MODULE-MATRIX-RERUN.md`. |
| 2026-07-18 | Module-aware skill profiles wired into local/host AI + luck/skill collector; engine 696 green. |
