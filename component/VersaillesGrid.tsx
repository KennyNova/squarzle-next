// src/components/VersaillesGrid.tsx
'use client';

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Square, GameState } from '@/types/game';
import SquareComponent, { SquareView } from './SquareComponent';
import styles from './VersaillesGrid.module.css';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { isSealed } from '@/utils/gameLogic';
import { ZoneTheme, buildZoneIndex, zoneOutline, zoneBounds } from '@/utils/mapGen';
import { Fragment, Impact } from '@/utils/breakage';

export interface BoardEffect {
  id: number;
  squareId: string;
  kind: 'dmg' | 'crit' | 'coin' | 'jackpot' | 'treasure' | 'shatter' | 'chip' | 'zap' | 'boom' | 'sealed';
  text?: string;
  fragments?: Fragment[]; // shatter + chip pieces
}

export interface SquareDamage {
  impacts: Impact[];
  chips: Impact[];
}

interface VersaillesGridProps {
  squares: Square[];
  width: number;
  height: number;
  mapKey: string; // Changes only when a new map is generated
  themes: ZoneTheme[];
  startId: string;
  wonk: number;
  unlockedZone: number;
  gateProgress: GameState['gateProgress'];
  hasRadar: boolean;
  showStartHint: boolean;
  effects: BoardEffect[];
  hitTicks: Record<string, number>;
  damage: Record<string, SquareDamage>;
  armed: boolean;
  shaking: boolean;
  onSquareClick: (id: string, point: { x: number; y: number }) => void;
}

// How far the pointer must travel before a press becomes a pan. Presses that start on a
// square need a bigger push so a slightly shaky click never moves the board.
const PAN_THRESHOLD = 10;
const PAN_THRESHOLD_ON_SQUARE = 22;

// Screen space the camera keeps clear for the HUD (px)
const HUD_TOP = 120;
const HUD_TOP_MOBILE = 200;
const HUD_BOTTOM = 100;
const SIDE_MARGIN = 16;
const MIN_SCALE = 0.1; // Big maps need to fit on screen
const MAX_FIT_SCALE = 1.3; // Small zones shouldn't fill the screen with giant stones

// Grid cells to CSS lengths, used for the frame, the label and the camera
const cellsSpan = (cells: number) => `calc(${cells} * var(--cell) + ${Math.max(0, cells - 1)} * var(--gap))`;
const cellsOffset = (cells: number) => `calc(var(--pad) + ${cells} * (var(--cell) + var(--gap)))`;

const paletteOf = (theme: ZoneTheme) =>
  ({ '--c': theme.c, '--c-light': theme.light, '--c-dark': theme.dark } as React.CSSProperties);

const treasureInfo = {
  damage: { icon: '💪', title: 'Power treasure', text: 'Break it for a permanent click damage boost.' },
  autoclick: { icon: '🤖', title: 'Auto treasure', text: 'Break it for a permanent auto damage boost.' },
  coins: { icon: '💰', title: 'Coin treasure', text: 'Break it for a pile of bonus coins.' },
  luck: { icon: '🍀', title: 'Luck treasure', text: 'Break it for permanent luck: bigger treasure and more jackpots.' },
};

interface Tooltip {
  icon: string;
  title: string;
  lines: string[];
}

type TipKind = 'boss' | 'portal' | 'elite' | 'treasure';

