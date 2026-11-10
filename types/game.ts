// types/game.ts
export type TreasureType = 'damage' | 'autoclick' | 'coins' | 'luck';

export interface Square {
    id: string;
    health: number;
    maxHealth: number;
    status: 'locked' | 'available' | 'dead';
    position: { x: number; y: number };
    isBoss: boolean; // Elite square (crown)
    isGate?: boolean; // Zone boss - defeating it unlocks the next zone
    isPortal?: boolean;
    portalTarget?: string; // ID of the zone boss that this portal awakens
    gateRequirement?: number; // Kills needed in this zone before the zone boss wakes up
    treasure?: {
      type: TreasureType;
      value: number;
    };
    size: { w: number; h: number }; // In grid cells
    moneyPerSecond: number; // Coins dropped on kill
    adjacentSquares: string[];
    level?: number; // Zone the square belongs to
}

export type ConsumableId = 'bomb' | 'lightning' | 'frenzy' | 'midas';

// corner: zones grow out of a corner · sweep: bands across the map · rings: a pyramid seen
// from above, border first and the big boss in the middle · burst: from the centre outward
export type MapLayout = 'corner' | 'sweep' | 'rings' | 'burst';
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface MapConfig {
    width: number;
    height: number;
    layout: MapLayout;
    // corner/sweep: where the run heads · rings: the side you enter from · burst: where the big boss waits
    direction: Direction;
    zones: number;
    stoneSize: number; // 0..1, tiny mosaic chips up to big slabs
    wonk: number; // 0..1, how hand-cut and uneven the stones look
    roughness: number; // 0..1, how ragged zone borders are
    bossSize: number; // Zone boss footprint in cells; the final boss is one bigger
    elites: number; // 0..1
    treasure: number; // 0..1
    seed: string;
}

export interface GameState {
    map: MapConfig;
    zoneCount: number; // Zones that actually fit on this map
    startId: string;
    squares: Square[];
    clickDamage: number;
    coins: number;
    autoClickDamage: number;
    seed: string;
    coinMultiplier?: number;
    luckMultiplier: number;
    squaresKilled: number; // Track total squares killed
    gateProgress: { // Track progress at zone bosses
        [key: number]: number; // zoneNumber -> squares killed in that zone
    };
    lifetimeEarnings: number; // Track total coins earned over the lifetime of the game
    unlockedZone: number; // Highest zone the player can see and play in
    critChance: number; // 0..1
    drones: number;
    hasRadar: boolean; // Shows treasures on locked squares
    inventory: Record<ConsumableId, number>;
    buffs: { frenzyUntil: number; midasUntil: number };
    purchases: Record<string, number>; // shop item id -> times bought
    won: boolean;
}

// Things that happened during a state transition, used to drive visual effects
export type GameEvent =
    | { type: 'hit'; squareId: string; amount: number; crit: boolean; source: 'click' | 'auto' | 'drone' | 'bomb' | 'lightning' }
    | { type: 'kill'; squareId: string; coins: number; jackpot: boolean }
    | { type: 'treasure'; squareId: string; label: string }
    | { type: 'bossAwake'; zone: number }
    | { type: 'zoneUnlocked'; zone: number }
    | { type: 'portal'; zone: number }
    | { type: 'sealed'; squareId: string; progress: number; requirement: number }
    | { type: 'victory' };
