// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { GameState, Square } from '@/types/game';
import { generateMap } from '@/utils/gameLogic';
import VersaillesGrid from '@/component/VersaillesGrid';

export default function Home() {
  const [domLoaded, setDomLoaded] = useState(false);
  const [gameState, setGameState] = useState<GameState>(() => {
    const seed = Math.random().toString(36).substring(7);
    return {
      squares: generateMap(seed),
      clickDamage: 10,
      coins: 0,
      autoClickDamage: 0,
      seed,
    };
  });

  const handleClick = (square: Square) => {
    

    if (square.status !== 'available') return;

    setGameState((prev: GameState) => {
      const newSquares = [...prev.squares];
      const squareIndex = newSquares.findIndex(s => s.id === square.id);
      
      if (squareIndex === -1) return prev;

      const newHealth = Math.max(0, square.health - prev.clickDamage);
      newSquares[squareIndex] = {
        ...square,
        health: newHealth,
        status: newHealth <= 0 ? 'dead' : 'available',
      };

      // Unlock adjacent squares if this one dies
      if (newHealth <= 0) {
        const [x, y] = square.id.split('-').map(Number);
        const adjacentPositions = [
          { x: x + 1, y: y },
          { x: x, y: y + 1 },
        ];

        adjacentPositions.forEach((pos: { x: number; y: number }) => {
          const adjSquareIndex = newSquares.findIndex(
            s => s.position.x === pos.x && s.position.y === pos.y
          );
          if (adjSquareIndex !== -1 && newSquares[adjSquareIndex].status === 'locked') {
            newSquares[adjSquareIndex] = {
              ...newSquares[adjSquareIndex],
              status: 'available',
            };
          }
        });
      }

      return {
        ...prev,
        squares: newSquares,
      };
    });
  };

  useEffect(() => {
    setDomLoaded(true);

    const interval = setInterval(() => {
      setGameState((prev: GameState) => {
        let newCoins = prev.coins;
        const newSquares = prev.squares.map(square => {
          if (square.status === 'dead') {
            newCoins += square.moneyPerSecond / 10;
            return square;
          }
          if (square.status === 'available') {
            const newHealth = Math.max(0, square.health - prev.autoClickDamage / 10);
            return {
              ...square,
              health: newHealth,
              status: newHealth <= 0 ? 'dead' as const : 'available' as const,
            };
          }
          return square;
        });
  
        return {
          ...prev,
          squares: newSquares,
          coins: newCoins,
        };
      });
    }, 100);
  
    return () => clearInterval(interval);
  }, []);

  return (
    <>
    {domLoaded && (<main className="min-h-screen p-8 bg-gray-900 text-white">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <p>Coins: {Math.floor(gameState.coins)}</p>
          <p>Click Damage: {gameState.clickDamage}</p>
          <p>Auto Click: {gameState.autoClickDamage}/s</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => setGameState((prev: GameState) => ({
              ...prev,
              clickDamage: prev.clickDamage + 10,
              coins: prev.coins - 100,
            }))}
            disabled={gameState.coins < 100}
            className="bg-blue-500 px-4 py-2 rounded disabled:opacity-50"
          >
            Upgrade Click (100 coins)
          </button>
          <button
            onClick={() => setGameState((prev: GameState) => ({
              ...prev,
              autoClickDamage: prev.autoClickDamage + 5,
              coins: prev.coins - 200,
            }))}
            disabled={gameState.coins < 200}
            className="bg-green-500 px-4 py-2 rounded disabled:opacity-50"
          >
            Upgrade Auto (200 coins)
          </button>
        </div>
      </div>

      <VersaillesGrid 
  squares={gameState.squares} 
  onSquareClick={handleClick}
/>

      <div className="mt-4">
        <p>Seed: {gameState.seed}</p>
        <button
          onClick={() => setGameState(() => {
            const newSeed = Math.random().toString(36).substring(7);
            return {
              squares: generateMap(newSeed),
              clickDamage: 10,
              coins: 0,
              autoClickDamage: 0,
              seed: newSeed,
            };
          })}
          className="bg-purple-500 px-4 py-2 rounded mt-2"
        >
          New Game
        </button>
      </div>
    </main>)}
    </>
  );
}