// types/game.ts
export interface Square {
    id: string;
    health: number;
    maxHealth: number;
    status: 'locked' | 'available' | 'dead';
    position: { x: number; y: number };
    isBoss: boolean;
    isGate?: boolean;
    gateRequirement?: number;
    treasure?: {
      type: 'damage' | 'autoclick' | 'coins' | 'luck';
      value: number;
    };
    size: {
        width: number;
        height: number;
    };
    moneyPerSecond: number;
    adjacentSquares: string[];
    level?: number; // To track which "level" the square belongs to
}
  
export interface GameState {
    squares: Square[];
    clickDamage: number;
    coins: number;
    autoClickDamage: number;
    seed: string;
    coinMultiplier?: number;
    luckMultiplier: number;
    squaresKilled: number; // Track total squares killed
    gateProgress: { // Track progress at level gates
        [key: number]: number; // levelNumber -> squares killed at this level
    };
    lifetimeEarnings: number; // Track total coins earned over the lifetime of the game
}