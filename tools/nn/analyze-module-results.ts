#!/usr/bin/env node
/**
 * Analyze module luck/skill results and generate recommendations.
 * Reads all luck-skill-w*-p*-m*.json files and produces a ranked report.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'tools/nn/data');
const OUTPUT_MD = resolve(process.cwd(), 'docs/MODULE-ANALYSIS.md');
const OUTPUT_JSON = resolve(process.cwd(), 'tools/nn/data/module-analysis-summary.json');

interface ConfigResult {
  warpFactor: number;
  playerCount: number;
  moduleConfig: string;
  moduleLabel: string;
  games: number;
  objective: string;
  summary: {
    avgLegalMoves: number;
    avgConstrainedTileFraction: number;
    avgMoveValueSpread: number;
    avgPipStdDev: number;
  };
  skillIndicators: number;
  timestamp: string;
  durationSeconds: number;
}

console.error('Loading results...');

const files = readdirSync(DATA_DIR).filter(
  (f) => f.match(/^luck-skill-w\d+-p\d+-m\w+\.json$/)
);

console.error(`Found ${files.length} result files\n`);

const results: ConfigResult[] = files.map((f) => {
  const content = readFileSync(resolve(DATA_DIR, f), 'utf-8');
  return JSON.parse(content) as ConfigResult;
});

// Group by module config
const byModule = new Map<string, ConfigResult[]>();
results.forEach((r) => {
  if (!byModule.has(r.moduleConfig)) {
    byModule.set(r.moduleConfig, []);
  }
  byModule.get(r.moduleConfig)!.push(r);
});

// Calculate averages per module across all warp/player combinations
interface ModuleSummary {
  moduleConfig: string;
  moduleLabel: string;
  totalConfigs: number;
  avgSkillIndicators: number;
  avgLegalMoves: number;
  avgConstrainedTiles: number;
  avgMoveValueSpread: number;
  avgPipStdDev: number;
  skillDominant: number; // Count of configs with 3-4 indicators
  luckDominant: number;  // Count of configs with 0-1 indicators
  mixed: number;         // Count of configs with 2 indicators
  recommendation: 'promote' | 'neutral' | 'avoid';
}

const moduleSummaries: ModuleSummary[] = [];

for (const [moduleConfig, configs] of byModule.entries()) {
  const totalConfigs = configs.length;
  const avgSkillIndicators =
    configs.reduce((sum, c) => sum + c.skillIndicators, 0) / totalConfigs;
  const avgLegalMoves =
    configs.reduce((sum, c) => sum + c.summary.avgLegalMovesPerTurn, 0) / totalConfigs;
  const avgConstrainedTiles =
    configs.reduce((sum, c) => sum + c.summary.avgConstrainedTileFraction, 0) / totalConfigs;
  const avgMoveValueSpread =
    configs.reduce((sum, c) => sum + c.summary.avgMoveValueSpread, 0) / totalConfigs;
  const avgUniquePips =
    configs.reduce((sum, c) => sum + c.summary.avgUniquePipsInHand, 0) / totalConfigs;

  const skillDominant = configs.filter((c) => c.skillIndicators >= 3).length;
  const luckDominant = configs.filter((c) => c.skillIndicators <= 1).length;
  const mixed = configs.filter((c) => c.skillIndicators === 2).length;

  // Recommendation logic:
  // - Promote: avg >= 2.5 indicators, majority skill-dominant
  // - Avoid: avg < 1.5 indicators, majority luck-dominant
  // - Neutral: otherwise
  let recommendation: 'promote' | 'neutral' | 'avoid';
  if (avgSkillIndicators >= 2.5 && skillDominant > luckDominant) {
    recommendation = 'promote';
  } else if (avgSkillIndicators < 1.5 && luckDominant > skillDominant) {
    recommendation = 'avoid';
  } else {
    recommendation = 'neutral';
  }

  moduleSummaries.push({
    moduleConfig,
    moduleLabel: configs[0].moduleLabel,
    totalConfigs,
    avgSkillIndicators,
    avgLegalMoves,
    avgConstrainedTiles,
    avgMoveValueSpread,
    avgUniquePips,
    skillDominant,
    luckDominant,
    mixed,
    recommendation,
  });
}

// Sort by avgSkillIndicators descending (best skill configurations first)
moduleSummaries.sort((a, b) => b.avgSkillIndicators - a.avgSkillIndicators);

// Generate markdown report
let md = `# Warp Module Analysis: Skill vs Luck

**Generated:** ${new Date().toISOString()}

This analysis quantifies the skill ceiling of each module configuration across all Warp factors and fleet sizes. Configurations are ranked by average skill indicators (0-4 scale).

## Summary Statistics

| Module | Label | Configs | Avg Skill | Legal Moves | Constrained | Spread | Unique Pips | Skill/Mixed/Luck | Rec |
|--------|-------|---------|-----------|-------------|-------------|--------|-------------|------------------|-----|
`;

for (const s of moduleSummaries) {
  const rec = s.recommendation === 'promote' ? '✓ Promote' : s.recommendation === 'avoid' ? '✗ Avoid' : '~ Neutral';
  md += `| ${s.moduleConfig} | ${s.moduleLabel} | ${s.totalConfigs} | ${s.avgSkillIndicators.toFixed(2)} | ${s.avgLegalMoves.toFixed(1)} | ${(s.avgConstrainedTiles * 100).toFixed(0)}% | ${s.avgMoveValueSpread.toFixed(1)} | ${s.avgUniquePips.toFixed(1)} | ${s.skillDominant}/${s.mixed}/${s.luckDominant} | ${rec} |\n`;
}

md += `\n## Interpretation

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

`;

const promote = moduleSummaries.filter((s) => s.recommendation === 'promote');
for (const s of promote) {
  md += `**${s.moduleLabel}** (${s.moduleConfig})\n`;
  md += `- Average skill indicators: ${s.avgSkillIndicators.toFixed(2)}/4\n`;
  md += `- Skill-dominant in ${s.skillDominant}/${s.totalConfigs} configurations (${((s.skillDominant / s.totalConfigs) * 100).toFixed(0)}%)\n`;
  md += `- Recommended for competitive/rated play\n\n`;
}

md += `### ✗ Avoid (Low Skill Ceiling)

`;

const avoid = moduleSummaries.filter((s) => s.recommendation === 'avoid');
if (avoid.length > 0) {
  for (const s of avoid) {
    md += `**${s.moduleLabel}** (${s.moduleConfig})\n`;
    md += `- Average skill indicators: ${s.avgSkillIndicators.toFixed(2)}/4\n`;
    md += `- Luck-dominant in ${s.luckDominant}/${s.totalConfigs} configurations (${((s.luckDominant / s.totalConfigs) * 100).toFixed(0)}%)\n`;
    md += `- Not recommended for competitive play (casual only)\n\n`;
  }
} else {
  md += `*None - all tested modules maintain acceptable skill levels*\n\n`;
}

md += `### ~ Neutral (Mixed or Moderate)

`;

const neutral = moduleSummaries.filter((s) => s.recommendation === 'neutral');
for (const s of neutral) {
  md += `**${s.moduleLabel}** (${s.moduleConfig})\n`;
  md += `- Average skill indicators: ${s.avgSkillIndicators.toFixed(2)}/4\n`;
  md += `- Mixed outcomes across configurations\n`;
  md += `- Acceptable but not ideal for rated play\n\n`;
}

md += `## Detailed Breakdown by Warp Factor

`;

// Group by warp factor
for (const factor of [9, 12, 15, 18]) {
  md += `### Warp ${factor}\n\n`;
  md += `| Players | Module | Skill | Legal | Constrained | Spread | Unique Pips |\n`;
  md += `|---------|--------|-------|-------|-------------|--------|-------------|\n`;

  const factorResults = results
    .filter((r) => r.warpFactor === factor)
    .sort((a, b) => b.skillIndicators - a.skillIndicators);

  for (const r of factorResults) {
    md += `| ${r.playerCount} | ${r.moduleConfig} | ${r.skillIndicators} | ${r.summary.avgLegalMovesPerTurn.toFixed(1)} | ${(r.summary.avgConstrainedTileFraction * 100).toFixed(0)}% | ${r.summary.avgMoveValueSpread.toFixed(1)} | ${r.summary.avgUniquePipsInHand.toFixed(1)} |\n`;
  }

  md += `\n`;
}

md += `## Methodology

- **Games per configuration**: ${results[0]?.games ?? 'N/A'}
- **Total configurations**: ${results.length}
- **Total games**: ${results.length * (results[0]?.games ?? 0)}
- **AI skill level**: Commander (tactical baseline)
- **Objective**: ${results[0]?.objective ?? 'N/A'}

Each configuration was tested across multiple fleet sizes to ensure recommendations are robust across player counts.

---

*Generated by \`tools/nn/analyze-module-results.ts\`*
`;

// Write markdown report
writeFileSync(OUTPUT_MD, md);
console.error(`✓ Markdown report written to: ${OUTPUT_MD}\n`);

// Write JSON summary
const jsonOutput = {
  generated: new Date().toISOString(),
  totalConfigs: results.length,
  totalGames: results.length * (results[0]?.games ?? 0),
  moduleSummaries,
  detailedResults: results,
};

writeFileSync(OUTPUT_JSON, JSON.stringify(jsonOutput, null, 2));
console.error(`✓ JSON summary written to: ${OUTPUT_JSON}\n`);

// Console summary
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.error('  MODULE RANKING (by skill ceiling)');
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const s of moduleSummaries) {
  const icon = s.recommendation === 'promote' ? '✓' : s.recommendation === 'avoid' ? '✗' : '~';
  console.error(`${icon} ${s.moduleConfig.padEnd(10)} ${s.avgSkillIndicators.toFixed(2)}/4  ${s.moduleLabel}`);
}

console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
