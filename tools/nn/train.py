#!/usr/bin/env python3
"""Train Class I* residual MLP and export ONNX + JSON weights for warp12-engine."""

from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

FEATURE_DIM = 303
DEFAULT_HIDDEN_SIZES = [128, 128]
MODEL_VERSION = 1
DEFAULT_ALPHA = 1.0


class TrajectoryDataset(Dataset):
    """Row-wise MSE on game outcome (+1 / -1). Legacy — weak for move ranking."""

    def __init__(self, rows: list[dict]) -> None:
        self.features = torch.tensor(
            [row["features"] for row in rows], dtype=torch.float32
        )
        self.labels = torch.tensor(
            [row["label"] for row in rows], dtype=torch.float32
        )
        weights = []
        for row in rows:
            w = 2.0 if row.get("chosen") else 1.0
            weights.append(w)
        self.weights = torch.tensor(weights, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.features)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        return self.features[index], self.labels[index], self.weights[index]


class DecisionRankingDataset(Dataset):
    """Per-decision groups for ranking / hinge / combined / rl-combined losses."""

    def __init__(self, groups: list[dict]) -> None:
        self.groups = groups

    def __len__(self) -> int:
        return len(self.groups)

    def __getitem__(self, index: int) -> dict:
        group = self.groups[index]
        return {
            "features": torch.tensor(group["features"], dtype=torch.float32),
            "heuristic_scores": torch.tensor(
                group["heuristic_scores"], dtype=torch.float32
            ),
            "target": torch.tensor(group["target_index"], dtype=torch.long),
            "weight": torch.tensor(group["weight"], dtype=torch.float32),
        }


