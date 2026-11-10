'use client';

import { memo, useMemo, useState } from 'react';
import { MapConfig, MapLayout, Direction, Square } from '@/types/game';
import {
  generateMap, normalizeConfig, encodeMap, decodeMap, randomSeed, randomMapConfig, zoneThemes, stoneLook,
  MAP_PRESETS, MAP_LIMITS, ZoneTheme,
} from '@/utils/mapGen';
import styles from './MapCreator.module.css';

interface MapCreatorProps {
  initial: MapConfig;
  canClose: boolean;
  runInProgress: boolean;
  onPlay: (config: MapConfig) => void;
  onClose: () => void;
}

const LAYOUTS: { id: MapLayout; name: string; icon: string; blurb: string; dirLabel: string }[] = [
  { id: 'rings', name: 'Pyramid', icon: '🔺', blurb: 'Border first, big boss in the middle', dirLabel: 'Enter from' },
  { id: 'sweep', name: 'Sweep', icon: '➡️', blurb: 'Bands straight across the map', dirLabel: 'Head toward' },
  { id: 'corner', name: 'Corner', icon: '📐', blurb: 'Zones grow out of one corner', dirLabel: 'Head toward' },
  { id: 'burst', name: 'Burst', icon: '💥', blurb: 'Start in the middle, break outward', dirLabel: 'Big boss waits' },
];

