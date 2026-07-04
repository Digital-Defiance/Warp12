#!/usr/bin/env bash
#
# Unattended Class Ω self-play training loop.
#
#   collect (with current net) -> train (warm-start) -> bench, repeated.
#
# Each iteration varies the self-play seed so the dataset stays diverse, and the
# bench result (win rate + implied Elo per slice) is appended to an Elo log so
# you can watch it climb. Start it and walk away.
#
# Env:
#   OMEGA_ITERATIONS   iterations to run                 (default 10)
#   OMEGA_GAMES        self-play games per iteration     (default 1000)
#   OMEGA_PLAYERS      table size for collection         (default 2)
#   OMEGA_OBJECTIVE    points | go-out                   (default points)
#   OMEGA_EPOCHS       training epochs per iteration     (default 20)
#   OMEGA_BENCH_GAMES  bench games per slice             (default 200)
#   OMEGA_ELO_LOG      Elo log path (JSONL)              (default tools/nn/data/omega-elo-log.jsonl)
#
set -euo pipefail

ITERATIONS="${OMEGA_ITERATIONS:-10}"
export OMEGA_GAMES="${OMEGA_GAMES:-1000}"
export OMEGA_PLAYERS="${OMEGA_PLAYERS:-2}"
export OMEGA_OBJECTIVE="${OMEGA_OBJECTIVE:-points}"
export OMEGA_EPOCHS="${OMEGA_EPOCHS:-20}"
export OMEGA_BENCH_GAMES="${OMEGA_BENCH_GAMES:-200}"
ELO_LOG="${OMEGA_ELO_LOG:-tools/nn/data/omega-elo-log.jsonl}"
BASE_SEED="${OMEGA_SEED:-2026}"

mkdir -p "$(dirname "$ELO_LOG")"

echo "Class Ω training loop: ${ITERATIONS} iterations, ${OMEGA_GAMES} games/iter, ${OMEGA_PLAYERS}p ${OMEGA_OBJECTIVE}"
echo "Elo log -> ${ELO_LOG}"

for ((i = 1; i <= ITERATIONS; i++)); do
  echo ""
  echo "================ Omega iteration ${i}/${ITERATIONS} ================"
  export OMEGA_SEED=$((BASE_SEED + i * 100003))

  yarn omega:collect
  yarn omega:train:warm

  BENCH_FILE="tools/nn/data/omega-bench-iter-${i}.json"
  yarn omega:bench > "${BENCH_FILE}"
  cat "${BENCH_FILE}"

  tools/nn/.venv/bin/python - "$i" "${BENCH_FILE}" "${ELO_LOG}" <<'PY'
import json, sys, time
iteration, bench_file, elo_log = int(sys.argv[1]), sys.argv[2], sys.argv[3]
text = open(bench_file).read()
data = json.loads(text[text.index("{"):])
summary = {
    "iteration": iteration,
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "objective": data.get("objective"),
    "slices": [
        {
            "playerCount": r["playerCount"],
            "seat": r["omegaSeatId"],
            "winRate": r["omegaWinRate"],
            "impliedEloGap": r["impliedEloGap"],
        }
        for r in data.get("results", [])
    ],
}
with open(elo_log, "a") as handle:
    handle.write(json.dumps(summary) + "\n")
best = max((s["impliedEloGap"] or -9999) for s in summary["slices"])
print(f"[iter {iteration}] best implied Elo gap vs Commander: {best:+.1f}")
PY
done

echo ""
echo "Done. Elo trajectory: ${ELO_LOG}"
