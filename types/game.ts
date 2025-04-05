// types/game.ts
export interface Square {
    id: string;
    health: number;
    maxHealth: number;
    status: 'locked' | 'available' | 'dead';
    position: { x: number; y: number };
    isBoss: boolean;
    treasure?: {
      type: 'damage' | 'autoclick' | 'coins';
      value: number;
    };
    size: {
        width: number;
        height: number;
      };
    moneyPerSecond: number;
    adjacentSquares: string[];
  }
  
  export interface GameState {
    squares: Square[];
    clickDamage: number;
    coins: number;
    autoClickDamage: number;
    seed: string;
    coinMultiplier?: number;
  }