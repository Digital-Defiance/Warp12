#!/usr/bin/env bash
set -euo pipefail

echo "=== processes ==="
pgrep -fl 'omega-train-loop|collect-omega|bench-omega|train-omega' 2>/dev/null || true

echo "=== rating log ==="
python3 <<'PY'
import json
import os

p = (
    os.environ.get("OMEGA_RATING_LOG")
    or os.environ.get("OMEGA_ELO_LOG")
    or "tools/nn/data/omega-rating-log.jsonl"
)
if os.path.exists(p) and os.path.getsize(p) > 0:
    rows = [json.loads(line) for line in open(p, encoding="utf-8") if line.strip()]
    for r in rows:
        s = {
            f"{x['playerCount']}p": round(x["fairShareRatio"], 2)
            for x in r["slices"]
        }
        metric = r.get("metric", "mean")
        mean_fs = r.get("meanFairShare")
        extra = f" mean={mean_fs}" if mean_fs is not None else ""
        print(
            r["iteration"],
            r["decision"],
            metric,
            "score",
            r["candidateScore"],
            "champ",
            r["championScore"],
            extra,
            s,
        )
    print(
        "promotions:",
        sum(1 for r in rows if r["decision"] == "PROMOTE"),
        "/",
        len(rows),
    )
else:
    print("no iterations logged yet")
PY
