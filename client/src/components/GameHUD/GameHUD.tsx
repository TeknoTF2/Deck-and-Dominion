import React from 'react';
import { GameState, Phase } from '@deck-and-dominion/shared';
import { useGameStore } from '../../store/gameStore';

interface GameHUDProps {
  gameState: GameState;
  isMyTurn: boolean;
  isDM: boolean;
  playerId: string;
}

export default function GameHUD({ gameState, isMyTurn, isDM, playerId }: GameHUDProps) {
  const { sendDMAction } = useGameStore();

  const partyHPPercent = (gameState.partyHP / gameState.maxPartyHP) * 100;
  const dmHPPercent = (gameState.dmHP / gameState.maxDmHP) * 100;

  return (
    <div style={{
      padding: '8px 16px',
      background: 'rgba(255,255,255,0.05)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
    }}>
      {/* Party HP */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
          <span style={{ color: '#66bb6a', fontWeight: 'bold' }}>Party HP</span>
          <span style={{ color: '#e8e8e8' }}>{gameState.partyHP}/{gameState.maxPartyHP}</span>
        </div>
        <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${partyHPPercent}%`,
            height: '100%',
            background: partyHPPercent > 50 ? '#66bb6a' : partyHPPercent > 25 ? '#ffa726' : '#ef5350',
            transition: '0.5s ease',
          }} />
        </div>
      </div>

      {/* Mana Pool */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#4fc3f7', fontWeight: 'bold' }}>Mana Pool</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#4fc3f7', fontWeight: 'bold', fontSize: '18px' }}>
              {gameState.manaPool.persistent}
            </span>
            <span style={{ color: '#555', fontSize: '10px' }}> P</span>
          </div>
          {gameState.manaPool.burst > 0 && (
            <div>
              <span style={{ color: '#ffa726', fontWeight: 'bold', fontSize: '18px' }}>
                {gameState.manaPool.burst}
              </span>
              <span style={{ color: '#555', fontSize: '10px' }}> B</span>
            </div>
          )}
        </div>
      </div>

      {/* Turn Info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#a0a0a0' }}>Turn {gameState.turnNumber}</div>
        <div style={{
          fontSize: '13px',
          fontWeight: 'bold',
          color: isMyTurn ? '#ffd700' : '#a0a0a0',
        }}>
          {gameState.phase}
        </div>
      </div>

      {/* Player Info */}
      <div style={{ textAlign: 'center', minWidth: '80px' }}>
        <div style={{ fontSize: '10px', color: '#a0a0a0' }}>Players</div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          {gameState.turnOrder.map((pid, i) => (
            <div key={pid} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: i === gameState.currentPlayerIndex ? '#ffd700' : '#444',
              border: pid === playerId ? '2px solid #e94560' : 'none',
            }} />
          ))}
        </div>
      </div>

      {/* Graveyard Count */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#a0a0a0' }}>Graveyard</div>
        <div style={{ color: '#7e57c2', fontWeight: 'bold', fontSize: '14px' }}>
          {gameState.graveyard.length}
        </div>
      </div>

      {/* DM HP */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
          <span style={{ color: '#e94560', fontWeight: 'bold' }}>DM HP</span>
          <span style={{ color: '#e8e8e8' }}>{gameState.dmHP}/{gameState.maxDmHP}</span>
        </div>
        <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${dmHPPercent}%`,
            height: '100%',
            background: '#e94560',
            transition: '0.5s ease',
          }} />
        </div>
      </div>

      {/* DM Controls */}
      {isDM && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => sendDMAction({ type: 'dm_end_battle', winner: 'party' })}
            style={{ fontSize: '10px', padding: '4px 8px', background: '#66bb6a' }}
          >
            Party Wins
          </button>
          <button
            onClick={() => sendDMAction({ type: 'dm_end_battle', winner: 'dm' })}
            style={{ fontSize: '10px', padding: '4px 8px', background: '#ef5350' }}
          >
            DM Wins
          </button>
        </div>
      )}
    </div>
  );
}
