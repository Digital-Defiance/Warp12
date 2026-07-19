# Warp Module Analysis: Skill vs Luck

**Generated:** 2026-07-19T02:35:08.232Z

This analysis quantifies the skill ceiling of each module configuration across all Warp factors and fleet sizes. Configurations are ranked by average skill indicators (0-4 scale).

## Summary Statistics

| Module | Label | Configs | Avg Skill | Legal Moves | Constrained | Spread | Unique Pips | Skill/Mixed/Luck | Rec |
|--------|-------|---------|-----------|-------------|-------------|--------|-------------|------------------|-----|
| iota | Module Iota (Double Down) | 38 | 3.00 | 2.3 | 58% | 3.8 | 8.3 | 38/0/0 | ✓ Promote |
| alpha | Module Alpha (Continuum) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| beta | Module Beta (Salamander Penalty) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| delta | Module Delta (Warp Drive Spool) | 38 | 2.97 | 2.2 | 57% | 3.6 | 8.0 | 37/1/0 | ✓ Promote |
| eta | Module Eta (Temporal Debt) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| gamma | Module Gamma (Sensor Grid) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| lambda | Module Lambda (Wormholes) | 38 | 2.97 | 2.2 | 57% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| none | Baseline (no modules) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| theta | Module Theta (Longest Trail) | 38 | 2.97 | 2.2 | 56% | 3.5 | 8.0 | 37/1/0 | ✓ Promote |
| zeta | Module Zeta (Squadrons) | 17 | 2.94 | 1.9 | 60% | 3.3 | 7.6 | 16/1/0 | ✓ Promote |
| kappa | Module Kappa (Temporal Inversion) | 38 | 2.89 | 2.4 | 54% | 3.7 | 8.8 | 35/2/1 | ◐ Warped |
| mu | Subspace Fracture (Own Trail) | 38 | 2.84 | 2.2 | 54% | 3.5 | 8.0 | 32/6/0 | ✓ Promote |
| official | Official Warp 12 Preset | 38 | 2.84 | 2.2 | 54% | 3.3 | 7.7 | 32/6/0 | ✓ Promote |
| all | All Modules (stress test) (Zeta omitted — fleet too small/uneven) | 38 | 2.82 | 2.4 | 55% | 4.1 | 9.4 | 29/9/0 | ✓ Promote |

## Interpretation

**Skill Indicators (0-4):**
- **4**: Highly skill-dependent (all metrics favor strategic play)
- **3**: Skill-dominant (most metrics favor strategic play)
- **2**: Mixed skill/luck balance
- **1**: Luck-leaning (most metrics favor random outcomes)
- **0**: Highly luck-dependent (all metrics favor random outcomes)

**Metrics:**
- **Legal Moves**: Avg choices per turn (≥3.0 = good)
- **Constrained**: % tiles with limited placement (>50% = good)
- **Spread**: Avg value difference between best/worst move (≥2.0 = good)
- **Unique Pips**: Avg distinct pip values in hand (≥5.0 = good)

**Skill/Mixed/Luck**: Count of configurations that were skill-dominant (3-4 indicators), mixed (2), or luck-dominant (0-1)

## Recommendations

### ✓ Promote (High Skill Ceiling)

**Module Iota (Double Down)** (iota)
- Average skill indicators: 3.00/4
- Skill-dominant in 38/38 configurations (100%)
- Recommended for competitive/rated play

**Module Alpha (Continuum)** (alpha)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Beta (Salamander Penalty)** (beta)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Delta (Warp Drive Spool)** (delta)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Eta (Temporal Debt)** (eta)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Gamma (Sensor Grid)** (gamma)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Lambda (Wormholes)** (lambda)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Baseline (no modules)** (none)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Theta (Longest Trail)** (theta)
- Average skill indicators: 2.97/4
- Skill-dominant in 37/38 configurations (97%)
- Recommended for competitive/rated play

**Module Zeta (Squadrons)** (zeta)
- Average skill indicators: 2.94/4
- Skill-dominant in 16/17 configurations (94%)
- Skill-promote; rated Warp 12 writes Squad TEI (squadRating) only — never FFA humanRating

**Subspace Fracture (Own Trail)** (mu)
- Average skill indicators: 2.84/4
- Skill-dominant in 32/38 configurations (84%)
- Recommended for competitive/rated play

**Official Warp 12 Preset** (official)
- Average skill indicators: 2.84/4
- Skill-dominant in 32/38 configurations (84%)
- Recommended for competitive/rated play

**All Modules (stress test) (Zeta omitted — fleet too small/uneven)** (all)
- Average skill indicators: 2.82/4
- Skill-dominant in 29/38 configurations (76%)
- Recommended for competitive/rated play

### ◐ Warped (Exhibition Only)

**Module Kappa (Temporal Inversion)** (kappa)
- Average skill indicators: 2.89/4
- **Warped**: intentional score inversion / chaos — exhibition only, never rated

### ✗ Avoid (Low Skill Ceiling)

*None — luck collapses are classified as Warped/party above*

### ~ Neutral (Mixed or Moderate)

## Detailed Breakdown by Warp Factor

### Warp 9

