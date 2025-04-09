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
      data-portal={square.isPortal ? "true" : "false"}
      data-level={square.level || 1}
      style={{ 
        opacity: square.status === 'dead' ? 0.5 : 1,
      }}
      onClick={onClick}
    >
      <div 
        className={`${styles.healthBar} ${square.isGate ? styles.gateHealthBar : ''} ${square.isPortal ? styles.portalHealthBar : ''}`}
        style={{ 
          transform: `scaleX(${square.status === 'available' ? healthPercentage / 100 : 0})`,
        }}
      />
      
      {/* Gate indicator */}
      {square.isGate && (
        <div className={styles.gateIndicator}>
          <span>⛩️</span>
          {square.gateRequirement && (
            <span className={styles.gateRequirement}>{square.gateRequirement}</span>
          )}
        </div>
      )}
      
      {/* Portal indicator */}
      {square.isPortal && (
        <div className={styles.portalIndicator}>
          <span>🌀</span>
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

      {/* Level number - always show it */}
      <div 
        className={styles.levelIndicator}
        title={`Level ${square.level || 1}`}
      >
        {`L${square.level || 1}`}
      </div>
      
      {/* Health indicator for gates to show they're tougher */}
      {square.isGate && square.status === 'available' && (
        <div className={styles.gateHealthDisplay}>
          {Math.ceil(square.health / 1000)}K
        </div>
      )}
    </div>
  );
} 