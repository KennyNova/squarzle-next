// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, Square } from '@/types/game';
import { generateMap, getRevealedAdjacents, canPassGate, getGateTunnelSquares } from '@/utils/gameLogic';
import VersaillesGrid from '@/component/VersaillesGrid';
import ItemShop from '@/component/ItemShop';

export default function Home() {
  const [domLoaded, setDomLoaded] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isSeedMenuOpen, setIsSeedMenuOpen] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  
  const [gameState, setGameState] = useState<GameState>(() => {
    const seed = Math.random().toString(36).substring(7);
    // Initial game state without screen width (will be updated after DOM loads)
    return {
      squares: [],
      clickDamage: 10,
      coins: 0,
      autoClickDamage: 0,
      seed,
      luckMultiplier: 1,
      squaresKilled: 0,
      gateProgress: {},
      lifetimeEarnings: 0,
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

    // Check if this is a gate and if requirements are met
    if (clickedSquare.isGate && clickedSquare.gateRequirement && clickedSquare.level) {
      const canPass = canPassGate(clickedSquare, gameState.gateProgress);
      if (!canPass) {
        const currentProgress = gameState.gateProgress[clickedSquare.level] || 0;
        setGateMessage(`Gate requires ${clickedSquare.gateRequirement} squares killed at this level. Progress: ${currentProgress}/${clickedSquare.gateRequirement}`);
        setTimeout(() => setGateMessage(null), 3000);
        return;
      }
    }

    setGameState(prev => {
      const newHealth = clickedSquare.health - prev.clickDamage;
      const newStatus = newHealth <= 0 ? 'dead' as const : 'available' as const;

      // Apply treasure effects if square is killed
      let treasureBonus = 0;
      let newClickDamage = prev.clickDamage;
      let newAutoClickDamage = prev.autoClickDamage;
      let newCoinMultiplier = prev.coinMultiplier || 1;
      let newLuckMultiplier = prev.luckMultiplier;

      if (newStatus === 'dead' && clickedSquare.treasure) {
        // Apply luck to treasure value
        const treasureValue = clickedSquare.treasure.value * prev.luckMultiplier;
        
        switch (clickedSquare.treasure.type) {
          case 'damage':
            newClickDamage += treasureValue;
            break;
          case 'autoclick':
            newAutoClickDamage += treasureValue;
            break;
          case 'coins':
            treasureBonus = treasureValue;
            break;
          case 'luck':
            newLuckMultiplier += treasureValue / 100; // Convert percentage to multiplier
            break;
        }
      }

      // Calculate level and update gate progress
      let newGateProgress = { ...prev.gateProgress };
      let newSquaresKilled = prev.squaresKilled;
      
      if (newStatus === 'dead') {
        newSquaresKilled++;
        
        // Update level gate progress if the square has a level
        if (clickedSquare.level) {
          newGateProgress[clickedSquare.level] = (newGateProgress[clickedSquare.level] || 0) + 1;
        }
      }

      // Get adjacent squares to reveal (limited to MAX_ADJACENT_REVEALED)
      let squaresToReveal: string[] = [];
      if (newStatus === 'dead') {
        squaresToReveal = getRevealedAdjacents(prev.squares, clickedSquare);
        
        // If this is a gate, get additional squares to auto-clear (tunnel effect)
        if (clickedSquare.isGate) {
          // Display a message about the tunnel being opened
          setGateMessage(`You broke through the gate! Tunnel opened!`);
          setTimeout(() => setGateMessage(null), 3000);
          
          // Get squares to auto-clear in the tunnel
          const tunnelSquares = getGateTunnelSquares(prev.squares, clickedSquare);
          squaresToReveal = [...new Set([...squaresToReveal, ...tunnelSquares])];
        }
      }

      const newSquares = prev.squares.map(square => {
        // Update clicked square
        if (square.id === clickedSquare.id) {
          return { 
            ...square, 
            health: newHealth, 
            status: newStatus 
          };
        }
        
        // For gate tunnels, also auto-clear squares ahead (kill them)
        if (newStatus === 'dead' && clickedSquare.isGate) {
          const isTunnelSquare = squaresToReveal.includes(square.id) && 
                                 square.position.y === clickedSquare.position.y && 
                                 square.position.x > clickedSquare.position.x;
          
          if (isTunnelSquare) {
            // Auto-kill the square in the tunnel
            return {
              ...square,
              health: 0,
              status: 'dead' as const
            };
          }
        }
        
        // Make eligible adjacent squares available if clicked square is dead
        if (newStatus === 'dead' && 
            square.status === 'locked' && 
            squaresToReveal.includes(square.id)) {
          
          // Check if this is a gate and requirements are met
          if (square.isGate && square.gateRequirement && square.level) {
            const canPass = canPassGate(square, newGateProgress);
            if (!canPass) {
              return square;
            }
          }
          
          return { ...square, status: 'available' as const };
        }
        
        return square;
      });

      // Calculate coin reward with distance-based scaling and luck
      const coinsReward = clickedSquare.health <= prev.clickDamage 
        ? clickedSquare.moneyPerSecond * (prev.coinMultiplier || 1) * prev.luckMultiplier 
        : 0;
        
      // Update lifetime earnings
      const totalEarned = coinsReward + treasureBonus;
      const newLifetimeEarnings = prev.lifetimeEarnings + totalEarned;

      return {
        ...prev,
        squares: newSquares,
        coins: prev.coins + totalEarned,
        clickDamage: newClickDamage,
        autoClickDamage: newAutoClickDamage,
        coinMultiplier: newCoinMultiplier,
        luckMultiplier: newLuckMultiplier,
        squaresKilled: newSquaresKilled,
        gateProgress: newGateProgress,
        lifetimeEarnings: newLifetimeEarnings,
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
          // Skip gates for auto-click if requirements aren't met
          if (firstAvailable.isGate && firstAvailable.gateRequirement && firstAvailable.level) {
            const canPass = canPassGate(firstAvailable, prev.gateProgress);
            if (!canPass) {
              return { ...prev, coins: newCoins };
            }
          }
          
          const newHealth = Math.max(0, firstAvailable.health - prev.autoClickDamage / 10);
          const newStatus = newHealth <= 0 ? 'dead' as const : 'available' as const;
          
          let newGateProgress = { ...prev.gateProgress };
          let newSquaresKilled = prev.squaresKilled;
          
          if (newStatus === 'dead') {
            newSquaresKilled++;
            
            // Update level gate progress if the square has a level
            if (firstAvailable.level) {
              newGateProgress[firstAvailable.level] = (newGateProgress[firstAvailable.level] || 0) + 1;
            }
          }
          
          // Get adjacent squares to reveal (limited to MAX_ADJACENT_REVEALED)
          let squaresToReveal: string[] = [];
          if (newStatus === 'dead') {
            squaresToReveal = getRevealedAdjacents(prev.squares, firstAvailable);
            
            // If this is a gate, get additional squares to auto-clear (tunnel effect)
            if (firstAvailable.isGate) {
              // Display a message about the tunnel being opened
              setGateMessage(`You broke through the gate! Tunnel opened!`);
              setTimeout(() => setGateMessage(null), 3000);
              
              // Get squares to auto-clear in the tunnel
              const tunnelSquares = getGateTunnelSquares(prev.squares, firstAvailable);
              squaresToReveal = [...new Set([...squaresToReveal, ...tunnelSquares])];
            }
          }
          
          const newSquares = prev.squares.map(square => {
            if (square.id === firstAvailable.id) {
              return {
                ...square,
                health: newHealth,
                status: newStatus,
              };
            }
            
            // For gate tunnels, also auto-clear squares ahead (kill them)
            if (newStatus === 'dead' && firstAvailable.isGate) {
              const isTunnelSquare = squaresToReveal.includes(square.id) && 
                                   square.position.y === firstAvailable.position.y && 
                                   square.position.x > firstAvailable.position.x;
              
              if (isTunnelSquare) {
                // Auto-kill the square in the tunnel
                return {
                  ...square,
                  health: 0,
                  status: 'dead' as const
                };
              }
            }
            
            // If the square just died, make adjacent squares available
            if (newStatus === 'dead' && 
                square.status === 'locked' && 
                squaresToReveal.includes(square.id)) {
              
              // Check if this is a gate and requirements are met
              if (square.isGate && square.gateRequirement && square.level) {
                const canPass = canPassGate(square, newGateProgress);
                if (!canPass) {
                  return square;
                }
              }
              
              return { ...square, status: 'available' as const };
            }
            return square;
          });

          // Apply coin multiplier and luck to auto-click rewards
          const autoClickReward = newStatus === 'dead' ? 
            (firstAvailable.moneyPerSecond / 10) * (prev.coinMultiplier || 1) * prev.luckMultiplier : 0;
            
          // Update lifetime earnings
          const newLifetimeEarnings = prev.lifetimeEarnings + autoClickReward;

          return {
            ...prev,
            squares: newSquares,
            coins: newCoins + autoClickReward,
            squaresKilled: newSquaresKilled,
            gateProgress: newGateProgress,
            lifetimeEarnings: newLifetimeEarnings,
          };
        }

        return { ...prev, coins: newCoins };
      });
    }, 100);
  
    return () => clearInterval(interval);
  }, [domLoaded]);
  
  // Handle clicking outside of modal to close it
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isShopModalOpen && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsShopModalOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isShopModalOpen]);

  // Shop modal component
  const ShopModal = () => (
    <div className={`fixed inset-0 z-50 ${isShopModalOpen ? 'flex' : 'hidden'} items-center justify-center`} onClick={() => setIsShopModalOpen(false)}>
      <div className="fixed inset-0 bg-black bg-opacity-75"></div>
      <div 
        ref={modalRef}
        className="relative bg-gray-800 rounded-lg w-full max-w-md p-4 m-4 max-h-[90vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Item Shop</h2>
          <button 
            onClick={() => setIsShopModalOpen(false)}
            className="text-gray-400 hover:text-white p-2"
            aria-label="Close shop"
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
            <div className="flex flex-wrap items-center">
              <p className="text-lg font-bold mr-4">Coins: {Math.floor(gameState.coins)}</p>
              <p className="text-sm mr-2">Click: {gameState.clickDamage}</p>
              <p className="text-sm mr-2">Auto: {gameState.autoClickDamage}/s</p>
              {gameState.coinMultiplier && gameState.coinMultiplier > 1 && 
                <p className="text-sm mr-2">💰 {gameState.coinMultiplier.toFixed(1)}x</p>}
              <p className="text-sm">🍀 {gameState.luckMultiplier.toFixed(1)}x</p>
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
            <div className="flex-grow my-2 relative">
              <VersaillesGrid 
                squares={gameState.squares} 
                onSquareClick={handleClick}
              />
              
              {/* Gate requirement message */}
              {gateMessage && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
                  {gateMessage}
                </div>
              )}
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
                      luckMultiplier: 1,
                      squaresKilled: 0,
                      gateProgress: {},
                      lifetimeEarnings: 0,
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