| Players | Module | Skill | Legal | Constrained | Spread | Unique Pips |
|---------|--------|-------|-------|-------------|--------|-------------|
| 2 | all | 4 | 3.3 | 55% | 3.9 | 8.9 |
| 2 | alpha | 3 | 2.0 | 60% | 2.1 | 6.1 |
| 2 | beta | 3 | 2.0 | 60% | 2.1 | 6.1 |
| 2 | delta | 3 | 2.0 | 62% | 2.2 | 6.1 |
| 2 | eta | 3 | 2.0 | 60% | 2.1 | 6.1 |
| 2 | gamma | 3 | 2.0 | 60% | 2.1 | 6.1 |
| 2 | iota | 3 | 2.3 | 65% | 2.7 | 6.7 |
| 2 | kappa | 3 | 2.7 | 57% | 3.2 | 7.8 |
| 2 | lambda | 3 | 1.9 | 60% | 2.1 | 6.0 |
| 2 | none | 3 | 1.9 | 60% | 2.0 | 6.1 |
| 2 | theta | 3 | 2.0 | 60% | 2.1 | 6.1 |
| 3 | alpha | 3 | 2.0 | 57% | 2.0 | 5.9 |
| 3 | beta | 3 | 2.0 | 58% | 2.0 | 5.9 |
| 3 | delta | 3 | 2.0 | 59% | 2.1 | 5.9 |
| 3 | eta | 3 | 2.0 | 58% | 2.0 | 5.9 |
| 3 | gamma | 3 | 1.9 | 58% | 2.0 | 5.9 |
| 3 | iota | 3 | 2.2 | 62% | 2.5 | 6.2 |
| 3 | kappa | 3 | 2.2 | 52% | 2.3 | 6.5 |
| 3 | lambda | 3 | 2.0 | 58% | 2.0 | 5.8 |
| 3 | none | 3 | 2.0 | 58% | 2.0 | 5.9 |
| 3 | theta | 3 | 2.0 | 57% | 2.0 | 5.9 |
| 4 | all | 3 | 1.9 | 57% | 2.0 | 6.3 |
| 4 | iota | 3 | 2.1 | 56% | 2.1 | 5.8 |
| 2 | mu | 2 | 1.9 | 57% | 2.0 | 6.2 |
| 2 | official | 2 | 1.9 | 55% | 1.8 | 5.7 |
| 3 | all | 2 | 2.4 | 48% | 2.6 | 7.4 |
| 3 | mu | 2 | 1.9 | 53% | 1.8 | 5.8 |
| 3 | official | 2 | 2.0 | 54% | 1.9 | 5.6 |
| 4 | alpha | 2 | 1.9 | 53% | 1.7 | 5.6 |
| 4 | beta | 2 | 1.9 | 54% | 1.7 | 5.6 |
| 4 | delta | 2 | 1.9 | 54% | 1.8 | 5.6 |
| 4 | eta | 2 | 1.9 | 54% | 1.7 | 5.6 |
| 4 | gamma | 2 | 1.9 | 54% | 1.8 | 5.6 |
| 4 | lambda | 2 | 1.9 | 54% | 1.7 | 5.6 |
| 4 | mu | 2 | 1.9 | 51% | 1.6 | 5.4 |
| 4 | none | 2 | 1.9 | 54% | 1.7 | 5.6 |
| 4 | official | 2 | 2.0 | 50% | 1.6 | 5.3 |
| 4 | theta | 2 | 1.9 | 54% | 1.7 | 5.6 |
| 4 | zeta | 2 | 1.7 | 59% | 1.6 | 5.3 |
| 4 | kappa | 1 | 2.1 | 48% | 1.7 | 6.1 |

### Warp 12

