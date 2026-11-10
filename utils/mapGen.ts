// utils/mapGen.ts
// Builds a map from a MapConfig: a progress field decides which zone each cell belongs to,
// bosses are dropped on each zone's frontier, and the rest is packed with random stones.
import seedrandom from 'seedrandom';
import { Square, TreasureType, MapConfig, MapLayout, Direction } from '@/types/game';
import { seededRandom } from '@/utils/breakage';

export const DIRECTIONS: Record<Direction, [number, number]> = {
    N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1],
};

export const MAP_LIMITS = { minSize: 8, maxSize: 40, minZones: 2, maxZones: 8, minBoss: 1, maxBoss: 4 };

export const DEFAULT_MAP: MapConfig = {
    width: 17,
    height: 17,
    layout: 'rings',
    direction: 'S',
    zones: 5,
    stoneSize: 0.4,
    wonk: 0.55,
    roughness: 0.2,
    bossSize: 2,
    elites: 0.5,
    treasure: 0.45,
    seed: 'squarzle',
};

export interface ZoneTheme {
    name: string;
    boss: string;
    bossEmoji: string;
    c: string;
    light: string;
    dark: string;
}

// The last zone is always the throne; the others are used in order
const ZONE_THEMES: ZoneTheme[] = [
    { name: 'Violet Hollow', boss: 'Grumblecube', bossEmoji: '👾', c: '#a855f7', light: '#d8b4fe', dark: '#3b0764' },
    { name: 'Azure Depths', boss: 'The Tidewarden', bossEmoji: '🦑', c: '#3b82f6', light: '#93c5fd', dark: '#172554' },
    { name: 'Jade Wilds', boss: 'Old Mossjaw', bossEmoji: '🐲', c: '#10b981', light: '#6ee7b7', dark: '#022c22' },
    { name: 'Amber Wastes', boss: 'Sunscorch', bossEmoji: '🦂', c: '#f59e0b', light: '#fcd34d', dark: '#451a03' },
    { name: 'Frost Spires', boss: 'The Rimehorn', bossEmoji: '🦣', c: '#22d3ee', light: '#a5f3fc', dark: '#083344' },
    { name: 'Rose Grotto', boss: 'Velvet Widow', bossEmoji: '🕷️', c: '#ec4899', light: '#f9a8d4', dark: '#500724' },
    { name: 'Cinder Forge', boss: 'Cindermaw', bossEmoji: '👹', c: '#f97316', light: '#fdba74', dark: '#431407' },
];
const FINAL_THEME: ZoneTheme = {
    name: 'Crimson Throne', boss: 'The Square King', bossEmoji: '😈', c: '#ef4444', light: '#fca5a5', dark: '#450a0a',
};

const themeCache: Record<number, ZoneTheme[]> = {};
// Index 0 is zone 1. Cached so the same count always returns the same array.
export const zoneThemes = (count: number): ZoneTheme[] =>
    (themeCache[count] ||= [...ZONE_THEMES.slice(0, Math.max(0, count - 1)), FINAL_THEME]);

export const zoneTheme = (zone: number, count: number): ZoneTheme => {
    const themes = zoneThemes(count);
    return themes[Math.max(0, Math.min(themes.length, zone) - 1)];
};

// Zones scale on a 0..4 curve whatever their number, so 3-zone and 8-zone maps end equally hard
export const zoneDepth = (zone: number, count: number) => ((zone - 1) * 4) / Math.max(1, count - 1);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);

export const normalizeConfig = (config: Partial<MapConfig>): MapConfig => {
    const c = { ...DEFAULT_MAP, ...config };
    const layout: MapLayout = ['corner', 'sweep', 'rings', 'burst'].includes(c.layout) ? c.layout : 'rings';
    let direction: Direction = c.direction in DIRECTIONS ? c.direction : 'SE';
    // A corner layout needs a diagonal to grow along
    if (layout === 'corner' && direction.length === 1) direction = 'SE';
    return {
        width: Math.round(clamp(c.width || 15, MAP_LIMITS.minSize, MAP_LIMITS.maxSize)),
        height: Math.round(clamp(c.height || 15, MAP_LIMITS.minSize, MAP_LIMITS.maxSize)),
        layout,
        direction,
        zones: Math.round(clamp(c.zones || 5, MAP_LIMITS.minZones, MAP_LIMITS.maxZones)),
        stoneSize: clamp01(c.stoneSize),
        wonk: clamp01(c.wonk),
        roughness: clamp01(c.roughness),
        bossSize: Math.round(clamp(c.bossSize || 2, MAP_LIMITS.minBoss, MAP_LIMITS.maxBoss)),
        elites: clamp01(c.elites),
        treasure: clamp01(c.treasure),
        seed: String(c.seed || 'squarzle').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'squarzle',
    };
};

