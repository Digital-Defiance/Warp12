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
#   OMEGA_BATCH           PyTorch batch size (default 512; M4 Max can use 1024+)
#   OMEGA_SEARCH_ITERS    ISMCTS iters/decision during collection (default 0)
#   OMEGA_WORKERS         parallel collection workers (default cores − 1)
#   OMEGA_BENCH_PARALLEL  set 0 to disable parallel bench (default on)
#   OMEGA_BENCH_WORKERS   bench worker count (defaults to OMEGA_WORKERS)
#   OMEGA_BENCH_PLAYERS   bench/gate table sizes, e.g. "3,4,6,8" (default 2,3,4)
#   OMEGA_CHAMPION        champion json (init + promote target)
#                         (default apps/Warp12/public/models/omega-v1.json)
#   OMEGA_MODEL_OUT_DIR   dir to copy promoted ONNX into (default app public models)
#   OMEGA_CANDIDATE_DIR   scratch dir for candidate weights
#   OMEGA_CHAMPION_SCORE  champion score baseline file (per-objective runs)
#   OMEGA_GATE_METRIC     mean (default) | weighted — promotion score
#   OMEGA_GATE_WEIGHTS    weighted gate, e.g. "4:3,5:3" (unsliced N default 1)
#   OMEGA_GATE_FLOOR_SLICES  require min fair-share on slices, e.g. "4,5"
#   OMEGA_GATE_FLOOR      min fair-share on floor slices (default 1.0)
#   OMEGA_GATE_REBASE     set 1 to bench champion and seed gate score before loop
#
set -euo pipefail

ITERATIONS="${OMEGA_ITERATIONS:-15}"
export OMEGA_GAMES="${OMEGA_GAMES:-1500}"
export OMEGA_PLAYERS="${OMEGA_PLAYERS:-2}"
export OMEGA_OBJECTIVE="${OMEGA_OBJECTIVE:-points}"
export OMEGA_EPOCHS="${OMEGA_EPOCHS:-4}"
export OMEGA_BATCH="${OMEGA_BATCH:-512}"
export OMEGA_BENCH_GAMES="${OMEGA_BENCH_GAMES:-200}"
ELO_LOG="${OMEGA_ELO_LOG:-tools/nn/data/omega-elo-log.jsonl}"
BASE_SEED="${OMEGA_SEED:-2026}"
PROMOTE_MARGIN="${OMEGA_PROMOTE_MARGIN:-0.0}"

CHAMPION="${OMEGA_CHAMPION:-apps/Warp12/public/models/omega-v1.json}"
MODEL_OUT_DIR="${OMEGA_MODEL_OUT_DIR:-apps/Warp12/public/models}"
CANDIDATE_DIR="${OMEGA_CANDIDATE_DIR:-tools/nn/data/omega-candidate}"
CHAMPION_SCORE_FILE="${OMEGA_CHAMPION_SCORE:-tools/nn/data/omega-champion-score.txt}"
GATE_METRIC="${OMEGA_GATE_METRIC:-mean}"

mkdir -p "$(dirname "$ELO_LOG")" "$CANDIDATE_DIR"

echo "Class Ω GATED training loop: ${ITERATIONS} iterations, ${OMEGA_GAMES} games/iter, ${OMEGA_PLAYERS}p ${OMEGA_OBJECTIVE}"
echo "Champion: ${CHAMPION}   Elo log: ${ELO_LOG}   promote margin: ${PROMOTE_MARGIN}"
echo "Train batch: ${OMEGA_BATCH}   search iters: ${OMEGA_SEARCH_ITERS:-0}   workers: ${OMEGA_WORKERS:-auto}"
echo "Gate metric: ${GATE_METRIC}${OMEGA_GATE_WEIGHTS:+  weights=${OMEGA_GATE_WEIGHTS}}${OMEGA_GATE_FLOOR_SLICES:+  floor=${OMEGA_GATE_FLOOR_SLICES}@${OMEGA_GATE_FLOOR:-1.0}}"

if [ "${OMEGA_GATE_REBASE:-0}" = "1" ]; then
  echo ""
  echo "Rebasing gate score from current champion..."
  REBASE_BENCH="tools/nn/data/omega-gate-rebase-bench.json"
  OMEGA_WEIGHTS="$CHAMPION" yarn omega:bench > "$REBASE_BENCH"
  tools/nn/.venv/bin/python tools/nn/omega-promote-gate.py \
    0 "$REBASE_BENCH" "$ELO_LOG" "$CHAMPION_SCORE_FILE" 0 --seed
fi

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

  # 4. Gate: promote candidate only if gate score beats the champion.
  # Shield from `set -e`: the gate script exits 10 to signal "promote", which
  # would otherwise abort the loop before gate_rc is captured.
  set +e
  tools/nn/.venv/bin/python tools/nn/omega-promote-gate.py \
    "$i" "$BENCH_FILE" "$ELO_LOG" "$CHAMPION_SCORE_FILE" "$PROMOTE_MARGIN"
  gate_rc=$?
  set -e

  if [ "$gate_rc" -eq 10 ]; then
    mkdir -p "$MODEL_OUT_DIR"
    cp "$CANDIDATE_DIR/omega-v1.json" "$CHAMPION"
    [ -f "$CANDIDATE_DIR/omega-policy-v1.onnx" ] && cp "$CANDIDATE_DIR/omega-policy-v1.onnx" "$MODEL_OUT_DIR/" || true
    [ -f "$CANDIDATE_DIR/omega-value-v1.onnx" ] && cp "$CANDIDATE_DIR/omega-value-v1.onnx" "$MODEL_OUT_DIR/" || true
    echo "  -> promoted candidate to champion"
  elif [ "$gate_rc" -eq 0 ]; then
    echo "  -> kept champion (candidate rejected)"
  else
    echo "  !! gate script failed (rc=$gate_rc)"; exit "$gate_rc"
  fi
done

echo ""
echo "Done. Elo trajectory: ${ELO_LOG}"