| Players | Module | Skill | Legal | Constrained | Spread | Unique Pips |
|---------|--------|-------|-------|-------------|--------|-------------|
| 2 | all | 4 | 3.2 | 58% | 5.2 | 11.3 |
| 2 | alpha | 3 | 1.8 | 57% | 2.3 | 7.4 |
| 2 | beta | 3 | 1.8 | 57% | 2.3 | 7.4 |
| 2 | delta | 3 | 1.8 | 60% | 2.5 | 7.4 |
| 2 | eta | 3 | 1.8 | 58% | 2.3 | 7.3 |
| 2 | gamma | 3 | 1.8 | 57% | 2.3 | 7.4 |
| 2 | iota | 3 | 2.0 | 62% | 2.9 | 7.9 |
| 2 | kappa | 3 | 2.6 | 57% | 3.9 | 9.7 |
| 2 | lambda | 3 | 1.8 | 58% | 2.3 | 7.3 |
| 2 | mu | 3 | 1.8 | 54% | 2.3 | 7.8 |
| 2 | none | 3 | 1.8 | 58% | 2.3 | 7.4 |
| 2 | official | 3 | 1.8 | 54% | 2.1 | 7.0 |
| 2 | theta | 3 | 1.8 | 58% | 2.3 | 7.3 |
| 3 | all | 3 | 3.0 | 56% | 4.6 | 10.2 |
| 3 | alpha | 3 | 2.1 | 62% | 3.2 | 7.6 |
| 3 | beta | 3 | 2.1 | 62% | 3.2 | 7.6 |
| 3 | delta | 3 | 2.1 | 63% | 3.3 | 7.6 |
| 3 | eta | 3 | 2.1 | 62% | 3.2 | 7.6 |
| 3 | gamma | 3 | 2.1 | 63% | 3.3 | 7.6 |
| 3 | iota | 3 | 2.3 | 66% | 3.8 | 8.1 |
| 3 | kappa | 3 | 2.3 | 59% | 3.6 | 8.2 |
| 3 | lambda | 3 | 2.1 | 62% | 3.3 | 7.6 |
| 3 | mu | 3 | 2.0 | 57% | 3.0 | 7.8 |
| 3 | none | 3 | 2.1 | 62% | 3.2 | 7.5 |
| 3 | official | 3 | 2.1 | 59% | 3.0 | 7.3 |
| 3 | theta | 3 | 2.1 | 62% | 3.2 | 7.6 |
| 4 | all | 3 | 3.0 | 69% | 5.4 | 10.3 |
| 4 | alpha | 3 | 2.3 | 66% | 3.9 | 8.0 |
| 4 | beta | 3 | 2.4 | 66% | 3.9 | 8.0 |
| 4 | delta | 3 | 2.4 | 66% | 3.9 | 8.0 |
| 4 | eta | 3 | 2.3 | 65% | 3.8 | 7.9 |
| 4 | gamma | 3 | 2.4 | 66% | 3.9 | 8.1 |
| 4 | iota | 3 | 2.6 | 69% | 4.6 | 8.6 |
| 4 | kappa | 3 | 2.6 | 61% | 4.1 | 8.5 |
| 4 | lambda | 3 | 2.4 | 66% | 3.9 | 8.0 |
| 4 | mu | 3 | 2.3 | 61% | 3.6 | 7.9 |
| 4 | none | 3 | 2.3 | 66% | 3.8 | 7.9 |
| 4 | official | 3 | 2.3 | 62% | 3.6 | 7.7 |
| 4 | theta | 3 | 2.3 | 65% | 3.8 | 7.9 |
| 4 | zeta | 3 | 2.1 | 65% | 3.3 | 7.6 |
| 5 | all | 3 | 2.7 | 54% | 3.9 | 9.0 |
| 5 | alpha | 3 | 2.3 | 61% | 3.5 | 7.6 |
| 5 | beta | 3 | 2.3 | 62% | 3.5 | 7.6 |
| 5 | delta | 3 | 2.3 | 62% | 3.6 | 7.7 |
| 5 | eta | 3 | 2.3 | 62% | 3.5 | 7.6 |
| 5 | gamma | 3 | 2.3 | 62% | 3.5 | 7.6 |
| 5 | iota | 3 | 2.5 | 64% | 4.0 | 8.0 |
| 5 | kappa | 3 | 2.5 | 56% | 3.6 | 8.3 |
| 5 | lambda | 3 | 2.3 | 62% | 3.5 | 7.7 |
| 5 | mu | 3 | 2.3 | 58% | 3.4 | 7.5 |
| 5 | none | 3 | 2.3 | 62% | 3.5 | 7.6 |
| 5 | official | 3 | 2.3 | 59% | 3.4 | 7.4 |
| 5 | theta | 3 | 2.3 | 62% | 3.5 | 7.6 |
| 6 | all | 3 | 2.5 | 65% | 4.2 | 9.0 |
| 6 | alpha | 3 | 2.5 | 62% | 3.9 | 7.8 |
| 6 | beta | 3 | 2.5 | 62% | 3.9 | 7.9 |
| 6 | delta | 3 | 2.5 | 62% | 3.9 | 7.9 |
| 6 | eta | 3 | 2.5 | 62% | 3.9 | 7.8 |
| 6 | gamma | 3 | 2.5 | 62% | 3.9 | 8.0 |
| 6 | iota | 3 | 2.7 | 64% | 4.4 | 8.3 |
| 6 | kappa | 3 | 2.7 | 57% | 3.9 | 8.4 |
| 6 | lambda | 3 | 2.5 | 62% | 3.9 | 7.9 |
| 6 | mu | 3 | 2.6 | 59% | 3.9 | 7.8 |
| 6 | none | 3 | 2.5 | 62% | 3.9 | 7.9 |
| 6 | official | 3 | 2.5 | 60% | 3.8 | 7.6 |
| 6 | theta | 3 | 2.5 | 62% | 3.9 | 7.9 |
| 6 | zeta | 3 | 2.1 | 66% | 3.4 | 7.6 |
| 7 | all | 3 | 2.7 | 52% | 3.7 | 8.1 |
| 7 | alpha | 3 | 2.4 | 58% | 3.5 | 7.4 |
| 7 | beta | 3 | 2.5 | 59% | 3.6 | 7.5 |
| 7 | delta | 3 | 2.5 | 59% | 3.6 | 7.5 |
| 7 | eta | 3 | 2.4 | 58% | 3.6 | 7.5 |
| 7 | gamma | 3 | 2.5 | 58% | 3.6 | 7.6 |
| 7 | iota | 3 | 2.6 | 60% | 4.0 | 7.8 |
| 7 | kappa | 3 | 2.6 | 53% | 3.5 | 7.9 |
| 7 | lambda | 3 | 2.4 | 59% | 3.5 | 7.5 |
| 7 | mu | 3 | 2.5 | 56% | 3.6 | 7.4 |
| 7 | none | 3 | 2.4 | 58% | 3.5 | 7.5 |
| 7 | official | 3 | 2.4 | 56% | 3.4 | 7.2 |
| 7 | theta | 3 | 2.5 | 58% | 3.6 | 7.5 |
| 8 | all | 3 | 2.3 | 59% | 3.6 | 8.1 |
| 8 | alpha | 3 | 2.6 | 57% | 3.8 | 7.6 |
| 8 | beta | 3 | 2.6 | 58% | 3.8 | 7.6 |
| 8 | delta | 3 | 2.6 | 58% | 3.8 | 7.6 |
| 8 | eta | 3 | 2.6 | 57% | 3.8 | 7.6 |
| 8 | gamma | 3 | 2.7 | 57% | 3.9 | 7.7 |
| 8 | iota | 3 | 2.7 | 58% | 4.1 | 7.8 |
| 8 | kappa | 3 | 2.7 | 53% | 3.7 | 8.0 |
| 8 | lambda | 3 | 2.6 | 58% | 3.8 | 7.6 |
| 8 | mu | 3 | 2.7 | 55% | 3.9 | 7.5 |
| 8 | none | 3 | 2.6 | 58% | 3.8 | 7.7 |
| 8 | official | 3 | 2.6 | 56% | 3.7 | 7.4 |
| 8 | theta | 3 | 2.6 | 57% | 3.8 | 7.7 |
| 8 | zeta | 3 | 2.1 | 64% | 3.4 | 7.3 |

### Warp 15