export const randomSeed = () => Math.random().toString(36).substring(2, 9);

// --- Share codes: "1.17.17.r.S.5.40.55.20.2.50.45.seed" ---
const LAYOUT_CODES: Record<MapLayout, string> = { corner: 'c', sweep: 's', rings: 'r', burst: 'b' };
const pct = (value: number) => Math.round(value * 100);

export const encodeMap = (config: MapConfig): string => {
    const c = normalizeConfig(config);
    return [1, c.width, c.height, LAYOUT_CODES[c.layout], c.direction, c.zones, pct(c.stoneSize), pct(c.wonk),
        pct(c.roughness), c.bossSize, pct(c.elites), pct(c.treasure), c.seed].join('.');
};

export const decodeMap = (code: string): MapConfig | null => {
    const parts = code.trim().split('.');
    if (parts.length !== 13 || parts[0] !== '1') return null;
    const layout = (Object.keys(LAYOUT_CODES) as MapLayout[]).find(key => LAYOUT_CODES[key] === parts[3]);
    if (!layout || !(parts[4] in DIRECTIONS)) return null;
    const num = (i: number) => Number(parts[i]);
    if ([1, 2, 5, 6, 7, 8, 9, 10, 11].some(i => !Number.isFinite(num(i)))) return null;
    return normalizeConfig({
        width: num(1), height: num(2), layout, direction: parts[4] as Direction, zones: num(5),
        stoneSize: num(6) / 100, wonk: num(7) / 100, roughness: num(8) / 100, bossSize: num(9),
        elites: num(10) / 100, treasure: num(11) / 100, seed: parts[12],
    });
};

export const MAP_PRESETS: { id: string; name: string; emoji: string; blurb: string; config: Omit<MapConfig, 'seed'> }[] = [
    {
        id: 'pyramid', name: 'Pyramid', emoji: '🔺', blurb: 'Border first, big boss in the middle',
        config: { width: 19, height: 19, layout: 'rings', direction: 'S', zones: 5, stoneSize: 0.4, wonk: 0.55, roughness: 0.15, bossSize: 2, elites: 0.5, treasure: 0.45 },
    },
    {
        id: 'gauntlet', name: 'Gauntlet', emoji: '➡️', blurb: 'A long run from left to right',
        config: { width: 34, height: 11, layout: 'sweep', direction: 'E', zones: 6, stoneSize: 0.45, wonk: 0.45, roughness: 0.35, bossSize: 2, elites: 0.5, treasure: 0.45 },
    },
    {
        id: 'ascent', name: 'Ascent', emoji: '↗️', blurb: 'Climb from bottom-left to top-right',
        config: { width: 20, height: 20, layout: 'sweep', direction: 'NE', zones: 6, stoneSize: 0.4, wonk: 0.5, roughness: 0.25, bossSize: 2, elites: 0.5, treasure: 0.45 },
    },
    {
        id: 'rubble', name: 'Rubble Field', emoji: '🪨', blurb: 'Huge wonky slabs, ragged borders',
        config: { width: 23, height: 23, layout: 'burst', direction: 'N', zones: 5, stoneSize: 0.75, wonk: 0.95, roughness: 0.6, bossSize: 3, elites: 0.6, treasure: 0.5 },
    },
    {
        id: 'mosaic', name: 'Mosaic', emoji: '🧩', blurb: 'Tiny chips, seven rings deep',
        config: { width: 25, height: 25, layout: 'rings', direction: 'W', zones: 7, stoneSize: 0.08, wonk: 0.8, roughness: 0.4, bossSize: 2, elites: 0.3, treasure: 0.4 },
    },
    {
        id: 'classic', name: 'Classic', emoji: '🟪', blurb: 'The original corner map',
        config: { width: 15, height: 15, layout: 'corner', direction: 'SE', zones: 5, stoneSize: 0.15, wonk: 0.15, roughness: 0, bossSize: 2, elites: 0.5, treasure: 0.45 },
    },
];

