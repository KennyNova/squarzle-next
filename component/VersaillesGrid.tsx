// src/components/VersaillesGrid.tsx
'use client';

import { Square } from '@/types/game';
import styles from './VersaillesGrid.module.css';

interface VersaillesGridProps {
  squares: Square[];
  onSquareClick: (square: Square) => void;
}

export default function VersaillesGrid({ squares, onSquareClick }: VersaillesGridProps) {
  return (
    <div className={styles.pattern}>
      {squares.map((square) => (
        <div
          key={square.id}
          onClick={() => onSquareClick(square)}
          className={`
            ${styles.square}
            ${square.size.width > 100 ? styles.large : styles.small}
            ${square.status === 'locked' ? 'bg-gray-800' : ''}
            ${square.status === 'available' ? 'bg-red-500' : ''}
            ${square.status === 'dead' ? 'bg-green-500' : ''}
            ${square.isBoss ? 'border-2 border-yellow-400' : ''}
          `}
          style={{
            gridColumn: `span ${square.size.width > 100 ? 2 : 1}`,
            gridRow: `span ${square.size.height > 100 ? 2 : 1}`,
          }}
        >
          {square.status !== 'locked' && (
            <>
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <span className="text-xs">
                  {Math.ceil(square.health)}/{square.maxHealth}
                </span>
              </div>
              {square.treasure && square.status === 'available' && (
                <span className="absolute top-2 right-2 text-yellow-400">💎</span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}