| Players | Module | Skill | Legal | Constrained | Spread | Unique Pips |
|---------|--------|-------|-------|-------------|--------|-------------|
| 10 | all | 3 | 2.1 | 57% | 3.6 | 8.3 |
| 10 | alpha | 3 | 2.5 | 56% | 4.0 | 8.0 |
| 10 | beta | 3 | 2.5 | 56% | 4.0 | 8.0 |
| 10 | delta | 3 | 2.5 | 56% | 4.1 | 8.0 |
| 10 | eta | 3 | 2.5 | 56% | 4.0 | 7.9 |
| 10 | gamma | 3 | 2.5 | 56% | 4.0 | 8.0 |
| 10 | iota | 3 | 2.6 | 58% | 4.3 | 8.2 |
| 10 | kappa | 3 | 2.5 | 54% | 3.9 | 8.2 |
| 10 | lambda | 3 | 2.5 | 57% | 4.1 | 8.0 |
| 10 | mu | 3 | 2.5 | 54% | 4.1 | 7.8 |
| 10 | none | 3 | 2.5 | 57% | 4.0 | 8.0 |
| 10 | official | 3 | 2.5 | 54% | 3.8 | 7.7 |
| 10 | theta | 3 | 2.5 | 56% | 4.0 | 7.9 |
| 10 | zeta | 3 | 1.9 | 62% | 3.4 | 7.6 |
| 11 | alpha | 3 | 2.5 | 55% | 3.7 | 7.7 |
| 11 | beta | 3 | 2.5 | 55% | 3.7 | 7.7 |
| 11 | delta | 3 | 2.5 | 55% | 3.8 | 7.7 |
| 11 | eta | 3 | 2.5 | 54% | 3.7 | 7.6 |
| 11 | gamma | 3 | 2.5 | 55% | 3.7 | 7.7 |
| 11 | iota | 3 | 2.6 | 56% | 4.0 | 7.9 |
| 11 | kappa | 3 | 2.6 | 52% | 3.6 | 7.9 |
| 11 | lambda | 3 | 2.5 | 54% | 3.7 | 7.7 |
| 11 | mu | 3 | 2.5 | 53% | 3.8 | 7.6 |
| 11 | none | 3 | 2.5 | 55% | 3.7 | 7.6 |
| 11 | official | 3 | 2.5 | 52% | 3.5 | 7.4 |
| 11 | theta | 3 | 2.5 | 54% | 3.7 | 7.7 |
| 12 | all | 3 | 2.1 | 56% | 3.6 | 8.0 |
| 12 | alpha | 3 | 2.6 | 54% | 3.8 | 7.7 |
| 12 | beta | 3 | 2.6 | 55% | 3.9 | 7.7 |
| 12 | delta | 3 | 2.6 | 55% | 3.9 | 7.8 |
| 12 | eta | 3 | 2.6 | 54% | 3.9 | 7.7 |
| 12 | gamma | 3 | 2.6 | 54% | 3.9 | 7.7 |
| 12 | iota | 3 | 2.7 | 55% | 4.1 | 7.9 |
| 12 | kappa | 3 | 2.7 | 52% | 3.8 | 8.0 |
| 12 | lambda | 3 | 2.6 | 54% | 3.8 | 7.7 |
| 12 | mu | 3 | 2.6 | 53% | 3.9 | 7.6 |
| 12 | none | 3 | 2.6 | 54% | 3.9 | 7.7 |
| 12 | official | 3 | 2.6 | 52% | 3.7 | 7.4 |
| 12 | theta | 3 | 2.6 | 54% | 3.8 | 7.7 |
| 12 | zeta | 3 | 2.0 | 60% | 3.4 | 7.3 |
| 2 | all | 3 | 2.7 | 57% | 4.9 | 12.6 |
| 2 | alpha | 3 | 1.6 | 53% | 2.1 | 8.6 |
| 2 | beta | 3 | 1.6 | 53% | 2.2 | 8.6 |
| 2 | delta | 3 | 1.7 | 57% | 2.5 | 8.9 |
| 2 | eta | 3 | 1.6 | 52% | 2.2 | 8.6 |
| 2 | gamma | 3 | 1.6 | 53% | 2.1 | 8.6 |
| 2 | iota | 3 | 1.7 | 57% | 2.7 | 9.2 |
| 2 | kappa | 3 | 2.2 | 55% | 3.8 | 11.3 |
| 2 | lambda | 3 | 1.6 | 53% | 2.2 | 8.6 |
| 2 | mu | 3 | 1.7 | 51% | 2.5 | 9.4 |
| 2 | none | 3 | 1.6 | 52% | 2.1 | 8.6 |
| 2 | official | 3 | 1.6 | 51% | 2.0 | 8.4 |
| 2 | theta | 3 | 1.6 | 53% | 2.1 | 8.6 |
| 3 | all | 3 | 2.6 | 53% | 4.8 | 11.7 |
| 3 | alpha | 3 | 1.8 | 57% | 3.0 | 8.3 |
| 3 | beta | 3 | 1.8 | 56% | 3.0 | 8.3 |
| 3 | delta | 3 | 1.8 | 58% | 3.2 | 8.4 |
| 3 | eta | 3 | 1.8 | 56% | 3.0 | 8.3 |
| 3 | gamma | 3 | 1.8 | 57% | 3.0 | 8.3 |
| 3 | iota | 3 | 1.9 | 59% | 3.4 | 8.7 |
| 3 | kappa | 3 | 2.1 | 54% | 3.5 | 9.6 |
| 3 | lambda | 3 | 1.8 | 56% | 2.9 | 8.3 |
| 3 | mu | 3 | 1.8 | 52% | 3.0 | 8.9 |
| 3 | none | 3 | 1.8 | 56% | 2.9 | 8.3 |
| 3 | official | 3 | 1.8 | 55% | 2.8 | 8.1 |
| 3 | theta | 3 | 1.8 | 56% | 2.9 | 8.2 |
| 4 | all | 3 | 2.4 | 65% | 5.1 | 11.3 |
| 4 | alpha | 3 | 2.0 | 60% | 3.7 | 8.5 |
| 4 | beta | 3 | 2.0 | 60% | 3.7 | 8.5 |
| 4 | delta | 3 | 2.1 | 61% | 3.8 | 8.6 |
| 4 | eta | 3 | 2.0 | 60% | 3.7 | 8.6 |
| 4 | gamma | 3 | 2.0 | 60% | 3.7 | 8.6 |
| 4 | iota | 3 | 2.2 | 63% | 4.1 | 8.9 |
| 4 | kappa | 3 | 2.4 | 56% | 4.1 | 9.7 |
| 4 | lambda | 3 | 2.0 | 60% | 3.6 | 8.5 |
| 4 | mu | 3 | 2.0 | 56% | 3.4 | 8.6 |
| 4 | none | 3 | 2.0 | 60% | 3.7 | 8.5 |
| 4 | official | 3 | 2.1 | 58% | 3.5 | 8.3 |
| 4 | theta | 3 | 2.0 | 60% | 3.7 | 8.6 |
| 4 | zeta | 3 | 1.7 | 59% | 2.9 | 8.2 |
| 5 | all | 3 | 2.4 | 52% | 3.9 | 9.8 |
| 5 | alpha | 3 | 2.1 | 58% | 3.6 | 8.2 |
| 5 | beta | 3 | 2.0 | 59% | 3.5 | 8.1 |
| 5 | delta | 3 | 2.1 | 59% | 3.7 | 8.2 |
| 5 | eta | 3 | 2.1 | 59% | 3.6 | 8.2 |
| 5 | gamma | 3 | 2.0 | 58% | 3.5 | 8.1 |
| 5 | iota | 3 | 2.1 | 61% | 3.9 | 8.4 |
| 5 | kappa | 3 | 2.3 | 54% | 3.8 | 9.1 |
| 5 | lambda | 3 | 2.0 | 58% | 3.5 | 8.2 |
| 5 | mu | 3 | 2.0 | 55% | 3.4 | 8.1 |
| 5 | none | 3 | 2.1 | 58% | 3.6 | 8.1 |
| 5 | official | 3 | 2.1 | 56% | 3.5 | 8.0 |
| 5 | theta | 3 | 2.1 | 58% | 3.6 | 8.2 |
| 6 | all | 3 | 2.1 | 61% | 4.1 | 9.7 |
| 6 | alpha | 3 | 2.2 | 59% | 3.9 | 8.3 |
| 6 | beta | 3 | 2.2 | 59% | 3.9 | 8.4 |
| 6 | delta | 3 | 2.2 | 60% | 3.9 | 8.4 |
| 6 | eta | 3 | 2.2 | 60% | 3.9 | 8.4 |
| 6 | gamma | 3 | 2.2 | 59% | 4.0 | 8.4 |
| 6 | iota | 3 | 2.3 | 62% | 4.3 | 8.6 |
| 6 | kappa | 3 | 2.4 | 55% | 4.0 | 9.2 |
| 6 | lambda | 3 | 2.2 | 60% | 3.9 | 8.4 |
| 6 | mu | 3 | 2.2 | 56% | 3.8 | 8.2 |
| 6 | none | 3 | 2.2 | 59% | 3.9 | 8.3 |
| 6 | official | 3 | 2.2 | 57% | 3.8 | 8.1 |
| 6 | theta | 3 | 2.2 | 60% | 3.9 | 8.3 |
| 6 | zeta | 3 | 1.8 | 62% | 3.2 | 8.0 |
| 7 | all | 3 | 2.4 | 51% | 3.9 | 8.8 |
| 7 | alpha | 3 | 2.2 | 58% | 3.6 | 8.0 |
| 7 | beta | 3 | 2.2 | 57% | 3.6 | 8.0 |
| 7 | delta | 3 | 2.2 | 57% | 3.7 | 8.0 |
| 7 | eta | 3 | 2.2 | 57% | 3.6 | 8.0 |
| 7 | gamma | 3 | 2.2 | 57% | 3.6 | 8.0 |
| 7 | iota | 3 | 2.3 | 59% | 4.0 | 8.2 |
| 7 | kappa | 3 | 2.3 | 54% | 3.7 | 8.5 |
| 7 | lambda | 3 | 2.2 | 57% | 3.6 | 8.0 |
| 7 | mu | 3 | 2.2 | 55% | 3.6 | 7.8 |
| 7 | none | 3 | 2.2 | 57% | 3.6 | 8.0 |
| 7 | official | 3 | 2.2 | 55% | 3.5 | 7.8 |
| 7 | theta | 3 | 2.2 | 57% | 3.6 | 7.9 |
| 8 | all | 3 | 2.0 | 59% | 3.7 | 8.8 |
| 8 | alpha | 3 | 2.3 | 58% | 3.9 | 8.1 |
| 8 | beta | 3 | 2.3 | 58% | 3.9 | 8.1 |
| 8 | delta | 3 | 2.3 | 58% | 4.0 | 8.1 |
| 8 | eta | 3 | 2.3 | 57% | 3.9 | 8.1 |
| 8 | gamma | 3 | 2.3 | 58% | 3.9 | 8.1 |
| 8 | iota | 3 | 2.4 | 59% | 4.2 | 8.3 |
| 8 | kappa | 3 | 2.5 | 55% | 4.0 | 8.7 |
| 8 | lambda | 3 | 2.3 | 58% | 3.9 | 8.1 |
| 8 | mu | 3 | 2.3 | 55% | 3.9 | 7.9 |
| 8 | none | 3 | 2.3 | 58% | 3.9 | 8.1 |
| 8 | official | 3 | 2.3 | 55% | 3.7 | 7.8 |
| 8 | theta | 3 | 2.3 | 57% | 4.0 | 8.1 |
| 8 | zeta | 3 | 1.8 | 61% | 3.2 | 7.7 |
| 9 | alpha | 3 | 2.4 | 56% | 3.8 | 7.9 |
| 9 | beta | 3 | 2.4 | 57% | 3.8 | 7.9 |
| 9 | delta | 3 | 2.4 | 57% | 3.8 | 7.9 |
| 9 | eta | 3 | 2.4 | 56% | 3.8 | 7.9 |
| 9 | gamma | 3 | 2.4 | 56% | 3.8 | 7.9 |
| 9 | iota | 3 | 2.4 | 58% | 4.1 | 8.1 |
| 9 | kappa | 3 | 2.5 | 54% | 3.8 | 8.2 |
| 9 | lambda | 3 | 2.4 | 57% | 3.8 | 7.9 |
| 9 | mu | 3 | 2.4 | 54% | 3.9 | 7.7 |
| 9 | none | 3 | 2.4 | 56% | 3.8 | 7.9 |
| 9 | official | 3 | 2.4 | 54% | 3.7 | 7.6 |
| 9 | theta | 3 | 2.4 | 56% | 3.8 | 7.9 |
| 11 | all | 2 | 2.7 | 48% | 3.8 | 8.1 |
| 9 | all | 2 | 2.6 | 50% | 3.9 | 8.6 |

