// src/app/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GameState, GameEvent, ConsumableId, MapConfig } from '@/types/game';
import {
  createInitialState, applyDamage, applyDamageMany, attackableSquares, autoTarget,
  bombHits, lightningHits, zoneBoss, isSealed, saveGame, loadGame, clearSave,
} from '@/utils/gameLogic';
import { zoneThemes, randomMapConfig, decodeMap, encodeMap, randomSeed, DEFAULT_MAP } from '@/utils/mapGen';
import MapCreator from '@/component/creator/MapCreator';
import { shopItems, purchaseItem, isSoldOut, ShopItem } from '@/utils/shopItems';
import VersaillesGrid, { BoardEffect, SquareDamage } from '@/component/VersaillesGrid';
import { Impact, randomImpact, shatterFragments, chipPolygon, toClipPath } from '@/utils/breakage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/component/ui/dialog";

// three.js is only downloaded when the shop is first opened
const loadShop = () => import('@/component/shop/Shop3D');
const Shop3D = dynamic(loadShop, {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0b0714] text-white/70 text-lg font-bold">
      Opening the Bazaar…
    </div>
  ),
});

const FRENZY_MS = 20_000;
const MIDAS_MS = 30_000;

interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'zone' | 'boss' | 'info' | 'buff';
}

const LAST_MAP_KEY = 'squarzle-last-map';

const loadLastMap = (): MapConfig | null => {
  try {
    const code = localStorage.getItem(LAST_MAP_KEY);
    return code ? decodeMap(code) : null;
  } catch {
    return null;
  }
};

const rememberMap = (config: MapConfig) => {
  try {
    localStorage.setItem(LAST_MAP_KEY, encodeMap(config));
  } catch {
    // Storage can be unavailable; the creator just starts from defaults next time
  }
};

const layoutNames = { rings: 'Pyramid', sweep: 'Sweep', corner: 'Corner', burst: 'Burst' };

const MAX_IMPACTS = 6;

// A chunk breaking off at the impact, falling away and leaving a hole behind
const chipAt = (impact: Impact): { hole: Impact; effect: Omit<BoardEffect, 'id' | 'squareId'> } => {
  const hole = {
    x: Math.max(10, Math.min(90, impact.x + (Math.random() - 0.5) * 10)),
    y: Math.max(10, Math.min(90, impact.y + (Math.random() - 0.5) * 10)),
    seed: Math.floor(Math.random() * 1e9),
  };
  return {
    hole,
    effect: {
      kind: 'chip',
      fragments: [{
        clipPath: toClipPath(chipPolygon(hole, 11)),
        originX: hole.x,
        originY: hole.y,
        dx: (hole.x - 50) * 0.5 + (Math.random() - 0.5) * 16,
        rotate: (Math.random() - 0.5) * 220,
        delay: 0,
      }],
    },
  };
};

const formatNumber = (value: number) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e4) return `${(value / 1e3).toFixed(1)}K`;
  return Math.floor(value).toLocaleString();
};

