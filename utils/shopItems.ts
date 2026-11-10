// utils/shopItems.ts
import { GameState, ConsumableId } from '@/types/game';
import { zoneDepth } from '@/utils/mapGen';

export type ShopCategory = 'upgrades' | 'gadgets' | 'mystery';

// Which procedural 3D model the shop renders for an item
export type ShopModel =
    | 'sword' | 'gear' | 'target' | 'drone' | 'magnet' | 'die'
    | 'bomb' | 'bolt' | 'potion' | 'elixir' | 'box' | 'lens';

export interface ShopItem {
    id: string;
    name: string;
    tagline: string;
    description: string;
    emoji: string;
    model: ShopModel;
    color: number; // Accent colour for the 3D model and UI
    category: ShopCategory;
    visibleAtEarnings: number;
    maxPurchases?: number;
    cost: (state: GameState) => number;
    // Short "before → after" preview shown in the shop
    preview: (state: GameState) => string;
    apply: (state: GameState) => { state: Partial<GameState>; message?: string };
}

const bought = (state: GameState, id: string) => state.purchases[id] || 0;

// Permanent upgrades get pricier each time; gadgets scale with how deep you are
const scaling = (id: string, base: number, growth: number) => (state: GameState) =>
    Math.floor(base * Math.pow(growth, bought(state, id)));
const zoneScaled = (base: number) => (state: GameState) =>
    Math.floor(base * Math.pow(2.3, zoneDepth(state.unlockedZone, state.zoneCount)));

const addCharge = (state: GameState, id: ConsumableId) => ({
    inventory: { ...state.inventory, [id]: state.inventory[id] + 1 },
});

const nextClick = (state: GameState) => state.clickDamage + Math.max(5, Math.round(state.clickDamage * 0.25));
const nextAuto = (state: GameState) => state.autoClickDamage + Math.max(4, Math.round(state.autoClickDamage * 0.25));

export const shopItems: ShopItem[] = [
    {
        id: 'click_power',
        name: 'Edge of Clicking',
        tagline: 'Hit harder',
        description: 'A sharper blade for your cursor. +25% click damage.',
        emoji: '🗡️',
        model: 'sword',
        color: 0xc084fc,
        category: 'upgrades',
        visibleAtEarnings: 0,
        cost: scaling('click_power', 20, 1.35),
        preview: s => `${Math.floor(s.clickDamage)} → ${Math.floor(nextClick(s))} dmg`,
        apply: s => ({ state: { clickDamage: nextClick(s) } }),
    },
    {
        id: 'auto_click',
        name: 'Clockwork Gear',
        tagline: 'Damage while you sleep',
        description: 'Ticks away at the weakest square for you. +25% auto damage.',
        emoji: '⚙️',
        model: 'gear',
        color: 0x60a5fa,
        category: 'upgrades',
        visibleAtEarnings: 15,
        cost: scaling('auto_click', 35, 1.35),
        preview: s => `${Math.floor(s.autoClickDamage)} → ${Math.floor(nextAuto(s))} /s`,
        apply: s => ({ state: { autoClickDamage: nextAuto(s) } }),
    },
    {
        id: 'crit',
        name: 'Bullseye',
        tagline: 'Triple-damage crits',
        description: '+5% chance for clicks and drones to crit for 3× damage.',
        emoji: '🎯',
        model: 'target',
        color: 0xf87171,
        category: 'upgrades',
        visibleAtEarnings: 60,
        maxPurchases: 9,
        cost: scaling('crit', 70, 1.7),
        preview: s => `${Math.round(s.critChance * 100)}% → ${Math.round(s.critChance * 100) + 5}% crit`,
        apply: s => ({ state: { critChance: +(s.critChance + 0.05).toFixed(2) } }),
    },
    {
        id: 'drone',
        name: 'Zap Drone',
        tagline: 'A tiny helper',
        description: 'Each drone zaps a random square every second for 50% of your click damage. Drones can crit.',
        emoji: '🛸',
        model: 'drone',
        color: 0x34d399,
        category: 'upgrades',
        visibleAtEarnings: 120,
        maxPurchases: 8,
        cost: scaling('drone', 120, 1.9),
        preview: s => `${s.drones} → ${s.drones + 1} drones`,
        apply: s => ({ state: { drones: s.drones + 1 } }),
    },
    {
        id: 'coin_magnet',
        name: 'Coin Magnet',
        tagline: 'More coins per kill',
        description: 'Pulls extra coins out of every square. ×1.25 coins.',
        emoji: '🧲',
        model: 'magnet',
        color: 0xfbbf24,
        category: 'upgrades',
        visibleAtEarnings: 80,
        cost: scaling('coin_magnet', 90, 1.8),
        preview: s => `×${(s.coinMultiplier || 1).toFixed(2)} → ×${((s.coinMultiplier || 1) * 1.25).toFixed(2)}`,
        apply: s => ({ state: { coinMultiplier: +((s.coinMultiplier || 1) * 1.25).toFixed(3) } }),
    },
    {
        id: 'luck',
        name: 'Lucky Die',
        tagline: 'Jackpots & bigger treasure',
        description: '+15% luck. Luck boosts treasure and gives kills a chance to pay out 5× as a JACKPOT.',
        emoji: '🎲',
        model: 'die',
        color: 0x4ade80,
        category: 'upgrades',
        visibleAtEarnings: 150,
        cost: scaling('luck', 110, 1.8),
        preview: s => `${s.luckMultiplier.toFixed(2)} → ${(s.luckMultiplier + 0.15).toFixed(2)} luck`,
        apply: s => ({ state: { luckMultiplier: +(s.luckMultiplier + 0.15).toFixed(2) } }),
    },
    {
        id: 'bomb',
        name: 'Square Bomb',
        tagline: 'Arm, click, kaboom',
        description: 'Arm it, then click a square: it and everything around it take 6× click damage.',
        emoji: '💣',
        model: 'bomb',
        color: 0xfb923c,
        category: 'gadgets',
        visibleAtEarnings: 0,
        cost: zoneScaled(30),
        preview: s => `You have ${s.inventory.bomb}`,
        apply: s => ({ state: addCharge(s, 'bomb') }),
    },
    {
        id: 'lightning',
        name: 'Storm in a Bolt',
        tagline: 'Chain lightning',
        description: 'Strikes up to 6 random squares for 4× click damage each.',
        emoji: '⚡',
        model: 'bolt',
        color: 0xfde047,
        category: 'gadgets',
        visibleAtEarnings: 40,
        cost: zoneScaled(45),
        preview: s => `You have ${s.inventory.lightning}`,
        apply: s => ({ state: addCharge(s, 'lightning') }),
    },
    {
        id: 'frenzy',
        name: 'Frenzy Potion',
        tagline: '20 seconds of 3× damage',
        description: 'Drink it before a boss. Every source of damage is tripled for 20 seconds.',
        emoji: '🧪',
        model: 'potion',
        color: 0xef4444,
        category: 'gadgets',
        visibleAtEarnings: 90,
        cost: zoneScaled(70),
        preview: s => `You have ${s.inventory.frenzy}`,
        apply: s => ({ state: addCharge(s, 'frenzy') }),
    },
    {
        id: 'midas',
        name: 'Midas Elixir',
        tagline: '30 seconds of 2× coins',
        description: 'Everything you break pays double for 30 seconds. Stack it with a Frenzy.',
        emoji: '✨',
        model: 'elixir',
        color: 0xfacc15,
        category: 'gadgets',
        visibleAtEarnings: 200,
        cost: zoneScaled(90),
        preview: s => `You have ${s.inventory.midas}`,
        apply: s => ({ state: addCharge(s, 'midas') }),
    },
    {
        id: 'radar',
        name: 'Treasure Lens',
        tagline: 'See hidden loot',
        description: 'Shows which locked squares hide treasure, so you can dig straight for it.',
        emoji: '🔍',
        model: 'lens',
        color: 0x22d3ee,
        category: 'gadgets',
        visibleAtEarnings: 100,
        maxPurchases: 1,
        cost: () => 150,
        preview: s => s.hasRadar ? 'Owned' : 'One-time purchase',
        apply: () => ({ state: { hasRadar: true } }),
    },
    {
        id: 'mystery',
        name: 'Mystery Box',
        tagline: 'Feeling lucky?',
        description: 'Could be a pile of coins, free gadgets, a permanent boost... or a single sad coin.',
        emoji: '🎁',
        model: 'box',
        color: 0xe879f9,
        category: 'mystery',
        visibleAtEarnings: 50,
        cost: zoneScaled(60),
        preview: () => 'Anything can happen',
        apply: s => openMysteryBox(s),
    },
];

