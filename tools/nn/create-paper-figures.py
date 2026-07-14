#!/usr/bin/env python3
"""
Generate additional figures for TEI paper (Sections 3, 4, 5, 7).
Complements the 5 figures from Section 8 (luck/skill analysis).
Uses OpenSkill rating system.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import seaborn as sns
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import json

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['font.size'] = 10
plt.rcParams['font.family'] = 'DejaVu Sans'  # Better Unicode support
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9

output_dir = 'tools/nn/figures/'

print("Generating additional paper figures...")

CREAM = "#F7F3EA"
NAVY = "#0B1F33"
TEAL = "#1C6E8C"
AMBER = "#D4A017"
CORAL = "#C23B22"
MOSS = "#3D6B4F"

# ============================================================================
# Figure 6: OpenSkill TEI Ladder (μ ± σ)
# ============================================================================
print("  Figure 6: OpenSkill TEI ladder visualization...")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12.5, 5.4))
fig.patch.set_facecolor(CREAM)
for ax in (ax1, ax2):
    ax.set_facecolor(CREAM)

# Calibrated anchors from libs/engine/.../anchors.ts
classes = ["Ensign\n(Class IV)", "Lieutenant\n(Class III)", "Commander\n(Class II)"]
points_mu = np.array([18.0, 26.5, 35.0])
points_sigma = np.array([4.0, 3.5, 3.0])
goout_mu = np.array([17.5, 28.0, 41.5])
goout_sigma = np.array([4.5, 4.0, 3.5])
# Display rating = μ - 3σ (floored at 0)
points_display = np.maximum(0, points_mu - 3 * points_sigma)
goout_display = np.maximum(0, goout_mu - 3 * goout_sigma)

x_pos = np.arange(len(classes))
width = 0.36

bars1 = ax1.bar(
    x_pos - width / 2,
    points_mu,
    width,
    yerr=points_sigma,
    capsize=5,
    label="Points μ ± σ",
    color=TEAL,
    ecolor=NAVY,
    alpha=0.9,
    edgecolor=NAVY,
    linewidth=0.5,
)
bars2 = ax1.bar(
    x_pos + width / 2,
    goout_mu,
    width,
    yerr=goout_sigma,
    capsize=5,
    label="Go-out μ ± σ",
    color=CORAL,
    ecolor=NAVY,
    alpha=0.85,
    edgecolor=NAVY,
    linewidth=0.5,
)
ax1.scatter(
    x_pos - width / 2,
    points_display,
    marker="D",
    s=45,
    color=AMBER,
    zorder=5,
    label="Display (μ−3σ)",
)
ax1.scatter(x_pos + width / 2, goout_display, marker="D", s=45, color=AMBER, zorder=5)
ax1.set_ylabel("OpenSkill μ (skill mean)")
ax1.set_title("Calibrated AI anchors (μ ± σ)")
ax1.set_xticks(x_pos)
ax1.set_xticklabels(classes)
ax1.legend(loc="upper left", fontsize=8)
ax1.grid(axis="y", alpha=0.3)
ax1.set_ylim(0, 50)

for i, (pm, pd, gm, gd) in enumerate(
    zip(points_mu, points_display, goout_mu, goout_display)
):
    ax1.text(i - width / 2, pm + points_sigma[i] + 0.8, f"μ={pm:.1f}", ha="center", fontsize=7)
    ax1.text(i + width / 2, gm + goout_sigma[i] + 0.8, f"μ={gm:.1f}", ha="center", fontsize=7)

# Right: grade letter from σ + score from display rating
grades = ["P / I", "I / C", "C / V"]
ax2.barh(
    np.arange(3),
    [points_sigma[2], points_sigma[1], points_sigma[0]][::-1],
    color=[MOSS, TEAL, CORAL][::-1],
    edgecolor=NAVY,
    height=0.55,
)
# Actually clearer: show TEI Grade mapping as text panels
ax2.clear()
ax2.set_facecolor(CREAM)
ax2.axis("off")
ax2.set_xlim(0, 10)
ax2.set_ylim(0, 10)
ax2.set_title("TEI Grade presentation layer", pad=12)

grade_rows = [
    ("E", "σ < 0.5", "Elite"),
    ("V", "σ < 1.5", "Veteran"),
    ("C", "σ < 2.5", "Consistent"),
    ("I", "σ < 4.0", "Improving"),
    ("P", "σ ≥ 4.0", "Provisional"),
]
for i, (letter, thresh, name) in enumerate(grade_rows):
    y = 8.5 - i * 1.35
    ax2.add_patch(
        plt.Rectangle((0.4, y - 0.45), 1.2, 0.9, facecolor=TEAL if i < 3 else CORAL, alpha=0.85, edgecolor=NAVY)
    )
    ax2.text(1.0, y, letter, ha="center", va="center", fontsize=16, fontweight="bold", color="white")
    ax2.text(2.0, y, f"{name}  ·  {thresh}", ha="left", va="center", fontsize=10, color=NAVY)

ax2.text(
    5.0,
    1.2,
    "Display format: letter + 0–99 score\n"
    "Score ∝ clamp(μ − 3σ) over [10, 50]\n"
    "Example: Commander μ=35, σ=3 → display≈26 → mid/high score",
    ha="left",
    va="center",
    fontsize=9,
    color=NAVY,
    bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor=NAVY, alpha=0.9),
)

plt.tight_layout()
plt.savefig(f"{output_dir}figure6-tei-ladder.png", bbox_inches="tight", dpi=180, facecolor=CREAM)
plt.close()
print(f"    ✓ Saved figure6-tei-ladder.png")

# ============================================================================
# Figure 7: Calibration Matrix Heatmap
# ============================================================================
print("  Figure 7: Calibration matrix heatmap...")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
fig.patch.set_facecolor(CREAM)
for ax in (ax1, ax2):
    ax.set_facecolor(CREAM)

classes_short = ["IV", "III", "II"]

# From openskill-calibration-log.md (2,000 games) — row=player, col=opponent win rate
# Points: EvsL=15.7%, EvsC=9.2%, LvsC=36.3% (weaker viewpoint)
# Matrix of P(row beats col):
points_matrix = np.array(
    [
        [0.50, 0.157, 0.092],  # IV vs IV/III/II
        [0.843, 0.50, 0.363],  # III
        [0.908, 0.637, 0.50],  # II
    ]
)
goout_matrix = np.array(
    [
        [0.50, 0.430, 0.384],
        [0.570, 0.50, 0.441],
        [0.616, 0.559, 0.50],
    ]
)

im1 = ax1.imshow(points_matrix, cmap="RdYlGn", vmin=0.3, vmax=0.95, aspect="auto")
ax1.set_xticks(np.arange(3))
ax1.set_yticks(np.arange(3))
ax1.set_xticklabels(classes_short)
ax1.set_yticklabels(classes_short)
ax1.set_xlabel("Opponent Class")
ax1.set_ylabel("Player Class")
ax1.set_title("Points: win rates (2,000 games)")
for i in range(3):
    for j in range(3):
        ax1.text(j, i, f"{points_matrix[i, j]:.2f}", ha="center", va="center", color="black", fontsize=10)
plt.colorbar(im1, ax=ax1, label="Win rate", fraction=0.046)

im2 = ax2.imshow(goout_matrix, cmap="RdYlGn", vmin=0.3, vmax=0.95, aspect="auto")
ax2.set_xticks(np.arange(3))
ax2.set_yticks(np.arange(3))
ax2.set_xticklabels(classes_short)
ax2.set_yticklabels(classes_short)
ax2.set_xlabel("Opponent Class")
ax2.set_ylabel("Player Class")
ax2.set_title("Go-out: compressed win rates (2,000 games)")
for i in range(3):
    for j in range(3):
        ax2.text(j, i, f"{goout_matrix[i, j]:.2f}", ha="center", va="center", color="black", fontsize=10)
plt.colorbar(im2, ax=ax2, label="Win rate", fraction=0.046)

plt.tight_layout()
plt.savefig(f"{output_dir}figure7-calibration-matrix.png", bbox_inches="tight", dpi=180, facecolor=CREAM)
plt.close()
print(f"    ✓ Saved figure7-calibration-matrix.png")

# ============================================================================
# Figure 8: Class I*/Admiral/Ω Bench Results
# ============================================================================
print("  Figure 8: AI bench results comparison...")

fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# Top-left: Class I* iterations
ax = axes[0, 0]
iterations = ['v1\n(go-out)', 'v2\n(points)', 'v3\n(RL regret)']
win_rates = [48.6, 51.0, 49.2]
colors = ['#d62728', '#2ca02c', '#ff7f0e']

bars = ax.bar(iterations, win_rates, color=colors, alpha=0.7, edgecolor='black')
ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='Parity (50%)')
ax.set_ylabel('Win Rate vs Commander (%)')
ax.set_title('Class I* Neural Residual (MLP)')
ax.set_ylim(45, 55)
ax.legend()
ax.grid(axis='y', alpha=0.3)

for bar, rate in zip(bars, win_rates):
    ax.text(bar.get_x() + bar.get_width()/2, rate + 0.3,
           f'{rate}%', ha='center', va='bottom', fontsize=9)

# Top-right: Fleet Admiral search backends
ax = axes[0, 1]
backends = ['Expectimax\n(2p points)', 'Expectimax\n(2p go-out)', 'ISMCTS\n(2p points)', 'ISMCTS\n(4p go-out)']
win_rates_fa = [64.4, 55.8, 51.1, 31.2]
colors_fa = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78']

bars = ax.bar(backends, win_rates_fa, color=colors_fa, alpha=0.7, edgecolor='black')
ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='Parity (50%)')
ax.axhline(y=25, color='gray', linestyle=':', alpha=0.5, label='Random (25% @ 4p)')
ax.set_ylabel('Win Rate / Sector Win Rate (%)')
ax.set_title('Fleet Admiral Search Backends (500-1500 games)')
ax.legend()
ax.grid(axis='y', alpha=0.3)

for bar, rate in zip(bars, win_rates_fa):
    ax.text(bar.get_x() + bar.get_width()/2, rate + 1,
           f'{rate}%', ha='center', va='bottom', fontsize=9)

# Bottom-left: Ω fair-share by fleet size (points)
ax = axes[1, 0]
fleet_sizes = [2, 3, 4, 5, 6, 7, 8]
fair_share_points = [1.03, 1.15, 1.24, 1.38, 1.52, 1.68, 1.72]

ax.plot(fleet_sizes, fair_share_points, 'o-', color='steelblue', linewidth=2, markersize=8, label='Points')
ax.axhline(y=1.0, color='gray', linestyle='--', alpha=0.5, label='Parity (1.0×)')
ax.axhline(y=1.38, color='coral', linestyle=':', alpha=0.7, label='Mean (1.38×)')
ax.set_xlabel('Fleet Size (players)')
ax.set_ylabel('Ω / Commander Fair-Share')
ax.set_title('Class Ω Fair-Share vs Fleet Size (200g/slice)')
ax.set_xticks(fleet_sizes)
ax.legend()
ax.grid(alpha=0.3)

# Bottom-right: Fair-share hazard (naive rating translation vs tempered)
ax = axes[1, 1]
fair_share = np.array([1.03, 1.15, 1.24, 1.38, 1.52, 1.68, 1.72])
naive_rating_delta = 400 * np.log10(fair_share)  # Naive translation
tempered_ref = 1520  # Actual v2 anchor
naive_ref = 1400 + naive_rating_delta  # What naive formula would give

ax.plot(fleet_sizes, naive_ref, 's--', color='red', linewidth=2, markersize=6, label='Naive (400 log10(fs))', alpha=0.7)
ax.axhline(y=tempered_ref, color='green', linestyle='-', linewidth=2, label='Tempered REF (1520)', alpha=0.8)
ax.axhline(y=1400, color='gray', linestyle=':', alpha=0.5, label='v1 Commander (1400)')
ax.set_xlabel('Fleet Size (players)')
ax.set_ylabel('Class II REF Rating (Points)')
ax.set_title('Fair-Share → Rating Hazard (naive: 400 log10(fs))')
ax.set_xticks(fleet_sizes)
ax.set_ylim(1350, 1700)
ax.legend()
ax.grid(alpha=0.3)

plt.tight_layout()
plt.savefig(f'{output_dir}figure8-ai-bench-results.png', bbox_inches='tight', dpi=150)
plt.close()
print(f"    ✓ Saved figure8-ai-bench-results.png")

# ============================================================================
# Figure 9: Architecture Diagrams
# ============================================================================
print("  Figure 9: Architecture diagrams...")

fig = plt.figure(figsize=(14, 10))
gs = fig.add_gridspec(3, 2, hspace=0.4, wspace=0.3)

# Top: Policy Stack
ax1 = fig.add_subplot(gs[0, :])
ax1.set_xlim(0, 10)
ax1.set_ylim(0, 2)
ax1.axis('off')
ax1.set_title('Policy Stack (Heuristic Agent)', fontsize=12, weight='bold', pad=20)

boxes = [
    (0.5, 'Legal\nMoves', 'lightblue'),
    (2.0, 'Heuristic\nScoring', 'lightgreen'),
    (3.5, 'Temperature\n+ Blunder', 'lightyellow'),
    (5.0, 'Lookahead\n(optional)', 'lightcoral'),
    (6.5, 'Action\nSelection', 'plum'),
    (8.0, 'Engine\nApply', 'lightgray')
]

for i, (x, label, color) in enumerate(boxes):
    box = FancyBboxPatch((x, 0.5), 1.2, 1.0, boxstyle="round,pad=0.05",
                         edgecolor='black', facecolor=color, linewidth=2)
    ax1.add_patch(box)
    ax1.text(x + 0.6, 1.0, label, ha='center', va='center', fontsize=9, weight='bold')
    
    if i < len(boxes) - 1:
        arrow = FancyArrowPatch((x + 1.2, 1.0), (boxes[i+1][0], 1.0),
                               arrowstyle='->', mutation_scale=20, linewidth=2, color='black')
        ax1.add_patch(arrow)

# Middle-left: Class I* Architecture
ax2 = fig.add_subplot(gs[1, 0])
ax2.set_xlim(0, 5)
ax2.set_ylim(0, 7)
ax2.axis('off')
ax2.set_title('Class I* Residual MLP', fontsize=11, weight='bold')

# Draw network
y_positions = [6, 4.5, 3, 1.5]
layer_labels = ['Features\n(303 dim)', 'Hidden\n(256)', 'Hidden\n(256)', 'Residual\n(scalar)']
layer_sizes = [10, 6, 6, 1]

for i, (y, label, size) in enumerate(zip(y_positions, layer_labels, layer_sizes)):
    if size > 1:
        for j in range(size):
            circle = plt.Circle((2.5, y - 0.15*j), 0.08, color='steelblue', ec='black', linewidth=1)
            ax2.add_patch(circle)
    else:
        circle = plt.Circle((2.5, y), 0.12, color='coral', ec='black', linewidth=2)
        ax2.add_patch(circle)
    
    ax2.text(1.0, y if size == 1 else y - 0.15*(size-1)/2, label, ha='right', va='center', fontsize=9)
    
    if i < len(y_positions) - 1:
        ax2.plot([2.5, 2.5], [y_positions[i] - 0.3, y_positions[i+1] + 0.3], 'k-', linewidth=1, alpha=0.3)

ax2.text(2.5, 0.5, 'final_score = heuristic + α·residual', ha='center', fontsize=9, style='italic',
        bbox=dict(boxstyle='round', facecolor='lightyellow', alpha=0.7))

# Middle-right: Class Ω Architecture
ax3 = fig.add_subplot(gs[1, 1])
ax3.set_xlim(0, 6)
ax3.set_ylim(0, 7)
ax3.axis('off')
ax3.set_title('Class Ω Policy/Value', fontsize=11, weight='bold')

# Shared trunk
ax3.text(3, 6, 'State+Action\n(303 dim)', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightblue', edgecolor='black', linewidth=1.5))

# Policy head (left)
ax3.text(1.5, 4, 'Policy MLP', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightgreen', edgecolor='black', linewidth=1.5))
ax3.text(1.5, 2, 'Softmax', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightyellow', edgecolor='black', linewidth=1.5))
ax3.text(1.5, 0.5, 'Action Logits', ha='center', va='center', fontsize=8, style='italic')

# Value head (right)
ax3.text(4.5, 4, 'Value MLP\n(195 dim)', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightcoral', edgecolor='black', linewidth=1.5))
ax3.text(4.5, 2, 'tanh', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightyellow', edgecolor='black', linewidth=1.5))
ax3.text(4.5, 0.5, 'E[outcome]', ha='center', va='center', fontsize=8, style='italic')

# Arrows
for x_target in [1.5, 4.5]:
    ax3.annotate('', xy=(x_target, 4.5), xytext=(3, 5.5),
                arrowprops=dict(arrowstyle='->', lw=2, color='black'))
    ax3.annotate('', xy=(x_target, 2.5), xytext=(x_target, 3.5),
                arrowprops=dict(arrowstyle='->', lw=2, color='black'))

# Bottom: Fleet Admiral Multi-Engine Routing
ax4 = fig.add_subplot(gs[2, :])
ax4.set_xlim(0, 10)
ax4.set_ylim(0, 3)
ax4.axis('off')
ax4.set_title('Fleet Admiral Multi-Engine Routing', fontsize=12, weight='bold', pad=20)

# Root
ax4.text(5, 2.5, 'Game State', ha='center', va='center', fontsize=10,
        bbox=dict(boxstyle='round', facecolor='lightgray', edgecolor='black', linewidth=2))

# Decision node
ax4.text(5, 1.5, 'Player Count?', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='lightyellow', edgecolor='black', linewidth=1.5))

# Branches
ax4.text(2, 0.5, 'Expectimax\n(2p, depth 3-4)', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='#aec7e8', edgecolor='black', linewidth=1.5))
ax4.text(5, 0.5, 'ISMCTS\n(3+ players)', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='#ffbb78', edgecolor='black', linewidth=1.5))
ax4.text(8, 0.5, 'Commander\n(advisor UI)', ha='center', va='center', fontsize=9,
        bbox=dict(boxstyle='round', facecolor='#98df8a', edgecolor='black', linewidth=1.5))

# Arrows
ax4.annotate('', xy=(5, 2.0), xytext=(5, 1.8), arrowprops=dict(arrowstyle='->', lw=2))
for x in [2, 5, 8]:
    ax4.annotate('', xy=(x, 1.0), xytext=(5, 1.2), arrowprops=dict(arrowstyle='->', lw=1.5))

plt.savefig(f'{output_dir}figure9-architectures.png', bbox_inches='tight', dpi=150)
plt.close()
print(f"    ✓ Saved figure9-architectures.png")

# ============================================================================
# Figure 10: Points vs Go-Out Strategic Divergence
# ============================================================================
print("  Figure 10: Points vs Go-out strategic divergence...")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.6))
fig.patch.set_facecolor(CREAM)
for ax in (ax1, ax2):
    ax.set_facecolor(CREAM)

# Left: Actual vs implied μ gaps from openskill-calibration-log.md
ax = ax1
matchups = ["Ensign vs\nLieutenant", "Lieutenant vs\nCommander", "Ensign vs\nCommander"]
# Anchored |Δμ|
points_actual = [8.5, 8.5, 17.0]
points_implied = [7.0, 2.3, 9.5]  # from observed win rates
goout_actual = [10.5, 13.5, 24.0]
goout_implied = [1.2, 1.0, 2.0]

x = np.arange(len(matchups))
width = 0.2
ax.bar(x - 1.5 * width, points_actual, width, label="Points |Δμ| anchor", color=TEAL, alpha=0.9)
ax.bar(x - 0.5 * width, points_implied, width, label="Points |Δμ| implied", color=TEAL, alpha=0.45)
ax.bar(x + 0.5 * width, goout_actual, width, label="Go-out |Δμ| anchor", color=CORAL, alpha=0.9)
ax.bar(x + 1.5 * width, goout_implied, width, label="Go-out |Δμ| implied", color=CORAL, alpha=0.45)
ax.set_ylabel("|Δμ| (OpenSkill skill gap)")
ax.set_title("Anchor gaps vs gaps implied by win rates")
ax.set_xticks(x)
ax.set_xticklabels(matchups)
ax.legend(fontsize=7.5, loc="upper left")
ax.grid(axis="y", alpha=0.3)

# Right: win rates (stronger beats weaker)
ax = ax2
scenarios = ["III beats IV", "II beats III", "II beats IV"]
points_wr = [0.843, 0.637, 0.908]
goout_wr = [0.570, 0.559, 0.616]
x2 = np.arange(len(scenarios))
w = 0.35
ax.bar(x2 - w / 2, points_wr, w, label="Points", color=TEAL, alpha=0.9)
ax.bar(x2 + w / 2, goout_wr, w, label="Go-out", color=CORAL, alpha=0.9)
ax.axhline(0.5, color="gray", linestyle="--", alpha=0.5)
ax.set_ylabel("Win rate (higher-skill captain)")
ax.set_title("Skill ordering preserved; go-out compressed")
ax.set_xticks(x2)
ax.set_xticklabels(scenarios)
ax.set_ylim(0, 1)
ax.legend()
ax.grid(axis="y", alpha=0.3)
for i, (p, g) in enumerate(zip(points_wr, goout_wr)):
    ax.text(i - w / 2, p + 0.02, f"{p:.0%}", ha="center", fontsize=8)
    ax.text(i + w / 2, g + 0.02, f"{g:.0%}", ha="center", fontsize=8)

plt.tight_layout()
plt.savefig(f"{output_dir}figure10-points-vs-goout.png", bbox_inches="tight", dpi=180, facecolor=CREAM)
plt.close()
print(f"    ✓ Saved figure10-points-vs-goout.png")

print()
print("=" * 70)
print("ALL ADDITIONAL FIGURES GENERATED")
print("=" * 70)
print("  • figure6-tei-ladder.png (OpenSkill μ±σ anchors + TEI grades)")
print("  • figure7-calibration-matrix.png (2k-game win rate heatmaps)")
print("  • figure8-ai-bench-results.png (Class I*/Admiral/Ω performance)")
print("  • figure9-architectures.png (Policy stack + neural architectures)")
print("  • figure10-points-vs-goout.png (Δμ compression)")
print("=" * 70)