// What the hovered emoji means, in plain words
const describeTip = (
  square: Square, tip: TipKind, gateProgress: GameState['gateProgress'], hasRadar: boolean, unlockedZone: number,
  themes: ZoneTheme[],
): Tooltip | null => {
  const zone = square.level || 1;
  if (zone > unlockedZone || square.status === 'dead') return null;
  const locked = square.status === 'locked';
  const lockedLine = 'Locked: break a square next to it to reach it.';

  switch (tip) {
    case 'boss': {
      if (!square.isGate) return null;
      const info = themes[zone - 1];
      const progress = gateProgress[zone] || 0;
      const lines = isSealed(square, gateProgress)
        ? [`Sealed. Break ${Math.max(0, (square.gateRequirement || 0) - progress)} more squares in this zone to wake it.`]
        : ['Awake! Hit it until it falls.'];
      lines.push(zone < themes.length ? `Defeating it reveals Zone ${zone + 1}: ${themes[zone].name}.` : 'Defeat it to win the game.');
      if (locked) lines.push(lockedLine);
      return { icon: '👑', title: `Zone boss: ${info.boss}`, lines };
    }
    case 'portal':
      if (!square.isPortal) return null;
      return {
        icon: '🌀',
        title: 'Portal',
        lines: [`Break it to wake ${themes[zone - 1].boss} right away, no clearing needed.`, ...(locked ? [lockedLine] : [])],
      };
    case 'elite':
      if (!square.isBoss) return null;
      return { icon: '💎', title: 'Elite square', lines: ['Tough, but drops about 12× the usual coins.', ...(locked ? [lockedLine] : [])] };
    case 'treasure': {
      if (!square.treasure || (locked && !hasRadar)) return null;
      const info = treasureInfo[square.treasure.type];
      return { icon: info.icon, title: info.title, lines: [info.text, ...(locked ? [lockedLine] : [])] };
    }
  }
};

