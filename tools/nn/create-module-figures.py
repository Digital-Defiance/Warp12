#!/usr/bin/env python3
"""
Publication figures for the Module Balance study (285k games).
Reads tools/nn/data/luck-skill-w*-p*-m*.json and writes PNGs to tools/nn/figures/.
"""

from __future__ import annotations

import glob
import json
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

sns.set_style("whitegrid")
plt.rcParams.update(
    {
        "figure.dpi": 180,
        "savefig.dpi": 220,
        "font.size": 10,
        "font.family": "DejaVu Sans",
        "axes.labelsize": 11,
        "axes.titlesize": 13,
        "axes.titleweight": "bold",
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "legend.fontsize": 9,
    }
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "tools/nn/data"
OUT = ROOT / "tools/nn/figures"
OUT.mkdir(parents=True, exist_ok=True)

# Deep-space / federation palette — avoid purple-on-white AI cliché
NAVY = "#0B1F33"
TEAL = "#1C6E8C"
AMBER = "#D4A017"
CORAL = "#C23B22"
SLATE = "#5B6B7A"
MOSS = "#3D6B4F"
CREAM = "#F7F3EA"
WARM = "#E8DFD0"

DISPLAY = {
    "iota": "Iota (Double Down)",
    "all": "All modules",
    "zeta": "Zeta (Squadrons)",
    "alpha": "Alpha (Continuum)",
    "beta": "Beta (Salamander)",
    "delta": "Delta (Spool)",
    "eta": "Eta (Temporal Debt)",
    "gamma": "Gamma (Sensor Grid)",
    "kappa": "Kappa (Inversion)",
    "lambda": "Lambda (Wormholes)",
    "none": "Baseline",
    "theta": "Theta (Longest Trail)",
    "mu": "Mu (Fracture)",
    "official": "Official Warp 12",
    "epsilon": "Epsilon (Drafting)",
}

ORDER = [
    "iota",
    "all",
    "zeta",
    "alpha",
    "beta",
    "delta",
    "eta",
    "gamma",
    "kappa",
    "lambda",
    "none",
    "theta",
    "mu",
    "official",
    "epsilon",
]


def eligible_zeta(player_count: int) -> bool:
    return player_count >= 4 and player_count % 2 == 0


def load_results() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(DATA.glob("luck-skill-w*-p*-m*.json")):
        data = json.loads(path.read_text())
        if data.get("skipped"):
            continue
        # Legacy ineligible Zeta runs ≈ baseline noise; exclude from Zeta claims.
        if data["moduleConfig"] == "zeta" and not eligible_zeta(data["playerCount"]):
            continue
        rows.append(data)
    return rows


def module_stats(rows: list[dict]) -> dict[str, dict]:
    by_mod: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_mod[r["moduleConfig"]].append(r)

    stats: dict[str, dict] = {}
    for mod, cfgs in by_mod.items():
        skills = [c["skillIndicators"] for c in cfgs]
        stats[mod] = {
            "n": len(cfgs),
            "avg_skill": float(np.mean(skills)),
            "skill_dom": sum(1 for s in skills if s >= 3),
            "luck_dom": sum(1 for s in skills if s <= 1),
            "mixed": sum(1 for s in skills if s == 2),
            "legal": float(np.mean([c["summary"]["avgLegalMovesPerTurn"] for c in cfgs])),
            "constrained": float(
                np.mean([c["summary"]["avgConstrainedTileFraction"] for c in cfgs])
            ),
            "spread": float(np.mean([c["summary"]["avgMoveValueSpread"] for c in cfgs])),
            "pips": float(np.mean([c["summary"]["avgUniquePipsInHand"] for c in cfgs])),
        }
    return stats


def figure11_ranking(stats: dict[str, dict]) -> None:
    print("  Figure 11: module skill ranking...")
    mods = [m for m in ORDER if m in stats]
    vals = [stats[m]["avg_skill"] for m in mods]
    colors = []
    for m, v in zip(mods, vals):
        if m == "epsilon":
            colors.append(CORAL)  # luck/party Warped
        elif m == "kappa":
            colors.append(AMBER)  # intentional chaos Warped
        elif v >= 2.95:
            colors.append(MOSS)
        elif v >= 2.5:
            colors.append(TEAL)
        else:
            colors.append(SLATE)

    fig, ax = plt.subplots(figsize=(10.5, 7.2))
    fig.patch.set_facecolor(CREAM)
    ax.set_facecolor(CREAM)
    y = np.arange(len(mods))
    bars = ax.barh(y, vals, color=colors, edgecolor=NAVY, linewidth=0.4, height=0.72)
    ax.set_yticks(y)
    ax.set_yticklabels([DISPLAY[m] for m in mods])
    ax.invert_yaxis()
    ax.set_xlim(0, 4.05)
    ax.set_xlabel("Average skill indicators (0–4)")
    ax.set_title(
        "Module skill ceiling across Warp factors & fleet sizes\n"
        "285,000 Commander self-play games · points objective"
    )
    ax.axvline(2.5, color=AMBER, linestyle="--", linewidth=1.4, alpha=0.9, label="Promote ≥ 2.5")
    ax.axvline(1.5, color=CORAL, linestyle=":", linewidth=1.4, alpha=0.9, label="Avoid < 1.5")
    for bar, v, m in zip(bars, vals, mods):
        note = f"{v:.2f}"
        if m == "epsilon":
            note += "  Warped/party"
        elif m == "kappa":
            note += "  Warped"
        elif v >= 2.5:
            note += "  ✓"
        ax.text(
            v + 0.05,
            bar.get_y() + bar.get_height() / 2,
            note,
            va="center",
            fontsize=8.5,
            color=NAVY,
            fontweight="bold" if m in ("iota", "epsilon") else "normal",
        )
    ax.legend(loc="lower right", frameon=True, facecolor="white")
    ax.grid(axis="x", alpha=0.35)
    sns.despine(left=True, bottom=False)
    plt.tight_layout()
    path = OUT / "figure11-module-skill-ranking.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure12_heatmap(rows: list[dict]) -> None:
    print("  Figure 12: module × Warp-factor heatmap...")
    mods = [m for m in ORDER if m != "all"]  # keep panel readable; all is stress meta
    warps = [9, 12, 15, 18]
    grid = np.full((len(mods), len(warps)), np.nan)
    for i, m in enumerate(mods):
        for j, w in enumerate(warps):
            vals = [
                r["skillIndicators"]
                for r in rows
                if r["moduleConfig"] == m and r["warpFactor"] == w
            ]
            if vals:
                grid[i, j] = float(np.mean(vals))

    fig, ax = plt.subplots(figsize=(8.8, 8.2))
    fig.patch.set_facecolor(CREAM)
    cmap = sns.color_palette("crest", as_cmap=True)
    # crest is blue-green; OK. Avoid purple.
    hm = sns.heatmap(
        grid,
        ax=ax,
        annot=True,
        fmt=".2f",
        cmap=cmap,
        vmin=0,
        vmax=4,
        linewidths=0.6,
        linecolor=WARM,
        cbar_kws={"label": "Mean skill indicators", "shrink": 0.85},
        xticklabels=[f"W{w}" for w in warps],
        yticklabels=[DISPLAY[m] for m in mods],
    )
    ax.set_title(
        "Skill indicators by module and Warp factor\n"
        "(averaged over all fleet sizes per cell)"
    )
    ax.set_xlabel("Warp factor")
    ax.set_ylabel("")
    plt.tight_layout()
    path = OUT / "figure12-module-warp-heatmap.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure13_epsilon_collapse(rows: list[dict]) -> None:
    print("  Figure 13: Epsilon collapse vs baseline...")
    fig, axes = plt.subplots(2, 2, figsize=(11.5, 8.5), sharey=True)
    fig.patch.set_facecolor(CREAM)
    warp_colors = {9: "#8FA3B5", 12: TEAL, 15: MOSS, 18: AMBER}

    for ax, warp in zip(axes.flat, [9, 12, 15, 18]):
        ax.set_facecolor(CREAM)
        for mod, color, ls, label in [
            ("none", NAVY, "-", "Baseline"),
            ("iota", MOSS, "-", "Iota"),
            ("epsilon", CORAL, "--", "Epsilon"),
            ("official", AMBER, ":", "Official"),
        ]:
            pts = sorted(
                (
                    r["playerCount"],
                    r["skillIndicators"],
                )
                for r in rows
                if r["moduleConfig"] == mod and r["warpFactor"] == warp
            )
            if not pts:
                continue
            xs, ys = zip(*pts)
            ax.plot(
                xs,
                ys,
                marker="o",
                linewidth=2.0,
                markersize=5.5,
                color=color,
                linestyle=ls,
                label=label,
            )
        ax.set_ylim(-0.15, 4.15)
        ax.set_title(f"Warp {warp}", color=warp_colors[warp])
        ax.set_xlabel("Fleet size")
        ax.set_ylabel("Skill indicators")
        ax.set_yticks([0, 1, 2, 3, 4])
        ax.grid(True, alpha=0.3)

    handles, labels = axes[0, 0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", ncol=4, frameon=True, bbox_to_anchor=(0.5, 1.02))
    fig.suptitle(
        "Module Epsilon collapses skill expression vs baseline / Iota / Official",
        fontsize=13,
        fontweight="bold",
        y=1.06,
    )
    plt.tight_layout()
    path = OUT / "figure13-epsilon-collapse.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure14_metric_profiles(stats: dict[str, dict]) -> None:
    print("  Figure 14: metric profiles for key modules...")
    mods = ["none", "iota", "zeta", "official", "epsilon"]
    metrics = [
        ("legal", "Legal moves / turn", 3.0),
        ("constrained", "Constrained tile fraction", 0.5),
        ("spread", "Move-value spread", 2.0),
        ("pips", "Unique pips in hand", 5.0),
    ]
    # Normalize each metric to [0,1] vs threshold banding for display bars
    raw = {m: [stats[m][k] for k, _, _ in metrics] for m in mods}

    fig, axes = plt.subplots(1, 4, figsize=(13.5, 4.8), sharey=False)
    fig.patch.set_facecolor(CREAM)
    palette = {
        "none": SLATE,
        "iota": MOSS,
        "zeta": TEAL,
        "official": AMBER,
        "epsilon": CORAL,
    }
    x = np.arange(len(mods))
    for ax, (key, title, threshold), idx in zip(axes, metrics, range(4)):
        ax.set_facecolor(CREAM)
        vals = [raw[m][idx] for m in mods]
        bars = ax.bar(
            x,
            vals,
            color=[palette[m] for m in mods],
            edgecolor=NAVY,
            linewidth=0.4,
            width=0.72,
        )
        ax.axhline(threshold, color=NAVY, linestyle="--", linewidth=1.0, alpha=0.55)
        ax.set_xticks(x)
        ax.set_xticklabels([DISPLAY[m].split(" (")[0] for m in mods], rotation=28, ha="right")
        ax.set_title(title)
        ax.grid(axis="y", alpha=0.3)
        for bar, v in zip(bars, vals):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                v,
                f"{v:.2f}" if key != "constrained" else f"{v:.0%}",
                ha="center",
                va="bottom",
                fontsize=8,
            )
        if key == "constrained":
            ax.set_ylim(0, 0.75)
            ax.yaxis.set_major_formatter(lambda y, _: f"{y:.0%}")

    fig.suptitle(
        "Decision-quality profile — Baseline · Iota · Zeta · Official · Epsilon",
        fontsize=13,
        fontweight="bold",
        y=1.03,
    )
    plt.tight_layout()
    path = OUT / "figure14-module-metric-profiles.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure15_w12_fleet_curves(rows: list[dict]) -> None:
    print("  Figure 15: W12 fleet curves for rating-relevant modules...")
    fig, ax = plt.subplots(figsize=(10.5, 5.8))
    fig.patch.set_facecolor(CREAM)
    ax.set_facecolor(CREAM)
    series = [
        ("none", NAVY, "Baseline"),
        ("iota", MOSS, "Iota"),
        ("zeta", TEAL, "Zeta (even fleets)"),
        ("official", AMBER, "Official"),
        ("epsilon", CORAL, "Epsilon"),
        ("all", "#6B4C3B", "All modules"),
    ]
    for mod, color, label in series:
        pts = sorted(
            (r["playerCount"], r["skillIndicators"])
            for r in rows
            if r["moduleConfig"] == mod and r["warpFactor"] == 12
        )
        if not pts:
            continue
        xs, ys = zip(*pts)
        ax.plot(xs, ys, marker="o", linewidth=2.2, markersize=7, color=color, label=label)
    ax.set_ylim(-0.1, 4.2)
    ax.set_xticks(range(2, 9))
    ax.set_xlabel("Fleet size (Warp 12)")
    ax.set_ylabel("Skill indicators")
    ax.set_title("Warp 12 module skill across rated fleet sizes (2–8 captains)")
    ax.legend(frameon=True, ncol=3, loc="lower left")
    ax.grid(True, alpha=0.3)
    sns.despine()
    plt.tight_layout()
    path = OUT / "figure15-w12-module-fleet-curves.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def write_latex_table(stats: dict[str, dict]) -> None:
    table_dir = ROOT / "tools/nn/tables"
    table_dir.mkdir(parents=True, exist_ok=True)
    path = table_dir / "table4-module-ranking.tex"
    lines = [
        "% Auto-generated by create-module-figures.py",
        "\\begin{table}[htbp]",
        "\\centering",
        "\\small",
        "\\caption{Module skill ranking from the 285{,}000-game study "
        "(Commander self-play, points objective, 500 games/cell). "
        "Zeta metrics restricted to even fleets $\\geq$4. "
        "\\emph{Rec} is the product call: Promote = eligible for rated "
        "presets (Zeta gameplay included; FFA TEI still gated on a "
        "squad track); Warped = exhibition only (Epsilon = party luck; "
        "Kappa = intentional score inversion).}",
        "\\label{tab:module-ranking}",
        "\\begin{tabular}{@{}llrrrrrl@{}}",
        "\\toprule",
        "\\textbf{Module} & \\textbf{Rec} & \\textbf{Skill} & "
        "\\textbf{Legal} & \\textbf{Constr.} & \\textbf{Spread} & "
        "\\textbf{Pips} & \\textbf{Skill/Luck} \\\\",
        "\\midrule",
    ]
    for m in ORDER:
        if m not in stats:
            continue
        s = stats[m]
        # Product classification (Warped = exhibition / never FFA-rated):
        # Epsilon collapses skill → party Warped. Kappa inverts scoring → Warped
        # by design. Zeta is skill-promote (FFA TEI gated separately).
        if m == "epsilon":
            rec = "Warped/party"
        elif m == "kappa":
            # Intentional score inversion — Warped by design even if complexity metrics look fine.
            rec = "Warped"
        elif s["avg_skill"] >= 2.5 and s["skill_dom"] > s["luck_dom"]:
            rec = "Promote"
        elif s["avg_skill"] < 1.5:
            rec = "Avoid"
        else:
            rec = "Neutral"
        lines.append(
            f"{DISPLAY[m]} & {rec} & {s['avg_skill']:.2f} & "
            f"{s['legal']:.2f} & {100*s['constrained']:.0f}\\% & "
            f"{s['spread']:.2f} & {s['pips']:.1f} & "
            f"{s['skill_dom']}/{s['mixed']}/{s['luck_dom']} \\\\"
        )
    lines.extend(
        [
            "\\bottomrule",
            "\\end{tabular}",
            "\\end{table}",
            "",
        ]
    )
    path.write_text("\n".join(lines))
    print(f"    ✓ {path.relative_to(ROOT)}")


def figure16_epsilon_deficit(rows: list[dict]) -> None:
    print("  Figure 16: Epsilon skill deficit heatmap...")
    warps = [9, 12, 15, 18]
    # Build per-warp player axis (different lengths) — use NaN-padded common grid 2..18
    players = list(range(2, 19))
    grid = np.full((len(warps), len(players)), np.nan)
    for i, w in enumerate(warps):
        by_p_none = {
            r["playerCount"]: r["skillIndicators"]
            for r in rows
            if r["moduleConfig"] == "none" and r["warpFactor"] == w
        }
        by_p_eps = {
            r["playerCount"]: r["skillIndicators"]
            for r in rows
            if r["moduleConfig"] == "epsilon" and r["warpFactor"] == w
        }
        for j, p in enumerate(players):
            if p in by_p_none and p in by_p_eps:
                grid[i, j] = by_p_eps[p] - by_p_none[p]

    fig, ax = plt.subplots(figsize=(12.5, 4.2))
    fig.patch.set_facecolor(CREAM)
    # Diverging from white — teal for gain, coral for loss; avoid purple
    cmap = sns.diverging_palette(20, 200, as_cmap=True)
    mask = np.isnan(grid)
    sns.heatmap(
        grid,
        ax=ax,
        mask=mask,
        annot=True,
        fmt=".0f",
        cmap=cmap,
        center=0,
        vmin=-3,
        vmax=1,
        linewidths=0.4,
        linecolor=WARM,
        cbar_kws={"label": "Δ skill indicators (Epsilon − Baseline)"},
        xticklabels=players,
        yticklabels=[f"W{w}" for w in warps],
    )
    ax.set_xlabel("Fleet size")
    ax.set_ylabel("")
    ax.set_title("Epsilon skill deficit vs baseline (negative = luck collapse)")
    plt.tight_layout()
    path = OUT / "figure16-epsilon-deficit-heatmap.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure17_iota_lift(rows: list[dict]) -> None:
    print("  Figure 17: Iota move-value-spread lift on W12...")
    pts = []
    for p in range(2, 9):
        iota = next(
            (
                r
                for r in rows
                if r["moduleConfig"] == "iota"
                and r["warpFactor"] == 12
                and r["playerCount"] == p
            ),
            None,
        )
        none = next(
            (
                r
                for r in rows
                if r["moduleConfig"] == "none"
                and r["warpFactor"] == 12
                and r["playerCount"] == p
            ),
            None,
        )
        if iota and none:
            pts.append(
                (
                    p,
                    none["summary"]["avgMoveValueSpread"],
                    iota["summary"]["avgMoveValueSpread"],
                )
            )
    xs = [p[0] for p in pts]
    none_y = [p[1] for p in pts]
    iota_y = [p[2] for p in pts]
    fig, ax = plt.subplots(figsize=(9.5, 5.2))
    fig.patch.set_facecolor(CREAM)
    ax.set_facecolor(CREAM)
    ax.fill_between(xs, none_y, iota_y, color=MOSS, alpha=0.25, label="Iota lift")
    ax.plot(xs, none_y, "o-", color=NAVY, linewidth=2.2, label="Baseline")
    ax.plot(xs, iota_y, "s-", color=MOSS, linewidth=2.2, label="Iota (Double Down)")
    for x, n, i in pts:
        ax.annotate(
            f"+{i - n:.2f}",
            xy=(x, (n + i) / 2),
            ha="center",
            fontsize=8,
            color=MOSS,
            fontweight="bold",
        )
    ax.set_xlabel("Fleet size (Warp 12)")
    ax.set_ylabel("Average move-value spread")
    ax.set_title("Iota raises discriminating pressure on the rated Warp factor")
    ax.legend()
    ax.grid(True, alpha=0.3)
    sns.despine()
    plt.tight_layout()
    path = OUT / "figure17-iota-spread-lift-w12.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure18_outcome_mix(stats: dict[str, dict]) -> None:
    print("  Figure 18: skill/mixed/luck outcome mix...")
    mods = [m for m in ORDER if m in stats]
    skill = np.array([stats[m]["skill_dom"] for m in mods], dtype=float)
    mixed = np.array([stats[m]["mixed"] for m in mods], dtype=float)
    luck = np.array([stats[m]["luck_dom"] for m in mods], dtype=float)
    # normalize to percent of configs
    totals = skill + mixed + luck
    skill_p = 100 * skill / totals
    mixed_p = 100 * mixed / totals
    luck_p = 100 * luck / totals

    fig, ax = plt.subplots(figsize=(11.5, 6.5))
    fig.patch.set_facecolor(CREAM)
    ax.set_facecolor(CREAM)
    y = np.arange(len(mods))
    ax.barh(y, skill_p, color=MOSS, edgecolor=NAVY, linewidth=0.3, label="Skill-dominant (3–4)")
    ax.barh(
        y,
        mixed_p,
        left=skill_p,
        color=AMBER,
        edgecolor=NAVY,
        linewidth=0.3,
        label="Mixed (2)",
    )
    ax.barh(
        y,
        luck_p,
        left=skill_p + mixed_p,
        color=CORAL,
        edgecolor=NAVY,
        linewidth=0.3,
        label="Luck-dominant (0–1)",
    )
    ax.set_yticks(y)
    ax.set_yticklabels([DISPLAY[m] for m in mods])
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("% of configuration cells")
    ax.set_title("Outcome mix across fleet × Warp matrix")
    ax.legend(loc="lower right")
    ax.grid(axis="x", alpha=0.3)
    sns.despine(left=True)
    plt.tight_layout()
    path = OUT / "figure18-module-outcome-mix.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure19_scatter_depth(rows: list[dict]) -> None:
    print("  Figure 19: legal moves vs spread scatter...")
    focus = {
        "none": (NAVY, "Baseline"),
        "iota": (MOSS, "Iota"),
        "epsilon": (CORAL, "Epsilon"),
        "zeta": (TEAL, "Zeta"),
        "official": (AMBER, "Official"),
    }
    fig, ax = plt.subplots(figsize=(9.8, 6.2))
    fig.patch.set_facecolor(CREAM)
    ax.set_facecolor(CREAM)
    for mod, (color, label) in focus.items():
        pts = [
            (
                r["summary"]["avgLegalMovesPerTurn"],
                r["summary"]["avgMoveValueSpread"],
            )
            for r in rows
            if r["moduleConfig"] == mod
        ]
        if not pts:
            continue
        xs, ys = zip(*pts)
        ax.scatter(xs, ys, s=42, alpha=0.7, color=color, edgecolors=NAVY, linewidths=0.3, label=label)
    ax.axvline(3.0, color=SLATE, linestyle="--", alpha=0.5, label="Legal-move threshold (3.0)")
    ax.axhline(2.0, color=SLATE, linestyle=":", alpha=0.5, label="Spread threshold (2.0)")
    ax.set_xlabel("Avg legal moves / turn")
    ax.set_ylabel("Avg move-value spread")
    ax.set_title("Decision breadth vs discriminating depth (every fleet × Warp cell)")
    ax.legend(loc="upper left", frameon=True)
    ax.grid(True, alpha=0.3)
    sns.despine()
    plt.tight_layout()
    path = OUT / "figure19-legal-vs-spread-scatter.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def figure20_constrained_bars(stats: dict[str, dict]) -> None:
    print("  Figure 20: constrained-tile + unique-pips bars...")
    mods = ["iota", "zeta", "none", "official", "epsilon"]
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.8))
    fig.patch.set_facecolor(CREAM)
    palette = {
        "iota": MOSS,
        "zeta": TEAL,
        "none": NAVY,
        "official": AMBER,
        "epsilon": CORAL,
    }
    x = np.arange(len(mods))
    for ax, key, title, fmt in [
        (axes[0], "constrained", "Constrained tile fraction", lambda v: f"{v:.0%}"),
        (axes[1], "pips", "Unique pips in hand", lambda v: f"{v:.1f}"),
    ]:
        ax.set_facecolor(CREAM)
        vals = [stats[m][key] for m in mods]
        bars = ax.bar(
            x,
            vals,
            color=[palette[m] for m in mods],
            edgecolor=NAVY,
            width=0.7,
        )
        ax.set_xticks(x)
        ax.set_xticklabels([DISPLAY[m].split(" (")[0] for m in mods], rotation=20, ha="right")
        ax.set_title(title)
        ax.grid(axis="y", alpha=0.3)
        for bar, v in zip(bars, vals):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                v,
                fmt(v),
                ha="center",
                va="bottom",
                fontsize=8,
            )
        if key == "constrained":
            ax.axhline(0.5, color=SLATE, linestyle="--", alpha=0.6)
            ax.set_ylim(0, 0.75)
            ax.yaxis.set_major_formatter(lambda y, _: f"{y:.0%}")
    fig.suptitle("Hand pressure metrics — key modules", fontweight="bold", y=1.02)
    plt.tight_layout()
    path = OUT / "figure20-hand-pressure-bars.png"
    plt.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close()
    print(f"    ✓ {path.name}")


def main() -> None:
    print("Generating module-analysis paper figures...")
    rows = load_results()
    stats = module_stats(rows)
    print(f"  Loaded {len(rows)} configuration cells")
    figure11_ranking(stats)
    figure12_heatmap(rows)
    figure13_epsilon_collapse(rows)
    figure14_metric_profiles(stats)
    figure15_w12_fleet_curves(rows)
    figure16_epsilon_deficit(rows)
    figure17_iota_lift(rows)
    figure18_outcome_mix(stats)
    figure19_scatter_depth(rows)
    figure20_constrained_bars(stats)
    write_latex_table(stats)
    print("Done.")


if __name__ == "__main__":
    main()
