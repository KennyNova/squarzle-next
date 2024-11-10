// utils/gameLogic.ts
import { Square, GameState } from '@/types/game';
import seedrandom from 'seedrandom';

export const generateMap = (seed: string): Square[] => {
    const rng = seedrandom(seed);
    const squares: Square[] = [];
    const gridSize = 8;
    
    // Create a template based on the seed
    const template = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    
    // Place large squares based on seed
    for (let y = 0; y < gridSize - 1; y += 2) {
      for (let x = 0; x < gridSize - 1; x += 2) {
        if (rng() > 0.7) { // 30% chance for large squares
          template[y][x] = 2;
          template[y][x + 1] = -1; // Mark as taken
          template[y + 1][x] = -1;
          template[y + 1][x + 1] = -1;
        }
      }
    }
  
    // Fill remaining spaces with small squares
    let squareCount = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (template[y][x] >= 0) { // Not taken by large square
          const size = template[y][x];
          const isBoss = (squareCount + 1) % 10 === 0;
          
          const square: Square = {
            id: `${x}-${y}`,
            health: isBoss ? 1000 * (squareCount + 1) : 100 * (squareCount + 1),
            maxHealth: isBoss ? 1000 * (squareCount + 1) : 100 * (squareCount + 1),
            status: squareCount === 0 ? 'available' : 'locked',
            position: { x, y },
            size: {
              width: size === 2 ? 200 : 100,
              height: size === 2 ? 200 : 100,
            },
            isBoss,
            moneyPerSecond: isBoss ? 10 * (squareCount + 1) : squareCount + 1,
          };
  
          if (rng() < 0.2 && !isBoss) {
            square.treasure = {
              type: ['damage', 'autoclick', 'coins'][Math.floor(rng() * 3)] as 'damage' | 'autoclick' | 'coins',
              value: Math.floor(rng() * 100) + 50,
            };
          }
  
          squares.push(square);
          squareCount++;
        }
      }
    }
  
    return squares;
  };