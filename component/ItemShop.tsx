import { GameState } from '@/types/game';

interface ItemShopProps {
  gameState: GameState;
  onPurchase: (item: ShopItem) => void;
}

interface ShopItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  action: (state: GameState) => Partial<GameState>;
}

const shopItems: ShopItem[] = [
  {
    id: 'click_damage',
    name: 'Click Damage +10',
    cost: 100,
    description: 'Increase click damage by 10',
    action: (state) => ({ clickDamage: state.clickDamage + 10 })
  },
  {
    id: 'auto_click',
    name: 'Auto Click +5',
    cost: 200,
    description: 'Increase auto-click damage by 5/s',
    action: (state) => ({ autoClickDamage: state.autoClickDamage + 5 })
  },
  {
    id: 'mega_click',
    name: 'Mega Click +50',
    cost: 500,
    description: 'Increase click damage by 50',
    action: (state) => ({ clickDamage: state.clickDamage + 50 })
  },
  {
    id: 'coin_multiplier',
    name: 'Coin Multiplier',
    cost: 1000,
    description: 'Double coin gains',
    action: (state) => ({ coinMultiplier: (state.coinMultiplier || 1) * 2 })
  }
];

export default function ItemShop({ gameState, onPurchase }: ItemShopProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {shopItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onPurchase(item)}
          disabled={gameState.coins < item.cost}
          className="bg-gray-800 p-4 rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors"
        >
          <h3 className="font-bold">{item.name}</h3>
          <p className="text-sm text-gray-400">{item.description}</p>
          <p className="text-yellow-500">{item.cost} coins</p>
        </button>
      ))}
    </div>
  );
} 