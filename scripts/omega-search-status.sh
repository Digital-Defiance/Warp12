#!/usr/bin/env bash
set -euo pipefail

echo "=== processes ==="
pgrep -fl 'omega-train-loop|collect-omega|bench-omega|train-omega' 2>/dev/null || true

echo "=== elo log ==="
python3 <<'PY'
import json
import os

#p = "tools/nn/data/omega-elo-log.jsonl"
p = "tools/nn/data/omega-elo-log-run2-480.jsonl"
if os.path.exists(p) and os.path.getsize(p) > 0:
    rows = [json.loads(line) for line in open(p, encoding="utf-8") if line.strip()]
    for r in rows:
        s = {
            f"{x['playerCount']}p": round(x["fairShareRatio"], 2)
            for x in r["slices"]
        }
        print(
            r["iteration"],
            r["decision"],
            "score",
            r["candidateScore"],
            "champ",
            r["championScore"],
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
