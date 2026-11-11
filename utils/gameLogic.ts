// utils/gameLogic.ts
import { Square, GameState, GameEvent, TreasureType, MapConfig } from '@/types/game';
import { generateMap } from '@/utils/mapGen';

const MAX_ADJACENT_REVEALED = 3; // Squares revealed after a normal kill
const CRIT_MULTIPLIER = 3;
const FRENZY_MULTIPLIER = 3;
const MIDAS_MULTIPLIER = 2;
const JACKPOT_MULTIPLIER = 5;

export const createInitialState = (config: MapConfig): GameState => {
    const map = generateMap(config);
    return {
        map: map.config,
        zoneCount: map.zoneCount,
        startId: map.startId,
        squares: map.squares,
        clickDamage: 10,
        coins: 0,
        autoClickDamage: 0,
        seed: map.config.seed,
        coinMultiplier: 1,
        luckMultiplier: 1,
        squaresKilled: 0,
        gateProgress: {},
        lifetimeEarnings: 0,
        unlockedZone: 1,
        critChance: 0.05,
        drones: 0,
        hasRadar: false,
        inventory: { bomb: 1, lightning: 0, frenzy: 0, midas: 0 },
        buffs: { frenzyUntil: 0, midasUntil: 0 },
        purchases: {},
        won: false,
    };
};

// A zone boss stays sealed until enough of its zone has been cleared
export const isSealed = (square: Square, gateProgress: GameState['gateProgress']): boolean => {
    if (!square.isGate || square.status === 'dead' || !square.level) return false;
    return (gateProgress[square.level] || 0) < (square.gateRequirement || 0);
};

export const canPassGate = (square: Square, gateProgress: GameState['gateProgress']): boolean =>
    !isSealed(square, gateProgress);

// Squares that auto attacks, drones and lightning are allowed to hit
export const attackableSquares = (state: GameState): Square[] =>
    state.squares.filter(s =>
        s.status === 'available' &&
        (s.level || 1) <= state.unlockedZone &&
        !isSealed(s, state.gateProgress));

export const zoneBoss = (state: GameState, zone: number): Square | undefined =>
    state.squares.find(s => s.isGate && s.level === zone);

const shuffle = <T,>(items: T[], rng: () => number): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const treasureLabel = (type: TreasureType) => {
    switch (type) {
        case 'damage': return '💪 Power up!';
        case 'autoclick': return '🤖 Auto up!';
        case 'luck': return '🍀 Luck up!';
        case 'coins': return '💰 Treasure!';
    }
};

export interface DamageResult {
    state: GameState;
    events: GameEvent[];
}

