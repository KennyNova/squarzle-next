import { GameState } from '@/types/game';
import { Button } from "@/component/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/component/ui/card";
import { cn } from "@/lib/utils";

interface ItemShopProps {
  gameState: GameState;
  onPurchase: (item: ShopItem) => void;
}

interface ShopItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  emoji: string;
  category: 'damage' | 'auto' | 'coins' | 'luck' | 'special';
  visibleAtEarnings: number;
  action: (state: GameState) => Partial<GameState>;
}

const shopItems: ShopItem[] = [
  {
    id: 'click_damage_small',
    name: 'Click Power',
    cost: 100,
    description: 'Increase click damage by 10',
    emoji: '👆',
    category: 'damage',
    visibleAtEarnings: 0,
    action: (state) => ({ clickDamage: state.clickDamage + 10 })
  },
  {
    id: 'click_damage_medium',
    name: 'Super Click',
    cost: 500,
    description: 'Increase click damage by 50',
    emoji: '💪',
    category: 'damage',
    visibleAtEarnings: 250,
    action: (state) => ({ clickDamage: state.clickDamage + 50 })
  },
  {
    id: 'click_damage_large',
    name: 'Mega Click',
    cost: 2000,
    description: 'Increase click damage by 200',
    emoji: '🔥',
    category: 'damage',
    visibleAtEarnings: 1000,
    action: (state) => ({ clickDamage: state.clickDamage + 200 })
  },
  {
    id: 'auto_click_small',
    name: 'Auto Clicker',
    cost: 200,
    description: 'Increase auto-click by 5/s',
    emoji: '🤖',
    category: 'auto',
    visibleAtEarnings: 150,
    action: (state) => ({ autoClickDamage: state.autoClickDamage + 5 })
  },
  {
    id: 'auto_click_medium',
    name: 'Turbo Clicker',
    cost: 1000,
    description: 'Increase auto-click by 25/s',
    emoji: '⚡',
    category: 'auto',
    visibleAtEarnings: 800,
    action: (state) => ({ autoClickDamage: state.autoClickDamage + 25 })
  },
  {
    id: 'coin_multiplier_small',
    name: 'Coin Magnet',
    cost: 1000,
    description: 'Multiply coin gains by 1.5x',
    emoji: '💰',
    category: 'coins',
    visibleAtEarnings: 600,
    action: (state) => ({ coinMultiplier: (state.coinMultiplier || 1) * 1.5 })
  },
  {
    id: 'coin_multiplier_large',
    name: 'Gold Rush',
    cost: 5000,
    description: 'Multiply coin gains by 2x',
    emoji: '🤑',
    category: 'coins',
    visibleAtEarnings: 2500,
    action: (state) => ({ coinMultiplier: (state.coinMultiplier || 1) * 2 })
  },
  {
    id: 'luck_small',
    name: 'Lucky Charm',
    cost: 800,
    description: 'Increase luck by 20%',
    emoji: '🍀',
    category: 'luck',
    visibleAtEarnings: 500,
    action: (state) => ({ luckMultiplier: state.luckMultiplier + 0.2 })
  },
  {
    id: 'luck_medium',
    name: 'Fortune Finder',
    cost: 3000,
    description: 'Increase luck by 50%',
    emoji: '🌟',
    category: 'luck',
    visibleAtEarnings: 1500,
    action: (state) => ({ luckMultiplier: state.luckMultiplier + 0.5 })
  }
];

export default function ItemShop({ gameState, onPurchase }: ItemShopProps) {
  // Filter items based on lifetime earnings
  const visibleItems = shopItems.filter(item => gameState.lifetimeEarnings >= item.visibleAtEarnings);
  
  // Group visible items by category
  const categories = {
    damage: visibleItems.filter(item => item.category === 'damage'),
    auto: visibleItems.filter(item => item.category === 'auto'),
    coins: visibleItems.filter(item => item.category === 'coins'),
    luck: visibleItems.filter(item => item.category === 'luck'),
    special: visibleItems.filter(item => item.category === 'special')
  };

  // Check if item is affordable
  const canAfford = (cost: number) => gameState.coins >= cost;

  // Check if any items exist in a category
  const hasCategory = (category: keyof typeof categories) => categories[category].length > 0;

  // Get section title
  const getCategoryTitle = (category: keyof typeof categories) => {
    switch(category) {
      case 'damage': return { title: 'Click Power Upgrades', emoji: '💪' };
      case 'auto': return { title: 'Auto Clicker Upgrades', emoji: '🤖' };
      case 'coins': return { title: 'Coin Multipliers', emoji: '💰' };
      case 'luck': return { title: 'Luck Boosters', emoji: '🍀' };
      case 'special': return { title: 'Special Items', emoji: '✨' };
    }
  };

  // Get background style for category
  const getCategoryStyle = (category: keyof typeof categories) => {
    switch(category) {
      case 'damage': return 'from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800';
      case 'auto': return 'from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800';
      case 'coins': return 'from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700';
      case 'luck': return 'from-green-700 to-green-900 hover:from-green-600 hover:to-green-800';
      case 'special': return 'from-pink-700 to-pink-900 hover:from-pink-600 hover:to-pink-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats section */}
      <Card className="bg-gray-900">
        <CardHeader>
          <CardTitle className="text-center">Your Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Lifetime Earnings: {Math.floor(gameState.lifetimeEarnings)} coins
          </p>
        </CardContent>
      </Card>
      
      {/* Category sections */}
      {['damage', 'auto', 'coins', 'luck', 'special'].map((categoryKey) => {
        const category = categoryKey as keyof typeof categories;
        if (!hasCategory(category)) return null;
        
        const { title, emoji } = getCategoryTitle(category);
        const style = getCategoryStyle(category);
        
        return (
          <Card key={categoryKey} className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center border-b border-gray-700 pb-2">
                <span className="mr-2 text-xl">{emoji}</span>
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories[category].map((item) => (
                  <Button
                    key={item.id}
                    onClick={() => onPurchase(item)}
                    disabled={!canAfford(item.cost)}
                    className={cn(
                      "relative overflow-hidden p-3 h-auto",
                      canAfford(item.cost) ? style : "bg-gray-700 opacity-60"
                    )}
                  >
                    <div className="flex items-start w-full">
                      <span className="text-2xl mr-3">{item.emoji}</span>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <p className={cn(
                          "mt-1 font-medium",
                          canAfford(item.cost) ? "text-yellow-300" : "text-gray-400"
                        )}>
                          {item.cost} coins
                        </p>
                      </div>
                    </div>
                    {!canAfford(item.cost) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                        <span className="text-xs font-medium px-2 py-1 bg-destructive rounded">
                          Need {item.cost - Math.floor(gameState.coins)} more coins
                        </span>
                      </div>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Coming soon section for locked items */}
      {gameState.lifetimeEarnings < 5000 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-sm text-center">
              More items will unlock as you earn more coins!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 