class Class1StarNet(nn.Module):
    def __init__(self, hidden_sizes: list[int]) -> None:
        super().__init__()
        self.hidden_sizes = hidden_sizes
        layers: list[nn.Module] = []
        in_dim = FEATURE_DIM
        for hidden in hidden_sizes:
            layers.append(nn.Linear(in_dim, hidden))
            layers.append(nn.ReLU())
            in_dim = hidden
        layers.append(nn.Linear(in_dim, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def parse_hidden_sizes(raw: str | None) -> list[int]:
    if raw is None or raw.strip() == "":
        return list(DEFAULT_HIDDEN_SIZES)
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def decision_weight(label: int, scheme: str) -> float:
    """Sample weight for a decision group."""
    if scheme == "uniform":
        return 1.0
    if scheme == "imitation":
        return 2.0 if label == 1 else 1.0
    if scheme == "outcome":
        return 4.0 if label == 1 else 0.25
    if scheme == "win-only":
        return 1.0 if label == 1 else 0.0
    raise ValueError(f"Unknown weight scheme: {scheme}")


def row_heuristic_score(row: dict) -> float:
    if "heuristicScore" in row:
        return float(row["heuristicScore"])
    return 0.0


def commander_index(decision_rows: list[dict]) -> int | None:
    for index, row in enumerate(decision_rows):
        if row.get("commanderPick"):
            return index
    return None


def build_ranking_groups(rows: list[dict], weight_scheme: str) -> list[dict]:
    by_decision: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        decision_id = row.get("decisionId")
        if not decision_id:
            continue
        by_decision[decision_id].append(row)

    groups: list[dict] = []
    for decision_rows in by_decision.values():
        if len(decision_rows) < 2:
            continue
        chosen_indices = [
            index for index, row in enumerate(decision_rows) if row.get("chosen")
        ]
        if len(chosen_indices) != 1:
            continue
        label = int(decision_rows[0].get("label", 0))
        weight = decision_weight(label, weight_scheme)
        if weight <= 0:
            continue
        groups.append(
            {
                "features": [row["features"] for row in decision_rows],
                "heuristic_scores": [
                    row_heuristic_score(row) for row in decision_rows
                ],
                "target_index": chosen_indices[0],
                "weight": weight,
                "label": label,
            }
        )
    return groups


def rl_group_weight(label: int, flipped: bool) -> float:
    """Regret-aware weights: reinforce innovations on wins, Commander on losses."""
    if label == 1:
        return 4.0 if flipped else 1.0
    return 4.0 if flipped else 2.0


def build_rl_groups(rows: list[dict]) -> list[dict]:
    """Regret targets from Class I* vs Commander self-play."""
    by_decision: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if row.get("actor") and row.get("actor") != "class1Star":
            continue
        decision_id = row.get("decisionId")
        if not decision_id:
            continue
        by_decision[decision_id].append(row)

    groups: list[dict] = []
    for decision_rows in by_decision.values():
        if len(decision_rows) < 2:
            continue
        chosen_indices = [
            index for index, row in enumerate(decision_rows) if row.get("chosen")
        ]
        if len(chosen_indices) != 1:
            continue
        chosen_index = chosen_indices[0]
        cmd_index = commander_index(decision_rows)
        label = int(decision_rows[0].get("label", 0))
        flipped = cmd_index is not None and chosen_index != cmd_index

        if label == 1:
            target_index = chosen_index
        elif cmd_index is not None:
            target_index = cmd_index
        else:
            target_index = chosen_index

        weight = rl_group_weight(label, flipped)
        groups.append(
            {
                "features": [row["features"] for row in decision_rows],
                "heuristic_scores": [
                    row_heuristic_score(row) for row in decision_rows
                ],
                "target_index": target_index,
                "weight": weight,
                "label": label,
                "flipped": flipped,
            }
        )
    return groups


def load_init_weights(model: Class1StarNet, path: Path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    linear_layers = [m for m in model.net if isinstance(m, nn.Linear)]
    init_layers = payload.get("layers", [])
    copied = 0
    for model_layer, init_layer in zip(linear_layers, init_layers):
        in_size = init_layer.get("inSize")
        out_size = init_layer.get("outSize")
        if (
            model_layer.in_features != in_size
            or model_layer.out_features != out_size
        ):
            break
        weights = torch.tensor(init_layer["weights"], dtype=torch.float32).reshape(
            out_size, in_size
        )
        bias = torch.tensor(init_layer["bias"], dtype=torch.float32)
        model_layer.weight.data.copy_(weights)
        model_layer.bias.data.copy_(bias)
        copied += 1
    print(f"Warm-started {copied}/{len(linear_layers)} layers from {path}")


def export_json(
    model: Class1StarNet, path: Path, alpha: float, hidden_sizes: list[int]
) -> None:
    linear_layers = [m for m in model.net if isinstance(m, nn.Linear)]
    payload = {
        "version": MODEL_VERSION,
        "featureDim": FEATURE_DIM,
        "hiddenSizes": hidden_sizes,
        "alpha": alpha,
        "layers": [],
    }
    for linear in linear_layers:
        payload["layers"].append(
            {
                "inSize": linear.in_features,
                "outSize": linear.out_features,
                "weights": linear.weight.detach().flatten().tolist(),
                "bias": linear.bias.detach().tolist(),
            }
        )
    path.write_text(json.dumps(payload), encoding="utf-8")


def export_onnx(model: Class1StarNet, path: Path) -> None:
    model.eval()
    dummy = torch.zeros(1, FEATURE_DIM, dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        path,
        input_names=["features"],
        output_names=["residual"],
        dynamic_axes={"features": {0: "batch"}, "residual": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )


def train_mse(args: argparse.Namespace, rows: list[dict], model: Class1StarNet) -> None:
    dataset = TrajectoryDataset(rows)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    loss_fn = nn.MSELoss(reduction="none")

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        count = 0
        for features, labels, weights in loader:
            optimizer.zero_grad()
            preds = model(features)
            loss = (loss_fn(preds, labels) * weights).mean()
            loss.backward()
            optimizer.step()
            total += loss.item() * len(features)
            count += len(features)
        print(f"epoch {epoch + 1}/{args.epochs} mse_loss={total / max(count, 1):.4f}")


def combined_scores(
    model: Class1StarNet,
    features: torch.Tensor,
    heuristic_scores: torch.Tensor,
    alpha: float,
) -> torch.Tensor:
    return heuristic_scores + alpha * model(features)


def train_decision_groups(
    args: argparse.Namespace, groups: list[dict], model: Class1StarNet
) -> None:
    if not groups:
        raise SystemExit(
            "No decision groups — re-collect with exportAllCandidates "
            "(default) so each decisionId has all legal candidates."
        )

    if args.loss in ("combined", "rl-combined"):
        has_heuristic = any(
            abs(score) > 1e-9 for group in groups for score in group["heuristic_scores"]
        )
        if not has_heuristic:
            print(
                "WARNING: combined loss but heuristicScore is missing/zero in trajectories. "
                "Re-run: CLASS1_STAR_GAMES=1000 yarn class1-star:collect"
            )

    dataset = DecisionRankingDataset(groups)
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=lambda batch: batch,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    ce_loss_fn = nn.CrossEntropyLoss(reduction="none")
    alpha = args.alpha
    loss_name = args.loss
    margin = args.hinge_margin

    win_groups = sum(1 for group in groups if group.get("label") == 1)
    flipped_groups = sum(1 for group in groups if group.get("flipped"))
    print(
        f"Decision groups: {len(groups)} "
        f"(win={win_groups}, loss={len(groups) - win_groups}, flipped={flipped_groups}) "
        f"loss={loss_name} weight={args.weight_scheme} alpha={alpha}"
    )

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        count = 0
        correct = 0
        for batch in loader:
            optimizer.zero_grad()
            batch_loss = 0.0
            batch_count = 0
            for group in batch:
                features = group["features"]
                heuristic_scores = group["heuristic_scores"]
                target = group["target"]
                weight = group["weight"]

                if loss_name in ("ranking", "combined", "rl-combined"):
                    if loss_name in ("combined", "rl-combined"):
                        logits = combined_scores(
                            model, features, heuristic_scores, alpha
                        ).unsqueeze(0)
                    else:
                        logits = model(features).unsqueeze(0)
                    loss = ce_loss_fn(logits, target.unsqueeze(0)) * weight
                    pred_index = logits.argmax(dim=1).item()
                else:
                    scores = model(features)
                    chosen = scores[target]
                    hinge_terms = []
                    for index in range(len(scores)):
                        if index == target.item():
                            continue
                        hinge_terms.append(
                            torch.clamp(margin - (chosen - scores[index]), min=0.0)
                        )
                    if hinge_terms:
                        loss = torch.stack(hinge_terms).mean() * weight
                    else:
                        loss = torch.zeros((), dtype=torch.float32)
                    pred_index = scores.argmax().item()

                batch_loss += loss.mean() if loss.ndim > 0 else loss
                batch_count += 1
                if pred_index == target.item():
                    correct += 1

            if batch_count == 0:
                continue
            batch_loss = batch_loss / batch_count
            batch_loss.backward()
            optimizer.step()
            total += batch_loss.item() * batch_count
            count += batch_count

        acc = correct / max(count, 1)
        print(
            f"epoch {epoch + 1}/{args.epochs} "
            f"{loss_name}_loss={total / max(count, 1):.4f} "
            f"train_top1={acc:.3f} "
            f"groups={len(groups)}"
        )


def train(args: argparse.Namespace) -> None:
    rows = load_jsonl(args.data)
    if not rows:
        raise SystemExit(f"No rows in {args.data}")

    hidden_sizes = parse_hidden_sizes(args.hidden_sizes)
    model = Class1StarNet(hidden_sizes)
    if args.init:
        if args.init.exists():
            load_init_weights(model, args.init)
        else:
            print(f"No init weights at {args.init}; training from scratch.")

    if args.loss == "mse":
        train_mse(args, rows, model)
    elif args.loss == "rl-combined":
        groups = build_rl_groups(rows)
        train_decision_groups(args, groups, model)
    else:
        groups = build_ranking_groups(rows, args.weight_scheme)
        train_decision_groups(args, groups, model)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    export_json(model, args.out_dir / "class1-star-v1.json", args.alpha, hidden_sizes)
    export_onnx(model, args.out_dir / "class1-star-v1.onnx")
    print(f"Wrote {args.out_dir / 'class1-star-v1.json'} (alpha={args.alpha})")
    print(f"Wrote {args.out_dir / 'class1-star-v1.onnx'}")


def env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return float(raw)


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return int(raw)


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Train Class I* residual model")
    parser.add_argument(
        "--data",
        type=Path,
        default=root / "tools/nn/data/trajectories.jsonl",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=root / "apps/Warp12/public/models",
    )
    parser.add_argument(
        "--loss",
        choices=("combined", "rl-combined", "ranking", "hinge", "mse"),
        default=os.environ.get("CLASS1_STAR_LOSS", "combined"),
        help=(
            "combined = softmax on heuristic + alpha*residual; "
            "rl-combined = regret targets from Class I* vs Commander RL data; "
            "ranking = residual-only softmax; "
            "hinge = pairwise margin on residual; "
            "mse = legacy outcome regression"
        ),
    )
    parser.add_argument(
        "--weight-scheme",
        choices=("outcome", "imitation", "win-only", "uniform"),
        default=os.environ.get("CLASS1_STAR_WEIGHT_SCHEME", "outcome"),
        help="Used by combined/ranking/hinge (not rl-combined)",
    )
    parser.add_argument(
        "--alpha",
        type=float,
        default=env_float("CLASS1_STAR_ALPHA", DEFAULT_ALPHA),
        help="Residual scale in combined loss and exported weights",
    )
    parser.add_argument(
        "--hidden-sizes",
        default=os.environ.get("CLASS1_STAR_HIDDEN", ""),
        help="Comma-separated hidden layer widths (default 128,128)",
    )
    parser.add_argument(
        "--init",
        type=Path,
        default=None,
        help="Warm-start from exported class1-star-v1.json (compatible layers only)",
    )
    parser.add_argument(
        "--hinge-margin",
        type=float,
        default=env_float("CLASS1_STAR_HINGE_MARGIN", 1.0),
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=env_int("CLASS1_STAR_EPOCHS", 20),
    )
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    train(parser.parse_args())


if __name__ == "__main__":
    main()
