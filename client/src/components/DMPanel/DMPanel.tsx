import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameState, Zone, Keyword, CardDefinition, CardInstance } from '@deck-and-dominion/shared';
import CardView from '../Card/CardView';

interface DMPanelProps {
  gameState: GameState;
}

export default function DMPanel({ gameState }: DMPanelProps) {
  const { sendDMAction, allCards } = useGameStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'hp' | 'creatures' | 'cards' | 'give'>('overview');
  const [hpTarget, setHpTarget] = useState<'party' | 'dm'>('party');
  const [hpValue, setHpValue] = useState(0);
  const [selectedCreature, setSelectedCreature] = useState<string | null>(null);
  const [modAttack, setModAttack] = useState(0);
  const [modHealth, setModHealth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [giveTarget, setGiveTarget] = useState('');
  const [giveZone, setGiveZone] = useState<Zone>(Zone.Hand);

  const playerIds = Object.keys(gameState.players);
  const allCreatures = [...gameState.board.playerCreatures, ...gameState.board.dmCreatures];

  const handleEditHP = () => {
    if (hpValue === 0) return;
    sendDMAction({ type: 'dm_edit_hp', target: hpTarget, value: hpValue });
    setHpValue(0);
  };

  const handleModifyCreature = () => {
    if (!selectedCreature) return;
    sendDMAction({
      type: 'dm_modify_creature',
      cardInstanceId: selectedCreature,
      attack: modAttack !== 0 ? modAttack : undefined,
      health: modHealth !== 0 ? modHealth : undefined,
    });
    setModAttack(0);
    setModHealth(0);
  };

  const handleMoveCard = (cardInstanceId: string, fromZone: Zone, toZone: Zone) => {
    sendDMAction({ type: 'dm_move_card', cardInstanceId, fromZone, toZone });
  };

  const handleGiveCard = (cardDefId: string) => {
    if (!giveTarget) return;
    sendDMAction({
      type: 'dm_give_card',
      cardDefinitionId: cardDefId,
      toPlayerId: giveTarget,
      toZone: giveZone,
    });
  };

  const filteredCards = searchTerm.length >= 2
    ? allCards.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.effectText.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 20)
    : [];

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'hp' as const, label: 'HP' },
    { id: 'creatures' as const, label: 'Creatures' },
    { id: 'cards' as const, label: 'Move Cards' },
    { id: 'give' as const, label: 'Give Card' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(233,69,96,0.05)',
      borderLeft: '1px solid rgba(233,69,96,0.2)',
    }}>
      <div style={{
        padding: '6px 8px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#e94560',
        borderBottom: '1px solid rgba(233,69,96,0.2)',
      }}>
        DM Controls
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '4px 2px',
              fontSize: '9px',
              background: activeTab === tab.id ? 'rgba(233,69,96,0.2)' : 'transparent',
              color: activeTab === tab.id ? '#e94560' : '#777',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #e94560' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: '#a0a0a0' }}>
              <div>Party HP: {gameState.partyHP}/{gameState.maxPartyHP}</div>
              <div>DM HP: {gameState.dmHP}/{gameState.maxDmHP}</div>
              <div>Turn: {gameState.turnNumber} - {gameState.phase}</div>
              <div>Board: {gameState.board.playerCreatures.length} party, {gameState.board.dmCreatures.length} DM</div>
              <div>Graveyard: {gameState.graveyard.length}</div>
              <div>Mana: {gameState.manaPool.persistent}P + {gameState.manaPool.burst}B</div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
              <div style={{ fontSize: '10px', color: '#a0a0a0', marginBottom: '4px' }}>Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  onClick={() => sendDMAction({ type: 'dm_end_battle', winner: 'party' })}
                  style={{ fontSize: '10px', padding: '6px', background: '#2e7d32', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Party Wins
                </button>
                <button
                  onClick={() => sendDMAction({ type: 'dm_end_battle', winner: 'dm' })}
                  style={{ fontSize: '10px', padding: '6px', background: '#c62828', borderRadius: '4px', cursor: 'pointer' }}
                >
                  DM Wins
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HP Tab */}
        {activeTab === 'hp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Target</label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <button
                  onClick={() => setHpTarget('party')}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                    background: hpTarget === 'party' ? '#2e7d32' : '#333',
                  }}
                >
                  Party ({gameState.partyHP})
                </button>
                <button
                  onClick={() => setHpTarget('dm')}
                  style={{
                    flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                    background: hpTarget === 'dm' ? '#c62828' : '#333',
                  }}
                >
                  DM ({gameState.dmHP})
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Amount (+heal / -damage)</label>
              <input
                type="number"
                value={hpValue}
                onChange={e => setHpValue(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%', padding: '4px', marginTop: '4px',
                  background: '#222', border: '1px solid #444', borderRadius: '4px',
                  color: '#e0e0e0', fontSize: '12px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setHpValue(v => v - 5)} style={{ flex: 1, padding: '4px', fontSize: '10px', background: '#c62828', borderRadius: '4px', cursor: 'pointer' }}>-5</button>
              <button onClick={() => setHpValue(v => v - 1)} style={{ flex: 1, padding: '4px', fontSize: '10px', background: '#d32f2f', borderRadius: '4px', cursor: 'pointer' }}>-1</button>
              <button onClick={() => setHpValue(v => v + 1)} style={{ flex: 1, padding: '4px', fontSize: '10px', background: '#388e3c', borderRadius: '4px', cursor: 'pointer' }}>+1</button>
              <button onClick={() => setHpValue(v => v + 5)} style={{ flex: 1, padding: '4px', fontSize: '10px', background: '#2e7d32', borderRadius: '4px', cursor: 'pointer' }}>+5</button>
            </div>
            <button
              onClick={handleEditHP}
              disabled={hpValue === 0}
              style={{
                padding: '6px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                background: hpValue === 0 ? '#333' : '#0f3460',
              }}
            >
              Apply HP Change
            </button>
          </div>
        )}

        {/* Creatures Tab */}
        {activeTab === 'creatures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', color: '#a0a0a0' }}>Select a creature to modify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
              {allCreatures.map(c => (
                <div
                  key={c.instanceId}
                  onClick={() => setSelectedCreature(c.instanceId)}
                  style={{
                    padding: '4px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                    background: selectedCreature === c.instanceId ? 'rgba(233,69,96,0.3)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedCreature === c.instanceId ? '#e94560' : 'transparent'}`,
                    color: '#e0e0e0',
                    display: 'flex', justifyContent: 'space-between',
                  }}
                >
                  <span>{c.definition.name}</span>
                  <span style={{ color: '#888' }}>{c.currentAttack}/{c.currentHealth}</span>
                </div>
              ))}
              {allCreatures.length === 0 && (
                <div style={{ color: '#555', fontSize: '10px' }}>No creatures on board</div>
              )}
            </div>
            {selectedCreature && (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '9px', color: '#a0a0a0' }}>ATK mod</label>
                    <input
                      type="number"
                      value={modAttack}
                      onChange={e => setModAttack(parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%', padding: '4px', background: '#222',
                        border: '1px solid #444', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '9px', color: '#a0a0a0' }}>HP mod</label>
                    <input
                      type="number"
                      value={modHealth}
                      onChange={e => setModHealth(parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%', padding: '4px', background: '#222',
                        border: '1px solid #444', borderRadius: '4px', color: '#e0e0e0', fontSize: '11px',
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleModifyCreature}
                  style={{ padding: '6px', fontSize: '11px', background: '#0f3460', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Modify Creature
                </button>
                <button
                  onClick={() => {
                    handleMoveCard(selectedCreature, Zone.Board, Zone.Graveyard);
                    setSelectedCreature(null);
                  }}
                  style={{ padding: '6px', fontSize: '11px', background: '#c62828', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Destroy Creature
                </button>
                <button
                  onClick={() => {
                    handleMoveCard(selectedCreature, Zone.Board, Zone.Exile);
                    setSelectedCreature(null);
                  }}
                  style={{ padding: '6px', fontSize: '11px', background: '#6a1b9a', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Exile Creature
                </button>
              </>
            )}
          </div>
        )}

        {/* Move Cards Tab */}
        {activeTab === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', color: '#a0a0a0' }}>DM Hand ({gameState.dmState.hand.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
              {gameState.dmState.hand.map(c => (
                <div key={c.instanceId} style={{
                  padding: '4px 8px', fontSize: '10px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)', color: '#e0e0e0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{c.definition.name} ({c.definition.manaCost}M)</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      onClick={() => handleMoveCard(c.instanceId, Zone.Hand, Zone.Board)}
                      style={{ fontSize: '8px', padding: '2px 4px', background: '#2e7d32', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      Play
                    </button>
                    <button
                      onClick={() => handleMoveCard(c.instanceId, Zone.Hand, Zone.Graveyard)}
                      style={{ fontSize: '8px', padding: '2px 4px', background: '#555', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '10px', color: '#a0a0a0', marginTop: '8px' }}>
              Graveyard ({gameState.graveyard.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
              {gameState.graveyard.map(c => (
                <div key={c.instanceId} style={{
                  padding: '4px 8px', fontSize: '10px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)', color: '#888',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{c.definition.name}</span>
                  <button
                    onClick={() => handleMoveCard(c.instanceId, Zone.Graveyard, Zone.Board)}
                    style={{ fontSize: '8px', padding: '2px 4px', background: '#6a1b9a', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    Resurrect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Give Card Tab */}
        {activeTab === 'give' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Player</label>
              <select
                value={giveTarget}
                onChange={e => setGiveTarget(e.target.value)}
                style={{
                  width: '100%', padding: '4px', marginTop: '4px',
                  background: '#222', border: '1px solid #444', borderRadius: '4px',
                  color: '#e0e0e0', fontSize: '11px',
                }}
              >
                <option value="">Select player...</option>
                {playerIds.map(pid => (
                  <option key={pid} value={pid}>{gameState.players[pid].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Zone</label>
              <select
                value={giveZone}
                onChange={e => setGiveZone(e.target.value as Zone)}
                style={{
                  width: '100%', padding: '4px', marginTop: '4px',
                  background: '#222', border: '1px solid #444', borderRadius: '4px',
                  color: '#e0e0e0', fontSize: '11px',
                }}
              >
                <option value={Zone.Hand}>Hand</option>
                <option value={Zone.Board}>Board</option>
                <option value={Zone.Deck}>Deck</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Search Cards</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name or text..."
                style={{
                  width: '100%', padding: '4px', marginTop: '4px',
                  background: '#222', border: '1px solid #444', borderRadius: '4px',
                  color: '#e0e0e0', fontSize: '11px',
                }}
              />
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredCards.map(c => (
                <div key={c.id} style={{
                  padding: '4px 8px', fontSize: '10px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)', color: '#e0e0e0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ fontSize: '8px', color: '#888' }}>{c.cardType} - {c.cardClass} - {c.manaCost}M</div>
                  </div>
                  <button
                    onClick={() => handleGiveCard(c.id)}
                    disabled={!giveTarget}
                    style={{
                      fontSize: '8px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer',
                      background: giveTarget ? '#0f3460' : '#333',
                    }}
                  >
                    Give
                  </button>
                </div>
              ))}
              {searchTerm.length >= 2 && filteredCards.length === 0 && (
                <div style={{ color: '#555', fontSize: '10px', textAlign: 'center' }}>No cards found</div>
              )}
              {searchTerm.length < 2 && (
                <div style={{ color: '#555', fontSize: '10px', textAlign: 'center' }}>Type 2+ chars to search</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