### Warp 18

| Players | Module | Skill | Legal | Constrained | Spread | Unique Pips |
|---------|--------|-------|-------|-------------|--------|-------------|
| 10 | all | 3 | 1.9 | 56% | 3.8 | 8.9 |
| 10 | alpha | 3 | 2.3 | 56% | 4.2 | 8.4 |
| 10 | beta | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | delta | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | eta | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | gamma | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | iota | 3 | 2.4 | 57% | 4.4 | 8.7 |
| 10 | kappa | 3 | 2.4 | 53% | 4.2 | 8.9 |
| 10 | lambda | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | mu | 3 | 2.3 | 54% | 4.3 | 8.4 |
| 10 | none | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | official | 3 | 2.3 | 54% | 4.0 | 8.2 |
| 10 | theta | 3 | 2.3 | 56% | 4.2 | 8.5 |
| 10 | zeta | 3 | 1.8 | 60% | 3.6 | 8.0 |
| 11 | alpha | 3 | 2.3 | 54% | 3.8 | 8.2 |
| 11 | beta | 3 | 2.3 | 54% | 3.9 | 8.2 |
| 11 | delta | 3 | 2.3 | 55% | 3.9 | 8.2 |
| 11 | eta | 3 | 2.3 | 54% | 3.8 | 8.2 |
| 11 | gamma | 3 | 2.3 | 55% | 3.9 | 8.2 |
| 11 | iota | 3 | 2.3 | 56% | 4.1 | 8.3 |
| 11 | kappa | 3 | 2.4 | 52% | 3.7 | 8.5 |
| 11 | lambda | 3 | 2.3 | 55% | 3.8 | 8.1 |
| 11 | mu | 3 | 2.3 | 53% | 3.9 | 8.1 |
| 11 | none | 3 | 2.3 | 55% | 3.8 | 8.2 |
| 11 | official | 3 | 2.3 | 53% | 3.8 | 7.9 |
| 11 | theta | 3 | 2.3 | 54% | 3.9 | 8.2 |
| 12 | all | 3 | 2.0 | 55% | 3.7 | 8.3 |
| 12 | alpha | 3 | 2.4 | 55% | 4.0 | 8.2 |
| 12 | beta | 3 | 2.4 | 54% | 4.0 | 8.2 |
| 12 | delta | 3 | 2.4 | 55% | 4.1 | 8.2 |
| 12 | eta | 3 | 2.4 | 55% | 4.0 | 8.3 |
| 12 | gamma | 3 | 2.4 | 55% | 4.0 | 8.2 |
| 12 | iota | 3 | 2.5 | 56% | 4.3 | 8.4 |
| 12 | kappa | 3 | 2.5 | 53% | 4.0 | 8.5 |
| 12 | lambda | 3 | 2.4 | 55% | 4.0 | 8.2 |
| 12 | mu | 3 | 2.4 | 53% | 4.1 | 8.2 |
| 12 | none | 3 | 2.4 | 55% | 4.1 | 8.2 |
| 12 | official | 3 | 2.4 | 53% | 3.9 | 8.0 |
| 12 | theta | 3 | 2.4 | 55% | 4.0 | 8.2 |
| 12 | zeta | 3 | 1.9 | 60% | 3.7 | 7.8 |
| 13 | alpha | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 13 | beta | 3 | 2.5 | 55% | 4.2 | 8.2 |
| 13 | delta | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 13 | eta | 3 | 2.5 | 55% | 4.1 | 8.2 |
| 13 | gamma | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 13 | iota | 3 | 2.5 | 56% | 4.4 | 8.4 |
| 13 | kappa | 3 | 2.5 | 53% | 4.0 | 8.5 |
| 13 | lambda | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 13 | mu | 3 | 2.5 | 53% | 4.3 | 8.2 |
| 13 | none | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 13 | official | 3 | 2.5 | 53% | 4.0 | 8.0 |
| 13 | theta | 3 | 2.5 | 55% | 4.2 | 8.3 |
| 14 | all | 3 | 2.0 | 53% | 3.7 | 7.9 |
| 14 | alpha | 3 | 2.4 | 53% | 3.7 | 7.9 |
| 14 | beta | 3 | 2.4 | 53% | 3.7 | 7.9 |
| 14 | delta | 3 | 2.4 | 53% | 3.8 | 7.9 |
| 14 | eta | 3 | 2.4 | 53% | 3.7 | 7.9 |
| 14 | gamma | 3 | 2.4 | 53% | 3.7 | 7.9 |
| 14 | iota | 3 | 2.5 | 54% | 3.9 | 8.0 |
| 14 | kappa | 3 | 2.5 | 51% | 3.6 | 8.1 |
| 14 | lambda | 3 | 2.4 | 53% | 3.7 | 7.9 |
| 14 | mu | 3 | 2.5 | 51% | 3.8 | 7.8 |
| 14 | none | 3 | 2.4 | 53% | 3.7 | 7.8 |
| 14 | official | 3 | 2.5 | 51% | 3.6 | 7.7 |
| 14 | theta | 3 | 2.4 | 53% | 3.7 | 7.8 |
| 14 | zeta | 3 | 1.9 | 58% | 3.6 | 7.5 |
| 15 | alpha | 3 | 2.5 | 53% | 3.8 | 7.9 |
| 15 | beta | 3 | 2.5 | 53% | 3.9 | 7.9 |
| 15 | delta | 3 | 2.5 | 53% | 3.9 | 8.0 |
| 15 | eta | 3 | 2.5 | 53% | 3.8 | 7.9 |
| 15 | gamma | 3 | 2.5 | 53% | 3.9 | 7.9 |
| 15 | iota | 3 | 2.6 | 54% | 4.1 | 8.0 |
| 15 | kappa | 3 | 2.6 | 52% | 3.8 | 8.1 |
| 15 | lambda | 3 | 2.5 | 53% | 3.8 | 7.9 |
| 15 | mu | 3 | 2.6 | 52% | 3.9 | 7.9 |
| 15 | none | 3 | 2.5 | 53% | 3.8 | 7.9 |
| 15 | official | 3 | 2.5 | 51% | 3.7 | 7.7 |
| 15 | theta | 3 | 2.5 | 53% | 3.8 | 7.9 |
| 16 | all | 3 | 2.2 | 54% | 3.9 | 7.9 |
| 16 | alpha | 3 | 2.6 | 53% | 3.9 | 7.9 |
| 16 | beta | 3 | 2.6 | 53% | 3.9 | 7.9 |
| 16 | delta | 3 | 2.6 | 53% | 4.0 | 8.0 |
| 16 | eta | 3 | 2.6 | 53% | 4.0 | 7.9 |
| 16 | gamma | 3 | 2.6 | 53% | 3.9 | 8.0 |
| 16 | iota | 3 | 2.7 | 54% | 4.2 | 8.1 |
| 16 | kappa | 3 | 2.7 | 52% | 3.9 | 8.1 |
| 16 | lambda | 3 | 2.6 | 53% | 3.9 | 7.9 |
| 16 | mu | 3 | 2.7 | 52% | 4.0 | 7.9 |
| 16 | none | 3 | 2.6 | 53% | 3.9 | 7.9 |
| 16 | official | 3 | 2.6 | 51% | 3.8 | 7.7 |
| 16 | theta | 3 | 2.6 | 53% | 3.9 | 7.9 |
| 16 | zeta | 3 | 2.0 | 58% | 3.9 | 7.5 |
| 17 | alpha | 3 | 2.6 | 50% | 3.4 | 7.5 |
| 17 | beta | 3 | 2.6 | 50% | 3.4 | 7.5 |
| 17 | delta | 3 | 2.6 | 50% | 3.4 | 7.5 |
| 17 | eta | 3 | 2.6 | 51% | 3.3 | 7.5 |
| 17 | gamma | 3 | 2.6 | 51% | 3.4 | 7.5 |
| 17 | iota | 3 | 2.6 | 51% | 3.5 | 7.7 |
| 17 | lambda | 3 | 2.6 | 51% | 3.4 | 7.5 |
| 17 | none | 3 | 2.6 | 50% | 3.3 | 7.5 |
| 17 | theta | 3 | 2.6 | 50% | 3.4 | 7.5 |
| 18 | all | 3 | 2.2 | 51% | 3.6 | 7.4 |
| 18 | alpha | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | beta | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | delta | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | eta | 3 | 2.7 | 50% | 3.4 | 7.5 |
| 18 | gamma | 3 | 2.6 | 50% | 3.4 | 7.5 |
| 18 | iota | 3 | 2.7 | 51% | 3.6 | 7.6 |
| 18 | lambda | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | none | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | theta | 3 | 2.7 | 50% | 3.5 | 7.5 |
| 18 | zeta | 3 | 2.1 | 56% | 3.6 | 7.1 |
| 2 | all | 3 | 2.2 | 57% | 4.5 | 13.8 |
| 2 | alpha | 3 | 1.5 | 51% | 2.3 | 10.1 |
| 2 | beta | 3 | 1.5 | 51% | 2.3 | 10.1 |
| 2 | delta | 3 | 1.6 | 56% | 2.9 | 10.4 |
| 2 | eta | 3 | 1.5 | 51% | 2.3 | 10.1 |
| 2 | gamma | 3 | 1.5 | 50% | 2.3 | 10.2 |
| 2 | iota | 3 | 1.6 | 55% | 2.8 | 10.5 |
| 2 | kappa | 3 | 2.0 | 55% | 3.7 | 12.8 |
| 2 | lambda | 3 | 1.5 | 51% | 2.3 | 10.1 |
| 2 | none | 3 | 1.5 | 51% | 2.3 | 10.1 |
| 2 | theta | 3 | 1.5 | 51% | 2.3 | 10.0 |
| 3 | all | 3 | 2.4 | 53% | 5.2 | 13.2 |
| 3 | alpha | 3 | 1.6 | 53% | 2.8 | 9.1 |
| 3 | beta | 3 | 1.6 | 53% | 2.8 | 9.0 |
| 3 | delta | 3 | 1.7 | 55% | 3.1 | 9.3 |
| 3 | eta | 3 | 1.6 | 53% | 2.8 | 9.0 |
| 3 | gamma | 3 | 1.6 | 53% | 2.9 | 9.1 |
| 3 | iota | 3 | 1.7 | 56% | 3.3 | 9.5 |
| 3 | kappa | 3 | 2.0 | 52% | 4.0 | 11.3 |
| 3 | lambda | 3 | 1.6 | 53% | 2.8 | 9.1 |
| 3 | mu | 3 | 1.7 | 51% | 3.2 | 10.2 |
| 3 | none | 3 | 1.6 | 53% | 2.8 | 9.0 |
| 3 | official | 3 | 1.6 | 52% | 2.8 | 9.0 |
| 3 | theta | 3 | 1.6 | 53% | 2.8 | 9.0 |
| 4 | all | 3 | 2.2 | 64% | 5.3 | 12.7 |
| 4 | alpha | 3 | 1.8 | 56% | 3.6 | 9.1 |
| 4 | beta | 3 | 1.8 | 57% | 3.6 | 9.1 |
| 4 | delta | 3 | 1.9 | 58% | 3.8 | 9.2 |
| 4 | eta | 3 | 1.8 | 57% | 3.6 | 9.1 |
| 4 | gamma | 3 | 1.8 | 56% | 3.5 | 9.0 |
| 4 | iota | 3 | 1.9 | 59% | 3.8 | 9.3 |
| 4 | kappa | 3 | 2.2 | 54% | 4.4 | 10.9 |
| 4 | lambda | 3 | 1.8 | 57% | 3.6 | 9.1 |
| 4 | mu | 3 | 1.8 | 53% | 3.5 | 9.5 |
| 4 | none | 3 | 1.8 | 57% | 3.6 | 9.0 |
| 4 | official | 3 | 1.8 | 55% | 3.4 | 8.8 |
| 4 | theta | 3 | 1.8 | 56% | 3.5 | 9.0 |
| 4 | zeta | 3 | 1.5 | 56% | 2.7 | 8.9 |
| 5 | all | 3 | 2.3 | 50% | 4.4 | 11.1 |
| 5 | alpha | 3 | 1.8 | 56% | 3.4 | 8.6 |
| 5 | beta | 3 | 1.8 | 56% | 3.4 | 8.5 |
| 5 | delta | 3 | 1.9 | 57% | 3.6 | 8.7 |
| 5 | eta | 3 | 1.8 | 56% | 3.5 | 8.6 |
| 5 | gamma | 3 | 1.8 | 56% | 3.4 | 8.6 |
| 5 | iota | 3 | 1.9 | 59% | 3.8 | 8.8 |
| 5 | kappa | 3 | 2.1 | 53% | 4.0 | 10.2 |
| 5 | lambda | 3 | 1.9 | 56% | 3.5 | 8.7 |
| 5 | mu | 3 | 1.8 | 53% | 3.5 | 8.7 |
| 5 | none | 3 | 1.9 | 56% | 3.5 | 8.7 |
| 5 | official | 3 | 1.9 | 55% | 3.4 | 8.5 |
| 5 | theta | 3 | 1.9 | 57% | 3.6 | 8.7 |
| 6 | all | 3 | 1.9 | 59% | 4.1 | 10.6 |
| 6 | alpha | 3 | 2.0 | 58% | 4.0 | 8.9 |
| 6 | beta | 3 | 2.0 | 58% | 4.0 | 8.9 |
| 6 | delta | 3 | 2.0 | 58% | 4.1 | 8.9 |
| 6 | eta | 3 | 2.0 | 58% | 4.0 | 8.9 |
| 6 | gamma | 3 | 2.0 | 57% | 4.0 | 8.8 |
| 6 | iota | 3 | 2.1 | 60% | 4.3 | 9.1 |
| 6 | kappa | 3 | 2.2 | 54% | 4.2 | 9.9 |
| 6 | lambda | 3 | 2.0 | 58% | 4.0 | 8.9 |
| 6 | mu | 3 | 2.0 | 54% | 3.9 | 8.8 |
| 6 | none | 3 | 2.0 | 58% | 4.0 | 8.9 |
| 6 | official | 3 | 2.0 | 56% | 3.9 | 8.6 |
| 6 | theta | 3 | 2.0 | 57% | 4.0 | 8.8 |
| 6 | zeta | 3 | 1.6 | 58% | 3.1 | 8.3 |
| 7 | alpha | 3 | 2.0 | 56% | 3.8 | 8.5 |
| 7 | beta | 3 | 2.0 | 57% | 3.8 | 8.5 |
| 7 | delta | 3 | 2.1 | 57% | 3.9 | 8.6 |
| 7 | eta | 3 | 2.0 | 57% | 3.8 | 8.6 |
| 7 | gamma | 3 | 2.0 | 56% | 3.8 | 8.4 |
| 7 | iota | 3 | 2.1 | 58% | 4.1 | 8.7 |
| 7 | kappa | 3 | 2.2 | 54% | 3.9 | 9.2 |
| 7 | lambda | 3 | 2.0 | 56% | 3.8 | 8.5 |
| 7 | mu | 3 | 2.0 | 54% | 3.8 | 8.4 |
| 7 | none | 3 | 2.0 | 56% | 3.8 | 8.5 |
| 7 | official | 3 | 2.0 | 54% | 3.6 | 8.2 |
| 7 | theta | 3 | 2.0 | 56% | 3.8 | 8.6 |
| 8 | all | 3 | 1.9 | 57% | 3.8 | 9.5 |
| 8 | alpha | 3 | 2.2 | 57% | 4.1 | 8.7 |
| 8 | beta | 3 | 2.2 | 57% | 4.1 | 8.7 |
| 8 | delta | 3 | 2.2 | 57% | 4.2 | 8.7 |
| 8 | eta | 3 | 2.2 | 57% | 4.1 | 8.7 |
| 8 | gamma | 3 | 2.1 | 57% | 4.1 | 8.6 |
| 8 | iota | 3 | 2.2 | 58% | 4.4 | 8.8 |
| 8 | kappa | 3 | 2.3 | 54% | 4.1 | 9.4 |
| 8 | lambda | 3 | 2.1 | 57% | 4.1 | 8.6 |
| 8 | mu | 3 | 2.1 | 54% | 4.1 | 8.4 |
| 8 | none | 3 | 2.1 | 57% | 4.1 | 8.6 |
| 8 | official | 3 | 2.2 | 55% | 4.0 | 8.4 |
| 8 | theta | 3 | 2.2 | 57% | 4.1 | 8.6 |
| 8 | zeta | 3 | 1.7 | 59% | 3.3 | 8.0 |
| 9 | alpha | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 9 | beta | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 9 | delta | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 9 | eta | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 9 | gamma | 3 | 2.2 | 56% | 3.9 | 8.4 |
| 9 | iota | 3 | 2.2 | 58% | 4.2 | 8.6 |
| 9 | kappa | 3 | 2.3 | 53% | 3.9 | 8.9 |
| 9 | lambda | 3 | 2.2 | 56% | 3.9 | 8.3 |
| 9 | mu | 3 | 2.2 | 54% | 4.0 | 8.3 |
| 9 | none | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 9 | official | 3 | 2.2 | 54% | 3.8 | 8.1 |
| 9 | theta | 3 | 2.2 | 56% | 4.0 | 8.4 |
| 11 | all | 2 | 2.5 | 48% | 3.9 | 8.7 |
| 13 | all | 2 | 2.7 | 48% | 4.2 | 8.8 |
| 15 | all | 2 | 2.7 | 47% | 3.9 | 8.3 |
| 17 | all | 2 | 2.8 | 44% | 3.4 | 7.8 |
| 17 | kappa | 2 | 2.6 | 49% | 3.2 | 7.6 |
| 17 | mu | 2 | 2.6 | 50% | 3.4 | 7.5 |
| 17 | official | 2 | 2.6 | 48% | 3.2 | 7.2 |
| 18 | kappa | 2 | 2.7 | 49% | 3.4 | 7.6 |
| 18 | mu | 2 | 2.7 | 49% | 3.6 | 7.5 |
| 18 | official | 2 | 2.7 | 48% | 3.3 | 7.3 |
| 2 | mu | 2 | 1.6 | 49% | 2.7 | 11.1 |
| 2 | official | 2 | 1.5 | 50% | 2.2 | 9.9 |
| 7 | all | 2 | 2.3 | 50% | 4.1 | 9.7 |
| 9 | all | 2 | 2.4 | 50% | 4.1 | 9.2 |

## Methodology

- **Games per configuration**: 500
- **Total configurations**: 511
- **Total games**: 255500
- **AI skill level**: Commander (tactical baseline)
- **Objective**: go-out
- **Product taxonomy**: Promote (rated-safe) · Warped/party (Epsilon) · Warped (Kappa) · Zeta skill-promote with separate FFA TEI gate

Each configuration was tested across multiple fleet sizes to ensure recommendations are robust across player counts.

---

*Generated by `tools/nn/analyze-module-results.ts`*
