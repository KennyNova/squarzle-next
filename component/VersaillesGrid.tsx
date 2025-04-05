// src/components/VersaillesGrid.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Square } from '@/types/game';
import SquareComponent from './SquareComponent';
import styles from './VersaillesGrid.module.css';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface VersaillesGridProps {
  squares: Square[];
  onSquareClick: (square: Square) => void;
}

export default function VersaillesGrid({ squares, onSquareClick }: VersaillesGridProps) {
  // Calculate relative size based on square size
  const calculateGridSpan = (size: number): number => {
    const baseSize = 100;
    return Math.max(1, Math.round(size / baseSize));
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const [originSquare, setOriginSquare] = useState<Square | null>(null);
  
  // Find the origin square (lowest numbered id or first available)
  useEffect(() => {
    if (!squares.length) return;
    
    // First try to find the lowest numbered square that's available
    const firstAvailable = [...squares]
      .filter(square => square.status === 'available')
      .sort((a, b) => {
        const [ax, ay] = a.id.split('-').map(Number);
        const [bx, by] = b.id.split('-').map(Number);
        // Sort by distance from origin (0,0)
        return (ax*ax + ay*ay) - (bx*bx + by*by);
      })[0];
      
    if (firstAvailable) {
      setOriginSquare(firstAvailable);
    } else {
      // If no available square, use the first square in the grid
      setOriginSquare(squares[0]);
    }
  }, [squares]);

  return (
    <div className={styles.gridContainer}>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        limitToBounds={false}
        centerOnInit={true}
        doubleClick={{ disabled: true }}
        panning={{ excluded: ['button', 'a'] }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className={styles.gridControls}>
              <button 
                onClick={() => zoomIn()} 
                className={styles.controlButton}
                aria-label="Zoom in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              
              <button 
                onClick={() => zoomOut()} 
                className={styles.controlButton}
                aria-label="Zoom out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              </button>
              
              <button 
                onClick={() => {
                  resetTransform();
                  
                  // If we have an origin square, try to center on it
                  if (originSquare && gridRef.current) {
                    const container = gridRef.current;
                    const element = container.querySelector(`[data-id="${originSquare.id}"]`);
                    
                    if (element) {
                      // Need to find element's position relative to container
                      // This is a simple implementation which you may need to adjust
                      setTimeout(() => {
                        element.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                          inline: 'center'
                        });
                      }, 100);
                    }
                  }
                }}
                className={styles.controlButton}
                aria-label="Reset and go to origin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={styles.controlIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
            </div>
            
            <TransformComponent wrapperClass={styles.transformWrapper} contentClass={styles.transformContent}>
              <div className={styles.grid} ref={gridRef}>
                {squares.map((square) => (
                  <div
                    key={square.id}
                    data-id={square.id}
                    style={{
                      gridColumn: `span ${calculateGridSpan(square.size.width)}`,
                      gridRow: `span ${calculateGridSpan(square.size.height)}`,
                    }}
                  >
                    <SquareComponent
                      square={square}
                      onClick={() => onSquareClick(square)}
                    />
                  </div>
                ))}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}