import { mergePipColors, type PipColorMap } from 'double-eighteen';

/** Cosmic pip palette for Navigational Coordinates (0–12). */
export const WARP_PIP_COLORS: PipColorMap = mergePipColors({
  0: { color: 'transparent' },
  1: { color: '#c7d2fe' }, // starlight
  2: { color: '#818cf8' }, // nebula violet
  3: { color: '#fbbf24' }, // warp plasma
  4: { color: '#e2e8f0', hollow: true }, // hull plating
  5: { color: '#34d399' }, // impulse trail
  6: { color: '#38bdf8' }, // deflector glow
  7: { color: '#fb923c' }, // alert amber
  8: { color: '#f87171' }, // red alert
  9: { color: '#6366f1' }, // subspace indigo
  10: { color: '#a78bfa' }, // tachyon lavender
  11: { color: '#4ade80' }, // life-support green
  12: { color: '#fcd34d' }, // spacedock gold
});

export const warpPalette = {
  void: '#050816',
  nebula: '#0f172a',
  table: '#0a1628',
  tableBorder: '#1e3a5f',
  spacedock: '#334155',
  spacedockRing: '#38bdf8',
  spacedockGlow: 'rgba(56, 189, 248, 0.35)',
  panel: 'rgba(15, 23, 42, 0.85)',
  panelBorder: '#334155',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  danger: '#f87171',
} as const;
