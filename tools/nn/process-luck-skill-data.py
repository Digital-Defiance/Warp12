#!/usr/bin/env python3
"""Process luck/skill comprehensive dataset into analyzable format."""

import json
import pandas as pd
import numpy as np

print("Loading dataset...")
with open('tools/nn/data/luck-skill-comprehensive.json') as f:
    data = json.load(f)

print(f"Dataset: {data['metadata']['totalGames']} games, {data['metadata']['totalConfigs']} configs")

# Flatten to DataFrame
rows = []
for result in data['results']:
    for game_idx, game_metrics in enumerate(result['metrics']):
        # Extract trail development stats
        trail_dev = game_metrics.get('trailDevelopment', {})
        total_own_trail = sum(p.get('ownTrailPlays', 0) for p in trail_dev.values())
        total_other_trail = sum(p.get('otherTrailPlays', 0) for p in trail_dev.values())
        total_shields_down = sum(p.get('shieldsDownTurns', 0) for p in trail_dev.values())
        total_turns = sum(p.get('totalTurns', 0) for p in trail_dev.values())
        
        row = {
            'warpFactor': result['maxPip'],
            'playerCount': result['playerCount'],
            'gameId': f"W{result['maxPip']}-P{result['playerCount']}-G{game_idx}",
            'avgLegalMoves': game_metrics['avgLegalMoves'],
            'avgUniqueTrains': game_metrics['avgUniqueTrains'],
            'avgConstrainedTileFraction': game_metrics['avgConstrainedTileFraction'],
            'avgUniquePips': game_metrics['avgUniquePips'],
            'avgMaxCluster': game_metrics['avgMaxCluster'],
            'avgHandEntropy': game_metrics['avgHandEntropy'],
            'avgValueSpread': game_metrics['avgValueSpread'],
            'avgNearOptimalFraction': game_metrics['avgNearOptimalFraction'],
            'turnsSampled': game_metrics['turnsSampled'],
            'ownTrailPlayRate': total_own_trail / total_turns if total_turns > 0 else 0,
            'otherTrailPlayRate': total_other_trail / total_turns if total_turns > 0 else 0,
            'shieldsDownRate': total_shields_down / total_turns if total_turns > 0 else 0,
        }
        rows.append(row)

df = pd.DataFrame(rows)

print(f"\nProcessed {len(df)} games")
print(f"  Warp factors: {sorted(df['warpFactor'].unique())}")
print(f"  Player counts: {sorted(df['playerCount'].unique())}")

# Add derived composite indices
print("\nComputing composite indices...")

# Skill Index: Higher when skill matters more
# - High value spread = choices matter
# - High near-optimal fraction = skill pays off
# - More legal moves = more decisions
df['skillIndex'] = (
    df['avgValueSpread'] * 0.4 +
    df['avgNearOptimalFraction'] * 0.3 +
    df['avgLegalMoves'] * 0.3
)

# Luck Index: Higher when luck dominates
# - Low near-optimal fraction = moves don't matter much
# - High constrained tiles = forced moves
# - Few legal moves = little choice
df['luckIndex'] = (
    (1 - df['avgNearOptimalFraction']) * 0.5 +
    df['avgConstrainedTileFraction'] * 0.3 +
    (1 / (df['avgLegalMoves'] + 1)) * 0.2
)

# Decision Quality: Combination of complexity and strategic depth
df['decisionQuality'] = df['avgLegalMoves'] * df['avgValueSpread']

# Save processed data
output_path = 'tools/nn/data/luck-skill-processed.csv'
df.to_csv(output_path, index=False)
print(f"\n✓ Saved processed data to {output_path}")

# Summary statistics by configuration
print("\n" + "="*80)
print("SUMMARY BY CONFIGURATION")
print("="*80)

summary = df.groupby(['warpFactor', 'playerCount']).agg({
    'avgLegalMoves': ['mean', 'std'],
    'avgHandEntropy': ['mean', 'std'],
    'avgValueSpread': ['mean', 'std'],
    'avgNearOptimalFraction': ['mean', 'std'],
    'skillIndex': ['mean', 'std'],
    'luckIndex': ['mean', 'std'],
}).round(3)

print(summary.to_string())

# Overall by Warp factor
print("\n" + "="*80)
print("OVERALL BY WARP FACTOR")
print("="*80)

factor_summary = df.groupby('warpFactor').agg({
    'avgLegalMoves': 'mean',
    'avgHandEntropy': 'mean',
    'avgValueSpread': 'mean',
    'avgNearOptimalFraction': 'mean',
    'skillIndex': 'mean',
    'luckIndex': 'mean',
    'avgConstrainedTileFraction': 'mean',
}).round(3)

print(factor_summary.to_string())

# Key insights
print("\n" + "="*80)
print("KEY PATTERNS")
print("="*80)

print("\n1. Decision Complexity (avgLegalMoves) across factors:")
for factor in sorted(df['warpFactor'].unique()):
    mean_moves = df[df['warpFactor'] == factor]['avgLegalMoves'].mean()
    print(f"   W{factor}: {mean_moves:.2f} moves/turn")

print("\n2. Hand Coherence (avgHandEntropy) across factors:")
for factor in sorted(df['warpFactor'].unique()):
    mean_entropy = df[df['warpFactor'] == factor]['avgHandEntropy'].mean()
    print(f"   W{factor}: {mean_entropy:.2f} bits")

print("\n3. Skill Index across factors:")
for factor in sorted(df['warpFactor'].unique()):
    mean_skill = df[df['warpFactor'] == factor]['skillIndex'].mean()
    print(f"   W{factor}: {mean_skill:.3f}")

print("\n4. Fleet size effect (correlation with player count):")
for factor in sorted(df['warpFactor'].unique()):
    factor_df = df[df['warpFactor'] == factor]
    corr = factor_df['playerCount'].corr(factor_df['skillIndex'])
    print(f"   W{factor}: r = {corr:.3f}")

print("\n✓ Analysis complete. Ready for statistical tests and figures.")
