// utils/breakage.ts
// Procedural damage geometry for squares. Everything works in a 0-100 box that maps
// onto the square, and is seeded so a square's cracks stay stable between renders.

export interface Impact {
    x: number; // 0-100 across the square
    y: number; // 0-100 down the square
    seed: number;
}

export interface Fragment {
    clipPath: string;
    originX: number;
    originY: number;
    dx: number; // sideways push in px
    rotate: number;
    delay: number; // ms
}

// Small deterministic PRNG (mulberry32)
export const seededRandom = (seed: number) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const randomImpact = (): Impact => ({
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
    seed: Math.floor(Math.random() * 1e9),
});

const clamp = (value: number) => Math.max(0, Math.min(100, value));

// Crack paths radiating from each impact. `severity` (0-1) is how damaged the square is,
// so cracks grow longer and branch more as health drops.
export const crackPaths = (impacts: Impact[], severity: number): string[] => {
    const paths: string[] = [];
    impacts.forEach((impact, index) => {
        const rng = seededRandom(impact.seed);
        // Older impacts have had longer to spread
        const age = 1 - index / (impacts.length + 1) * 0.5;
        const rays = 4 + Math.floor(rng() * 3);
        const baseAngle = rng() * Math.PI * 2;

        for (let r = 0; r < rays; r++) {
            const angle = baseAngle + (r / rays) * Math.PI * 2 + (rng() - 0.5) * 0.7;
            const length = (10 + severity * 75) * (0.55 + rng() * 0.6) * age;
            const segments = 3 + Math.floor(rng() * 3);
            let x = impact.x;
            let y = impact.y;
            let heading = angle;
            let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;

            for (let s = 0; s < segments; s++) {
                heading += (rng() - 0.5) * 0.9;
                const step = length / segments;
                x = clamp(x + Math.cos(heading) * step);
                y = clamp(y + Math.sin(heading) * step);
                d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;

                // Branches appear once the square is badly hurt
                if (severity > 0.35 && rng() < 0.35) {
                    const branchHeading = heading + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6);
                    const branchLength = step * (0.6 + rng());
                    const bx = clamp(x + Math.cos(branchHeading) * branchLength);
                    const by = clamp(y + Math.sin(branchHeading) * branchLength);
                    paths.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`);
                }
            }
            paths.push(d);
        }
    });
    return paths;
};

// Irregular polygon around a point, used for chipped-out holes and falling chips
export const chipPolygon = (impact: Impact, radius: number): { x: number; y: number }[] => {
    const rng = seededRandom(impact.seed ^ 0x5f3759df);
    const points = 6 + Math.floor(rng() * 3);
    const start = rng() * Math.PI * 2;
    return Array.from({ length: points }, (_, i) => {
        const angle = start + (i / points) * Math.PI * 2;
        const r = radius * (0.6 + rng() * 0.6);
        return { x: clamp(impact.x + Math.cos(angle) * r), y: clamp(impact.y + Math.sin(angle) * r) };
    });
};

export const toSvgPoints = (points: { x: number; y: number }[]) =>
    points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export const toClipPath = (points: { x: number; y: number }[]) =>
    `polygon(${points.map(p => `${p.x.toFixed(1)}% ${p.y.toFixed(1)}%`).join(', ')})`;

// Where a ray from (px, py) at `angle` leaves the 0-100 box
const rayToEdge = (px: number, py: number, angle: number) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const ts: number[] = [];
    if (dx > 1e-6) ts.push((100 - px) / dx);
    if (dx < -1e-6) ts.push(-px / dx);
    if (dy > 1e-6) ts.push((100 - py) / dy);
    if (dy < -1e-6) ts.push(-py / dy);
    const t = Math.min(...ts);
    return { x: clamp(px + dx * t), y: clamp(py + dy * t) };
};

const normalise = (angle: number) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

// Splits the square into wedges radiating from the killing blow, then splits each
// wedge into an inner and outer piece so the square breaks into chunks, not slices.
export const shatterFragments = (impact: Impact): Fragment[] => {
    const rng = seededRandom(impact.seed ^ 0x9e3779b9);
    const count = 7 + Math.floor(rng() * 4);
    const start = rng() * Math.PI * 2;
    const angles = Array.from({ length: count }, (_, i) =>
        normalise(start + ((i + (rng() - 0.5) * 0.6) / count) * Math.PI * 2)).sort((a, b) => a - b);

    const corners = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
        .map(c => ({ ...c, angle: normalise(Math.atan2(c.y - impact.y, c.x - impact.x)) }));

    const fragments: Fragment[] = [];
    angles.forEach((a1, i) => {
        let a2 = angles[(i + 1) % count];
        if (a2 <= a1) a2 += Math.PI * 2;

        const outer = [rayToEdge(impact.x, impact.y, a1)];
        corners
            .map(c => ({ ...c, angle: c.angle < a1 ? c.angle + Math.PI * 2 : c.angle }))
            .filter(c => c.angle > a1 && c.angle < a2)
            .sort((a, b) => a.angle - b.angle)
            .forEach(c => outer.push({ x: c.x, y: c.y }));
        outer.push(rayToEdge(impact.x, impact.y, a2));

        // Inner cut, part way along each ray
        const cut = 0.35 + rng() * 0.3;
        const inner = outer.map(p => ({
            x: impact.x + (p.x - impact.x) * cut,
            y: impact.y + (p.y - impact.y) * cut,
        }));

        const pieces = [
            [{ x: impact.x, y: impact.y }, inner[0], inner[inner.length - 1]],
            [...inner, ...[...outer].reverse()],
        ];

        pieces.forEach((polygon, pieceIndex) => {
            const cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
            const cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
            const distance = Math.hypot(cx - impact.x, cy - impact.y);
            fragments.push({
                clipPath: toClipPath(polygon),
                originX: cx,
                originY: cy,
                dx: ((cx - impact.x) / 50) * (14 + rng() * 18),
                rotate: (rng() - 0.5) * 140,
                // Pieces nearest the hit drop first
                delay: pieceIndex === 0 ? 0 : 20 + distance * 2.2 + rng() * 40,
            });
        });
    });
    return fragments;
};
