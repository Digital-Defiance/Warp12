# Warp 12 roadmap

## Completed (recent)

- Server-verified practice AI TEI (replay on `reportPracticeAiMatch`)
- Firestore lockdown for competitive stats fields
- Offline vs-AI play with queued TEI sync when connectivity returns
- Local pass-and-play (2–8 humans on one device, unrated; optional AI fill)
- Leaderboard verified-pool labels and fleet totals from TEI buckets only
- [Security model](./security-model.md) (trust boundaries + native leaderboard path)
- **[Crews & charters](./crews-roadmap.md) Phases 1–3** — `groupTei`, charter callables, `/crews` UI, Global Official leaderboard tab + season label
- **Luck vs Skill Analysis** — 19K-game comprehensive study complete ([LUCK-SKILL-READY](./LUCK-SKILL-READY.md), [SECTION-8-COMPLETE](./SECTION-8-COMPLETE.md))
  - 38 configurations (W9/12/15/18 × all fleet sizes)
  - Statistical analysis, 5 figures, 3 tables
  - TEI paper Section 8 integrated (~15 pages LaTeX)
  - Key finding: W18@18p has 1.74× higher skill than 2p (contradicts "large fleets are crapshoots")

## In progress

- **Ω promotion** + client wiring (see [omega-handoff](./omega-handoff.md))
- **New modules (Theta, Iota, Kappa)** — 500-game calibration running

## TODO (Phase 4 — ecosystem)

- **New modules** — Theta (Longest Trail + Spool), Iota (Double Down), Kappa (Temporal Inversion)
  - Theta: ✅ Implemented, ⏳ Calibration in progress
  - Iota: ✅ Implemented, ⏳ Calibration in progress  
  - Kappa: ✅ Implemented, ⏳ Calibration in progress (expected Warped)
  - Need: comprehensive unit tests, RULES.md updates, UI support
- Match certificate JSON export
- `CREW-` short invite codes, listed crews, profile/match charter UI polish
- Third-party group TEI interoperability notes

<!-- Pass-and-play shipped — see /local/pass-and-play -->
