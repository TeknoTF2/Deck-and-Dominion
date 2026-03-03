import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CardClass, DeckDefinition } from '@deck-and-dominion/shared';

const CLASS_COLORS: Record<string, string> = {
  Commander: '#f5f5f5',
  DPS: '#ef5350',
  Wizard: '#42a5f5',
  Sorcerer: '#7e57c2',
  Crafter: '#66bb6a',
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Commander: 'Tank/Support - Buffs, shields, team coordination',
  DPS: 'Damage Dealer - Creatures, direct damage, aggression',
  Wizard: 'Combo Engine - Spells, counters, keyword tricks',
  Sorcerer: 'Graveyard Master - Resurrection, sacrifice, curses',
  Crafter: 'Economy Builder - Equipment, mana, consumables',
};

export default function LobbyView() {
  const { lobby, playerId, selectClass, selectDeck, setAsDM, toggleReady, startGame, leaveLobby, setView, serverError, clearServerError } = useGameStore();
  const [dmHP, setDmHP] = useState(40);
  const [savedDecks, setSavedDecks] = useState<DeckDefinition[]>([]);

  useEffect(() => {
    fetch('/api/decks?playerId=local')
      .then(res => res.json())
      .then(decks => setSavedDecks(decks))
      .catch(() => {});
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (serverError) {
      const timer = setTimeout(clearServerError, 5000);
      return () => clearTimeout(timer);
    }
  }, [serverError]);

  if (!lobby) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading lobby...</div>;
  }

  const currentPlayer = lobby.players.find(p => p.id === playerId);
  const isHost = lobby.host === playerId;
  const hasDM = !!lobby.dmId;
  const nonDMPlayers = lobby.players.filter(p => !p.isDM);
  const allPlayersReady = nonDMPlayers.length === 0 || nonDMPlayers.every(p => p.ready && p.cardClass && p.deckId);
  const canStart = hasDM && allPlayersReady;

  // Compute what's missing for start
  const missingReqs: string[] = [];
  if (!hasDM) missingReqs.push('Need a Dungeon Master');
  for (const p of nonDMPlayers) {
    if (!p.cardClass) missingReqs.push(`${p.name}: select a class`);
    if (!p.deckId) missingReqs.push(`${p.name}: select a deck`);
    if (!p.ready) missingReqs.push(`${p.name}: not ready`);
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      gap: '16px',
    }}>
      {/* Error Banner */}
      {serverError && (
        <div
          onClick={clearServerError}
          style={{
            padding: '12px 16px',
            background: 'rgba(233,69,96,0.2)',
            border: '1px solid #e94560',
            borderRadius: '8px',
            color: '#ff6b6b',
            cursor: 'pointer',
          }}
        >
          {serverError}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#ffd700' }}>Game Lobby</h2>
          <p style={{ color: '#a0a0a0' }}>
            Code: <span style={{ fontWeight: 'bold', letterSpacing: '3px', color: '#e8e8e8', fontSize: '18px' }}>{lobby.code}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setView('deck-builder')} style={{ background: '#0f3460' }}>
            Deck Builder
          </button>
          <button onClick={leaveLobby} style={{ background: '#666' }}>
            Leave
          </button>
        </div>
      </div>

      {/* Players */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
      }}>
        {/* Player List */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h3 style={{ marginBottom: '12px' }}>Players ({lobby.players.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lobby.players.map(p => (
              <div key={p.id} style={{
                padding: '12px',
                background: p.id === playerId ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: `1px solid ${p.ready ? 'rgba(102,187,106,0.5)' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                  {p.id === lobby.host && <span style={{ color: '#ffd700', marginLeft: '8px', fontSize: '12px' }}>HOST</span>}
                  {p.isDM && <span style={{ color: '#e94560', marginLeft: '8px', fontSize: '12px' }}>DM</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.cardClass && !p.isDM && (
                    <span style={{
                      color: CLASS_COLORS[p.cardClass] || '#fff',
                      fontWeight: 'bold',
                      fontSize: '14px',
                    }}>
                      {p.cardClass}
                    </span>
                  )}
                  {p.deckId && !p.isDM && (
                    <span style={{ color: '#4fc3f7', fontSize: '11px' }}>Deck</span>
                  )}
                  {p.ready && !p.isDM && (
                    <span style={{ color: '#66bb6a', fontWeight: 'bold' }}>Ready</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Class Selection */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h3 style={{ marginBottom: '12px' }}>Select Role</h3>

          <button
            onClick={setAsDM}
            style={{
              width: '100%',
              marginBottom: '16px',
              padding: '12px',
              background: currentPlayer?.isDM ? '#e94560' : 'rgba(233,69,96,0.2)',
              border: currentPlayer?.isDM ? '2px solid #e94560' : '2px solid transparent',
              fontWeight: 'bold',
            }}
          >
            Dungeon Master
          </button>

          <h4 style={{ marginBottom: '8px', color: '#a0a0a0' }}>Player Classes:</h4>
          {Object.entries(CLASS_DESCRIPTIONS).map(([cls, desc]) => {
            const taken = lobby.players.some(p => p.id !== playerId && p.cardClass === cls && !p.isDM);
            const selected = currentPlayer?.cardClass === cls;

            return (
              <button
                key={cls}
                onClick={() => selectClass(cls as CardClass)}
                disabled={taken || currentPlayer?.isDM}
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  padding: '10px',
                  background: selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: selected ? `2px solid ${CLASS_COLORS[cls]}` : '2px solid transparent',
                  textAlign: 'left',
                  opacity: taken ? 0.3 : 1,
                }}
              >
                <div style={{ color: CLASS_COLORS[cls], fontWeight: 'bold' }}>{cls}</div>
                <div style={{ color: '#a0a0a0', fontSize: '12px' }}>{desc}</div>
                {taken && <div style={{ color: '#ef5350', fontSize: '11px' }}>Taken</div>}
              </button>
            );
          })}

          {/* Deck Selection */}
          {currentPlayer?.cardClass && !currentPlayer?.isDM && (
            <>
              <h4 style={{ marginTop: '16px', marginBottom: '8px', color: '#a0a0a0' }}>Select Deck:</h4>
              {savedDecks
                .filter(d => d.cardClass === currentPlayer.cardClass)
                .map(deck => (
                  <button
                    key={deck.id}
                    onClick={() => selectDeck(deck.id)}
                    style={{
                      width: '100%',
                      marginBottom: '8px',
                      padding: '10px',
                      background: currentPlayer.deckId === deck.id ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                      border: currentPlayer.deckId === deck.id ? '2px solid #ffd700' : '2px solid transparent',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{deck.name}</div>
                    <div style={{ color: '#a0a0a0', fontSize: '12px' }}>{deck.cardIds.length} cards</div>
                  </button>
                ))}
              {savedDecks.filter(d => d.cardClass === currentPlayer.cardClass).length === 0 && (
                <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>
                  No decks for {currentPlayer.cardClass}. Use the Deck Builder to create one.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isHost && (
            <>
              <label style={{ color: '#a0a0a0' }}>DM HP:</label>
              <input
                type="number"
                value={dmHP}
                onChange={(e) => setDmHP(parseInt(e.target.value) || 40)}
                min={1}
                style={{ width: '80px' }}
              />
            </>
          )}
          {isHost && missingReqs.length > 0 && (
            <span style={{ color: '#e94560', fontSize: '11px', marginLeft: '12px' }}>
              {missingReqs[0]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!currentPlayer?.isDM && (
            <button
              onClick={toggleReady}
              style={{
                padding: '12px 24px',
                background: currentPlayer?.ready ? '#66bb6a' : '#0f3460',
                fontWeight: 'bold',
              }}
            >
              {currentPlayer?.ready ? 'Ready!' : 'Ready Up'}
            </button>
          )}
          {isHost && (
            <button
              onClick={() => startGame(dmHP)}
              disabled={!canStart}
              style={{
                padding: '12px 24px',
                fontWeight: 'bold',
                fontSize: '16px',
                opacity: canStart ? 1 : 0.5,
              }}
              title={canStart ? 'Start the game' : missingReqs.join(', ')}
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
