#!/usr/bin/env python3
"""Train the concept-bottleneck tactical advisor from Ω+ teacher labels."""

from __future__ import annotations

import argparse
import json
import logging
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

for _noisy in ("torch.onnx", "torch.onnx._internal.exporter._registration"):
    logging.getLogger(_noisy).setLevel(logging.ERROR)

POLICY_FEATURE_DIM = 40
STATE_CONCEPT_DIM = 20
MODEL_VERSION = 1
DEFAULT_HIDDEN = [64, 64]


class DecisionDataset(Dataset):
    def __init__(self, groups: list[dict]) -> None:
        self.groups = groups

    def __len__(self) -> int:
        return len(self.groups)

    def __getitem__(self, index: int) -> dict:
        return self.groups[index]


def collate_padded(batch: list[dict]) -> dict:
    max_c = max(len(group["features"]) for group in batch)
    b = len(batch)
    features = torch.zeros(b, max_c, POLICY_FEATURE_DIM, dtype=torch.float32)
    mask = torch.zeros(b, max_c, dtype=torch.bool)
    concepts = torch.zeros(b, STATE_CONCEPT_DIM, dtype=torch.float32)
    chosen = torch.zeros(b, dtype=torch.long)
    teacher = torch.zeros(b, max_c, dtype=torch.float32)
    has_teacher = torch.zeros(b, dtype=torch.bool)

    for i, group in enumerate(batch):
        cands = group["features"]
        c = len(cands)
        features[i, :c] = torch.tensor(cands, dtype=torch.float32)
        mask[i, :c] = True
        concepts[i] = torch.tensor(group["concepts"], dtype=torch.float32)
        chosen[i] = int(group["chosen"])
        tgt = group.get("teacher_target")
        if tgt is not None:
            teacher[i, :c] = torch.tensor(tgt, dtype=torch.float32)
            has_teacher[i] = True

    return {
        "features": features,
        "mask": mask,
        "concepts": concepts,
        "chosen": chosen,
        "teacher": teacher,
        "has_teacher": has_teacher,
    }


class AdvisorPolicy(nn.Module):
    def __init__(self, hidden: list[int]) -> None:
        super().__init__()
        layers: list[nn.Module] = []
        in_dim = POLICY_FEATURE_DIM
        for width in hidden:
            layers.extend([nn.Linear(in_dim, width), nn.ReLU()])
            in_dim = width
        layers.append(nn.Linear(in_dim, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.net(features).squeeze(-1)


def load_groups(path: Path) -> list[dict]:
    by_decision: dict[str, list[dict]] = defaultdict(list)
    with path.open() as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            by_decision[row["decisionId"]].append(row)

    groups: list[dict] = []
    for rows in by_decision.values():
        features = [row["features"] for row in rows]
        concepts = rows[0]["concepts"]
        chosen = next(i for i, row in enumerate(rows) if row.get("chosen"))
        visits = [float(row.get("teacherVisits") or 0.0) for row in rows]
        visit_sum = sum(visits)
        teacher_target = (
            [v / visit_sum for v in visits] if visit_sum > 0 else None
        )
        groups.append(
            {
                "features": features,
                "concepts": concepts,
                "chosen": chosen,
                "teacher_target": teacher_target,
            }
        )
    return groups


def export_json(model: AdvisorPolicy, hidden: list[int], out: Path) -> None:
    state = model.state_dict()
    linear_idx = 0
    layers = []
    in_dim = POLICY_FEATURE_DIM
    for width in hidden:
        weight = state[f"net.{linear_idx}.weight"].tolist()
        bias = state[f"net.{linear_idx}.bias"].tolist()
        layers.append(
            {
                "inSize": in_dim,
                "outSize": width,
                "weights": [w for row in weight for w in row],
                "bias": bias,
            }
        )
        in_dim = width
        linear_idx += 2
    out_weight = state[f"net.{linear_idx}.weight"].tolist()
    out_bias = state[f"net.{linear_idx}.bias"].tolist()
    layers.append(
        {
            "inSize": in_dim,
            "outSize": 1,
            "weights": [w for row in out_weight for w in row],
            "bias": out_bias,
        }
    )
    payload = {
        "version": MODEL_VERSION,
        "policyFeatureDim": POLICY_FEATURE_DIM,
        "policyHiddenSizes": hidden,
        "policyLayers": layers,
    }
    out.write_text(json.dumps(payload))


def train_epoch(
    model: AdvisorPolicy,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
) -> float:
    model.train()
    total = 0.0
    count = 0
    for batch in loader:
        logits = model(batch["features"])
        logits = logits.masked_fill(~batch["mask"], -1e9)

        policy_loss = F.cross_entropy(logits, batch["chosen"])
        loss = policy_loss
        if batch["has_teacher"].any():
            log_probs = F.log_softmax(logits, dim=-1)
            teacher_loss = -(
                log_probs * batch["teacher"] * batch["has_teacher"].unsqueeze(-1)
            ).sum(dim=-1)
            teacher_loss = teacher_loss[batch["has_teacher"]].mean()
            loss = loss + teacher_loss

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total += float(loss.item())
        count += 1
    return total / max(count, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        default="tools/nn/data/advisor-trajectories.jsonl",
    )
    parser.add_argument(
        "--out",
        default="apps/Warp12/public/models/advisor-v1.json",
    )
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--concept-weight", type=float, default=0.1, help="unused — concepts are deterministic in features")
    parser.add_argument("--hidden", default="64,64")
    args = parser.parse_args()

    hidden = [int(part) for part in args.hidden.split(",") if part.strip()]
    groups = load_groups(Path(args.data))
    if not groups:
        raise SystemExit(f"No advisor decision groups in {args.data}")

    loader = DataLoader(
        DecisionDataset(groups),
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate_padded,
    )
    model = AdvisorPolicy(hidden)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    for epoch in range(1, args.epochs + 1):
        loss = train_epoch(model, loader, optimizer)
        print(f"epoch {epoch}/{args.epochs} loss={loss:.4f}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    export_json(model, hidden, out)
    print(f"Wrote advisor weights to {out}")


if __name__ == "__main__":
    main()
