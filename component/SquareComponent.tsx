import { Square } from '@/types/game';
import styles from './SquareComponent.module.css';

interface SquareComponentProps {
  square: Square;
  onClick: () => void;
}

export default function SquareComponent({ square, onClick }: SquareComponentProps) {
  const healthPercentage = (square.health / square.maxHealth) * 100;
  
  return (
    <div 
      className={styles.square}
      data-status={square.status}
      data-gate={square.isGate ? "true" : "false"}
      style={{ 
        opacity: square.status === 'dead' ? 0.5 : 1,
      }}
      onClick={onClick}
    >
      <div 
        className={`${styles.healthBar} ${square.isGate ? styles.gateHealthBar : ''}`}
        style={{ 
          transform: `scaleX(${square.status === 'available' ? healthPercentage / 100 : 0})`,
        }}
      />
      
      {/* Level indicator for gates */}
      {square.isGate && (
        <div className={styles.gateIndicator}>
          <span>🌀</span>
          {square.gateRequirement && (
            <span className={styles.gateRequirement}>{square.gateRequirement}</span>
          )}
        </div>
      )}
      
      {/* Boss indicator */}
      {square.isBoss && <div className={styles.bossIndicator}>👑</div>}
      
      {/* Treasure indicator */}
      {square.treasure && (
        <div className={styles.treasureIndicator}>
          {square.treasure.type === 'damage' && '💪'}
          {square.treasure.type === 'autoclick' && '⚡'}
          {square.treasure.type === 'coins' && '💰'}
          {square.treasure.type === 'luck' && '🍀'}
        </div>
      )}

      {/* Level number (for debugging) */}
      {square.level && square.level > 1 && (
        <div className={styles.levelIndicator}>
          {square.level}
        </div>
      )}
      
      {/* Health indicator for gates to show they're tougher */}
      {square.isGate && square.status === 'available' && (
        <div className={styles.gateHealthDisplay}>
          {Math.ceil(square.health / 1000)}K
        </div>
      )}
    </div>
  );
} 