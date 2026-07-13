# Section 8: Luck vs Skill Across Warp Factors

## 8.1 Motivation

While Sections 6–7 calibrate AI tiers at a fixed Warp factor (double-12), Warp 12 ships with **four** playable Warp factors (9 / 12 / 15 / 18), each supporting different fleet sizes:

| Warp Factor | Max Pip | Fleet Limit | Tiles | Rated? |
|-------------|---------|-------------|-------|--------|
| W9 | 9 | 2–4 players | 55 | Exhibition |
| W12 | 12 | 2–8 players | 91 | **Rated (TEI)** |
| W15 | 15 | 2–12 players | 136 | Exhibition |
| W18 | 18 | 2–18 players | 190 | Exhibition |

Players and designers routinely ask:

1. **Does Warp factor affect skill expression?** Higher pip sets increase hand entropy — does this create meaningful strategic depth or just pip-dumping chaos?
2. **Does fleet size (player count) affect skill?** Conventional wisdom suggests more players = more noise, but is that true?
3. **Should TEI be calibrated differently for W9 vs W18?** If skill expression differs, should we adjust reference bands or restrict rating to W12?
4. **Why is W12 the rated factor?** Is it merely tradition (Mexican Train's historical default), or does the data justify it?

This section reports **19,000 self-play games** across **38 configurations** (Warp factor × fleet size) to empirically answer these questions.

