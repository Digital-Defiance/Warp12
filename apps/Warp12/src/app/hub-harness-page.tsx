import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DominoHub, DominoThemeProvider } from 'double-eighteen';
import { WARP_PIP_COLORS, createWarpDominoTheme } from 'warp12-theme';
import { WARP_FACTORS, type WarpFactor, isWarpFactor } from 'warp12-engine';

import { buildHubHarnessScene } from './hub-harness-fixtures.js';
import { TrailSpokeIndicators } from './trail-spoke-indicators.js';
import { computeFitView } from './table-viewport.js';
import styles from './hub-harness-page.module.scss';

const PLAYER_PRESETS = [4, 8, 12, 18] as const;

function parsePlayers(raw: string | null): number {
  const value = Number.parseInt(raw ?? '8', 10);
  if (!Number.isFinite(value)) return 8;
  return Math.min(18, Math.max(2, value));
}

function parseSet(raw: string | null): WarpFactor {
  const value = Number.parseInt(raw ?? '12', 10);
  return isWarpFactor(value) ? value : 12;
}

function parseLayout(raw: string | null): 'offset' | 'linear' {
  return raw === 'linear' ? 'linear' : 'offset';
}

export const HubHarnessPage: FC = () => {
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState(() => parsePlayers(params.get('players')));
  const [maxPip, setMaxPip] = useState<WarpFactor>(() =>
    parseSet(params.get('set'))
  );
  const [layoutStyle, setLayoutStyle] = useState<'offset' | 'linear'>(() =>
    parseLayout(params.get('layout'))
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, pan: { x: 0, y: 0 } });

  const syncUrl = (
    nextPlayers: number,
    nextSet: WarpFactor,
    nextLayout: 'offset' | 'linear'
  ) => {
    const next = new URLSearchParams();
    next.set('players', String(nextPlayers));
    next.set('set', String(nextSet));
    next.set('layout', nextLayout);
    setParams(next, { replace: true });
  };

  const scene = useMemo(
    () => buildHubHarnessScene(players, maxPip, layoutStyle),
    [players, maxPip, layoutStyle]
  );
  const { geometry, trains, spokes, round } = scene;
  const theme = useMemo(() => createWarpDominoTheme({}), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      setView(
        computeFitView(
          width,
          height,
          geometry.tableWidth,
          geometry.tableHeight,
          0.15
        )
      );
    };

    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [geometry.tableHeight, geometry.tableWidth]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.back}>
          <Link to="/">← Bridge</Link>
        </p>
        <h1 className={styles.title}>Hub layout harness</h1>
        <p className={styles.lead}>
          Visual approval for spoke count, Neutral Zone arm, and table growth.
          Captains + 1 Neutral Zone spoke; canvas scales with{' '}
          <code>hubTrainStartDistance</code>.
        </p>
      </header>

      <section className={styles.controls} aria-label="Harness controls">
        <label className={styles.field}>
          <span>Captains</span>
          <div className={styles.presets}>
            {PLAYER_PRESETS.map((count) => (
              <button
                key={count}
                type="button"
                className={styles.preset}
                data-active={players === count}
                onClick={() => {
                  setPlayers(count);
                  syncUrl(count, maxPip, layoutStyle);
                }}
              >
                {count}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={2}
            max={18}
            value={players}
            aria-label="Captain count"
            onChange={(event) => {
              const next = Number(event.target.value);
              setPlayers(next);
              syncUrl(next, maxPip, layoutStyle);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>Warp factor (max pip)</span>
          <select
            value={maxPip}
            onChange={(event) => {
              const next = parseSet(event.target.value);
              setMaxPip(next);
              syncUrl(players, next, layoutStyle);
            }}
          >
            {WARP_FACTORS.map((factor) => (
              <option key={factor} value={factor}>
                Double-{factor}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Train layout</span>
          <select
            value={layoutStyle}
            onChange={(event) => {
              const next = parseLayout(event.target.value);
              setLayoutStyle(next);
              syncUrl(players, maxPip, next);
            }}
          >
            <option value="offset">Offset</option>
            <option value="linear">Linear</option>
          </select>
        </label>
      </section>

      <dl className={styles.metrics}>
        <div>
          <dt>Hub slots</dt>
          <dd>{geometry.hubSlots}</dd>
        </div>
        <div>
          <dt>NZ slot</dt>
          <dd>{geometry.hubSlots - 1}</dd>
        </div>
        <div>
          <dt>Hub radius</dt>
          <dd>{Math.round(geometry.hubRadius)}px</dd>
        </div>
        <div>
          <dt>Start distance</dt>
          <dd>{geometry.startDistance}px</dd>
        </div>
        <div>
          <dt>Table</dt>
          <dd>
            {geometry.tableWidth}×{geometry.tableHeight}
          </dd>
        </div>
        <div>
          <dt>Fit scale</dt>
          <dd>{Math.round(view.scale * 100)}%</dd>
        </div>
      </dl>

      <div ref={stageRef} className={styles.stage}>
        <DominoThemeProvider theme={theme}>
          <div
            className={styles.canvas}
            style={{
              width: geometry.tableWidth,
              height: geometry.tableHeight,
              transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.scale})`,
            }}
          >
            <div className={styles.table}>
              <TrailSpokeIndicators
                centerX={geometry.centerX}
                centerY={geometry.centerY}
                hubRadius={geometry.hubRadius}
                startDistance={geometry.startDistance}
                hubSlots={geometry.hubSlots}
                spokes={spokes}
              />
              <DominoHub
                playerCount={geometry.hubSlots}
                centerX={geometry.centerX}
                centerY={geometry.centerY}
                radius={geometry.hubRadius}
                engineValue={round.spacedockValue}
                maxPips={maxPip}
                trains={trains}
                layoutStyle={layoutStyle}
                tableWidth={geometry.tableWidth}
                tableHeight={geometry.tableHeight}
                pipColors={WARP_PIP_COLORS}
              />
            </div>
          </div>
        </DominoThemeProvider>
      </div>
    </div>
  );
};
