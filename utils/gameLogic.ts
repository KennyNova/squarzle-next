// utils/gameLogic.ts
import { Square, GameState } from '@/types/game';
import seedrandom from 'seedrandom';

// Fixed grid dimensions - we now use zoom/pan instead of responsive sizing
const GRID_WIDTH = 15;
const GRID_HEIGHT = 15;

export const generateMap = (seed: string): Square[] => {
    const rng = seedrandom(seed);
    const squares: Square[] = [];

    // Use fixed dimensions for the grid
    const dimensions = { width: GRID_WIDTH, height: GRID_HEIGHT };
    
    // Create a template based on the seed
    const template = Array(dimensions.height).fill(0).map(() => Array(dimensions.width).fill(0));
    
    // Base positions for 2x2 squares (bosses)
    const baseLargeSquarePositions = [
        [0, 0], [0, 4], [0, 8],
        [4, 2], [4, 6], [4, 10],
        [8, 0], [8, 4], [8, 8],
        [12, 2], [12, 6],
    ];
    
    // Limit the number of large squares 
    const maxLargeSquares = Math.max(1, Math.floor(dimensions.width * dimensions.height / 25));
    const selectedLargeSquares = baseLargeSquarePositions.slice(0, maxLargeSquares);

    selectedLargeSquares.forEach(([y, x]) => {
        if (y < dimensions.height - 1 && x < dimensions.width - 1) {
            template[y][x] = 2; // 2 means 2x2 square
            template[y][x + 1] = -1;
            template[y + 1][x] = -1;
            template[y + 1][x + 1] = -1;
        }
    });

    // Place 1x2 vertical rectangles based on available space
    for (let y = 0; y < dimensions.height - 1; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            if (template[y][x] === 0 && template[y + 1][x] === 0 && rng() > 0.8) {
                template[y][x] = 3; // 3 means 1x2 vertical rectangle
                template[y + 1][x] = -1;
            }
        }
    }

    // Create a map to store squares by position for adjacency checks
    const squaresByPosition: { [key: string]: Square } = {};

    // Fill remaining spaces with 1x1 squares
    let squareCount = 0;
    for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            if (template[y][x] >= 0) {
                const size = template[y][x];
                // Adjust boss frequency based on grid size
                const bossDivisor = Math.max(5, Math.floor(dimensions.width * dimensions.height / 30));
                const isBoss = (squareCount + 1) % bossDivisor === 0;
                
                // Determine if this square should be initially available
                // Make the top-left square available to start
                const isInitialSquare = x === 0 && y === 0;
                
                // Calculate difficulty based on distance from origin, scaled to grid size
                const maxDistance = Math.sqrt(dimensions.width * dimensions.width + dimensions.height * dimensions.height);
                const distanceFactor = Math.sqrt(x*x + y*y) / (maxDistance / 4);
                
                const square: Square = {
                    id: `${x}-${y}`,
                    status: isInitialSquare ? 'available' : 'locked',
                    position: { x, y },
                    size: {
                        width: size === 2 ? 200 : 100,
                        height: size === 3 ? 200 : size === 2 ? 200 : 100,
                    },
                    isBoss,
                    adjacentSquares: [],
                    // Apply scaling to these values based on position
                    health: Math.floor((isBoss ? 1000 : 100) * Math.pow(1.2, distanceFactor)),
                    maxHealth: Math.floor((isBoss ? 1000 : 100) * Math.pow(1.2, distanceFactor)),
                    moneyPerSecond: Math.floor((isBoss ? 10 : 1) * Math.pow(1.2, distanceFactor))
                };

                if (rng() < 0.2 && !isBoss) {
                    square.treasure = {
                        type: ['damage', 'autoclick', 'coins'][Math.floor(rng() * 3)] as 'damage' | 'autoclick' | 'coins',
                        value: Math.floor(rng() * 100) + 50,
                    };
                }

                squares.push(square);
                squaresByPosition[`${x}-${y}`] = square;
                squareCount++;
            }
        }
    }

    // Add adjacency information
    squares.forEach(square => {
        const { x, y } = square.position;
        const width = square.size.width > 100 ? 2 : 1;
        const height = square.size.height > 100 ? 2 : 1;

        // Check all positions around the square
        for (let dy = -1; dy <= height; dy++) {
            for (let dx = -1; dx <= width; dx++) {
                const checkPos = `${x + dx}-${y + dy}`;
                if (squaresByPosition[checkPos] && checkPos !== `${x}-${y}`) {
                    square.adjacentSquares.push(squaresByPosition[checkPos].id);
                }
            }
        }
    });

    return squares;
}