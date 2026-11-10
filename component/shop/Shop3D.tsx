'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GameState } from '@/types/game';
import { shopItems, ShopItem, ShopCategory, isSoldOut, timesBought } from '@/utils/shopItems';
import { ShopScene, SceneItem } from './ShopScene';
import styles from './Shop3D.module.css';

interface Shop3DProps {
  gameState: GameState;
  // Returns the purchase message, or null if the purchase failed
  onPurchase: (item: ShopItem) => { message?: string } | null;
  onClose: () => void;
}

const CATEGORIES: { id: ShopCategory; label: string; emoji: string }[] = [
  { id: 'upgrades', label: 'Upgrades', emoji: '⚔️' },
  { id: 'gadgets', label: 'Gadgets', emoji: '💣' },
  { id: 'mystery', label: 'Mystery', emoji: '🎁' },
];

const formatCoins = (value: number) => Math.floor(value).toLocaleString();

export default function Shop3D({ gameState, onPurchase, onClose }: Shop3DProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShopScene | null>(null);
  const [category, setCategory] = useState<ShopCategory>('upgrades');
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const items = useMemo(() => shopItems.filter(item => item.category === category), [category]);
  const isLocked = (item: ShopItem) => gameState.lifetimeEarnings < item.visibleAtEarnings;
  const canBuy = (item: ShopItem) => !isLocked(item) && !isSoldOut(item, gameState) && gameState.coins >= item.cost(gameState);

  const sceneItems: SceneItem[] = items.map(item => ({
    model: item.model,
    color: item.color,
    locked: isLocked(item),
    affordable: canBuy(item),
  }));
  const lockKey = sceneItems.map(item => (item.locked ? 1 : 0)).join('');
  const affordKey = sceneItems.map(item => (item.affordable ? 1 : 0)).join('');

  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new ShopScene(canvasRef.current, index => setSelected(index));
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Rebuild the carousel when the category changes or an item unlocks
  useEffect(() => {
    sceneRef.current?.setItems(sceneItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, lockKey]);

  useEffect(() => {
    sceneRef.current?.setAffordability(sceneItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affordKey]);

  useEffect(() => {
    sceneRef.current?.select(selected);
  }, [selected, category]);

  const changeCategory = (next: ShopCategory) => {
    setCategory(next);
    setSelected(0);
  };

  const step = (direction: number) => setSelected(current => (current + direction + items.length) % items.length);

  const item = items[Math.min(selected, items.length - 1)];
  const locked = item ? isLocked(item) : true;
  const soldOut = item ? isSoldOut(item, gameState) : false;
  const cost = item ? item.cost(gameState) : 0;
  const affordable = item ? canBuy(item) : false;
  const owned = item ? timesBought(gameState, item.id) : 0;

  const buy = () => {
    if (!item || !affordable) return;
    const result = onPurchase(item);
    if (!result) return;
    sceneRef.current?.celebrate();
    setToast({ id: Date.now(), text: result.message || `${item.emoji} ${item.name} acquired!` });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        buy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={styles.overlay}>
      <div ref={canvasRef} className={styles.canvas} />

      <header className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleMain}>The Bazaar</span>
          <span className={styles.titleSub}>Spend coins, break more squares</span>
        </div>
        <div className={styles.coins}>
          <span className={styles.coinIcon} />
          {formatCoins(gameState.coins)}
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Close shop">✕</button>
      </header>

      <nav className={styles.tabs}>
        {CATEGORIES.map(tab => {
          const buyable = shopItems.some(i => i.category === tab.id && canBuy(i));
          return (
            <button
              key={tab.id}
              className={styles.tab}
              data-active={tab.id === category}
              onClick={() => changeCategory(tab.id)}
            >
              <span>{tab.emoji}</span> {tab.label}
              {buyable && <span className={styles.tabDot} />}
            </button>
          );
        })}
      </nav>

      {items.length > 1 && (
        <>
          <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={() => step(-1)} aria-label="Previous item">‹</button>
          <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={() => step(1)} aria-label="Next item">›</button>
        </>
      )}

      {toast && <div key={toast.id} className={styles.toast}>{toast.text}</div>}

      {item && (
        <section className={styles.panel} style={{ '--accent': `#${item.color.toString(16).padStart(6, '0')}` } as React.CSSProperties}>
          <div className={styles.strip}>
            {items.map((entry, index) => (
              <button
                key={entry.id}
                className={styles.stripItem}
                data-active={index === selected}
                data-locked={isLocked(entry)}
                onClick={() => setSelected(index)}
                aria-label={isLocked(entry) ? 'Locked item' : entry.name}
              >
                {isLocked(entry) ? '?' : entry.emoji}
                {canBuy(entry) && <span className={styles.stripDot} />}
              </button>
            ))}
          </div>

          {locked ? (
            <div className={styles.info}>
              <h3 className={styles.name}>???</h3>
              <p className={styles.description}>
                Earn {formatCoins(item.visibleAtEarnings)} lifetime coins to reveal this item.
                ({formatCoins(gameState.lifetimeEarnings)} so far)
              </p>
            </div>
          ) : (
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <h3 className={styles.name}>{item.name}</h3>
                {owned > 0 && item.category === 'upgrades' && <span className={styles.level}>Lv {owned}</span>}
              </div>
              <p className={styles.tagline}>{item.tagline}</p>
              <p className={styles.description}>{item.description}</p>
              <span className={styles.preview}>{item.preview(gameState)}</span>
            </div>
          )}

          <button className={styles.buy} disabled={!affordable} onClick={buy}>
            {locked ? 'Locked' : soldOut ? 'Sold out' : (
              <>
                <span className={styles.buyLabel}>{affordable ? 'Buy' : `Need ${formatCoins(cost - gameState.coins)} more`}</span>
                <span className={styles.buyCost}><span className={styles.coinIcon} />{formatCoins(cost)}</span>
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );
}
