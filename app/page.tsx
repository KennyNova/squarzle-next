// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { GameState, Square } from '@/types/game';
import { generateMap } from '@/utils/gameLogic';
import VersaillesGrid from '@/component/VersaillesGrid';
import ItemShop from '@/component/ItemShop';

export default function Home() {
  const [domLoaded, setDomLoaded] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isSeedMenuOpen, setIsSeedMenuOpen] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const seed = Math.random().toString(36).substring(7);
    // Initial game state without screen width (will be updated after DOM loads)
    return {
      squares: [],
      clickDamage: 10,
      coins: 0,
      autoClickDamage: 0,
      seed,
    };
  });

  // Initialize the map once on load
  useEffect(() => {
    if (!domLoaded) return;
    
    // Generate the map with fixed dimensions
    setGameState(prev => ({
      ...prev,
      squares: generateMap(prev.seed)
    }));
  }, [domLoaded]);

  // Set domLoaded to true after component mounts
  useEffect(() => {
    setDomLoaded(true);
  }, []);

  const handleClick = (clickedSquare: Square) => {
    if (clickedSquare.status !== 'available') return;

    setGameState(prev => {
      const newSquares = prev.squares.map(square => {
        if (square.id === clickedSquare.id) {
          const newHealth = square.health - prev.clickDamage;
          const newStatus = newHealth <= 0 ? 'dead' as const : 'available' as const;
          
          // If the square is now dead, make adjacent squares available
          if (newStatus === 'dead') {
            return { ...square, health: newHealth, status: newStatus };
          }
          
          return { ...square, health: newHealth };
        }
        
        // If the clicked square is dead, make adjacent squares available
        if (clickedSquare.health <= prev.clickDamage && 
          square.status === 'locked' && 
          clickedSquare.adjacentSquares.includes(square.id)) {
          return { ...square, status: 'available' as const };
        }
        
        return square;
      });

      return {
        ...prev,
        squares: newSquares,
        coins: prev.coins + (clickedSquare.health <= prev.clickDamage ? clickedSquare.moneyPerSecond : 0),
      };
    });
  };

  useEffect(() => {
    if (!domLoaded) return;

    const interval = setInterval(() => {
      setGameState((prev: GameState) => {
        if (!prev.squares.length) return prev;
        
        let newCoins = prev.coins;
        
        // Find the first available square
        const firstAvailable = prev.squares.find(square => 
          square.status === 'available'
        );

        if (firstAvailable) {
          const newHealth = Math.max(0, firstAvailable.health - prev.autoClickDamage / 10);
          const newStatus = newHealth <= 0 ? 'dead' as const : 'available' as const;
          
          const newSquares = prev.squares.map(square => {
            if (square.id === firstAvailable.id) {
              return {
                ...square,
                health: newHealth,
                status: newStatus,
              };
            }
            // If the square just died, make adjacent squares available
            if (newStatus === 'dead' && 
                square.status === 'locked' && 
                firstAvailable.adjacentSquares.includes(square.id)) {
              return { ...square, status: 'available' as const };
            }
            return square;
          });

          return {
            ...prev,
            squares: newSquares,
            coins: newCoins + (firstAvailable.status === 'dead' ? 
              (firstAvailable.moneyPerSecond / 10) * (prev.coinMultiplier || 1) : 0),
          };
        }

        return { ...prev, coins: newCoins };
      });
    }, 100);
  
    return () => clearInterval(interval);
  }, [domLoaded]);

  // Shop modal component
  const ShopModal = () => (
    <div className={`fixed inset-0 z-50 ${isShopModalOpen ? 'flex' : 'hidden'} items-center justify-center`}>
      <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setIsShopModalOpen(false)}></div>
      <div className="relative bg-gray-800 rounded-lg w-full max-w-md p-4 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Item Shop</h2>
          <button 
            onClick={() => setIsShopModalOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <ItemShop 
          gameState={gameState}
          onPurchase={(item) => {
            if (gameState.coins >= item.cost) {
              setGameState(prev => ({
                ...prev,
                ...item.action(prev),
                coins: prev.coins - item.cost
              }));
            }
          }}
        />
      </div>
    </div>
  );

  return (
    <>
    {domLoaded && (
      <main className="flex flex-col min-h-screen bg-gray-900 text-white">
        {/* Fixed top bar with game stats */}
        <div className="sticky top-0 z-10 bg-gray-800 p-2 shadow-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <p className="text-lg font-bold mr-4">Coins: {Math.floor(gameState.coins)}</p>
              <p className="text-sm mr-2">Click: {gameState.clickDamage}</p>
              <p className="text-sm">Auto: {gameState.autoClickDamage}/s</p>
              {gameState.coinMultiplier && <p className="text-sm ml-2">Multiplier: {gameState.coinMultiplier}x</p>}
            </div>
            
            {/* Shop button on all screen sizes */}
            <button
              onClick={() => setIsShopModalOpen(true)}
              className="bg-purple-700 hover:bg-purple-600 py-1 px-3 rounded text-sm transition-colors"
            >
              Shop
            </button>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-grow p-2 sm:p-4">
          <div className="max-w-7xl mx-auto flex flex-col h-full">
            {/* Game grid - fill available space */}
            <div className="flex-grow my-2">
              <VersaillesGrid 
                squares={gameState.squares} 
                onSquareClick={handleClick}
              />
            </div>
          </div>
        </div>
        
        {/* Circular sticky button for seed and new game */}
        <div className="fixed bottom-4 left-4 z-20">
          <div className={`relative ${isSeedMenuOpen ? 'menu-open' : ''}`}>
            {/* Main circular button */}
            <button 
              onClick={() => setIsSeedMenuOpen(!isSeedMenuOpen)}
              className="w-12 h-12 rounded-full bg-purple-700 flex items-center justify-center shadow-lg hover:bg-purple-600 transition-colors sticky-button"
              aria-label="Game options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Expanded menu */}
            <div className={`absolute bottom-14 left-0 bg-gray-800 p-3 rounded-lg shadow-lg transform transition-all duration-300 ${isSeedMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
              <div className="w-48 text-sm">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Game Options</span>
                </div>
                <p className="mb-2 truncate">Seed: {gameState.seed}</p>
                <button
                  onClick={() => {
                    const newSeed = Math.random().toString(36).substring(7);
                    setGameState({
                      squares: generateMap(newSeed),
                      clickDamage: 10,
                      coins: 0,
                      autoClickDamage: 0,
                      seed: newSeed,
                    });
                    setIsSeedMenuOpen(false);
                  }}
                  className="bg-purple-500 px-3 py-1 rounded w-full hover:bg-purple-600 transition-colors"
                >
                  New Game
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Shop modal for all screen sizes */}
        <ShopModal />
      </main>
    )}
    </>
  );
}