// Direction pad, laid out like the compass it represents
const PAD: (Direction | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
const ARROWS: Record<Direction, string> = { NW: '↖', N: '↑', NE: '↗', W: '←', E: '→', SW: '↙', S: '↓', SE: '↘' };

const treasureColor = '#fde047';

const MapPreview = memo(function MapPreview({ squares, width, height, themes, startId, wonk }: {
  squares: Square[]; width: number; height: number; themes: ZoneTheme[]; startId: string; wonk: number;
}) {
  const gap = 0.07;
  const radius = 0.1 + wonk * 0.16;
  return (
    <svg className={styles.preview} viewBox={`-0.4 -0.4 ${width + 0.8} ${height + 0.8}`} preserveAspectRatio="xMidYMid meet">
      {squares.map(square => {
        const { x, y } = square.position;
        const { w, h } = square.size;
        const theme = themes[(square.level || 1) - 1];
        const look = stoneLook(square.id, w * h, wonk);
        const shade = `color-mix(in srgb, ${theme.c}, ${look.shade < 0 ? 'black' : 'white'} ${Math.round(Math.abs(look.shade) * 28)}%)`;
        const cx = x + w / 2;
        const cy = y + h / 2;
        return (
          <g key={square.id} transform={`rotate(${look.tilt} ${cx} ${cy})`}>
            <rect
              x={x + gap} y={y + gap} width={w - gap * 2} height={h - gap * 2} rx={radius}
              style={{ fill: shade }}
              stroke={square.isGate ? '#fde047' : square.isBoss ? '#facc15' : 'none'}
              strokeWidth={square.isGate ? 0.12 : 0.08}
            />
            {square.isGate && (
              <text x={cx} y={cy} fontSize={Math.min(w, h) * 0.62} textAnchor="middle" dominantBaseline="central">
                {theme.bossEmoji}
              </text>
            )}
            {square.id === startId && (
              <text x={cx} y={cy} fontSize={0.75} textAnchor="middle" dominantBaseline="central">🚩</text>
            )}
            {square.isPortal && (
              <text x={cx} y={cy} fontSize={0.6} textAnchor="middle" dominantBaseline="central">🌀</text>
            )}
            {!square.isPortal && square.treasure && (
              <circle cx={x + w - 0.28} cy={y + 0.28} r={0.12} fill={treasureColor} />
            )}
          </g>
        );
      })}
    </svg>
  );
});

function Slider({ label, value, min, max, step = 1, format, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  format?: (value: number) => string; onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs font-bold text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white">{format ? format(value) : value}</span>
      </span>
      <input
        type="range" className={styles.range} min={min} max={max} step={step} value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const describe = (value: number, words: string[]) => words[Math.min(words.length - 1, Math.floor(value * words.length))];

export default function MapCreator({ initial, canClose, runInProgress, onPlay, onClose }: MapCreatorProps) {
  const [config, setConfig] = useState<MapConfig>(() => normalizeConfig(initial));
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = (patch: Partial<MapConfig>) => setConfig(current => normalizeConfig({ ...current, ...patch }));
  const map = useMemo(() => generateMap(config), [config]);
  const themes = zoneThemes(map.zoneCount);
  const code = encodeMap(config);
  const layout = LAYOUTS.find(l => l.id === config.layout)!;

  const stats = useMemo(() => ({
    stones: map.squares.length,
    treasure: map.squares.filter(s => s.treasure && !s.isPortal).length,
    elites: map.squares.filter(s => s.isBoss).length,
  }), [map]);

  const chooseLayout = (id: MapLayout) => {
    // Corners only make sense heading diagonally
    const direction = id === 'corner' && config.direction.length === 1 ? 'SE' : config.direction;
    update({ layout: id, direction });
  };

  const loadCode = () => {
    const decoded = decodeMap(codeInput.split('map=').pop() || '');
    if (!decoded) {
      setCodeError(true);
      return;
    }
    setConfig(decoded);
    setCodeInput('');
    setCodeError(false);
  };

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?map=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCodeInput(link);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0714] text-white md:flex-row">
      {/* Live preview */}
      <section className="relative flex min-h-[48vh] flex-1 flex-col p-3 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black md:text-2xl">🗺️ Map creator</h2>
          {canClose && (
            <button className="hud-icon-button md:hidden" onClick={onClose} aria-label="Close map creator">✕</button>
          )}
        </div>
        <div className={styles.previewFrame}>
          <MapPreview
            key={`${config.seed}-${config.layout}-${config.direction}`}
            squares={map.squares} width={config.width} height={config.height}
            themes={themes} startId={map.startId} wonk={config.wonk}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {themes.map((theme, i) => (
            <span key={theme.name} className={styles.zoneChip} style={{ '--c': theme.c } as React.CSSProperties}>
              <span className={styles.zoneDot} />{i + 1}.<span className="hidden sm:inline"> {theme.name}</span> {theme.bossEmoji}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/60">
          {stats.stones} stones · {map.zoneCount} zones · {stats.elites} elites · {stats.treasure} treasures · 🚩 start
          {map.zoneCount < config.zones && (
            <span className="ml-1 text-amber-300">· Only {map.zoneCount} of {config.zones} zones fit. Make the map bigger.</span>
          )}
        </p>
      </section>

      {/* Controls */}
      <aside className="flex max-h-[52vh] w-full flex-col border-t border-white/10 bg-[#140e22] md:max-h-none md:w-[380px] md:border-l md:border-t-0">
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <h3 className={styles.heading}>Presets</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {MAP_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={styles.preset}
                  title={preset.blurb}
                  onClick={() => setConfig(normalizeConfig({ ...preset.config, seed: config.seed }))}
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
            <button className={`${styles.preset} mt-1.5 w-full flex-row`} onClick={() => setConfig(randomMapConfig())}>
              🎲 Surprise me
            </button>
          </div>

          <div>
            <h3 className={styles.heading}>Layout</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {LAYOUTS.map(option => (
                <button
                  key={option.id}
                  className={styles.option}
                  data-active={config.layout === option.id}
                  onClick={() => chooseLayout(option.id)}
                >
                  <span className="text-base font-black">{option.icon} {option.name}</span>
                  <span className="text-[11px] text-white/55">{option.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={styles.pad}>
              {PAD.map((dir, i) => {
                if (!dir) return <span key={i} className={styles.padCenter}>{layout.icon}</span>;
                const disabled = config.layout === 'corner' && dir.length === 1;
                return (
                  <button
                    key={dir}
                    className={styles.padButton}
                    data-active={config.direction === dir}
                    disabled={disabled}
                    onClick={() => update({ direction: dir })}
                    aria-label={`${layout.dirLabel} ${dir}`}
                  >
                    {config.layout === 'rings' || config.layout === 'burst' ? '●' : ARROWS[dir]}
                  </button>
                );
              })}
            </div>
            <div>
              <h3 className={styles.heading}>{layout.dirLabel}</h3>
              <p className="text-sm font-bold">{config.direction}</p>
              <p className="text-[11px] text-white/55">
                {config.layout === 'rings' && 'Which side of the outer ring you start on.'}
                {config.layout === 'burst' && 'Which edge the final boss guards.'}
                {(config.layout === 'sweep' || config.layout === 'corner') && 'You start on the far side and push this way.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className={styles.heading}>Size</h3>
            <Slider label="Width" value={config.width} min={MAP_LIMITS.minSize} max={MAP_LIMITS.maxSize} onChange={width => update({ width })} />
            <Slider label="Height" value={config.height} min={MAP_LIMITS.minSize} max={MAP_LIMITS.maxSize} onChange={height => update({ height })} />
            <Slider label="Zones" value={config.zones} min={MAP_LIMITS.minZones} max={MAP_LIMITS.maxZones} onChange={zones => update({ zones })} />
            <Slider
              label="Boss size" value={config.bossSize} min={MAP_LIMITS.minBoss} max={MAP_LIMITS.maxBoss}
              format={v => `${v}×${v} · final ${Math.min(5, v + 1)}×${Math.min(5, v + 1)}`}
              onChange={bossSize => update({ bossSize })}
            />
          </div>

          <div className="space-y-3">
            <h3 className={styles.heading}>Stonework</h3>
            <Slider
              label="Stone size" value={config.stoneSize} min={0} max={1} step={0.05}
              format={v => describe(v, ['Mosaic chips', 'Small', 'Bricks', 'Blocks', 'Slabs'])}
              onChange={stoneSize => update({ stoneSize })}
            />
            <Slider
              label="Wonkiness" value={config.wonk} min={0} max={1} step={0.05}
              format={v => describe(v, ['Machine cut', 'Tidy', 'Hand cut', 'Rough', 'Rubble'])}
              onChange={wonk => update({ wonk })}
            />
            <Slider
              label="Ragged borders" value={config.roughness} min={0} max={1} step={0.05}
              format={v => describe(v, ['Straight', 'Wavy', 'Ragged', 'Wild'])}
              onChange={roughness => update({ roughness })}
            />
          </div>

          <div className="space-y-3">
            <h3 className={styles.heading}>Loot</h3>
            <Slider label="Elites 💎" value={config.elites} min={0} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={elites => update({ elites })} />
            <Slider label="Treasure 💰" value={config.treasure} min={0} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={treasure => update({ treasure })} />
          </div>

          <div className="space-y-2">
            <h3 className={styles.heading}>Seed & sharing</h3>
            <div className="flex gap-1.5">
              <input
                className={styles.input}
                value={config.seed}
                onChange={event => update({ seed: event.target.value })}
                aria-label="Seed"
              />
              <button className={styles.smallButton} onClick={() => update({ seed: randomSeed() })} title="New seed">🎲 Reroll</button>
            </div>
            <div className="flex gap-1.5">
              <input className={`${styles.input} text-white/60`} value={code} readOnly aria-label="Map code" onFocus={event => event.target.select()} />
              <button className={styles.smallButton} onClick={copyLink}>{copied ? '✓ Copied' : '🔗 Copy link'}</button>
            </div>
            <div className="flex gap-1.5">
              <input
                className={styles.input}
                data-error={codeError}
                value={codeInput}
                placeholder="Paste a map code or link"
                onChange={event => { setCodeInput(event.target.value); setCodeError(false); }}
                onKeyDown={event => { if (event.key === 'Enter') loadCode(); }}
              />
              <button className={styles.smallButton} onClick={loadCode} disabled={!codeInput.trim()}>Load</button>
            </div>
            {codeError && <p className="text-xs text-red-300">That code doesn&apos;t look like a Squarzle map.</p>}
          </div>
        </div>

        {runInProgress && (
          <p className="px-4 pb-2 text-[11px] text-amber-200/80">
            Playing a new map replaces your current run.
          </p>
        )}
        <div className="flex gap-2 border-t border-white/10 p-3">
          {canClose && (
            <button className="hidden rounded-xl bg-white/10 px-4 py-3 font-bold hover:bg-white/15 md:block" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            className="flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 px-6 py-3 font-black shadow-[0_5px_0_#4c1d95] transition active:translate-y-1 active:shadow-none"
            onClick={() => onPlay(config)}
          >
            ▶ Play this map
          </button>
        </div>
      </aside>
    </div>
  );
}
