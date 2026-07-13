/**
 * Rating History Chart — Line chart showing rating progression over time.
 * 
 * Displays μ (skill estimate) with ±σ confidence bands to show:
 * - Rating improvement over matches
 * - Convergence toward true skill
 * - Confidence increase (σ decrease)
 */

import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MatchHistoryEntry, RatedObjective } from '../firebase/stats-schema.js';
import styles from './rating-history-chart.module.scss';

interface RatingHistoryChartProps {
  history: readonly MatchHistoryEntry[];
  objective: RatedObjective;
  title?: string;
}

interface ChartDataPoint {
  match: number;
  mu: number;
  muPlusSigma: number;
  muMinusSigma: number;
  muPlus3Sigma: number; // Upper bound (rarely shown)
  muMinus3Sigma: number; // Display rating (conservative estimate)
  sigma: number;
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
    return {
      match: index + 1,
      mu: rating.mu,
      muPlusSigma: rating.mu + rating.sigma,
      muMinusSigma: rating.mu - rating.sigma,
      muPlus3Sigma: rating.mu + 3 * rating.sigma,
      muMinus3Sigma: rating.mu - 3 * rating.sigma, // Display rating
      sigma: rating.sigma,
    };
  });
}

export function RatingHistoryChart({
  history,
  objective,
  title = 'Rating History',
}: RatingHistoryChartProps) {
  const data = prepareChartData(history, objective);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Play more {objective === 'go-out' ? 'go-out' : 'points'} matches to see your rating progression.</p>
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
        <p className={styles.tooltipValue}>μ: {data.mu.toFixed(2)}</p>
        <p className={styles.tooltipValue}>σ: {data.sigma.toFixed(2)}</p>
        <p className={styles.tooltipValue}>Display: {data.muMinus3Sigma.toFixed(1)}</p>
        <p className={styles.tooltipHint}>±1σ confidence band</p>
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
            label={{ value: 'Rating (μ)', angle: -90, position: 'insideLeft' }}
            stroke="rgba(255,255,255,0.6)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Confidence band (μ ± σ) */}
          <Area
            type="monotone"
            dataKey="muPlusSigma"
            stroke="none"
            fill="rgba(79, 195, 247, 0.2)"
            name="±σ band"
          />
          <Area
            type="monotone"
            dataKey="muMinusSigma"
            stroke="none"
            fill="rgba(255, 255, 255, 0.05)"
            name=""
          />
          
          {/* Main rating line (μ) */}
          <Line
            type="monotone"
            dataKey="mu"
            stroke="#4fc3f7"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="μ (skill estimate)"
          />
          
          {/* Display rating line (μ - 3σ) */}
          <Line
            type="monotone"
            dataKey="muMinus3Sigma"
            stroke="#81c784"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            name="Display rating (μ - 3σ)"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className={styles.chartCaption}>
        Shows your skill estimate (μ) over time with ±1σ confidence band.
        Display rating (dashed green) is the conservative estimate shown in your grade.
      </p>
    </div>
  );
}
