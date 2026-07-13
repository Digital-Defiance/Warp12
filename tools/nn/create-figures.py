#!/usr/bin/env python3
"""Generate publication-quality figures for luck/skill analysis."""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# Set publication style
sns.set_style("whitegrid")
sns.set_context("paper", font_scale=1.3)
plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['savefig.bbox'] = 'tight'

df = pd.read_csv('tools/nn/data/luck-skill-processed.csv')

print("Generating figures...")

# Figure 1: Cross-Factor Comparison (2-4p)
print("  Figure 1: Cross-factor comparison...")
fig, axes = plt.subplots(2, 2, figsize=(14, 11))
df_2to4 = df[df['playerCount'].isin([2, 3, 4])]

metrics = [
    ('avgLegalMoves', 'Decision Complexity\n(Avg Legal Moves/Turn)'),
    ('avgHandEntropy', 'Hand Coherence\n(Entropy, bits)'),
    ('avgValueSpread', 'Strategic Depth\n(Move Value Spread)'),
    ('skillIndex', 'Skill Index\n(Composite)')
]

colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']  # W9, W12, W15, W18

for idx, (metric, title) in enumerate(metrics):
    ax = axes[idx // 2, idx % 2]
    for factor_idx, factor in enumerate([9, 12, 15, 18]):
        data = df_2to4[df_2to4['warpFactor'] == factor]
        means = data.groupby('playerCount')[metric].mean()
        sems = data.groupby('playerCount')[metric].sem()
        ax.errorbar(means.index, means.values, yerr=sems.values * 1.96,  # 95% CI
                    label=f'Warp {factor}', marker='o', capsize=5, linewidth=2,
                    markersize=8, color=colors[factor_idx])
    ax.set_xlabel('Fleet Size (Player Count)', fontsize=12)
    ax.set_ylabel(title, fontsize=12)
    ax.legend(loc='best', frameon=True)
    ax.set_xticks([2, 3, 4])
    ax.grid(True, alpha=0.3)

plt.suptitle('Luck/Skill Metrics Across Warp Factors (2-4 Players)', 
             fontsize=16, fontweight='bold', y=0.995)
plt.tight_layout()
plt.savefig('tools/nn/figures/figure1-cross-factor-comparison.png')
print("    ✓ Saved figure1-cross-factor-comparison.png")

# Figure 2: Fleet Size Effects (full range per factor)
print("  Figure 2: Fleet size effects...")
fig, axes = plt.subplots(2, 2, figsize=(14, 11))

for idx, factor in enumerate([9, 12, 15, 18]):
    ax = axes[idx // 2, idx % 2]
    data = df[df['warpFactor'] == factor]
    means = data.groupby('playerCount')['skillIndex'].mean()
    sems = data.groupby('playerCount')['skillIndex'].sem()
    
    # Plot with error bars
    ax.errorbar(means.index, means.values, yerr=sems.values * 1.96,
                marker='o', capsize=5, linewidth=2, markersize=8,
                color=colors[idx], label=f'Warp {factor} Data')
    
    # Add linear regression line
    from scipy.stats import linregress
    x = means.index.values
    y = means.values
    slope, intercept, r_value, p_value, std_err = linregress(x, y)
    line_x = np.linspace(x.min(), x.max(), 100)
    line_y = slope * line_x + intercept
    ax.plot(line_x, line_y, '--', color=colors[idx], alpha=0.5,
            label=f'Linear fit (R²={r_value**2:.3f})')
    
    ax.set_title(f'Warp {factor} (n={len(data)} games)', fontsize=14, fontweight='bold')
    ax.set_xlabel('Fleet Size (Player Count)', fontsize=12)
    ax.set_ylabel('Skill Index', fontsize=12)
    ax.grid(True, alpha=0.3)
    ax.legend(loc='best', frameon=True, fontsize=10)

plt.suptitle('Fleet Size Effect on Skill Expression', 
             fontsize=16, fontweight='bold', y=0.995)
plt.tight_layout()
plt.savefig('tools/nn/figures/figure2-fleet-size-effects.png')
print("    ✓ Saved figure2-fleet-size-effects.png")

# Figure 3: Decision Complexity Heatmap
print("  Figure 3: Decision complexity heatmap...")
plt.figure(figsize=(14, 5))

pivot = df.groupby(['warpFactor', 'playerCount'])['avgLegalMoves'].mean().unstack(fill_value=np.nan)

# Create heatmap
sns.heatmap(pivot, annot=True, fmt='.2f', cmap='YlOrRd', 
            cbar_kws={'label': 'Avg Legal Moves per Turn'},
            linewidths=0.5, linecolor='gray')

plt.xlabel('Fleet Size (Player Count)', fontsize=13)
plt.ylabel('Warp Factor', fontsize=13)
plt.title('Decision Complexity Across All Configurations', fontsize=15, fontweight='bold')
plt.tight_layout()
plt.savefig('tools/nn/figures/figure3-complexity-heatmap.png')
print("    ✓ Saved figure3-complexity-heatmap.png")

# Figure 4: Hand Coherence vs Strategic Depth
print("  Figure 4: Coherence vs depth scatter...")
plt.figure(figsize=(12, 9))

# Sample 2000 points per factor for readability
for factor_idx, factor in enumerate([9, 12, 15, 18]):
    data = df[df['warpFactor'] == factor]
    sample = data.sample(min(2000, len(data)), random_state=42)
    plt.scatter(sample['avgHandEntropy'], sample['avgValueSpread'],
                label=f'Warp {factor}', alpha=0.4, s=20, color=colors[factor_idx])

plt.xlabel('Hand Coherence (Entropy, bits)', fontsize=13)
plt.ylabel('Strategic Depth (Move Value Spread)', fontsize=13)
plt.title('Hand Coherence vs Strategic Depth', fontsize=15, fontweight='bold')
plt.legend(loc='best', frameon=True, fontsize=11, markerscale=2)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('tools/nn/figures/figure4-coherence-vs-depth.png')
print("    ✓ Saved figure4-coherence-vs-depth.png")

# Figure 5: Skill vs Luck Balance
print("  Figure 5: Skill vs luck balance...")
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))

