#!/usr/bin/env python3
"""Unit tests for omega-promote-gate.py (run: python tools/nn/omega-promote-gate.spec.py)."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

HERE = Path(__file__).resolve().parent
GATE = HERE / "omega-promote-gate.py"


def run_gate(
    bench: dict,
    *,
    metric: str = "mean",
    weights: str = "",
    floor_slices: str = "",
    floor: str = "1.0",
    prev_score: Optional[str] = None,
    margin: str = "0.0",
) -> tuple[int, dict]:
    with tempfile.TemporaryDirectory() as tmp:
        bench_path = Path(tmp) / "bench.json"
        elo_log = Path(tmp) / "elo.jsonl"
        score_file = Path(tmp) / "score.txt"
        bench_path.write_text(json.dumps(bench), encoding="utf-8")
        if prev_score is not None:
            score_file.write_text(prev_score, encoding="utf-8")

        env = os.environ.copy()
        env["OMEGA_GATE_METRIC"] = metric
        env["OMEGA_GATE_WEIGHTS"] = weights
        env["OMEGA_GATE_FLOOR_SLICES"] = floor_slices
        env["OMEGA_GATE_FLOOR"] = floor

        proc = subprocess.run(
            [
                sys.executable,
                str(GATE),
                "1",
                str(bench_path),
                str(elo_log),
                str(score_file),
                margin,
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        row = json.loads(elo_log.read_text(encoding="utf-8").strip())
        return proc.returncode, row


def test_mean_gate_promotes_on_higher_average() -> None:
    bench = {
        "objective": "go-out",
        "results": [
            {"playerCount": 4, "omegaSeatId": "a", "omegaWinRate": 0.3, "fairShareRatio": 1.2},
            {"playerCount": 8, "omegaSeatId": "a", "omegaWinRate": 0.2, "fairShareRatio": 1.0},
        ],
    }
    code, row = run_gate(bench, prev_score="1.05")
    assert code == 10
    assert row["decision"] == "PROMOTE"


def test_weighted_gate_favors_focus_slices() -> None:
    """Higher 4p/5p with weaker 8p should promote under weighted gate, not mean."""
    bench = {
        "objective": "go-out",
        "results": [
            {"playerCount": 4, "omegaSeatId": "a", "omegaWinRate": 0.3, "fairShareRatio": 1.15},
            {"playerCount": 5, "omegaSeatId": "a", "omegaWinRate": 0.26, "fairShareRatio": 1.1},
            {"playerCount": 8, "omegaSeatId": "a", "omegaWinRate": 0.1, "fairShareRatio": 0.85},
        ],
    }
    mean_code, _ = run_gate(bench, prev_score="1.04", weights="")
    weighted_code, weighted_row = run_gate(
        bench,
        prev_score="1.04",
        metric="weighted",
        weights="4:3,5:3,8:1",
    )
    assert mean_code == 0
    assert weighted_code == 10
    assert weighted_row["candidateScore"] > 1.04


def test_floor_blocks_weak_focus_slice() -> None:
    bench = {
        "objective": "go-out",
        "results": [
            {"playerCount": 4, "omegaSeatId": "a", "omegaWinRate": 0.2, "fairShareRatio": 0.9},
            {"playerCount": 5, "omegaSeatId": "a", "omegaWinRate": 0.3, "fairShareRatio": 1.2},
        ],
    }
    code, row = run_gate(
        bench,
        metric="weighted",
        weights="4:3,5:3",
        floor_slices="4,5",
        floor="1.0",
    )
    assert code == 0
    assert row["floorFailed"] == [4]


def main() -> None:
    test_mean_gate_promotes_on_higher_average()
    test_weighted_gate_favors_focus_slices()
    test_floor_blocks_weak_focus_slice()
    print("omega-promote-gate.spec.py: ok")


if __name__ == "__main__":
    main()
