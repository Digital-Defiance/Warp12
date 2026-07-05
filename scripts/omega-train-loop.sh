#!/usr/bin/env bash
#
# Unattended Class Ω self-play training loop — CHAMPION-GATED.
#
#   collect (from champion) -> train candidate (warm-start from champion)
#   -> bench candidate -> promote ONLY if it beats the champion.
#
# Gating makes the ladder monotonic: a regressed candidate is discarded, never
# propagated. This fixes the "good, good, collapse" oscillation of blind
# warm-start REINFORCE, where a bad net poisoned the next iteration's data.
#
# The champion is the shipped net at apps/Warp12/public/models/omega-v1.json.
# Candidates train into a scratch dir and are only copied over on promotion.
#
# Env:
#   OMEGA_ITERATIONS   iterations to run                 (default 15)
#   OMEGA_GAMES        self-play games per iteration     (default 1500)
#   OMEGA_PLAYERS      table size for collection         (default 2)
#   OMEGA_OBJECTIVE    points | go-out                   (default points)
#   OMEGA_EPOCHS       training epochs per iteration     (default 4)
#   OMEGA_BENCH_GAMES  bench games per slice             (default 200)
#   OMEGA_ELO_LOG      Elo log path (JSONL)              (default tools/nn/data/omega-elo-log.jsonl)
#   OMEGA_PROMOTE_MARGIN  min aggregate win-rate gain to promote (default 0.0)
#
set -euo pipefail

ITERATIONS="${OMEGA_ITERATIONS:-15}"
export OMEGA_GAMES="${OMEGA_GAMES:-1500}"
export OMEGA_PLAYERS="${OMEGA_PLAYERS:-2}"
export OMEGA_OBJECTIVE="${OMEGA_OBJECTIVE:-points}"
export OMEGA_EPOCHS="${OMEGA_EPOCHS:-4}"
export OMEGA_BENCH_GAMES="${OMEGA_BENCH_GAMES:-200}"
ELO_LOG="${OMEGA_ELO_LOG:-tools/nn/data/omega-elo-log.jsonl}"
BASE_SEED="${OMEGA_SEED:-2026}"
PROMOTE_MARGIN="${OMEGA_PROMOTE_MARGIN:-0.0}"

CHAMPION="apps/Warp12/public/models/omega-v1.json"
CANDIDATE_DIR="tools/nn/data/omega-candidate"
CHAMPION_SCORE_FILE="tools/nn/data/omega-champion-score.txt"

mkdir -p "$(dirname "$ELO_LOG")" "$CANDIDATE_DIR"

echo "Class Ω GATED training loop: ${ITERATIONS} iterations, ${OMEGA_GAMES} games/iter, ${OMEGA_PLAYERS}p ${OMEGA_OBJECTIVE}"
echo "Champion: ${CHAMPION}   Elo log: ${ELO_LOG}   promote margin: ${PROMOTE_MARGIN}"

for ((i = 1; i <= ITERATIONS; i++)); do
  echo ""
  echo "================ Omega iteration ${i}/${ITERATIONS} ================"
  export OMEGA_SEED=$((BASE_SEED + i * 100003))

  # 1. Collect self-play data using the current CHAMPION (OMEGA_WEIGHTS default =
  #    omega-v1.json = champion; missing => zero-init on the very first iteration).
  yarn omega:collect

  # 2. Train a CANDIDATE, warm-started from the champion, into a scratch dir.
  #    (Never overwrites the champion until it earns promotion.)
  #    Two explicit branches avoid empty-array expansion under `set -u` on the
  #    macOS system bash 3.2 (first iteration has no champion to --init from).
  if [ -f "$CHAMPION" ]; then
    tools/nn/.venv/bin/python tools/nn/train-omega.py \
      --out-dir "$CANDIDATE_DIR" --init "$CHAMPION"
  else
    tools/nn/.venv/bin/python tools/nn/train-omega.py \
      --out-dir "$CANDIDATE_DIR"
  fi

  # 3. Bench the CANDIDATE.
  BENCH_FILE="tools/nn/data/omega-bench-iter-${i}.json"
  OMEGA_WEIGHTS="$CANDIDATE_DIR/omega-v1.json" yarn omega:bench > "$BENCH_FILE"

  # 4. Gate: promote candidate only if aggregate win rate beats the champion.
  # Shield from `set -e`: the gate script exits 10 to signal "promote", which
  # would otherwise abort the loop before gate_rc is captured.
  set +e
  tools/nn/.venv/bin/python - "$i" "$BENCH_FILE" "$ELO_LOG" "$CHAMPION_SCORE_FILE" "$PROMOTE_MARGIN" <<'PY'
import json, sys, time, os, pathlib
iteration, bench_file, elo_log, score_file, margin = (
    int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5])
)
text = open(bench_file).read()
data = json.loads(text[text.index("{"):])
results = data.get("results", [])
agg_wins = sum(r["omegaWins"] for r in results)
agg_games = sum(r["completed"] for r in results) or 1
cand_score = agg_wins / agg_games

prev = None
if os.path.exists(score_file):
    prev = float(open(score_file).read().strip() or "nan")
    if prev != prev:  # nan
        prev = None

promote = prev is None or cand_score > prev + margin
decision = "PROMOTE" if promote else "REJECT"
if promote:
    open(score_file, "w").write(f"{cand_score}")

summary = {
    "iteration": iteration,
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "objective": data.get("objective"),
    "candidateAggregate": round(cand_score, 4),
    "championAggregate": round(prev, 4) if prev is not None else None,
    "decision": decision,
    "slices": [
        {"playerCount": r["playerCount"], "seat": r["omegaSeatId"],
         "winRate": r["omegaWinRate"], "impliedEloGap": r["impliedEloGap"]}
        for r in results
    ],
}
with open(elo_log, "a") as h:
    h.write(json.dumps(summary) + "\n")

best = max((s["impliedEloGap"] or -9999) for s in summary["slices"])
print(f"[iter {iteration}] {decision}  candidate agg={cand_score:.3f} "
      f"champion agg={prev if prev is not None else float('nan'):.3f}  best slice Elo {best:+.0f}")
# Exit code 10 => promote (shell copies candidate over champion), 0 => reject.
sys.exit(10 if promote else 0)
PY
  gate_rc=$?
  set -e

  if [ "$gate_rc" -eq 10 ]; then
    cp "$CANDIDATE_DIR/omega-v1.json" "$CHAMPION"
    [ -f "$CANDIDATE_DIR/omega-policy-v1.onnx" ] && cp "$CANDIDATE_DIR/omega-policy-v1.onnx" "apps/Warp12/public/models/" || true
    [ -f "$CANDIDATE_DIR/omega-value-v1.onnx" ] && cp "$CANDIDATE_DIR/omega-value-v1.onnx" "apps/Warp12/public/models/" || true
    echo "  -> promoted candidate to champion"
  elif [ "$gate_rc" -eq 0 ]; then
    echo "  -> kept champion (candidate rejected)"
  else
    echo "  !! gate script failed (rc=$gate_rc)"; exit "$gate_rc"
  fi
done

echo ""
echo "Done. Elo trajectory: ${ELO_LOG}"