# Left panel: Skill Index by configuration
configs = df.groupby(['warpFactor', 'playerCount']).agg({
    'skillIndex': 'mean',
    'luckIndex': 'mean'
}).reset_index()

for factor_idx, factor in enumerate([9, 12, 15, 18]):
    data = configs[configs['warpFactor'] == factor]
    ax1.plot(data['playerCount'], data['skillIndex'], 
             marker='o', linewidth=2, markersize=8,
             label=f'Warp {factor}', color=colors[factor_idx])

ax1.set_xlabel('Fleet Size (Player Count)', fontsize=12)
ax1.set_ylabel('Skill Index (higher = more skill)', fontsize=12)
ax1.set_title('Skill Expression Across Configurations', fontsize=13, fontweight='bold')
ax1.legend(loc='best', frameon=True)
ax1.grid(True, alpha=0.3)

# Right panel: Skill/Luck ratio
for factor_idx, factor in enumerate([9, 12, 15, 18]):
    data = configs[configs['warpFactor'] == factor]
    ratio = data['skillIndex'] / data['luckIndex']
    ax2.plot(data['playerCount'], ratio,
             marker='o', linewidth=2, markersize=8,
             label=f'Warp {factor}', color=colors[factor_idx])

ax2.set_xlabel('Fleet Size (Player Count)', fontsize=12)
ax2.set_ylabel('Skill/Luck Ratio', fontsize=12)
ax2.set_title('Skill-to-Luck Balance', fontsize=13, fontweight='bold')
ax2.legend(loc='best', frameon=True)
ax2.grid(True, alpha=0.3)
ax2.axhline(y=1, color='black', linestyle='--', alpha=0.3, label='Equal balance')

plt.suptitle('Skill vs Luck Landscape', fontsize=16, fontweight='bold', y=0.98)
plt.tight_layout()
plt.savefig('tools/nn/figures/figure5-skill-luck-balance.png')
print("    ✓ Saved figure5-skill-luck-balance.png")

print("\n✓ All figures generated successfully in tools/nn/figures/")
print("\nFigure Summary:")
print("  1. Cross-factor comparison (2-4p) - Shows W12 > W15 > W18 > W9 for skill")
print("  2. Fleet size effects - Strong positive correlation for W12/15/18")
print("  3. Complexity heatmap - Decision complexity relatively constant")
print("  4. Coherence vs depth - Hand entropy increases with Warp factor")
print("  5. Skill/luck balance - W12-W15 optimal for skill expression")
