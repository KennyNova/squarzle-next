import { memo, useMemo } from 'react';
import { Square } from '@/types/game';
import { ZoneTheme, stoneLook } from '@/utils/mapGen';
import { Impact, crackPaths, chipPolygon, toSvgPoints } from '@/utils/breakage';
import styles from './SquareComponent.module.css';

export type SquareView = 'visible' | 'teaser' | 'fog';

interface SquareComponentProps {
  square: Square;
  theme: ZoneTheme;
  wonk: number; // 0..1, how uneven the stones are cut
  view: SquareView;
  sealed: boolean;
  progress: number;
  showTreasure: boolean;
  hitTick: number;
  armed: boolean;
  hint: boolean;
  impacts?: Impact[];
  chips?: Impact[];
  // point is where on the square the click landed, 0-100 on each axis
  onClick: (id: string, point: { x: number; y: number }) => void;
}

const treasureEmoji = {
  damage: '💪',
  autoclick: '🤖',
  coins: '💰',
  luck: '🍀',
};

const formatHealth = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${Math.ceil(value)}`;
};

// Cracks and chipped-out holes, drawn from where the square was actually hit
function Damage({ impacts, chips, severity }: { impacts: Impact[]; chips: Impact[]; severity: number }) {
  // Quantised so cracks only regrow when damage moves meaningfully
  const step = Math.round(severity * 12) / 12;
  const paths = useMemo(() => crackPaths(impacts, step), [impacts, step]);
  const holes = useMemo(() => chips.map(chip => toSvgPoints(chipPolygon(chip, 11))), [chips]);

  return (
    <svg className={styles.damage} viewBox="0 0 100 100" preserveAspectRatio="none">
      {holes.map((points, i) => (
        <g key={`h${i}`}>
          <polygon points={points} className={styles.hole} />
          <polygon points={points} className={styles.holeEdge} />
        </g>
      ))}
      {paths.map((d, i) => <path key={`l${i}`} d={d} className={styles.crackLight} />)}
      {paths.map((d, i) => <path key={`c${i}`} d={d} className={styles.crack} />)}
      {impacts.map((impact, i) => (
        <circle key={`p${i}`} cx={impact.x} cy={impact.y} r={2.2 + severity * 2} className={styles.crater} />
      ))}
    </svg>
  );
}

function SquareComponent({
  square, theme, wonk, view, sealed, progress, showTreasure, hitTick, armed, hint, impacts, chips, onClick,
}: SquareComponentProps) {
  const area = square.size.w * square.size.h;
  // Every stone is cut a little differently: uneven corners, a slight tilt, its own shade
  const stoneStyle = useMemo(() => {
    const look = stoneLook(square.id, area, wonk);
    return {
      top: look.inset[0], right: look.inset[1], bottom: look.inset[2], left: look.inset[3],
      borderRadius: look.radius,
      '--tilt': `${look.tilt}deg`,
      '--shade-to': look.shade < 0 ? 'black' : 'white',
      '--shade-pct': `${Math.round(Math.abs(look.shade) * 22)}%`,
      '--tex': `${look.texX}px ${look.texY}px`,
      '--span': Math.min(square.size.w, square.size.h),
    } as React.CSSProperties;
  }, [square.id, area, wonk, square.size.w, square.size.h]);

  if (view !== 'visible') {
    return <div className={styles.fog} data-view={view} style={{ borderRadius: stoneStyle.borderRadius }} />;
  }

  const healthPercentage = Math.max(0, (square.health / square.maxHealth) * 100);
  const damaged = square.status === 'available' && healthPercentage < 100;
  const zone = theme;
  const isBig = square.size.w > 1 && square.size.h > 1;
  const kind = square.isGate ? 'boss' : square.isPortal ? 'portal' : square.isBoss ? 'elite' : 'normal';
  const treasureVisible = square.treasure && !square.isPortal && !square.isGate &&
    square.status !== 'dead' && (square.status === 'available' || showTreasure);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Keyboard/synthetic clicks have no real position, so keep the impact inside the square
    const inside = (value: number) => (Number.isFinite(value) ? Math.max(4, Math.min(96, value)) : 50);
    onClick(square.id, {
      x: inside(((event.clientX - rect.left) / rect.width) * 100),
      y: inside(((event.clientY - rect.top) / rect.height) * 100),
    });
  };

  return (
    <div
      className={styles.square}
      data-status={square.status}
      data-kind={kind}
      data-level={square.level || 1}
      data-sealed={sealed ? 'true' : 'false'}
      data-armed={armed && square.status === 'available' ? 'true' : 'false'}
      data-hint={hint ? 'true' : 'false'}
      style={stoneStyle}
      onClick={handleClick}
    >
      <div key={hitTick} className={`${styles.body} ${hitTick ? styles.hit : ''}`}>
        {square.status === 'dead' ? (
          <div className={styles.rubble} />
        ) : (
          <>
            {damaged && (impacts?.length || chips?.length) ? (
              <Damage impacts={impacts || []} chips={chips || []} severity={1 - healthPercentage / 100} />
            ) : null}

            {square.isGate && (
              <div className={styles.bossFace}>
                <span className={styles.bossEmoji} data-tip="boss">{zone.bossEmoji}</span>
                {square.status === 'available' && <span className={styles.bossName}>{zone.boss}</span>}
                {square.status === 'available' && sealed && (
                  <span className={styles.sealBadge}>🔒 {progress}/{square.gateRequirement}</span>
                )}
              </div>
            )}

            {square.isPortal && <div className={styles.portalSwirl}><span data-tip="portal">🌀</span></div>}
            {square.isBoss && <div className={styles.eliteBadge} data-tip="elite">💎</div>}
            {square.status === 'locked' && !square.isGate && <div className={styles.lockIcon}>🔒</div>}

            {treasureVisible && (
              <div className={`${styles.treasure} ${isBig ? styles.treasureBig : ''}`} data-tip="treasure">
                {treasureEmoji[square.treasure!.type]}
              </div>
            )}

            {(damaged || (square.isGate && square.status === 'available')) && (
              <div className={styles.healthTrack}>
                <div className={styles.healthFill} style={{ transform: `scaleX(${healthPercentage / 100})` }} />
                {(isBig || square.isGate) && (
                  <span className={styles.healthText}>{formatHealth(square.health)}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* The crown marks the zone boss */}
      {square.isGate && square.status !== 'dead' && <div className={styles.bossCrown} data-tip="boss">👑</div>}

      {hint && square.status === 'available' && (
        <div className={styles.hintBubble}>
          <span className={styles.hintFinger}>👆</span>
          Click me!
        </div>
      )}
    </div>
  );
}

export default memo(SquareComponent);
