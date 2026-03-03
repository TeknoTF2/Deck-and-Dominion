import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameState, Zone, CardDefinition, CardClass, PackTier, PackFilter } from '@deck-and-dominion/shared';
import CardView from '../Card/CardView';

interface DMPanelProps {
  gameState: GameState;
}

const CLASS_ARCHETYPES: Record<string, string[]> = {
  Commander: ['Marshal', 'Tactician', 'Warden'],
  DPS: ['Swarm', 'Big', 'Undead'],
  Wizard: ['Enchanter', 'Illusionist', 'Abjurer'],
  Sorcerer: ['Necromancer', 'Dark Ritualist', 'Hexer'],
  Crafter: ['Blacksmith', 'Farmer', 'Alchemist'],
};

export default function DMPanel({ gameState }: DMPanelProps) {
  const {
    sendDMAction, allCards, grantPack,
    gameSettings, loadSettings, updateCardLimit, updateStarterDeck, resetStarterDeck,
  } = useGameStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'hp' | 'creatures' | 'cards' | 'give' | 'packs' | 'balance'>('overview');
  const [hpTarget, setHpTarget] = useState<'party' | 'dm'>('party');
  const [hpValue, setHpValue] = useState(0);
  const [selectedCreature, setSelectedCreature] = useState<string | null>(null);
  const [modAttack, setModAttack] = useState(0);
  const [modHealth, setModHealth] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [giveTarget, setGiveTarget] = useState('');
  const [giveZone, setGiveZone] = useState<Zone>(Zone.Hand);

  // Pack granting state
  const [packTarget, setPackTarget] = useState('');
  const [packTier, setPackTier] = useState<PackTier>(PackTier.Common);
  const [packSize, setPackSize] = useState(5);
  const [packCount, setPackCount] = useState(1);
  const [packClassFilter, setPackClassFilter] = useState<string>('');
  const [packArchetypeFilter, setPackArchetypeFilter] = useState<string>('');

  // Balance tab state
  const [cardLimitInput, setCardLimitInput] = useState<number>(gameSettings.maxCardCopies);
  const [cardLimitSaved, setCardLimitSaved] = useState(false);
  const [balanceSubTab, setBalanceSubTab] = useState<'limit' | 'starters'>('limit');
  const [starterClass, setStarterClass] = useState<string>('Commander');
  const [starterArchetype, setStarterArchetype] = useState<string>('Marshal');
  const [starterDeckCards, setStarterDeckCards] = useState<string[]>([]);
  const [starterSearchTerm, setStarterSearchTerm] = useState('');
  const [starterSaved, setStarterSaved] = useState(false);

  const playerIds = Object.keys(gameState.players);
  const allCreatures = [...gameState.board.playerCreatures, ...gameState.board.dmCreatures];

  // Keep card limit input in sync with store
  useEffect(() => {
    setCardLimitInput(gameSettings.maxCardCopies);
  }, [gameSettings.maxCardCopies]);

  // Load starter deck when class/archetype changes in balance tab
  useEffect(() => {
    const stored = gameSettings.starterDecks?.[starterClass]?.[starterArchetype];
    if (stored) {
      setStarterDeckCards(stored);
    } else {
      // Fetch from server
      fetch(`/api/settings/starter-decks/${encodeURIComponent(starterClass)}/${encodeURIComponent(starterArchetype)}`)
        .then(r => r.json())
        .then(d => setStarterDeckCards(d.cardIds || []))
        .catch(() => setStarterDeckCards([]));
    }
    setStarterSaved(false);
  }, [starterClass, starterArchetype, gameSettings.starterDecks]);

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

  const availableArchetypes = packClassFilter
    ? [...new Set(allCards.filter(c => c.cardClass === packClassFilter).map(c => c.archetype))].filter(a => a !== 'Shared').sort()
    : [];

  const handleGrantPack = () => {
    if (!packTarget) return;
    const filter: PackFilter = {};
    if (packClassFilter) filter.cardClass = packClassFilter as CardClass;
    if (packArchetypeFilter) filter.archetype = packArchetypeFilter;
    grantPack(packTarget, packTier, packSize, filter, packCount);
  };

  // Balance: card limit
  const handleSaveCardLimit = async () => {
    await updateCardLimit(cardLimitInput);
    setCardLimitSaved(true);
    setTimeout(() => setCardLimitSaved(false), 2000);
  };

  // Balance: starter deck
  const starterCardDefs = starterDeckCards
    .map(id => allCards.find(c => c.id === id))
    .filter((c): c is CardDefinition => !!c);

  const starterCardCounts: Record<string, number> = {};
  for (const id of starterDeckCards) {
    starterCardCounts[id] = (starterCardCounts[id] || 0) + 1;
  }

  const uniqueStarterCards = Object.keys(starterCardCounts).map(id => ({
    card: allCards.find(c => c.id === id),
    count: starterCardCounts[id],
    id,
  })).filter(e => e.card);

  const filteredStarterSearch = starterSearchTerm.length >= 2
    ? allCards.filter(c =>
        c.name.toLowerCase().includes(starterSearchTerm.toLowerCase()) ||
        c.effectText.toLowerCase().includes(starterSearchTerm.toLowerCase())
      ).slice(0, 15)
    : [];

  const addCardToStarter = (cardId: string) => {
    setStarterDeckCards(prev => [...prev, cardId]);
    setStarterSaved(false);
  };

  const removeOneFromStarter = (cardId: string) => {
    const idx = starterDeckCards.lastIndexOf(cardId);
    if (idx !== -1) {
      setStarterDeckCards(prev => prev.filter((_, i) => i !== idx));
    }
    setStarterSaved(false);
  };

  const handleSaveStarterDeck = async () => {
    await updateStarterDeck(starterClass, starterArchetype, starterDeckCards);
    setStarterSaved(true);
    setTimeout(() => setStarterSaved(false), 2000);
  };

  const handleResetStarterDeck = async () => {
    await resetStarterDeck(starterClass, starterArchetype);
    await loadSettings();
    setStarterSaved(false);
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'hp' as const, label: 'HP' },
    { id: 'creatures' as const, label: 'Creatures' },
    { id: 'cards' as const, label: 'Move Cards' },
    { id: 'give' as const, label: 'Give Card' },
    { id: 'packs' as const, label: 'Packs' },
    { id: 'balance' as const, label: 'Balance' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px', marginTop: '4px',
    background: '#222', border: '1px solid #444', borderRadius: '4px',
    color: '#e0e0e0', fontSize: '11px',
  };

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
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 1 auto',
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
              <div>Party Mana: {gameState.manaPool.persistent}P + {gameState.manaPool.burst}B</div>
              <div>DM Mana: {gameState.dmState.manaAvailable ?? '?'}</div>
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
                style={inputStyle}
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
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '9px', color: '#a0a0a0' }}>HP mod</label>
                    <input
                      type="number"
                      value={modHealth}
                      onChange={e => setModHealth(parseInt(e.target.value) || 0)}
                      style={{ ...inputStyle, marginTop: '2px' }}
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
              <select value={giveTarget} onChange={e => setGiveTarget(e.target.value)} style={inputStyle}>
                <option value="">Select player...</option>
                {playerIds.map(pid => (
                  <option key={pid} value={pid}>{gameState.players[pid].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Zone</label>
              <select value={giveZone} onChange={e => setGiveZone(e.target.value as Zone)} style={inputStyle}>
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
                style={inputStyle}
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

        {/* Packs Tab */}
        {activeTab === 'packs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Player</label>
              <select value={packTarget} onChange={e => setPackTarget(e.target.value)} style={inputStyle}>
                <option value="">Select player...</option>
                {playerIds.map(pid => (
                  <option key={pid} value={pid}>{gameState.players[pid].name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Pack Tier</label>
              <select value={packTier} onChange={e => setPackTier(e.target.value as PackTier)} style={inputStyle}>
                <option value={PackTier.Common}>Common</option>
                <option value={PackTier.Uncommon}>Uncommon</option>
                <option value={PackTier.Rare}>Rare</option>
                <option value={PackTier.Legendary}>Legendary</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Cards/Pack</label>
                <input
                  type="number"
                  value={packSize}
                  min={3}
                  max={10}
                  onChange={e => setPackSize(Math.max(3, Math.min(10, parseInt(e.target.value) || 5)))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Quantity</label>
                <input
                  type="number"
                  value={packCount}
                  min={1}
                  max={10}
                  onChange={e => setPackCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Class Filter (optional)</label>
              <select
                value={packClassFilter}
                onChange={e => { setPackClassFilter(e.target.value); setPackArchetypeFilter(''); }}
                style={inputStyle}
              >
                <option value="">All Classes (Random)</option>
                <option value={CardClass.Commander}>Commander</option>
                <option value={CardClass.DPS}>DPS</option>
                <option value={CardClass.Wizard}>Wizard</option>
                <option value={CardClass.Sorcerer}>Sorcerer</option>
                <option value={CardClass.Crafter}>Crafter</option>
              </select>
            </div>
            {packClassFilter && availableArchetypes.length > 0 && (
              <div>
                <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Archetype Filter (optional)</label>
                <select value={packArchetypeFilter} onChange={e => setPackArchetypeFilter(e.target.value)} style={inputStyle}>
                  <option value="">All Archetypes</option>
                  {availableArchetypes.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={handleGrantPack}
              disabled={!packTarget}
              style={{
                padding: '8px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer',
                background: packTarget ? '#0f3460' : '#333',
                color: packTarget ? '#e0e0e0' : '#666',
                marginTop: '4px',
              }}
            >
              Grant {packCount > 1 ? `${packCount} Packs` : 'Pack'}
            </button>
            <div style={{
              padding: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)',
              fontSize: '9px', color: '#666', lineHeight: '1.4',
            }}>
              {packTier} tier: Guaranteed 1 {packTier.toLowerCase()} card.
              {packClassFilter ? ` ${packClassFilter} cards` : ' All classes'}{packArchetypeFilter ? ` (${packArchetypeFilter})` : ''}.
              {' '}{packSize} cards per pack{packCount > 1 ? ` x${packCount}` : ''}.
            </div>
          </div>
        )}

        {/* Balance Tab */}
        {activeTab === 'balance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              <button
                onClick={() => setBalanceSubTab('limit')}
                style={{
                  flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                  background: balanceSubTab === 'limit' ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)',
                  color: balanceSubTab === 'limit' ? '#e94560' : '#888',
                  border: balanceSubTab === 'limit' ? '1px solid #e94560' : '1px solid transparent',
                }}
              >
                Card Limit
              </button>
              <button
                onClick={() => setBalanceSubTab('starters')}
                style={{
                  flex: 1, padding: '4px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer',
                  background: balanceSubTab === 'starters' ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.05)',
                  color: balanceSubTab === 'starters' ? '#e94560' : '#888',
                  border: balanceSubTab === 'starters' ? '1px solid #e94560' : '1px solid transparent',
                }}
              >
                Starter Decks
              </button>
            </div>

            {/* Card Limit sub-tab */}
            {balanceSubTab === 'limit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#a0a0a0', lineHeight: '1.4' }}>
                  Max copies of a single non-Starter, non-Land card allowed in a deck.
                  Currently: <span style={{ color: '#ffd700' }}>{gameSettings.maxCardCopies}x</span>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#a0a0a0' }}>New Limit (1–10)</label>
                  <input
                    type="number"
                    value={cardLimitInput}
                    min={1}
                    max={10}
                    onChange={e => setCardLimitInput(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    style={inputStyle}
                  />
                </div>
                <button
                  onClick={handleSaveCardLimit}
                  style={{
                    padding: '6px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer',
                    background: cardLimitSaved ? '#2e7d32' : '#0f3460',
                  }}
                >
                  {cardLimitSaved ? 'Saved!' : 'Save Card Limit'}
                </button>
                <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4' }}>
                  Change takes effect for new decks and future deck saves. The server enforces this limit on save.
                </div>
              </div>
            )}

            {/* Starter Decks sub-tab */}
            {balanceSubTab === 'starters' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select
                    value={starterClass}
                    onChange={e => {
                      setStarterClass(e.target.value);
                      setStarterArchetype(CLASS_ARCHETYPES[e.target.value]?.[0] || '');
                    }}
                    style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                  >
                    {Object.keys(CLASS_ARCHETYPES).map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                  <select
                    value={starterArchetype}
                    onChange={e => setStarterArchetype(e.target.value)}
                    style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                  >
                    {(CLASS_ARCHETYPES[starterClass] || []).map(arch => (
                      <option key={arch} value={arch}>{arch}</option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '10px', color: '#a0a0a0' }}>
                  {starterClass} {starterArchetype} Starter — {starterDeckCards.length} cards
                </div>

                {/* Current starter cards list */}
                <div style={{
                  maxHeight: '180px', overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '4px',
                }}>
                  {uniqueStarterCards.map(({ card, count, id }) => (
                    <div key={id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '3px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)',
                    }}>
                      <span style={{ fontSize: '10px', color: '#e0e0e0' }}>
                        {count > 1 && <span style={{ color: '#ffd700', marginRight: '4px' }}>{count}x</span>}
                        {card!.name}
                        <span style={{ color: '#666', marginLeft: '4px', fontSize: '9px' }}>{card!.manaCost}M</span>
                      </span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          onClick={() => addCardToStarter(id)}
                          style={{ fontSize: '9px', padding: '1px 4px', background: '#2e7d32', borderRadius: '3px', cursor: 'pointer' }}
                          title="Add one more copy"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeOneFromStarter(id)}
                          style={{ fontSize: '9px', padding: '1px 4px', background: '#c62828', borderRadius: '3px', cursor: 'pointer' }}
                          title="Remove one copy"
                        >
                          –
                        </button>
                      </div>
                    </div>
                  ))}
                  {uniqueStarterCards.length === 0 && (
                    <div style={{ color: '#555', fontSize: '10px', textAlign: 'center', padding: '8px' }}>
                      No cards in this starter deck
                    </div>
                  )}
                </div>

                {/* Search to add cards */}
                <div>
                  <label style={{ fontSize: '10px', color: '#a0a0a0' }}>Add Card (search)</label>
                  <input
                    type="text"
                    value={starterSearchTerm}
                    onChange={e => setStarterSearchTerm(e.target.value)}
                    placeholder="Type 2+ chars..."
                    style={inputStyle}
                  />
                </div>
                {filteredStarterSearch.length > 0 && (
                  <div style={{
                    maxHeight: '120px', overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '4px',
                  }}>
                    {filteredStarterSearch.map(c => (
                      <div key={c.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '3px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)',
                      }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#e0e0e0' }}>{c.name}</span>
                          <span style={{ fontSize: '8px', color: '#666', marginLeft: '4px' }}>{c.cardClass} {c.rarity} {c.manaCost}M</span>
                        </div>
                        <button
                          onClick={() => { addCardToStarter(c.id); setStarterSearchTerm(''); }}
                          style={{ fontSize: '9px', padding: '1px 5px', background: '#0f3460', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Save / Reset */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={handleSaveStarterDeck}
                    style={{
                      flex: 2, padding: '6px', fontSize: '11px', fontWeight: 'bold',
                      borderRadius: '4px', cursor: 'pointer',
                      background: starterSaved ? '#2e7d32' : '#0f3460',
                    }}
                  >
                    {starterSaved ? 'Saved!' : 'Save Starter Deck'}
                  </button>
                  <button
                    onClick={handleResetStarterDeck}
                    title="Reset to default (Starter-rarity cards)"
                    style={{
                      flex: 1, padding: '6px', fontSize: '10px',
                      borderRadius: '4px', cursor: 'pointer', background: '#555',
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4' }}>
                  Changes are saved to the server and take effect when players next load this starter deck.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