const openMysteryBox = (state: GameState): { state: Partial<GameState>; message: string } => {
    const price = zoneScaled(60)(state);
    const roll = Math.random() * Math.min(1.6, state.luckMultiplier);
    if (roll < 0.15) {
        return { state: { coins: state.coins + 1 }, message: '🪙 A single, sad coin.' };
    }
    if (roll < 0.4) {
        const prize = Math.floor(price * 2);
        return { state: { coins: state.coins + prize, lifetimeEarnings: state.lifetimeEarnings + prize }, message: `💰 ${prize} coins!` };
    }
    if (roll < 0.6) {
        return {
            state: { inventory: { ...state.inventory, bomb: state.inventory.bomb + 2, lightning: state.inventory.lightning + 1 } },
            message: '💣💣⚡ Gadget bundle!',
        };
    }
    if (roll < 0.8) {
        return { state: { inventory: { ...state.inventory, frenzy: state.inventory.frenzy + 1, midas: state.inventory.midas + 1 } }, message: '🧪✨ Potion pair!' };
    }
    if (roll < 0.95) {
        return { state: { clickDamage: Math.floor(state.clickDamage * 1.5) }, message: '🗡️ +50% click damage, forever!' };
    }
    const prize = Math.floor(price * 8);
    return { state: { coins: state.coins + prize, lifetimeEarnings: state.lifetimeEarnings + prize }, message: `🎰 JACKPOT! ${prize} coins!` };
};

export const isSoldOut = (item: ShopItem, state: GameState) =>
    item.maxPurchases !== undefined && bought(state, item.id) >= item.maxPurchases;

export const purchaseItem = (state: GameState, item: ShopItem): { state: GameState; message?: string } | null => {
    const cost = item.cost(state);
    if (state.coins < cost || isSoldOut(item, state)) return null;
    const paid: GameState = { ...state, coins: state.coins - cost };
    const result = item.apply(paid);
    return {
        state: {
            ...paid,
            ...result.state,
            purchases: { ...state.purchases, [item.id]: bought(state, item.id) + 1 },
        },
        message: result.message,
    };
};

export const timesBought = bought;