// Applies damage to one square and resolves everything a kill triggers:
// coins, treasure, reveals, boss wake-ups, zone unlocks and victory.
export const applyDamage = (
    state: GameState,
    squareId: string,
    baseDamage: number,
    source: 'click' | 'auto' | 'drone' | 'bomb' | 'lightning',
    now: number,
    rng: () => number = Math.random,
): DamageResult => {
    const target = state.squares.find(s => s.id === squareId);
    if (!target || target.status !== 'available' || (target.level || 1) > state.unlockedZone) {
        return { state, events: [] };
    }

    const zone = target.level || 1;
    if (isSealed(target, state.gateProgress)) {
        return {
            state,
            events: [{
                type: 'sealed',
                squareId,
                progress: state.gateProgress[zone] || 0,
                requirement: target.gateRequirement || 0,
            }],
        };
    }

    const events: GameEvent[] = [];
    const canCrit = source === 'click' || source === 'drone';
    const crit = canCrit && rng() < state.critChance;
    const frenzy = now < state.buffs.frenzyUntil;
    const damage = baseDamage * (crit ? CRIT_MULTIPLIER : 1) * (frenzy ? FRENZY_MULTIPLIER : 1);
    const newHealth = Math.max(0, target.health - damage);

    if (source !== 'auto') {
        events.push({ type: 'hit', squareId, amount: damage, crit, source });
    }

    if (newHealth > 0) {
        return {
            state: {
                ...state,
                squares: state.squares.map(s => s.id === squareId ? { ...s, health: newHealth } : s),
            },
            events,
        };
    }

    // --- The square died ---
    let next: GameState = { ...state, inventory: { ...state.inventory }, gateProgress: { ...state.gateProgress } };
    const statusUpdates: { [id: string]: Partial<Square> } = { [squareId]: { health: 0, status: 'dead' } };

    const midas = now < state.buffs.midasUntil;
    const jackpot = rng() < Math.max(0, state.luckMultiplier - 1) * 0.2;
    let coins = target.moneyPerSecond * (state.coinMultiplier || 1) * (midas ? MIDAS_MULTIPLIER : 1)
        * (jackpot ? JACKPOT_MULTIPLIER : 1);

    if (target.treasure) {
        const scaled = target.treasure.value * state.luckMultiplier;
        switch (target.treasure.type) {
            case 'damage':
                next.clickDamage += Math.max(2, Math.round(next.clickDamage * scaled / 100));
                break;
            case 'autoclick':
                next.autoClickDamage += Math.max(3, Math.round(next.autoClickDamage * scaled / 100));
                break;
            case 'luck':
                next.luckMultiplier = +(next.luckMultiplier + scaled / 100).toFixed(2);
                break;
            case 'coins':
                coins += scaled * (midas ? MIDAS_MULTIPLIER : 1);
                break;
        }
        events.push({ type: 'treasure', squareId, label: treasureLabel(target.treasure.type) });
    }

    coins = Math.floor(coins);
    next.coins += coins;
    next.lifetimeEarnings += coins;
    next.squaresKilled += 1;
    events.push({ type: 'kill', squareId, coins, jackpot });

    const boss = zoneBoss(state, zone);
    const wasSealed = boss ? isSealed(boss, state.gateProgress) : false;
    if (!target.isGate) {
        next.gateProgress[zone] = (next.gateProgress[zone] || 0) + 1;
    }

    // Reveal a few locked neighbours inside the unlocked zones
    const lockedNeighbours = target.adjacentSquares
        .map(id => state.squares.find(s => s.id === id)!)
        .filter(s => s && s.status === 'locked' && (s.level || 1) <= state.unlockedZone);
    shuffle(lockedNeighbours, rng).slice(0, MAX_ADJACENT_REVEALED).forEach(s => {
        statusUpdates[s.id] = { status: 'available' };
    });

    if (target.isPortal && target.portalTarget) {
        statusUpdates[target.portalTarget] = { status: 'available', gateRequirement: 0 };
        events.push({ type: 'portal', zone });
    } else if (boss && wasSealed && !target.isGate && !isSealed(boss, next.gateProgress)) {
        events.push({ type: 'bossAwake', zone });
    }

    if (target.isGate) {
        // Any portal leading to this boss is now pointless
        state.squares
            .filter(s => s.isPortal && s.portalTarget === target.id)
            .forEach(s => { statusUpdates[s.id] = { ...statusUpdates[s.id], isPortal: false, portalTarget: undefined }; });

        if (zone >= state.zoneCount) {
            next.won = true;
            events.push({ type: 'victory' });
        } else {
            next.unlockedZone = Math.max(next.unlockedZone, zone + 1);
            // Breaking the boss opens the whole border it touches
            target.adjacentSquares
                .map(id => state.squares.find(s => s.id === id)!)
                .filter(s => s && s.status === 'locked' && s.level === zone + 1)
                .forEach(s => { statusUpdates[s.id] = { status: 'available' }; });
            events.push({ type: 'zoneUnlocked', zone: zone + 1 });
        }
    }

    next.squares = state.squares.map(s => statusUpdates[s.id] ? { ...s, ...statusUpdates[s.id] } : s);

    // Never leave the player stuck: if nothing is attackable, open the whole frontier
    if (!next.won && attackableSquares(next).length === 0) {
        const deadIds = new Set(next.squares.filter(s => s.status === 'dead').map(s => s.id));
        next.squares = next.squares.map(s =>
            s.status === 'locked' && (s.level || 1) <= next.unlockedZone && s.adjacentSquares.some(id => deadIds.has(id))
                ? { ...s, status: 'available' as const }
                : s);
    }

    // Last resort for odd layouts: open everything already unlocked, then move on a zone
    while (!next.won && attackableSquares(next).length === 0) {
        const opened = next.squares.some(s => s.status === 'locked' && (s.level || 1) <= next.unlockedZone);
        if (!opened) {
            if (next.unlockedZone >= next.zoneCount) break;
            next.unlockedZone += 1;
            events.push({ type: 'zoneUnlocked', zone: next.unlockedZone });
        }
        next.squares = next.squares.map(s =>
            s.status === 'locked' && (s.level || 1) <= next.unlockedZone ? { ...s, status: 'available' as const } : s);
    }

    return { state: next, events };
};

// Applies several hits in sequence, collecting all events
export const applyDamageMany = (
    state: GameState,
    hits: { squareId: string; damage: number }[],
    source: 'drone' | 'bomb' | 'lightning',
    now: number,
): DamageResult => {
    let current = state;
    const events: GameEvent[] = [];
    hits.forEach(hit => {
        const result = applyDamage(current, hit.squareId, hit.damage, source, now);
        current = result.state;
        events.push(...result.events);
    });
    return { state: current, events };
};

export const bombHits = (state: GameState, squareId: string) => {
    const target = state.squares.find(s => s.id === squareId);
    if (!target) return [];
    const blast = new Set([squareId, ...target.adjacentSquares]);
    return attackableSquares(state)
        .filter(s => blast.has(s.id))
        .map(s => ({ squareId: s.id, damage: state.clickDamage * 6 }));
};

export const lightningHits = (state: GameState) =>
    shuffle(attackableSquares(state), Math.random)
        .slice(0, 6)
        .map(s => ({ squareId: s.id, damage: state.clickDamage * 4 }));

// Auto damage chips away at the weakest attackable square so kills keep flowing
export const autoTarget = (state: GameState): Square | undefined =>
    attackableSquares(state).sort((a, b) => a.health - b.health)[0];

const SAVE_KEY = 'squarzle-save-v3';

export const saveGame = (state: GameState) => {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable (private mode); the game still works without saves
    }
};

export const loadGame = (): GameState | null => {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as GameState;
        if (!Array.isArray(parsed.squares) || typeof parsed.unlockedZone !== 'number' || !parsed.map) return null;
        return { ...createInitialState(parsed.map), ...parsed };
    } catch {
        return null;
    }
};

export const clearSave = () => {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch {
        // ignore
    }
};
