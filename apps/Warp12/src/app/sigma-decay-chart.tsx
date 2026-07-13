/**
 * Sigma Decay Chart — Visualization of rating confidence convergence.
 * 
 * Shows how σ (uncertainty) decreases with more matches,
 * indicating increasing confidence in the rating estimate.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MatchHistoryEntry, RatedObjective } from '../firebase/stats-schema.js';
import type { TeiGrade } from 'warp12-engine';
import styles from './sigma-decay-chart.module.scss';

interface SigmaDecayChartProps {
  history: readonly MatchHistoryEntry[];
  objective: RatedObjective;
  title?: string;
}

interface ChartDataPoint {
  match: number;
  sigma: number;
  grade?: TeiGrade;
}

function prepareChartData(
  history: readonly MatchHistoryEntry[],
  objective: RatedObjective
): ChartDataPoint[] {
  // Filter to only matches for this objective with rating data
  const objectiveHistory = history
    .filter((entry) => entry.objective === objective && entry.ratingAfter)
    .reverse(); // Reverse to chronological order (oldest first)

  if (objectiveHistory.length === 0) {
    return [];
  }

  return objectiveHistory.map((entry, index) => {
    const rating = entry.ratingAfter!;
    // Extract grade letter from displayGrade (e.g., "V67" → "V")
    const grade = rating.displayGrade?.charAt(0) as TeiGrade | undefined;
    
    return {
      match: index + 1,
      sigma: rating.sigma,
      grade,
    };
  });
}

export function SigmaDecayChart({
  history,
  objective,
  title = 'Rating Confidence (σ decay)',
}: SigmaDecayChartProps) {
  const data = prepareChartData(history, objective);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Play more {objective === 'go-out' ? 'go-out' : 'points'} matches to see confidence convergence.</p>
      </div>
    );
  }

  // Format for tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>Match {data.match}</p>
        <p className={styles.tooltipValue}>σ: {data.sigma.toFixed(3)}</p>
        {data.grade && (
          <p className={styles.tooltipGrade}>
            Grade: {data.grade} ({getGradeName(data.grade)})
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="match"
            label={{ value: 'Match number', position: 'insideBottom', offset: -5 }}
            stroke="rgba(255,255,255,0.6)"
          />
          <YAxis
            label={{ value: 'σ (uncertainty)', angle: -90, position: 'insideLeft' }}
            stroke="rgba(255,255,255,0.6)"
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Grade boundary reference lines */}
          <ReferenceLine
            y={0.5}
            stroke="#ffd700"
            strokeDasharray="3 3"
            label={{ value: 'E (Elite)', position: 'right', fill: '#ffd700', fontSize: 12 }}
          />
          <ReferenceLine
            y={1.5}
            stroke="#4fc3f7"
            strokeDasharray="3 3"
            label={{ value: 'V (Veteran)', position: 'right', fill: '#4fc3f7', fontSize: 12 }}
          />
          <ReferenceLine
            y={2.5}
            stroke="#81c784"
            strokeDasharray="3 3"
            label={{ value: 'C (Consistent)', position: 'right', fill: '#81c784', fontSize: 12 }}
          />
          <ReferenceLine
            y={4.0}
            stroke="#ffb74d"
            strokeDasharray="3 3"
            label={{ value: 'I (Improving)', position: 'right', fill: '#ffb74d', fontSize: 12 }}
          />
          
          {/* Sigma decay line */}
          <Line
            type="monotone"
            dataKey="sigma"
            stroke="#e57373"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="σ (uncertainty)"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className={styles.chartCaption}>
        Lower σ means higher confidence. Grade boundaries shown: E (&lt;0.5), V (&lt;1.5), C (&lt;2.5), I (&lt;4.0), P (≥4.0).
        Sigma naturally decreases as you play more matches and the system learns your skill level.
      </p>
    </div>
  );
}

function getGradeName(grade: TeiGrade): string {
  switch (grade) {
    case 'E': return 'Elite';
    case 'V': return 'Veteran';
    case 'C': return 'Consistent';
    case 'I': return 'Improving';
    case 'P': return 'Provisional';
  }
}