// A playable random map for "New random map"
export const randomMapConfig = (): MapConfig => {
    const rng = Math.random;
    const layouts: MapLayout[] = ['corner', 'sweep', 'rings', 'rings', 'burst'];
    const layout = layouts[Math.floor(rng() * layouts.length)];
    const dirs = (layout === 'corner' ? ['NE', 'SE', 'SW', 'NW'] : Object.keys(DIRECTIONS)) as Direction[];
    const long = layout === 'sweep' && rng() < 0.5;
    const size = 14 + Math.floor(rng() * 10);
    return normalizeConfig({
        width: long ? size + 12 : size,
        height: long ? Math.max(9, size - 6) : size + Math.floor((rng() - 0.5) * 4),
        layout,
        direction: dirs[Math.floor(rng() * dirs.length)],
        zones: 4 + Math.floor(rng() * 3),
        stoneSize: 0.1 + rng() * 0.6,
        wonk: 0.3 + rng() * 0.6,
        roughness: rng() * 0.5,
        bossSize: rng() < 0.75 ? 2 : 3,
        elites: 0.5,
        treasure: 0.45,
        seed: randomSeed(),
    });
};

// --- Stone looks, shared by the board and the creator preview ---
const hashString = (text: string) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
};

export interface StoneLook {
    tilt: number; // degrees
    shade: number; // -1 (darker) .. 1 (lighter)
    inset: [number, number, number, number]; // px trimmed from top, right, bottom, left
    radius: string; // CSS border-radius
    texX: number;
    texY: number;
}

export const stoneLook = (id: string, area: number, wonk: number): StoneLook => {
    const r = seededRandom(hashString(id));
    const spread = (n: number) => (r() - 0.5) * 2 * n;
    const corner = () => Math.round(5 + r() * 4 + r() * 12 * wonk);
    return {
        tilt: +(spread(1.8 * wonk) / Math.sqrt(area)).toFixed(2),
        shade: +spread(0.35 + 0.65 * wonk).toFixed(2),
        inset: [0, 0, 0, 0].map(() => +(r() * 3.5 * wonk).toFixed(1)) as StoneLook['inset'],
        radius: `${corner()}px ${corner()}px ${corner()}px ${corner()}px / ${corner()}px ${corner()}px ${corner()}px ${corner()}px`,
        texX: Math.round(r() * 200),
        texY: Math.round(r() * 200),
    };
};

// --- Generation ---

// Smooth value noise in -1..1
const makeNoise = (rng: () => number, width: number, height: number, scale: number) => {
    const gw = Math.ceil(width / scale) + 2;
    const gh = Math.ceil(height / scale) + 2;
    const lattice = Array.from({ length: gw * gh }, () => rng() * 2 - 1);
    const at = (gx: number, gy: number) => lattice[gy * gw + gx];
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return (x: number, y: number) => {
        const fx = x / scale;
        const fy = y / scale;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        return top * (1 - ty) + bottom * ty;
    };
};

const BOSS_REQUIREMENT_RATIO = 0.35;

export interface GeneratedMap {
    config: MapConfig;
    squares: Square[];
    zoneCount: number;
    startId: string;
}