const ABILITIES: { id: ConsumableId; emoji: string; name: string; key: string }[] = [
  { id: 'bomb', emoji: '💣', name: 'Bomb', key: '1' },
  { id: 'lightning', emoji: '⚡', name: 'Storm', key: '2' },
  { id: 'frenzy', emoji: '🧪', name: 'Frenzy', key: '3' },
  { id: 'midas', emoji: '✨', name: 'Midas', key: '4' },
];

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isVictoryOpen, setIsVictoryOpen] = useState(false);
  const [creator, setCreator] = useState<MapConfig | null>(null);
  const [armed, setArmed] = useState<'bomb' | null>(null);
  const armedRef = useRef<'bomb' | null>(null);
  const [effects, setEffects] = useState<BoardEffect[]>([]);
  const [hitTicks, setHitTicks] = useState<Record<string, number>>({});
  const [damage, setDamage] = useState<Record<string, SquareDamage>>({});
  const damageRef = useRef<Record<string, SquareDamage>>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [shaking, setShaking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [coinBump, setCoinBump] = useState(0);
  const effectId = useRef(0);

  // Every state change goes through here so intervals and clicks never read stale state
  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  const setArmedMode = useCallback((mode: 'bomb' | null) => {
    armedRef.current = mode;
    setArmed(mode);
  }, []);

  // Load a save, or start fresh and explain the rules. A shared ?map= link opens the creator.
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      commit(saved);
      if (saved.won) setIsVictoryOpen(true);
    } else {
      commit(createInitialState({ ...DEFAULT_MAP, seed: randomSeed() }));
      setIsRulesModalOpen(true);
    }
    const shared = decodeMap(new URLSearchParams(window.location.search).get('map') || '');
    if (shared) {
      setCreator(shared);
      setIsRulesModalOpen(false);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [commit]);

  const pushEffects = useCallback((list: Omit<BoardEffect, 'id'>[]) => {
    if (!list.length) return;
    const created = list.map(effect => ({ ...effect, id: ++effectId.current }));
    const ids = new Set(created.map(effect => effect.id));
    setEffects(current => [...current.slice(-60), ...created]);
    setTimeout(() => setEffects(current => current.filter(effect => !ids.has(effect.id))), 1500);
  }, []);

  const showBanner = useCallback((next: Omit<Banner, 'id'>) => {
    setBanner({ ...next, id: Date.now() + Math.random() });
  }, []);

  const shake = useCallback(() => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    setTimeout(() => setShaking(false), 550);
  }, []);

  // Turns game events into floating numbers, cracks, debris, banners and shakes.
  // `clickImpact` is where the player's click landed on `clickedId`.
  const processEvents = useCallback((events: GameEvent[], clickedId?: string, clickImpact?: Impact) => {
    if (!events.length) return;
    const newEffects: Omit<BoardEffect, 'id'>[] = [];
    const hitIds: string[] = [];
    const damageMap = { ...damageRef.current };
    let damageChanged = false;

    events.forEach(event => {
      switch (event.type) {
        case 'hit': {
          hitIds.push(event.squareId);
          const square = stateRef.current?.squares.find(s => s.id === event.squareId);
          const impact = event.squareId === clickedId && clickImpact ? clickImpact : randomImpact();
          const current = damageMap[event.squareId] || { impacts: [], chips: [] };
          const next = { impacts: [...current.impacts, impact].slice(-MAX_IMPACTS), chips: current.chips };
          // Every quarter of health lost knocks a chunk out where the hit landed
          if (square && square.health > 0) {
            const after = square.health / square.maxHealth;
            const before = Math.min(1, (square.health + event.amount) / square.maxHealth);
            if (Math.floor(before * 4) > Math.floor(after * 4)) {
              const chip = chipAt(impact);
              next.chips = [...next.chips, chip.hole].slice(-8);
              newEffects.push({ squareId: event.squareId, ...chip.effect });
            }
          }
          damageMap[event.squareId] = next;
          damageChanged = true;
          if (event.source === 'lightning') newEffects.push({ squareId: event.squareId, kind: 'zap', text: '⚡' });
          if (event.source === 'drone') newEffects.push({ squareId: event.squareId, kind: 'zap', text: '🛸' });
          newEffects.push({
            squareId: event.squareId,
            kind: event.crit ? 'crit' : 'dmg',
            text: event.crit ? `CRIT ${formatNumber(event.amount)}!` : formatNumber(event.amount),
          });
          break;
        }
        case 'kill': {
          // Shatter outward from the killing blow
          const impacts = damageMap[event.squareId]?.impacts;
          const impact = (event.squareId === clickedId && clickImpact) || impacts?.[impacts.length - 1] || randomImpact();
          newEffects.push({ squareId: event.squareId, kind: 'shatter', fragments: shatterFragments(impact) });
          delete damageMap[event.squareId];
          damageChanged = true;
          if (event.coins > 0) {
            newEffects.push({
              squareId: event.squareId,
              kind: event.jackpot ? 'jackpot' : 'coin',
              text: event.jackpot ? `JACKPOT +${formatNumber(event.coins)}` : `+${formatNumber(event.coins)}`,
            });
          }
          setCoinBump(bump => bump + 1);
          break;
        }
        case 'treasure':
          newEffects.push({ squareId: event.squareId, kind: 'treasure', text: event.label });
          break;
        case 'sealed': {
          const zone = stateRef.current?.squares.find(s => s.id === event.squareId)?.level || 1;
          const ZONES = zoneThemes(stateRef.current?.zoneCount || 1);
          newEffects.push({ squareId: event.squareId, kind: 'sealed', text: `🔒 ${event.progress}/${event.requirement}` });
          showBanner({
            title: `${ZONES[zone - 1].boss} is sealed`,
            subtitle: `Break ${event.requirement - event.progress} more squares in this zone to wake it`,
            tone: 'info',
          });
          break;
        }
        case 'bossAwake': {
          const ZONES = zoneThemes(stateRef.current?.zoneCount || 1);
          showBanner({ title: `${ZONES[event.zone - 1].bossEmoji} ${ZONES[event.zone - 1].boss} awakens!`, subtitle: 'Defeat it to open the next zone', tone: 'boss' });
          break;
        }
        case 'portal': {
          const ZONES = zoneThemes(stateRef.current?.zoneCount || 1);
          showBanner({ title: '🌀 Portal opened!', subtitle: `${ZONES[event.zone - 1].boss} woke up early`, tone: 'boss' });
          break;
        }
        case 'zoneUnlocked': {
          const ZONES = zoneThemes(stateRef.current?.zoneCount || 1);
          shake();
          showBanner({ title: `Zone ${event.zone} unlocked`, subtitle: ZONES[event.zone - 1].name, tone: 'zone' });
          break;
        }
        case 'victory':
          shake();
          setTimeout(() => setIsVictoryOpen(true), 900);
          break;
      }
    });

    pushEffects(newEffects);
    if (damageChanged) {
      damageRef.current = damageMap;
      setDamage(damageMap);
    }
    if (hitIds.length) {
      setHitTicks(current => {
        const next = { ...current };
        hitIds.forEach(id => { next[id] = (next[id] || 0) + 1; });
        return next;
      });
    }
  }, [pushEffects, showBanner, shake]);

  const handleSquareClick = useCallback((id: string, point: { x: number; y: number }) => {
    const state = stateRef.current;
    if (!state) return;
    const now = Date.now();
    const impact: Impact = { ...point, seed: Math.floor(Math.random() * 1e9) };

    if (armedRef.current === 'bomb') {
      const hits = bombHits(state, id);
      if (!hits.length || state.inventory.bomb <= 0) return;
      const paid = { ...state, inventory: { ...state.inventory, bomb: state.inventory.bomb - 1 } };
      const result = applyDamageMany(paid, hits, 'bomb', now);
      commit(result.state);
      pushEffects([{ squareId: id, kind: 'boom' }]);
      processEvents(result.events, id, impact);
      shake();
      setArmedMode(null);
      return;
    }

    const result = applyDamage(state, id, state.clickDamage, 'click', now);
    if (result.state !== state) commit(result.state);
    processEvents(result.events, id, impact);
  }, [commit, processEvents, pushEffects, shake, setArmedMode]);

  const activateAbility = useCallback((id: ConsumableId) => {
    const state = stateRef.current;
    if (!state) return;
    if (state.inventory[id] <= 0) {
      setIsShopOpen(true);
      return;
    }
    const now = Date.now();
    const inventory = { ...state.inventory, [id]: state.inventory[id] - 1 };

    switch (id) {
      case 'bomb':
        setArmedMode(armedRef.current === 'bomb' ? null : 'bomb');
        if (armedRef.current) showBanner({ title: '💣 Bomb armed', subtitle: 'Click a square to blow it up', tone: 'info' });
        return;
      case 'lightning': {
        const hits = lightningHits(state);
        if (!hits.length) return;
        const result = applyDamageMany({ ...state, inventory }, hits, 'lightning', now);
        commit(result.state);
        processEvents(result.events);
        shake();
        return;
      }
      case 'frenzy':
        commit({ ...state, inventory, buffs: { ...state.buffs, frenzyUntil: Math.max(now, state.buffs.frenzyUntil) + FRENZY_MS } });
        showBanner({ title: '🧪 FRENZY!', subtitle: '3× damage for 20 seconds', tone: 'buff' });
        return;
      case 'midas':
        commit({ ...state, inventory, buffs: { ...state.buffs, midasUntil: Math.max(now, state.buffs.midasUntil) + MIDAS_MS } });
        showBanner({ title: '✨ Midas touch', subtitle: '2× coins for 30 seconds', tone: 'buff' });
        return;
    }
  }, [commit, processEvents, shake, showBanner, setArmedMode]);

  // Auto damage: 10 small ticks per second on the weakest square
  useEffect(() => {
    const interval = setInterval(() => {
      const state = stateRef.current;
      if (!state || state.autoClickDamage <= 0 || state.won) return;
      const target = autoTarget(state);
      if (!target) return;
      const result = applyDamage(state, target.id, state.autoClickDamage / 10, 'auto', Date.now());
      commit(result.state);
      processEvents(result.events);
    }, 100);
    return () => clearInterval(interval);
  }, [commit, processEvents]);

  // Drones: each one zaps a random square every second
  useEffect(() => {
    const interval = setInterval(() => {
      const state = stateRef.current;
      if (!state || state.drones <= 0 || state.won) return;
      const targets = attackableSquares(state);
      if (!targets.length) return;
      const hits = Array.from({ length: state.drones }, () => ({
        squareId: targets[Math.floor(Math.random() * targets.length)].id,
        damage: Math.max(1, state.clickDamage * 0.5),
      }));
      const result = applyDamageMany(state, hits, 'drone', Date.now());
      commit(result.state);
      processEvents(result.events);
    }, 1000);
    return () => clearInterval(interval);
  }, [commit, processEvents]);

  // Warm up the 3D shop in the background so it opens instantly
  useEffect(() => {
    const timer = setTimeout(() => { loadShop(); }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Clock for buff countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  // Autosave
  useEffect(() => {
    const save = () => { if (stateRef.current) saveGame(stateRef.current); };
    const interval = setInterval(save, 3000);
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', save);
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 2800);
    return () => clearTimeout(timer);
  }, [banner]);

  // Hotkeys: 1-4 abilities, S shop, Esc cancels bomb
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isShopOpen || event.target instanceof HTMLInputElement) return;
      const ability = ABILITIES.find(a => a.key === event.key);
      if (ability) activateAbility(ability.id);
      if (event.key === 's' || event.key === 'S') setIsShopOpen(true);
      if (event.key === 'Escape') setArmedMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isShopOpen, activateAbility, setArmedMode]);

  const handlePurchase = useCallback((item: ShopItem) => {
    const state = stateRef.current;
    if (!state) return null;
    const result = purchaseItem(state, item);
    if (!result) return null;
    commit(result.state);
    return { message: result.message };
  }, [commit]);

  // The creator warns inline, so only the quick menu actions ask for confirmation
  const startGame = (config: MapConfig, confirmLoss = true) => {
    const state = stateRef.current;
    if (confirmLoss && state && !state.won && state.squaresKilled > 0 &&
        !window.confirm('Start a new map? Your current progress will be lost.')) return;
    clearSave();
    rememberMap(config);
    commit(createInitialState(config));
    setEffects([]);
    setHitTicks({});
    damageRef.current = {};
    setDamage({});
    setArmedMode(null);
    setIsMenuOpen(false);
    setIsVictoryOpen(false);
    setCreator(null);
  };

  const openCreator = () => {
    setCreator(loadLastMap() || stateRef.current?.map || DEFAULT_MAP);
    setIsMenuOpen(false);
    setIsVictoryOpen(false);
  };

  if (!gameState) {
    return <main className="fixed inset-0 bg-[#07050d]" />;
  }

  const zone = gameState.unlockedZone;
  const themes = zoneThemes(gameState.zoneCount);
  const zoneInfo = themes[zone - 1];
  const boss = zoneBoss(gameState, zone);
  const progress = gameState.gateProgress[zone] || 0;
  const requirement = boss?.gateRequirement || 0;
  const bossSealed = boss ? isSealed(boss, gameState.gateProgress) : false;
  const frenzyLeft = Math.max(0, gameState.buffs.frenzyUntil - now);
  const midasLeft = Math.max(0, gameState.buffs.midasUntil - now);
  const affordableCount = shopItems.filter(item =>
    gameState.lifetimeEarnings >= item.visibleAtEarnings &&
    !isSoldOut(item, gameState) &&
    gameState.coins >= item.cost(gameState)).length;

  return (
    <>
      <Dialog open={isRulesModalOpen} onOpenChange={setIsRulesModalOpen}>
        <DialogContent className="bg-[#140e22] text-white border border-purple-500/30 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Welcome to Squarzle</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-3"><span className="text-xl">👆</span><span>Click glowing squares to break them. Each one you break drops coins and opens up its neighbours.</span></li>
            <li className="flex gap-3"><span className="text-xl">🌫️</span><span>You start in a small zone. Everything else is hidden in fog.</span></li>
            <li className="flex gap-3"><span className="text-xl">{themes[0].bossEmoji}</span><span>Each zone has a 👑 boss guarding the way on. Break enough squares to wake it, then beat it to reveal the next zone.</span></li>
            <li className="flex gap-3"><span className="text-xl">🗺️</span><span>Want a different world? Open the map creator from the ☰ menu and build your own.</span></li>
            <li className="flex gap-3"><span className="text-xl">💰</span><span>Spend coins in the Bazaar on upgrades, drones, bombs and potions.</span></li>
            <li className="flex gap-3"><span className="text-xl">🌀</span><span>Hidden portals wake a boss early. Treasure squares give permanent boosts.</span></li>
          </ul>
          <p className="text-xs text-white/50">Hotkeys: 1–4 use gadgets · S opens the shop · progress saves automatically</p>
          <div className="flex justify-end">
            <button
              className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 px-6 py-3 font-black shadow-[0_5px_0_#4c1d95] active:translate-y-1 active:shadow-none transition"
              onClick={() => setIsRulesModalOpen(false)}
            >
              Let&apos;s break some squares
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isVictoryOpen} onOpenChange={setIsVictoryOpen}>
        <DialogContent className="bg-[#140e22] text-white border border-yellow-400/40 rounded-2xl text-center">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black">👑 You conquered Squarzle!</DialogTitle>
          </DialogHeader>
          <p className="text-white/70">{themes[themes.length - 1].boss} has fallen. Every zone is yours.</p>
          <div className="grid grid-cols-2 gap-3 my-2">
            <div className="rounded-xl bg-white/5 p-3"><div className="text-2xl font-black">{gameState.squaresKilled}</div><div className="text-xs text-white/50">squares broken</div></div>
            <div className="rounded-xl bg-white/5 p-3"><div className="text-2xl font-black">{formatNumber(gameState.lifetimeEarnings)}</div><div className="text-xs text-white/50">coins earned</div></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 px-6 py-3 font-black text-[#2a1606] shadow-[0_5px_0_#9a3412] active:translate-y-1 active:shadow-none transition"
              onClick={openCreator}
            >
              🗺️ Build a new map
            </button>
            <button
              className="rounded-xl bg-white/10 px-6 py-3 font-black hover:bg-white/15 transition"
              onClick={() => startGame(randomMapConfig())}
            >
              🎲 Random map
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {creator && (
        <MapCreator
          initial={creator}
          canClose={!!gameState}
          runInProgress={!gameState.won && gameState.squaresKilled > 0}
          onPlay={config => startGame(config, false)}
          onClose={() => setCreator(null)}
        />
      )}

      <main
        className="game-bg fixed inset-0 overflow-hidden text-white select-none"
        style={{ '--zone': zoneInfo.c } as React.CSSProperties}
      >
        <VersaillesGrid
          squares={gameState.squares}
          width={gameState.map.width}
          height={gameState.map.height}
          mapKey={`${encodeMap(gameState.map)}:${gameState.startId}`}
          themes={themes}
          startId={gameState.startId}
          wonk={gameState.map.wonk}
          unlockedZone={zone}
          gateProgress={gameState.gateProgress}
          hasRadar={gameState.hasRadar}
          effects={effects}
          hitTicks={hitTicks}
          damage={damage}
          showStartHint={gameState.squaresKilled === 0}
          armed={armed === 'bomb'}
          shaking={shaking}
          onSquareClick={handleSquareClick}
        />

        {/* Buff tint over the whole board */}
        {frenzyLeft > 0 && <div className="pointer-events-none absolute inset-0 frenzy-vignette" />}
        {midasLeft > 0 && <div className="pointer-events-none absolute inset-0 midas-vignette" />}

        {/* Top HUD */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="pointer-events-auto hud-panel flex flex-col gap-2 px-4 py-3">
              <div key={coinBump} className="coin-bump flex items-center gap-2 text-2xl sm:text-3xl font-black tabular-nums text-amber-200">
                <span className="coin-icon" />
                {formatNumber(gameState.coins)}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="stat-chip" title="Click damage">🗡️ {formatNumber(gameState.clickDamage)}</span>
                <span className="stat-chip" title="Auto damage per second">⚙️ {formatNumber(gameState.autoClickDamage)}/s</span>
                <span className="stat-chip" title="Crit chance">🎯 {Math.round(gameState.critChance * 100)}%</span>
                {gameState.drones > 0 && <span className="stat-chip" title="Drones">🛸 {gameState.drones}</span>}
                {(gameState.coinMultiplier || 1) > 1 && <span className="stat-chip" title="Coin multiplier">🧲 ×{(gameState.coinMultiplier || 1).toFixed(2)}</span>}
                <span className="stat-chip" title="Luck">🍀 {gameState.luckMultiplier.toFixed(2)}</span>
              </div>
            </div>

            {/* Zone objective */}
            <div className="order-last w-full flex justify-center md:order-none md:w-auto md:flex-1">
              <div className="pointer-events-auto hud-panel zone-card px-4 py-2.5 w-[min(420px,100%)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] zone-accent">Zone {zone} / {gameState.zoneCount}</span>
                  <span className="text-sm font-black truncate">{zoneInfo.name}</span>
                </div>
                {boss && boss.status !== 'dead' && (
                  <>
                    <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full zone-fill transition-[width] duration-300"
                        style={{ width: `${bossSealed ? Math.min(100, (progress / Math.max(1, requirement)) * 100) : (boss.health / boss.maxHealth) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                      {bossSealed
                        ? <>Break <b className="text-white">{Math.max(0, requirement - progress)}</b> more squares to wake {zoneInfo.bossEmoji} {zoneInfo.boss}</>
                        : <>⚔️ {zoneInfo.boss} is awake. Look for the 👑 crown!</>}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-start gap-2">
              <button
                className="pointer-events-auto shop-button relative"
                onClick={() => setIsShopOpen(true)}
              >
                <span className="text-xl">🏪</span>
                <span>Shop</span>
                {affordableCount > 0 && <span className="shop-badge">{affordableCount}</span>}
              </button>
              <div className="pointer-events-auto relative">
                <button className="hud-icon-button" onClick={() => setIsMenuOpen(open => !open)} aria-label="Game menu">☰</button>
                {isMenuOpen && (
                  <div className="hud-panel absolute right-0 top-12 w-56 p-3 text-sm space-y-2">
                    <p className="text-white/50 text-xs truncate">
                      {layoutNames[gameState.map.layout]} {gameState.map.width}×{gameState.map.height} · seed {gameState.seed}
                    </p>
                    <button className="menu-item" onClick={openCreator}>🗺️ Map creator</button>
                    <button className="menu-item" onClick={() => startGame(randomMapConfig())}>🎲 Random map</button>
                    <button className="menu-item" onClick={() => startGame(gameState.map)}>🔁 Restart this map</button>
                    <button className="menu-item" onClick={() => { setIsRulesModalOpen(true); setIsMenuOpen(false); }}>📖 How to play</button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </header>

        {/* Event banner */}
        {banner && (
          <div key={banner.id} className="banner pointer-events-none absolute left-1/2 top-[32%] z-30 text-center" data-tone={banner.tone}>
            <div className="banner-title">{banner.title}</div>
            {banner.subtitle && <div className="banner-subtitle">{banner.subtitle}</div>}
          </div>
        )}

        {/* Ability bar */}
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex gap-2 hud-panel p-2">
          {ABILITIES.map(ability => {
            const count = gameState.inventory[ability.id];
            const remaining = ability.id === 'frenzy' ? frenzyLeft : ability.id === 'midas' ? midasLeft : 0;
            const total = ability.id === 'frenzy' ? FRENZY_MS : MIDAS_MS;
            return (
              <button
                key={ability.id}
                className="ability"
                data-empty={count <= 0}
                data-active={(ability.id === 'bomb' && armed === 'bomb') || remaining > 0}
                onClick={() => activateAbility(ability.id)}
                title={`${ability.name} (${ability.key})`}
              >
                {remaining > 0 && (
                  <span className="ability-timer" style={{ '--p': `${Math.min(1, remaining / total) * 360}deg` } as React.CSSProperties} />
                )}
                <span className="relative text-2xl leading-none">{ability.emoji}</span>
                <span className="relative text-[10px] font-bold text-white/70">
                  {remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : ability.name}
                </span>
                <span className="ability-count">{count > 0 ? count : '+'}</span>
                <span className="ability-key">{ability.key}</span>
              </button>
            );
          })}
        </div>

        {isShopOpen && (
          <Shop3D gameState={gameState} onPurchase={handlePurchase} onClose={() => setIsShopOpen(false)} />
        )}
      </main>
    </>
  );
}
