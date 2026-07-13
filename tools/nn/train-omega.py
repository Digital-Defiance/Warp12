#!/usr/bin/env python3
"""Train the standalone Class Ω policy/value network from self-play outcomes.

Pure actor-critic. The ONLY supervision is the game result (+1 win / -1 loss)
for the acting seat. There is no Commander target, no heuristic score, and no
imitation term anywhere in this file — by design. Exports JSON weights (TS
fallback) and ONNX (policy + value) for warp12-engine.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

# Quiet the ONNX dynamo exporter's "torchvision not installed / skipping
# torchvision::nms …" probes. We export plain MLPs (no vision ops), so those
# registrations are irrelevant — cosmetic noise only.
for _noisy in ("torch.onnx", "torch.onnx._internal.exporter._registration"):
    logging.getLogger(_noisy).setLevel(logging.ERROR)

POLICY_FEATURE_DIM = 303
STATE_FEATURE_DIM = 195
MODEL_VERSION = 1
DEFAULT_POLICY_HIDDEN = [256, 256]
DEFAULT_VALUE_HIDDEN = [256, 128]


class DecisionDataset(Dataset):
    """One item per self-play decision group (all legal candidates + outcome)."""

    def __init__(self, groups: list[dict]) -> None:
        self.groups = groups

    def __len__(self) -> int:
        return len(self.groups)

    def __getitem__(self, index: int) -> dict:
        return self.groups[index]


def collate_padded(batch: list[dict]) -> dict:
    """Pad variable candidate counts to the batch max and build a mask."""
    max_c = max(len(group["features"]) for group in batch)
    b = len(batch)
    features = torch.zeros(b, max_c, POLICY_FEATURE_DIM, dtype=torch.float32)
    mask = torch.zeros(b, max_c, dtype=torch.bool)
    state = torch.zeros(b, STATE_FEATURE_DIM, dtype=torch.float32)
    chosen = torch.zeros(b, dtype=torch.long)
    label = torch.zeros(b, dtype=torch.float32)
    search_target = torch.zeros(b, max_c, dtype=torch.float32)
    has_search = torch.zeros(b, dtype=torch.bool)

    for i, group in enumerate(batch):
        cands = group["features"]
        c = len(cands)
        features[i, :c] = torch.tensor(cands, dtype=torch.float32)
        mask[i, :c] = True
        state[i] = torch.tensor(group["state"], dtype=torch.float32)
        chosen[i] = int(group["chosen"])
        label[i] = float(group["label"])
        tgt = group.get("search_target")
        if tgt is not None:
            search_target[i, :c] = torch.tensor(tgt, dtype=torch.float32)
            has_search[i] = True

    return {
        "features": features,
        "mask": mask,
        "state": state,
        "chosen": chosen,
        "label": label,
        "search_target": search_target,
        "has_search": has_search,
    }


def resolve_device() -> torch.device:
    """Prefer Apple MPS (M-series GPU), then CUDA, else CPU."""
    if os.environ.get("OMEGA_DEVICE"):
        return torch.device(os.environ["OMEGA_DEVICE"])
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


class Mlp(nn.Module):
    def __init__(self, in_dim: int, hidden_sizes: list[int]) -> None:
        super().__init__()
        layers: list[nn.Module] = []
        prev = in_dim
        for hidden in hidden_sizes:
            layers.append(nn.Linear(prev, hidden))
            layers.append(nn.ReLU())
            prev = hidden
        layers.append(nn.Linear(prev, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class ValueNet(nn.Module):
    def __init__(self, in_dim: int, hidden_sizes: list[int]) -> None:
        super().__init__()
        self.body = Mlp(in_dim, hidden_sizes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.tanh(self.body(x))


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def build_groups(rows: list[dict]) -> list[dict]:
    """Reassemble decision groups from flat rows keyed by decisionId."""
    by_decision: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        decision_id = row.get("decisionId")
        if decision_id:
            by_decision[decision_id].append(row)

    groups: list[dict] = []
    for decision_rows in by_decision.values():
        if len(decision_rows) < 2:
            continue
        chosen_indices = [
            i for i, row in enumerate(decision_rows) if row.get("chosen")
        ]
        if len(chosen_indices) != 1:
            continue
        chosen_index = chosen_indices[0]
        state = decision_rows[chosen_index].get("stateFeatures")
        if state is None:
            continue
        # AlphaZero-style policy target from ISMCTS visit counts, when collected.
        visits = [row.get("searchVisits") for row in decision_rows]
        search_target = None
        if all(v is not None for v in visits):
            total = float(sum(visits))
            if total > 0:
                search_target = [float(v) / total for v in visits]
        groups.append(
            {
                "features": [row["features"] for row in decision_rows],
                "state": state,
                "chosen": chosen_index,
                "label": float(decision_rows[0].get("label", 0)),
                "search_target": search_target,
            }
        )
    return groups


def parse_hidden(raw: str | None, default: list[int]) -> list[int]:
    if raw is None or raw.strip() == "":
        return list(default)
    return [int(part.strip()) for part in raw.split(",") if part.strip()]


def export_layers(mlp: nn.Module) -> list[dict]:
    layers = []
    for linear in [m for m in mlp.modules() if isinstance(m, nn.Linear)]:
        layers.append(
            {
                "inSize": linear.in_features,
                "outSize": linear.out_features,
                "weights": linear.weight.detach().flatten().tolist(),
                "bias": linear.bias.detach().tolist(),
            }
        )
    return layers


def export_json(
    policy: Mlp,
    value: ValueNet,
    path: Path,
    policy_hidden: list[int],
    value_hidden: list[int],
) -> None:
    payload = {
        "version": MODEL_VERSION,
        "policyFeatureDim": POLICY_FEATURE_DIM,
        "valueFeatureDim": STATE_FEATURE_DIM,
        "policyHiddenSizes": policy_hidden,
        "valueHiddenSizes": value_hidden,
        "policyLayers": export_layers(policy),
        "valueLayers": export_layers(value.body),
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def export_onnx(policy: Mlp, value: ValueNet, out_dir: Path) -> None:
    policy.eval()
    value.eval()
    # Modern (dynamo) exporter, saved self-contained (external_data=False) so there
    # is no `.onnx.data` sidecar to track/copy. Batch dim is fixed at export; the
    # authoritative artifact is the JSON (TS fallback), so this ONNX is a
    # convenience — when browser ONNX inference is wired, re-export with
    # dynamic_shapes for a variable candidate-batch dimension.
    torch.onnx.export(
        policy,
        (torch.zeros(1, POLICY_FEATURE_DIM, dtype=torch.float32),),
        input_names=["features"],
        output_names=["logit"],
        dynamo=True,
        verbose=False,
    ).save(str(out_dir / "omega-policy-v1.onnx"), external_data=False)
    torch.onnx.export(
        value,
        (torch.zeros(1, STATE_FEATURE_DIM, dtype=torch.float32),),
        input_names=["state"],
        output_names=["value"],
        dynamo=True,
        verbose=False,
    ).save(str(out_dir / "omega-value-v1.onnx"), external_data=False)


def load_init(policy: Mlp, value: ValueNet, path: Path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))

    def copy_into(module: nn.Module, layers: list[dict]) -> int:
        linears = [m for m in module.modules() if isinstance(m, nn.Linear)]
        copied = 0
        for linear, layer in zip(linears, layers):
            if (
                linear.in_features != layer.get("inSize")
                or linear.out_features != layer.get("outSize")
            ):
                break
            w = torch.tensor(layer["weights"], dtype=torch.float32).reshape(
                layer["outSize"], layer["inSize"]
            )
            linear.weight.data.copy_(w)
            linear.bias.data.copy_(torch.tensor(layer["bias"], dtype=torch.float32))
            copied += 1
        return copied

    p = copy_into(policy, payload.get("policyLayers", []))
    v = copy_into(value.body, payload.get("valueLayers", []))
    print(f"Warm-started policy {p} layers, value {v} layers from {path}")


def train(args: argparse.Namespace) -> None:
    rows = load_jsonl(args.data)
    if not rows:
        raise SystemExit(f"No rows in {args.data}")

    groups = build_groups(rows)
    if not groups:
        raise SystemExit(
            "No usable decision groups. Collect with OMEGA_* self-play first."
        )

    policy_hidden = parse_hidden(args.policy_hidden, DEFAULT_POLICY_HIDDEN)
    value_hidden = parse_hidden(args.value_hidden, DEFAULT_VALUE_HIDDEN)

    device = resolve_device()
    policy = Mlp(POLICY_FEATURE_DIM, policy_hidden).to(device)
    value = ValueNet(STATE_FEATURE_DIM, value_hidden).to(device)

    if args.init and args.init.exists():
        load_init(policy, value, args.init)
    elif args.init:
        print(f"No init weights at {args.init}; training from scratch.")

    win_groups = sum(1 for g in groups if g["label"] > 0)
    search_groups = sum(1 for g in groups if g.get("search_target") is not None)
    print(
        f"Decision groups: {len(groups)} (win={win_groups}, loss={len(groups) - win_groups}, "
        f"search-target={search_groups}) "
        f"device={device.type} policy_hidden={policy_hidden} value_hidden={value_hidden} "
        f"value_coef={args.value_coef} entropy_coef={args.entropy_coef} "
        f"adv_clip={args.adv_clip} grad_clip={args.grad_clip}"
    )

    dataset = DecisionDataset(groups)
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate_padded,
    )
    optimizer = torch.optim.Adam(
        list(policy.parameters()) + list(value.parameters()), lr=args.lr
    )

    for epoch in range(args.epochs):
        policy.train()
        value.train()
        pol_total = 0.0
        val_total = 0.0
        seen = 0
        correct = 0

        for batch in loader:
            features = batch["features"].to(device)  # [B, C, 303]
            mask = batch["mask"].to(device)  # [B, C] bool
            state = batch["state"].to(device)  # [B, 195]
            chosen = batch["chosen"].to(device)  # [B]
            label = batch["label"].to(device)  # [B]
            b, c, _ = features.shape

            optimizer.zero_grad()

            value_pred = value(state)  # [B]
            value_loss = F.mse_loss(value_pred, label)
            advantage = (label - value_pred).detach()  # [B]
            # Standardize advantages within the batch (zero mean, unit variance).
            # This is the key REINFORCE variance reducer: it makes the policy learn
            # *relative* move quality this batch instead of pushing every losing-seat
            # move down uniformly (which just diverges the logits). Then clamp the
            # standardized values so no single decision dominates the update.
            if advantage.numel() > 1:
                advantage = (advantage - advantage.mean()) / (advantage.std() + 1e-6)
            advantage = advantage.clamp(-args.adv_clip, args.adv_clip)

            logits = policy(features.reshape(b * c, POLICY_FEATURE_DIM)).reshape(b, c)
            # Finite mask fill — `-inf` + soft/log_softmax is fine, but `0 * -inf`
            # later (padded search targets) becomes NaN on MPS/CPU.
            logits = logits.masked_fill(~mask, -1e9)
            log_probs = F.log_softmax(logits, dim=1)  # [B, C]
            # Zero padded slots so CE/entropy never multiply mass×(-inf).
            safe_log_probs = torch.where(mask, log_probs, torch.zeros_like(log_probs))
            probs = torch.where(mask, log_probs.exp(), torch.zeros_like(log_probs))

            search_target = batch["search_target"].to(device)  # [B, C]
            has_search = batch["has_search"].to(device)  # [B] bool

            # REINFORCE loss (sampled move, advantage-weighted) — used where no search.
            chosen_log_prob = safe_log_probs.gather(1, chosen.unsqueeze(1)).squeeze(1)
            reinforce = -(chosen_log_prob * advantage)  # [B]

            # AlphaZero cross-entropy against the ISMCTS visit distribution — used
            # where search targets exist. Far lower variance than REINFORCE.
            ce = -(search_target * safe_log_probs).sum(dim=1)  # [B]

            per_group = torch.where(has_search, ce, reinforce)
            policy_loss = per_group.mean()

            entropy = -(probs * safe_log_probs).sum(dim=1).mean()

            loss = (
                policy_loss
                + args.value_coef * value_loss
                - args.entropy_coef * entropy
            )
            if not torch.isfinite(loss):
                print(
                    f"  !! non-finite loss (policy={float(policy_loss):.4g} "
                    f"value={float(value_loss):.4g} entropy={float(entropy):.4g}); skipping batch"
                )
                continue
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                list(policy.parameters()) + list(value.parameters()),
                args.grad_clip,
            )
            optimizer.step()

            pol_total += float(policy_loss.detach()) * b
            val_total += float(value_loss.detach()) * b
            correct += int((logits.argmax(dim=1) == chosen).sum().item())
            seen += b

        acc = correct / max(seen, 1)
        print(
            f"epoch {epoch + 1}/{args.epochs} "
            f"policy={pol_total / max(seen, 1):.4f} "
            f"value={val_total / max(seen, 1):.4f} "
            f"policy_top1={acc:.3f}"
        )

    # Export from CPU copies so weights serialize identically regardless of device.
    policy = policy.to("cpu")
    value = value.to("cpu")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    export_json(policy, value, args.out_dir / "omega-v1.json", policy_hidden, value_hidden)
    try:
        export_onnx(policy, value, args.out_dir)
        print(f"Wrote {args.out_dir / 'omega-policy-v1.onnx'} + omega-value-v1.onnx")
    except Exception as error:  # noqa: BLE001 - ONNX export is best-effort
        print(f"ONNX export skipped: {error}")
    print(f"Wrote {args.out_dir / 'omega-v1.json'}")


def env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw not in (None, "") else default


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw not in (None, "") else default


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description="Train Class Ω policy/value net")
    parser.add_argument(
        "--data",
        type=Path,
        default=root / "tools/nn/data/omega-trajectories.jsonl",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=root / "apps/Warp12/public/models",
    )
    parser.add_argument(
        "--policy-hidden",
        default=os.environ.get("OMEGA_POLICY_HIDDEN", ""),
        help="Comma-separated policy hidden widths (default 256,256)",
    )
    parser.add_argument(
        "--value-hidden",
        default=os.environ.get("OMEGA_VALUE_HIDDEN", ""),
        help="Comma-separated value hidden widths (default 256,128)",
    )
    parser.add_argument(
        "--init",
        type=Path,
        default=None,
        help="Warm-start from a prior omega-v1.json (never from Commander).",
    )
    parser.add_argument(
        "--value-coef", type=float, default=env_float("OMEGA_VALUE_COEF", 1.0)
    )
    parser.add_argument(
        "--entropy-coef", type=float, default=env_float("OMEGA_ENTROPY_COEF", 0.05)
    )
    parser.add_argument(
        "--adv-clip", type=float, default=env_float("OMEGA_ADV_CLIP", 3.0),
        help="Clamp standardized advantage (z-score) magnitude (default 3.0 = 3σ)",
    )
    parser.add_argument(
        "--grad-clip", type=float, default=env_float("OMEGA_GRAD_CLIP", 1.0),
        help="Max gradient norm (default 1.0)",
    )
    parser.add_argument("--epochs", type=int, default=env_int("OMEGA_EPOCHS", 8))
    parser.add_argument("--batch-size", type=int, default=env_int("OMEGA_BATCH", 512))
    parser.add_argument("--lr", type=float, default=env_float("OMEGA_LR", 3e-4))
    train(parser.parse_args())


if __name__ == "__main__":
    main()
