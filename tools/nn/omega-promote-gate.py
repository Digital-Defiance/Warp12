#!/usr/bin/env python3
"""Promotion gate for scripts/omega-train-loop.sh.

Exit codes: 10 = promote, 0 = reject, 1 = error.

Env:
  OMEGA_GATE_METRIC     mean (default) | weighted
  OMEGA_GATE_WEIGHTS    e.g. "4:3,5:3" — per-table-size weights (default 1 each)
  OMEGA_GATE_FLOOR_SLICES  e.g. "4,5" — candidate must meet OMEGA_GATE_FLOOR on these
  OMEGA_GATE_FLOOR      min fair-share on floor slices (default 1.0)
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict


def parse_weights(raw: str) -> dict[int, float]:
    weights: dict[int, float] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" not in part:
            raise ValueError(f"invalid OMEGA_GATE_WEIGHTS entry: {part!r}")
        n_str, w_str = part.split(":", 1)
        weights[int(n_str.strip())] = float(w_str.strip())
    return weights


def parse_int_list(raw: str) -> list[int]:
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def slice_map(results: list[dict]) -> dict[int, float]:
    """Average fair-share per table size (both seats at 2p)."""
    by_count: dict[int, list[float]] = defaultdict(list)
    for row in results:
        ratio = row.get("fairShareRatio")
        if ratio is not None:
            by_count[int(row["playerCount"])].append(float(ratio))
    return {n: sum(vals) / len(vals) for n, vals in by_count.items()}


def mean_score(slices: dict[int, float]) -> float:
    if not slices:
        return 0.0
    return sum(slices.values()) / len(slices)


def weighted_score(slices: dict[int, float], weights: dict[int, float]) -> float:
    if not slices:
        return 0.0
    total_w = 0.0
    total = 0.0
    for n, ratio in slices.items():
        w = weights.get(n, 1.0)
        total_w += w
        total += ratio * w
    return total / total_w if total_w > 0 else 0.0


def gate_score(
    slices: dict[int, float],
    metric: str,
    weights: dict[int, float],
) -> float:
    if metric == "weighted":
        return weighted_score(slices, weights)
    if metric == "mean":
        return mean_score(slices)
    raise ValueError(f"unknown OMEGA_GATE_METRIC: {metric!r}")


def floor_ok(
    slices: dict[int, float],
    floor_slices: list[int],
    floor: float,
) -> tuple[bool, list[int]]:
    failed: list[int] = []
    for n in floor_slices:
        if slices.get(n, 0.0) < floor:
            failed.append(n)
    return len(failed) == 0, failed


def load_score(path: str) -> float | None:
    if not os.path.exists(path):
        return None
    raw = open(path, encoding="utf-8").read().strip()
    if not raw:
        return None
    value = float(raw)
    if value != value:  # nan
        return None
    return value


def slices_sidecar(score_file: str) -> str:
    return f"{score_file}.slices.json"


def load_champion_slices(score_file: str) -> dict[int, float] | None:
    path = slices_sidecar(score_file)
    if not os.path.exists(path):
        return None
    data = json.load(open(path, encoding="utf-8"))
    return {int(k): float(v) for k, v in data.items()}


def save_champion_state(score_file: str, score: float, slices: dict[int, float]) -> None:
    with open(score_file, "w", encoding="utf-8") as handle:
        handle.write(f"{score}")
    with open(slices_sidecar(score_file), "w", encoding="utf-8") as handle:
        json.dump({str(n): round(r, 4) for n, r in sorted(slices.items())}, handle)


def main() -> int:
    seed_only = len(sys.argv) == 7 and sys.argv[6] == "--seed"
    if len(sys.argv) not in (6, 7):
        print(
            "usage: omega-promote-gate.py <iteration> <bench.json> "
            "<elo-log.jsonl> <score-file> <margin> [--seed]",
            file=sys.stderr,
        )
        return 1

    iteration = int(sys.argv[1])
    bench_file = sys.argv[2]
    elo_log = sys.argv[3]
    score_file = sys.argv[4]
    margin = float(sys.argv[5])

    metric = os.environ.get("OMEGA_GATE_METRIC", "mean").strip().lower()
    weights = parse_weights(os.environ.get("OMEGA_GATE_WEIGHTS", ""))
    floor_slices = parse_int_list(os.environ.get("OMEGA_GATE_FLOOR_SLICES", ""))
    floor = float(os.environ.get("OMEGA_GATE_FLOOR", "1.0"))

    text = open(bench_file, encoding="utf-8").read()
    data = json.loads(text[text.index("{") :])
    results = data.get("results", [])
    cand_slices = slice_map(results)
    cand_score = gate_score(cand_slices, metric, weights)
    mean_fair = mean_score(cand_slices)

    prev = load_score(score_file)
    prev_slices = load_champion_slices(score_file)

    meets_floor, floor_failed = floor_ok(cand_slices, floor_slices, floor)
    beats_champion = prev is None or cand_score > prev + margin
    promote = seed_only or (beats_champion and meets_floor)
    decision = "SEED" if seed_only else ("PROMOTE" if promote else "REJECT")

    if promote:
        save_champion_state(score_file, cand_score, cand_slices)

    summary = {
        "iteration": iteration,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "objective": data.get("objective"),
        "metric": metric if metric != "mean" else "mean_fair_share_ratio",
        "candidateScore": round(cand_score, 4),
        "championScore": round(prev, 4) if prev is not None else None,
        "meanFairShare": round(mean_fair, 4),
        "gateWeights": {str(k): v for k, v in sorted(weights.items())} or None,
        "floorSlices": floor_slices or None,
        "floorFailed": floor_failed or None,
        "decision": decision,
        "slices": [
            {
                "playerCount": r["playerCount"],
                "seat": r["omegaSeatId"],
                "winRate": r["omegaWinRate"],
                "fairShareRatio": r["fairShareRatio"],
            }
            for r in results
        ],
        "sliceMeans": {str(n): round(v, 4) for n, v in sorted(cand_slices.items())},
        "championSliceMeans": (
            {str(n): round(v, 4) for n, v in sorted(prev_slices.items())}
            if prev_slices
            else None
        ),
    }
    if not seed_only:
        with open(elo_log, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(summary) + "\n")

    per_slice = " ".join(
        f"{n}p={cand_slices[n]:.2f}" for n in sorted(cand_slices)
    )
    metric_label = "weighted fair-share" if metric == "weighted" else "mean fair-share"
    reject_bits: list[str] = []
    if not seed_only and not beats_champion:
        reject_bits.append("score")
    if not seed_only and not meets_floor:
        reject_bits.append(f"floor<{floor} on {floor_failed}")
    why = f" ({', '.join(reject_bits)})" if reject_bits and not promote else ""

    print(
        f"[iter {iteration}] {decision}  candidate={cand_score:.3f} "
        f"champion={prev if prev is not None else float('nan'):.3f} "
        f"mean={mean_fair:.3f} ({metric_label}; 1.0=Commander){why}  [{per_slice}]"
    )
    return 10 if promote and not seed_only else (0 if not seed_only else 0)


if __name__ == "__main__":
    sys.exit(main())
