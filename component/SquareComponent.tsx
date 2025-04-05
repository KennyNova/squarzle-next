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
      style={{ 
        opacity: square.status === 'dead' ? 0.5 : 1,
      }}
      onClick={onClick}
    >
      <div 
        className={styles.healthBar}
        style={{ 
          transform: `scaleX(${square.status === 'available' ? healthPercentage / 100 : 0})`,
        }}
      />
      {square.isBoss && <div className={styles.bossIndicator}>👑</div>}
      {square.treasure && <div className={styles.treasureIndicator}>💎</div>}
    </div>
  );
} 