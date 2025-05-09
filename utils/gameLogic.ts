// utils/gameLogic.ts
import { Square, GameState } from '@/types/game';
import seedrandom from 'seedrandom';

// Fixed grid dimensions - we now use zoom/pan instead of responsive sizing
const GRID_WIDTH = 15;
const GRID_HEIGHT = 15;

// Constants for game mechanics
const MAX_ADJACENT_REVEALED = 3; // Maximum squares to reveal after killing one
const GATE_REQUIREMENT_BASE = 5; // Base number of squares to kill at each gate
const GATE_HEALTH_MULTIPLIER = 5; // Gates have 5x more health than normal squares
const GATE_AUTO_CLEAR_COUNT = 7; // Number of squares to auto-clear when a gate is destroyed
const MAX_LEVEL = 6; // Maximum number of levels in the game

// Helper function to calculate level based on distance from origin
const calculateLevel = (x: number, y: number): number => {
    const distanceFromOrigin = Math.sqrt(x*x + y*y);
    // Use smaller level sizes to ensure more distinct levels
    return Math.min(MAX_LEVEL, Math.floor(distanceFromOrigin / 3) + 1);
};

// Calculate gate requirement based on gate level
const calculateGateRequirement = (gateLevel: number): number => {
    // First gate requires 5 kills, then increases by 2 each gate
    return GATE_REQUIREMENT_BASE + (gateLevel - 1) * 2;
};

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
    
    // Pre-define fixed gate positions for each level transition
    // Format: [level, x, y]
    const gatePositions = [
        [1, 4, 3],  // Level 1 to 2
        [2, 7, 5],  // Level 2 to 3
        [3, 10, 7], // Level 3 to 4
        [4, 12, 9], // Level 4 to 5
        [5, 13, 11] // Level 5 to 6
    ];
    
    // Track squares by level
    const squaresByLevel: { [level: number]: Square[] } = {};
    
    // Process all squares first without gates or portals
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
                
                // Calculate difficulty and rewards based on distance from origin and size
                const maxDistance = Math.sqrt(dimensions.width * dimensions.width + dimensions.height * dimensions.height);
                const distanceFactor = Math.sqrt(x*x + y*y) / (maxDistance / 4);
                
                // Size multiplier for health and rewards
                const sizeMultiplier = size === 2 ? 4 : size === 3 ? 2 : 1;
                
                // Calculate the level based on distance - ensure all squares have a level
                const level = calculateLevel(x, y);
                
                const square: Square = {
                    id: `${x}-${y}`,
                    status: isInitialSquare ? 'available' : 'locked',
                    position: { x, y },
                    size: {
                        width: size === 2 ? 200 : 100,
                        height: size === 3 ? 200 : size === 2 ? 200 : 100,
                    },
                    isBoss,
                    isGate: false, // We'll set gates later
                    isPortal: false, // We'll set portals later
                    level,  // Every square has a defined level
                    adjacentSquares: [],
                    // Apply scaling to health and money based on position, size, and gate status
                    health: Math.floor((isBoss ? 1000 : 100) * Math.pow(1.3, distanceFactor) * sizeMultiplier),
                    maxHealth: Math.floor((isBoss ? 1000 : 100) * Math.pow(1.3, distanceFactor) * sizeMultiplier),
                    moneyPerSecond: Math.floor((isBoss ? 10 : 1) * Math.pow(1.5, distanceFactor) * sizeMultiplier)
                };

                // Add treasure with weighted random selection
                if (rng() < 0.2 && !isBoss) {
                    const treasureTypes = ['damage', 'autoclick', 'coins', 'luck'];
                    const weights = [0.3, 0.3, 0.3, 0.1]; // Luck is more rare
                    
                    const random = rng();
                    let cumulativeWeight = 0;
                    let selectedType = 'coins';
                    
                    for (let i = 0; i < treasureTypes.length; i++) {
                        cumulativeWeight += weights[i];
                        if (random <= cumulativeWeight) {
                            selectedType = treasureTypes[i];
                            break;
                        }
                    }
                    
                    // Scale treasure value by level and distance
                    const valueMultiplier = Math.pow(1.2, level - 1);
                    square.treasure = {
                        type: selectedType as 'damage' | 'autoclick' | 'coins' | 'luck',
                        value: Math.floor((rng() * 100 + 50) * valueMultiplier),
                    };
                }

                squares.push(square);
                squaresByPosition[`${x}-${y}`] = square;
                squareCount++;
                
                // Track squares by level
                if (!squaresByLevel[level]) {
                    squaresByLevel[level] = [];
                }
                squaresByLevel[level].push(square);
            }
        }
    }
    
    // Now place gates at specific positions
    const gates: Square[] = [];
    
    for (const [level, gateX, gateY] of gatePositions) {
        // Find a square at this position or nearby
        let gateSquare = squaresByPosition[`${gateX}-${gateY}`];
        
        // If position is not available, find the closest square at this level
        if (!gateSquare || gateSquare.level !== level) {
            // Find squares at this level
            const levelSquares = squaresByLevel[level] || [];
            
            if (levelSquares.length > 0) {
                // Sort by distance to the desired gate position
                levelSquares.sort((a, b) => {
                    const distA = Math.pow(a.position.x - gateX, 2) + Math.pow(a.position.y - gateY, 2);
                    const distB = Math.pow(b.position.x - gateX, 2) + Math.pow(b.position.y - gateY, 2);
                    return distA - distB;
                });
                
                // Pick the closest square
                gateSquare = levelSquares[0];
            }
        }
        
        if (gateSquare) {
            // Convert this square to a gate
            gateSquare.isGate = true;
            gateSquare.gateRequirement = calculateGateRequirement(level);
            
            // Update health to be higher for gates
            gateSquare.health = gateSquare.health * GATE_HEALTH_MULTIPLIER;
            gateSquare.maxHealth = gateSquare.maxHealth * GATE_HEALTH_MULTIPLIER;
            
            // Add a coin treasure to the gate
            const valueMultiplier = Math.pow(1.2, level - 1);
            gateSquare.treasure = {
                type: 'coins',
                value: Math.floor(300 * valueMultiplier),
            };
            
            gates.push(gateSquare);
        }
    }
    
    // Add portals - one per level except the highest level
    const portals: Square[] = [];
    
    for (let level = 1; level < MAX_LEVEL; level++) {
        // Get all potential portal squares at this level
        const levelSquares = squaresByLevel[level] || [];
        
        // Find eligible squares (not gates, not bosses)
        const eligibleSquares = levelSquares.filter(s => !s.isGate && !s.isBoss);
        
        if (eligibleSquares.length > 0) {
            // Find the gate for this level
            const targetGate = gates.find(g => g.level === level);
            
            if (targetGate) {
                // Choose a random eligible square
                const portalIndex = Math.floor(rng() * eligibleSquares.length);
                const portalSquare = eligibleSquares[portalIndex];
                
                // Convert this square to a portal
                portalSquare.isPortal = true;
                portalSquare.portalTarget = targetGate.id;
                
                // Add a coin treasure to the portal
                const valueMultiplier = Math.pow(1.2, level - 1);
                portalSquare.treasure = {
                    type: 'coins',
                    value: Math.floor(200 * valueMultiplier),
                };
                
                portals.push(portalSquare);
            }
        }
    }

    // Add adjacency information with level progression rules
    squares.forEach(square => {
        const { x, y } = square.position;
        const width = square.size.width > 100 ? 2 : 1;
        const height = square.size.height > 100 ? 2 : 1;

        // Check all positions around the square
        for (let dy = -1; dy <= height; dy++) {
            for (let dx = -1; dx <= width; dx++) {
                const checkPos = `${x + dx}-${y + dy}`;
                if (squaresByPosition[checkPos] && checkPos !== `${x}-${y}`) {
                    const adjacentSquare = squaresByPosition[checkPos];
                    
                    // Enforce level progression - only add adjacency if:
                    // 1. The squares are at the same level, OR
                    // 2. The current square is a gate and can reveal the next level, OR
                    // 3. The current square is a portal and can reveal its target
                    const squareLevel = square.level || 0;
                    const adjacentLevel = adjacentSquare.level || 0;
                    
                    if (
                        (squareLevel === adjacentLevel) || 
                        (square.isGate && adjacentLevel === squareLevel + 1) ||
                        (square.isPortal && square.portalTarget && adjacentSquare.id === square.portalTarget)
                    ) {
                        square.adjacentSquares.push(adjacentSquare.id);
                    }
                }
            }
        }
    });

    return squares;
};

