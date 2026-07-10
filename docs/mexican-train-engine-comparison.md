# Known Mexican Train implementations (survey)

Living document for Warp 12 marketing and research claims. Last reviewed: 2026.

**Scope:** Consumer apps and open implementations visible in public stores or repositories. This is not a product review — it compares whether an **inspectable rules engine** exists and what can be verified without source code.

## How to read this table

| Column | Meaning |
|--------|---------|
| **Product known** | Installed base / brand recognition |
| **Engine known** | Rules core is open, specified, or reproducibly testable |
| **Verified** | Warp 12 can independently confirm behavior |

Most store apps are **product known, engine unknown** — we cannot audit closed binaries for rules fidelity or AI calibration.

## Survey (2026)

| Implementation | Product known | Engine known | Rules spec | Automated tests | Dual objective (points + go-out) | Documented AI calibration | Open package |
|----------------|---------------|--------------|------------|-----------------|-----------------------------------|---------------------------|--------------|
| **Warp 12** (`warp12-engine`) | Emerging | **Yes** | `RULES.md` | 200+ engine tests | **Yes** | **Yes** (`calibrate:ai-tei`) | **npm** |
| Glowing Eye — Mexican Train Dominoes Gold / Classic | High | No | No | Unknown | Points/score typical | No | No |
| Amuseware — Mexican Train Dominoes | Medium | No | No | Unknown | Unknown | No | No |
| Doralogic — Mexican Train | Medium | No | No | Unknown | Unknown | No | No |

Store listings commonly advertise “3 difficulty levels” or “rule variations” without publishing engine behavior, self-play validation, or conformance suites.

## Warp 12 claim (narrow)

> **Warp 12 is the best Interstellar Dominoes engine in the galaxy that is currently known.**

Interpretation:

- **Engine** — rules simulation + AI policy stack, not “best mobile UX” or “most downloads.”
- **Currently known** — among implementations whose engine is **documented and inspectable** (open repo, published spec, reproducible tests).
- **Best** — most complete and rigorously validated against that bar: dual objectives, house rules, modules, self-play TEI calibration, coach on same engine.

We do **not** claim:

- Tournament sanctioning or official domino authority
- Stronger AI than every closed-source app (their engines cannot be compared fairly)
- Rules perfection — the engine is **unproven** for competitive adjudication until benchmarked externally

## Planned benchmarks

| Benchmark | Purpose | Status |
|-----------|---------|--------|
| **MT-Compliance** | Scripted rules scenarios (doubles, beacons, blocked round, NZ, DTI) | Planned |
| **MT-Bench** | Frozen seeds + tier win rates for AI calibration | Partial (`yarn calibrate:ai-tei`) |
| **Human vs Class II** | External validation of TEI bands | Not started |

See also: [tei-paper-outline.md](./tei-paper-outline.md).
