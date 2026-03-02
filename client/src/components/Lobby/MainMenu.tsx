import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';

export default function MainMenu() {
  const { playerName, setPlayerName, createLobby, joinLobby, setView, connected } = useGameStore();
  const [joinCode, setJoinCode] = useState('');

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold', letterSpacing: '2px', color: '#ffd700' }}>
        Deck & Dominion
      </h1>
      <p style={{ color: '#a0a0a0', fontSize: '16px', marginBottom: '16px' }}>
        A Cooperative Deckbuilding TTRPG
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '320px',
        padding: '24px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          style={{ textAlign: 'center', fontSize: '16px' }}
        />

        <button
          onClick={createLobby}
          disabled={!playerName || !connected}
          style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold' }}
        >
          Create Lobby
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Lobby Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ flex: 1, textAlign: 'center', letterSpacing: '4px', fontSize: '16px' }}
          />
          <button
            onClick={() => joinLobby(joinCode)}
            disabled={!playerName || !joinCode || !connected}
          >
            Join
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '4px' }}>
          <button
            onClick={() => setView('deck-builder')}
            style={{ width: '100%', background: '#0f3460', marginBottom: '8px' }}
          >
            Deck Builder
          </button>
          <button
            onClick={() => setView('collection')}
            style={{ width: '100%', background: '#0f3460', marginBottom: '8px' }}
          >
            Card Collection
          </button>
          <button
            onClick={() => setView('card-art-manager')}
            style={{ width: '100%', background: '#0f3460' }}
          >
            Card Art Manager
          </button>
        </div>
      </div>

      <div style={{ color: '#666', fontSize: '12px' }}>
        {connected ? 'Connected to server' : 'Connecting...'}
      </div>
    </div>
  );
}