export const generateMap = (input: MapConfig): GeneratedMap => {
    const config = normalizeConfig(input);
    const { width: W, height: H, layout } = config;
    // Separate streams so moving one slider doesn't reshuffle everything else
    const zoneRng = seedrandom(`${config.seed}:zones`);
    const stoneRng = seedrandom(`${config.seed}:stones`);
    const lootRng = seedrandom(`${config.seed}:loot`);
    const [dx, dy] = DIRECTIONS[config.direction];

    const idx = (x: number, y: number) => y * W + x;
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const norm = (x: number, y: number): [number, number] => [W > 1 ? x / (W - 1) : 0.5, H > 1 ? y / (H - 1) : 0.5];

    const coarse = makeNoise(zoneRng, W, H, 5);
    const fine = makeNoise(zoneRng, W, H, 2);
    const noise = (x: number, y: number) => coarse(x, y) * 0.7 + fine(x, y) * 0.3;

    const finalBossSize = Math.min(5, config.bossSize + 1);
    const progress = new Float64Array(W * H); // 0 at the start, 1 at the big boss
    const zoneOfCell = new Int32Array(W * H);

    // --- 1. Zone field ---
    const maxRing = Math.floor((Math.min(W, H) - 1) / 2);
    // Rings: keep a core in the middle big enough for the final boss
    const coreRings = Math.max(0, Math.ceil((finalBossSize - (Math.min(W, H) % 2 ? 1 : 2)) / 2));
    const coreStart = Math.max(1, maxRing - coreRings);

    // Zones need some depth to hold together, so small or thin maps get fewer of them
    const span = layout === 'rings' ? coreStart * 2.5
        : layout === 'burst' ? Math.min(W, H) / 2 * (2.5 / 1.5)
            : dx && dy ? (W + H) / 2 : dx ? W : H;
    const zones = Math.max(MAP_LIMITS.minZones, Math.min(config.zones, Math.floor(span / 2.5) + (layout === 'rings' ? 1 : 0)));

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const [u, v] = norm(x, y);
            const i = idx(x, y);
            const n = noise(x, y) * config.roughness;
            if (layout === 'rings') {
                const ring = Math.min(x, y, W - 1 - x, H - 1 - y);
                progress[i] = maxRing ? ring / maxRing : 0;
                if (ring >= coreStart) {
                    zoneOfCell[i] = zones;
                } else {
                    const r = clamp(ring + n * 1.6, 0, coreStart - 0.001);
                    zoneOfCell[i] = Math.floor((r / coreStart) * (zones - 1)) + 1;
                }
                continue;
            }
            let t: number;
            if (layout === 'burst') {
                t = Math.min(1, Math.hypot((u - 0.5) * 2, (v - 0.5) * 2) / 1.15);
            } else {
                const parts: number[] = [];
                if (dx) parts.push(dx > 0 ? u : 1 - u);
                if (dy) parts.push(dy > 0 ? v : 1 - v);
                t = layout === 'corner' ? Math.max(...parts) : parts.reduce((a, b) => a + b, 0) / parts.length;
            }
            progress[i] = t;
            zoneOfCell[i] = clamp(Math.floor((t + n * 0.14) * zones) + 1, 1, zones);
        }
    }

    // --- 2. Tidy zones: fold stray islands into their surroundings, then renumber densely ---
    for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        const seen = new Uint8Array(W * H);
        const components: { zone: number; cells: number[] }[] = [];
        for (let start = 0; start < W * H; start++) {
            if (seen[start]) continue;
            const zone = zoneOfCell[start];
            const cells = [start];
            seen[start] = 1;
            for (let k = 0; k < cells.length; k++) {
                const cx = cells[k] % W;
                const cy = Math.floor(cells[k] / W);
                for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + ox;
                    const ny = cy + oy;
                    if (!inBounds(nx, ny)) continue;
                    const j = idx(nx, ny);
                    if (!seen[j] && zoneOfCell[j] === zone) { seen[j] = 1; cells.push(j); }
                }
            }
            components.push({ zone, cells });
        }
        const largest: Record<number, number> = {};
        components.forEach(c => { largest[c.zone] = Math.max(largest[c.zone] || 0, c.cells.length); });
        components.forEach(component => {
            if (component.cells.length === largest[component.zone]) return;
            const counts: Record<number, number> = {};
            component.cells.forEach(cell => {
                const cx = cell % W;
                const cy = Math.floor(cell / W);
                for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    if (!inBounds(cx + ox, cy + oy)) continue;
                    const z = zoneOfCell[idx(cx + ox, cy + oy)];
                    if (z !== component.zone) counts[z] = (counts[z] || 0) + 1;
                }
            });
            const target = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]);
            if (target) {
                component.cells.forEach(cell => { zoneOfCell[cell] = target; });
                changed = true;
            }
        });
        if (!changed) break;
    }
    const used = [...new Set(zoneOfCell)].sort((a, b) => a - b);
    const renumber: Record<number, number> = {};
    used.forEach((zone, i) => { renumber[zone] = i + 1; });
    for (let i = 0; i < W * H; i++) zoneOfCell[i] = renumber[zoneOfCell[i]];
    const zoneCount = used.length;
    const zoneAt = (x: number, y: number) => zoneOfCell[idx(x, y)];

    // --- 3. Start cell ---
    const startAnchor: [number, number] =
        layout === 'rings' ? [0.5 + dx * 0.5, 0.5 + dy * 0.5]
            : layout === 'burst' ? [0.5, 0.5]
                : [0.5 - dx * 0.5, 0.5 - dy * 0.5];
    const bossAnchor: [number, number] = [0.5 + dx * 0.5, 0.5 + dy * 0.5];
    const distTo = (x: number, y: number, anchor: [number, number]) => {
        const [u, v] = norm(x, y);
        return Math.hypot(u - anchor[0], v - anchor[1]) / Math.SQRT2;
    };

    let startX = 0;
    let startY = 0;
    let bestStart = Infinity;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (zoneAt(x, y) !== 1) continue;
            const score = progress[idx(x, y)] * 4 + distTo(x, y, startAnchor);
            if (score < bestStart) { bestStart = score; startX = x; startY = y; }
        }
    }
    const startId = `${startX}-${startY}`;

    // --- 4. Bosses on each zone's frontier ---
    const owner: (string | null)[] = new Array(W * H).fill(null);
    owner[idx(startX, startY)] = startId;
    const placements: { x: number; y: number; w: number; h: number; kind: 'start' | 'boss' | 'stone' }[] = [
        { x: startX, y: startY, w: 1, h: 1, kind: 'start' },
    ];
    const claim = (x: number, y: number, w: number, h: number, kind: 'boss' | 'stone') => {
        const id = `${x}-${y}`;
        for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) owner[idx(x + ox, y + oy)] = id;
        placements.push({ x, y, w, h, kind });
    };

    for (let zone = 1; zone <= zoneCount; zone++) {
        const isFinal = zone === zoneCount;
        // Prefer a spot touching the next zone; on very thin or ragged zones, settle for anywhere
        const attempts: [number, boolean][] = [];
        for (let size = isFinal ? finalBossSize : config.bossSize; size >= 1; size--) attempts.push([size, true]);
        if (!isFinal) attempts.push([1, false]);
        for (const [size, needsFrontier] of attempts) {
            let best: { x: number; y: number; score: number } | null = null;
            for (let y = 0; y + size <= H; y++) {
                for (let x = 0; x + size <= W; x++) {
                    let fits = true;
                    let touchesNext = isFinal || !needsFrontier;
                    let progressSum = 0;
                    for (let oy = 0; oy < size && fits; oy++) {
                        for (let ox = 0; ox < size; ox++) {
                            const cx = x + ox;
                            const cy = y + oy;
                            if (zoneAt(cx, cy) !== zone || owner[idx(cx, cy)]) { fits = false; break; }
                            progressSum += progress[idx(cx, cy)];
                            if (!touchesNext) {
                                for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
                                    if (inBounds(nx, ny) && zoneAt(nx, ny) === zone + 1) touchesNext = true;
                                }
                            }
                        }
                    }
                    if (!fits || !touchesNext) continue;
                    const cx = x + (size - 1) / 2;
                    const cy = y + (size - 1) / 2;
                    const along = progressSum / (size * size);
                    const score = layout === 'burst'
                        ? along * 1.5 + (1 - distTo(cx, cy, bossAnchor)) * 4 + zoneRng() * 0.15
                        : isFinal && layout === 'rings'
                            ? along * 10 - distTo(cx, cy, [0.5, 0.5]) * 4
                            : along * 3 + distTo(cx, cy, [startX / Math.max(1, W - 1), startY / Math.max(1, H - 1)]) * 0.8 + zoneRng() * 0.15;
                    if (!best || score > best.score) best = { x, y, score };
                }
            }
            if (best) {
                claim(best.x, best.y, size, size, 'boss');
                break;
            }
        }
    }

    // --- 5. Pack everything else with random stones ---
    const maxSpan = 1 + Math.ceil(config.stoneSize * 3);
    const falloff = 2 - 1.9 * config.stoneSize;
    const shapes: { w: number; h: number; weight: number }[] = [];
    for (let h = 1; h <= maxSpan; h++) {
        for (let w = 1; w <= maxSpan; w++) {
            if (w * h > 8 || Math.max(w, h) / Math.min(w, h) > 4) continue;
            // Long bricks read as masonry, so they beat squares of the same area
            const weight = w * h === 1
                ? 1 - 0.7 * config.stoneSize
                : Math.exp(-(w * h - 1) * falloff) * (w !== h ? 1.3 : 1);
            shapes.push({ w, h, weight });
        }
    }
    const totalWeight = shapes.reduce((sum, s) => sum + s.weight, 0);
    const pickShape = () => {
        let roll = stoneRng() * totalWeight;
        for (const shape of shapes) {
            roll -= shape.weight;
            if (roll <= 0) return shape;
        }
        return shapes[0];
    };

    const order = Array.from({ length: W * H }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(stoneRng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach(cell => {
        if (owner[cell]) return;
        const ax = cell % W;
        const ay = Math.floor(cell / W);
        const zone = zoneAt(ax, ay);
        for (let attempt = 0; attempt < 8; attempt++) {
            const shape = pickShape();
            // The anchor can sit anywhere inside the stone, not just its corner
            const x = ax - Math.floor(stoneRng() * shape.w);
            const y = ay - Math.floor(stoneRng() * shape.h);
            let fits = true;
            for (let oy = 0; oy < shape.h && fits; oy++) {
                for (let ox = 0; ox < shape.w; ox++) {
                    if (!inBounds(x + ox, y + oy) || owner[idx(x + ox, y + oy)] || zoneAt(x + ox, y + oy) !== zone) {
                        fits = false;
                        break;
                    }
                }
            }
            if (fits) {
                claim(x, y, shape.w, shape.h, 'stone');
                return;
            }
        }
        claim(ax, ay, 1, 1, 'stone');
    });

    // --- 6. Turn placements into squares ---
    const jitter = () => 0.85 + lootRng() * 0.3;
    const squaresByZone: Record<number, Square[]> = {};
    const bosses: Square[] = [];
    const squares: Square[] = placements.map(p => {
        const zone = zoneAt(p.x, p.y);
        const depth = zoneDepth(zone, zoneCount);
        const baseHealth = 30 * Math.pow(2.7, depth);
        const baseCoins = 4 * Math.pow(2.4, depth);
        const area = p.w * p.h;
        const isGate = p.kind === 'boss';
        const isElite = p.kind === 'stone' && area >= 2 && zone > 1 && lootRng() < config.elites * 0.3;

        let health = baseHealth * Math.pow(area, 0.95) * jitter();
        let coins = baseCoins * area * jitter();
        if (isElite) {
            health = baseHealth * area * 3 * jitter();
            coins = baseCoins * area * 4 * jitter();
        }
        if (isGate) {
            const bulk = Math.pow(area / 4, 0.6);
            health = baseHealth * (zone === zoneCount ? 40 : 20) * bulk;
            coins = baseCoins * 30 * bulk;
        }

        const square: Square = {
            id: `${p.x}-${p.y}`,
            status: p.kind === 'start' ? 'available' : 'locked',
            position: { x: p.x, y: p.y },
            size: { w: p.w, h: p.h },
            isBoss: isElite,
            isGate,
            isPortal: false,
            level: zone,
            adjacentSquares: [],
            health: Math.floor(health),
            maxHealth: Math.floor(health),
            moneyPerSecond: Math.max(1, Math.floor(coins)),
        };

        if (!isGate && p.kind !== 'start' && lootRng() < config.treasure * 0.4) {
            const treasureTypes: TreasureType[] = ['damage', 'autoclick', 'coins', 'luck'];
            const weights = [0.3, 0.25, 0.35, 0.1];
            const roll = lootRng();
            let cumulative = 0;
            let type: TreasureType = 'coins';
            for (let i = 0; i < treasureTypes.length; i++) {
                cumulative += weights[i];
                if (roll <= cumulative) { type = treasureTypes[i]; break; }
            }
            // damage/autoclick/luck values are percentages; coins are absolute
            const value = type === 'coins'
                ? Math.floor(baseCoins * 6 * Math.sqrt(area) * jitter())
                : type === 'luck' ? 5 : 12;
            square.treasure = { type, value };
        }

        if (isGate) bosses.push(square);
        else (squaresByZone[zone] ||= []).push(square);
        return square;
    });

    // Wake requirement scales with zone size, but never more than the zone holds
    bosses.forEach(boss => {
        const zoneSize = (squaresByZone[boss.level!] || []).length;
        boss.gateRequirement = Math.min(zoneSize, Math.max(Math.min(4, zoneSize), Math.ceil(zoneSize * BOSS_REQUIREMENT_RATIO)));
    });

    // One portal per zone (except the last) that wakes the boss early
    for (let zone = 1; zone < zoneCount; zone++) {
        const boss = bosses.find(b => b.level === zone);
        const eligible = (squaresByZone[zone] || []).filter(s =>
            !s.isBoss && !s.treasure && s.size.w * s.size.h <= 2 && s.id !== startId);
        if (!boss || !eligible.length) continue;
        const portal = eligible[Math.floor(lootRng() * eligible.length)];
        portal.isPortal = true;
        portal.portalTarget = boss.id;
        portal.treasure = { type: 'coins', value: Math.floor(4 * Math.pow(2.4, zoneDepth(zone, zoneCount)) * 10) };
    }

    // Adjacency: every square touching any cell this square covers (8 directions)
    squares.forEach(square => {
        const neighbours = new Set<string>();
        for (let oy = -1; oy <= square.size.h; oy++) {
            for (let ox = -1; ox <= square.size.w; ox++) {
                const nx = square.position.x + ox;
                const ny = square.position.y + oy;
                if (!inBounds(nx, ny)) continue;
                const id = owner[idx(nx, ny)];
                if (id && id !== square.id) neighbours.add(id);
            }
        }
        square.adjacentSquares = [...neighbours];
    });

    return { config, squares, zoneCount, startId };
};

// Which zone each cell belongs to, for frames, labels and the camera
export interface ZoneIndex {
    width: number;
    height: number;
    cells: Int32Array; // zone per cell, row-major
}

export const buildZoneIndex = (squares: Square[], width: number, height: number): ZoneIndex => {
    const cells = new Int32Array(width * height);
    squares.forEach(square => {
        for (let oy = 0; oy < square.size.h; oy++) {
            for (let ox = 0; ox < square.size.w; ox++) {
                const x = square.position.x + ox;
                const y = square.position.y + oy;
                if (x < width && y < height) cells[y * width + x] = square.level || 1;
            }
        }
    });
    return { width, height, cells };
};

// SVG path (in cell units, edges on the mortar lines) around every cell in zones <= `zone`
export const zoneOutline = (index: ZoneIndex, zone: number): string => {
    const { width: W, height: H, cells } = index;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cells[y * W + x] <= zone;
    let path = '';
    for (let y = 0; y <= H; y++) {
        let runStart = -1;
        for (let x = 0; x <= W; x++) {
            const edge = x < W && inside(x, y) !== inside(x, y - 1);
            if (edge && runStart < 0) runStart = x;
            if (!edge && runStart >= 0) { path += `M${runStart} ${y}H${x}`; runStart = -1; }
        }
    }
    for (let x = 0; x <= W; x++) {
        let runStart = -1;
        for (let y = 0; y <= H; y++) {
            const edge = y < H && inside(x, y) !== inside(x - 1, y);
            if (edge && runStart < 0) runStart = y;
            if (!edge && runStart >= 0) { path += `M${x} ${runStart}V${y}`; runStart = -1; }
        }
    }
    return path;
};

// Bounding box (in cells) of zones <= `zone`
export const zoneBounds = (index: ZoneIndex, zone: number) => {
    const { width: W, height: H, cells } = index;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (cells[y * W + x] > zone) continue;
            x0 = Math.min(x0, x); y0 = Math.min(y0, y);
            x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    }
    return x1 < 0 ? { x0: 0, y0: 0, x1: W - 1, y1: H - 1 } : { x0, y0, x1, y1 };
};