// Helper function to limit adjacent squares revealed
export const getRevealedAdjacents = (squares: Square[], killedSquare: Square): string[] => {
    // First get all available adjacent squares
    const lockedAdjacents = killedSquare.adjacentSquares.filter(id => {
        const adjacentSquare = squares.find(s => s.id === id);
        return adjacentSquare && adjacentSquare.status === 'locked';
    });
    
    // If this is a gate, reveal more squares (tunnel effect)
    const revealLimit = killedSquare.isGate ? GATE_AUTO_CLEAR_COUNT : MAX_ADJACENT_REVEALED;
    
    // If there are more than the limit of locked squares, choose randomly
    if (lockedAdjacents.length > revealLimit) {
        // Shuffle the array and take the first N squares
        // Fisher-Yates shuffle
        for (let i = lockedAdjacents.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lockedAdjacents[i], lockedAdjacents[j]] = [lockedAdjacents[j], lockedAdjacents[i]];
        }
        
        return lockedAdjacents.slice(0, revealLimit);
    }
    
    return lockedAdjacents;
};

// Auto-clear squares after a gate is killed
export const getGateTunnelSquares = (squares: Square[], killedGate: Square): string[] => {
    if (!killedGate.isGate) return [];
    
    // Find squares in the same row to auto-clear (tunnel effect)
    const { x, y } = killedGate.position;
    const level = killedGate.level || 1;
    
    // Find all locked and available squares on the same row that are not dead yet
    const tunnelSquares = squares
        .filter(square => 
            // Must be on the same row
            square.position.y === y && 
            // Must be ahead of the gate
            square.position.x > x && 
            // Must not be already dead
            square.status !== 'dead' &&
            // Must have the same level
            square.level === level
        )
        // Sort by x position to process them in order from left to right
        .sort((a, b) => a.position.x - b.position.x)
        // Take only the first GATE_AUTO_CLEAR_COUNT squares
        .slice(0, GATE_AUTO_CLEAR_COUNT)
        // Get their IDs
        .map(square => square.id);
    
    return tunnelSquares;
};

// Special function to handle portal activation
export const getPortalRevealSquares = (squares: Square[], killedPortal: Square): string[] => {
    if (!killedPortal.isPortal || !killedPortal.portalTarget) return [];
    
    // Find the target gate
    const targetGate = squares.find(s => s.id === killedPortal.portalTarget);
    if (!targetGate) return [];
    
    // Return the target gate ID to be revealed
    return [targetGate.id];
};

// Function to check if a player can pass a gate
export const canPassGate = (square: Square, gateProgress: { [key: number]: number }): boolean => {
    if (!square.isGate || !square.gateRequirement || !square.level) return true;
    
    const levelProgress = gateProgress[square.level] || 0;
    return levelProgress >= square.gateRequirement;
};