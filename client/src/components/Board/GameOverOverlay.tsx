import React from 'react';
import { useGameStore } from '../../store/gameStore';

export default function GameOverOverlay() {
  const { gameOverResult, clearGameOver } = useGameStore();

  if (!gameOverResult) return null;

  const isPartyWin = gameOverResult.winner === 'party';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        textAlign: 'center',
        padding: '48px',
        background: '#1a1a2e',
        borderRadius: '16px',
        border: `2px solid ${isPartyWin ? '#66bb6a' : '#e94560'}`,
        boxShadow: `0 0 60px ${isPartyWin ? 'rgba(102,187,106,0.3)' : 'rgba(233,69,96,0.3)'}`,
      }}>
        <h1 style={{
          fontSize: '48px',
          margin: '0 0 16px',
          color: isPartyWin ? '#66bb6a' : '#e94560',
        }}>
          {isPartyWin ? 'Victory!' : 'Defeat!'}
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#e0e0e0',
          margin: '0 0 32px',
        }}>
          {gameOverResult.message}
        </p>
        <button
          onClick={clearGameOver}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            background: '#0f3460',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Return to Lobby
        </button>
      </div>
    </div>
  );
}