export default function VersaillesGrid({
  squares, width, height, mapKey, themes, startId, wonk, unlockedZone, gateProgress, hasRadar, showStartHint, effects, hitTicks, damage, armed, shaking, onSquareClick,
}: VersaillesGridProps) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ id: string; tip: TipKind } | null>(null);

  // Fits the camera box into the screen space left between the HUD and the ability bar.
  // Done in screen pixels so the HUD margins hold at any zoom level.
  const fitToZone = useCallback((animationTime = 700) => {
    const transform = transformRef.current;
    const camera = cameraRef.current;
    const box = containerRef.current;
    if (!transform || !camera || !box || !camera.offsetWidth) return;
    const hudTop = box.clientWidth < 768 ? HUD_TOP_MOBILE : HUD_TOP;
    const availableWidth = box.clientWidth - 2 * SIDE_MARGIN;
    const availableHeight = Math.max(100, box.clientHeight - hudTop - HUD_BOTTOM);
    const scale = Math.min(MAX_FIT_SCALE, Math.max(MIN_SCALE,
      Math.min(availableWidth / camera.offsetWidth, availableHeight / camera.offsetHeight)));
    const x = (box.clientWidth - camera.offsetWidth * scale) / 2 - camera.offsetLeft * scale;
    const y = hudTop + (availableHeight - camera.offsetHeight * scale) / 2 - camera.offsetTop * scale;
    transform.setTransform(x, y, scale, animationTime, 'easeInOutQuad');
  }, []);

  const hasSquares = squares.length > 0;

  // Frame the starting zone once the map exists
  useEffect(() => {
    if (!hasSquares) return;
    const timer = setTimeout(() => fitToZone(0), 50);
    return () => clearTimeout(timer);
  }, [hasSquares, fitToZone]);

  // Pull the camera back to show each newly unlocked zone
  const firstZoneRender = useRef(true);
  useEffect(() => {
    if (firstZoneRender.current) {
      firstZoneRender.current = false;
      return;
    }
    const timer = setTimeout(() => fitToZone(1400), 700);
    return () => clearTimeout(timer);
  }, [unlockedZone, fitToZone]);

  // Refit whenever the board's box changes size, including its first real layout
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      fitToZone(first ? 0 : 300);
      first = false;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitToZone]);

  // Our own drag-to-pan: nothing moves until the pointer clearly travels, there is no
  // momentum, and a real drag swallows the click so it never hits a square.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pointers = new Set<number>();
    let drag: { id: number; startX: number; startY: number; lastX: number; lastY: number; threshold: number; panning: boolean } | null = null;
    let suppressClick = false;

    const onDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (pointers.size > 1) {
        drag = null; // second finger: leave it to pinch-zoom
        return;
      }
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      const onSquare = !!(event.target as HTMLElement).closest('[data-id]');
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        threshold: onSquare ? PAN_THRESHOLD_ON_SQUARE : PAN_THRESHOLD,
        panning: false,
      };
    };

    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id || !transformRef.current) return;
      if (!drag.panning) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < drag.threshold) return;
        drag.panning = true;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        container.dataset.panning = 'true';
        setHovered(null);
        return;
      }
      const { positionX, positionY, scale } = transformRef.current.instance.transformState;
      transformRef.current.setTransform(positionX + event.clientX - drag.lastX, positionY + event.clientY - drag.lastY, scale, 0);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };

    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (drag && event.pointerId === drag.id) {
        if (drag.panning) suppressClick = true;
        drag = null;
        delete container.dataset.panning;
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    container.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      container.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  // Hover tooltip follows the mouse without re-rendering the board
  const handlePointerMove = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse' || containerRef.current?.dataset.panning) return;
    // Only the emoji itself triggers a tooltip, not the rest of the square
    const tipElement = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    const id = tipElement?.closest<HTMLElement>('[data-id]')?.dataset.id;
    const tip = tipElement?.dataset.tip as TipKind | undefined;
    if (id !== hovered?.id || tip !== hovered?.tip) setHovered(id && tip ? { id, tip } : null);
    if (tooltipRef.current) {
      const flip = event.clientX > window.innerWidth - 280;
      tooltipRef.current.style.transform =
        `translate(${event.clientX + (flip ? -16 : 16)}px, ${event.clientY + 18}px) translateX(${flip ? '-100%' : '0'})`;
    }
  };

  const hoveredSquare = hovered ? squares.find(s => s.id === hovered.id) : undefined;
  const tooltip = hoveredSquare && hovered
    ? describeTip(hoveredSquare, hovered.tip, gateProgress, hasRadar, unlockedZone, themes)
    : null;

  const effectsBySquare = useMemo(() => {
    const grouped: Record<string, BoardEffect[]> = {};
    effects.forEach(effect => { (grouped[effect.squareId] ||= []).push(effect); });
    return grouped;
  }, [effects]);

  const viewOf = (square: Square): SquareView => {
    const zone = square.level || 1;
    if (zone <= unlockedZone) return 'visible';
    if (zone === unlockedZone + 1) return 'teaser';
    return 'fog';
  };

  // Zone layout never changes during a game, so it is worked out once per map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const zoneIndex = useMemo(() => buildZoneIndex(squares, width, height), [mapKey]);
  const outline = useMemo(() => zoneOutline(zoneIndex, unlockedZone), [zoneIndex, unlockedZone]);
  const zoneCount = themes.length;
  const nextZone = unlockedZone < zoneCount ? unlockedZone + 1 : null;

  // The camera frames the open zones plus a sliver of what's next
  const bounds = zoneBounds(zoneIndex, unlockedZone);
  const cam = {
    x0: Math.max(0, bounds.x0 - 1), y0: Math.max(0, bounds.y0 - 1),
    x1: Math.min(width - 1, bounds.x1 + 1), y1: Math.min(height - 1, bounds.y1 + 1),
  };

  // The "next zone" label floats over the cells that open when the current boss falls
  const teaserSpot = useMemo(() => {
    if (!nextZone) return null;
    const { cells } = zoneIndex;
    const boss = squares.find(s => s.isGate && s.level === unlockedZone);
    const points: [number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y * width + x] !== nextZone) continue;
        const nearBoss = boss
          ? x >= boss.position.x - 1 && x <= boss.position.x + boss.size.w && y >= boss.position.y - 1 && y <= boss.position.y + boss.size.h
          : true;
        if (nearBoss) points.push([x, y]);
      }
    }
    if (!points.length) return null;
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return { x: cx + 0.5, y: cy + 0.5 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneIndex, unlockedZone, nextZone]);

  const renderEffect = (effect: BoardEffect) => {
    if (effect.kind === 'shatter' || effect.kind === 'chip') {
      return (
        <div key={effect.id} className={styles.debris} data-kind={effect.kind}>
          {effect.fragments?.map((fragment, i) => (
            <div
              key={i}
              className={styles.fragmentDrift}
              style={{ '--dx': `${fragment.dx}px`, animationDelay: `${fragment.delay}ms` } as React.CSSProperties}
            >
              <div
                className={styles.fragment}
                style={{
                  clipPath: fragment.clipPath,
                  transformOrigin: `${fragment.originX}% ${fragment.originY}%`,
                  animationDelay: `${fragment.delay}ms`,
                  '--rot': `${fragment.rotate}deg`,
                } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div key={effect.id} className={styles.effect} data-kind={effect.kind}>
        {effect.text}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.gridContainer} ${shaking ? styles.shake : ''}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHovered(null)}
    >
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={MIN_SCALE}
        maxScale={3}
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        panning={{ disabled: true }}
      >
        {({ zoomIn, zoomOut }) => (
          <>
            <div className={styles.gridControls}>
              <button onClick={() => zoomIn()} className={styles.controlButton} aria-label="Zoom in">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button onClick={() => zoomOut()} className={styles.controlButton} aria-label="Zoom out">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              </button>
              <button onClick={() => fitToZone()} className={styles.controlButton} aria-label="Center on current zone">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M9 12h6M12 9v6" />
                </svg>
              </button>
            </div>

            <TransformComponent wrapperClass={styles.transformWrapper} contentClass={styles.transformContent}>
              <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${width}, var(--cell))` }}>
                {/* Invisible box the camera fits to: the open zones plus a sliver of what's next */}
                <div
                  ref={cameraRef}
                  className={styles.cameraTarget}
                  style={{
                    left: `calc(${cellsOffset(cam.x0)} - var(--pad))`,
                    top: `calc(${cellsOffset(cam.y0)} - var(--pad))`,
                    width: `calc(${cellsSpan(cam.x1 - cam.x0 + 1)} + 2 * var(--pad))`,
                    height: `calc(${cellsSpan(cam.y1 - cam.y0 + 1)} + 2 * var(--pad))`,
                  }}
                />

                {/* Glowing outline traced along the mortar around every open zone */}
                <svg
                  className={styles.zoneFrame}
                  style={{
                    ...paletteOf(themes[unlockedZone - 1]),
                    width: `calc(${width} * (var(--cell) + var(--gap)))`,
                    height: `calc(${height} * (var(--cell) + var(--gap)))`,
                  }}
                  viewBox={`0 0 ${width} ${height}`}
                  preserveAspectRatio="none"
                >
                  <path d={outline} />
                </svg>

                {nextZone && teaserSpot && (
                  <div
                    className={styles.teaserLabel}
                    style={{
                      ...paletteOf(themes[nextZone - 1]),
                      left: `calc(var(--pad) + ${teaserSpot.x} * (var(--cell) + var(--gap)) - var(--gap) / 2)`,
                      top: `calc(var(--pad) + ${teaserSpot.y} * (var(--cell) + var(--gap)) - var(--gap) / 2)`,
                    }}
                  >
                    <span className={styles.teaserLock}>🔒</span>
                    <span className={styles.teaserTitle}>Zone {nextZone}</span>
                    <span className={styles.teaserName}>{themes[nextZone - 1].name}</span>
                    <span className={styles.teaserHint}>Defeat {themes[unlockedZone - 1].boss}</span>
                  </div>
                )}

                {squares.map((square) => {
                  const view = viewOf(square);
                  const squareEffects = effectsBySquare[square.id];
                  const squareDamage = damage[square.id];
                  return (
                    <div
                      key={square.id}
                      data-id={view === 'visible' ? square.id : undefined}
                      className={styles.cell}
                      style={{
                        ...paletteOf(themes[(square.level || 1) - 1]),
                        gridColumn: `${square.position.x + 1} / span ${square.size.w}`,
                        gridRow: `${square.position.y + 1} / span ${square.size.h}`,
                        zIndex: squareEffects ? 5 : square.isGate ? 2 : undefined,
                      }}
                    >
                      <SquareComponent
                        square={square}
                        theme={themes[(square.level || 1) - 1]}
                        wonk={wonk}
                        view={view}
                        sealed={isSealed(square, gateProgress)}
                        progress={gateProgress[square.level || 1] || 0}
                        showTreasure={hasRadar}
                        hitTick={hitTicks[square.id] || 0}
                        armed={armed}
                        hint={showStartHint && square.id === startId}
                        impacts={squareDamage?.impacts}
                        chips={squareDamage?.chips}
                        onClick={onSquareClick}
                      />
                      {squareEffects?.map(renderEffect)}
                    </div>
                  );
                })}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>

      <div ref={tooltipRef} className={styles.tooltip} data-visible={tooltip ? 'true' : 'false'}>
        {tooltip && (
          <>
            <div className={styles.tooltipTitle}><span>{tooltip.icon}</span>{tooltip.title}</div>
            {tooltip.lines.map(line => <p key={line}>{line}</p>)}
          </>
        )}
      </div>
    </div>
  );
}
