import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import CardView from '../Card/CardView';
import CardDetailModal from '../Card/CardDetailModal';
import { CardDefinition, CardClass, CardType, Rarity, DECK_MIN_SIZE, DECK_MAX_SIZE, MAX_CARD_COPIES } from '@deck-and-dominion/shared';

export default function DeckBuilder() {
  const { allCards, setView, cardsLoaded, loadCards } = useGameStore();
  const [selectedClass, setSelectedClass] = useState<CardClass>(CardClass.Commander);
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deckCards, setDeckCards] = useState<string[]>([]);
  const [deckName, setDeckName] = useState('My Deck');
  const [detailCard, setDetailCard] = useState<CardDefinition | null>(null);

  useEffect(() => {
    if (!cardsLoaded) loadCards();
  }, []);

  const classCards = allCards.filter(c => c.cardClass === selectedClass || c.cardClass === CardClass.Neutral);

  const filteredCards = classCards.filter(c => {
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
    if (filterType !== 'all' && c.cardType !== filterType) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.effectText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const deckCardDefs = deckCards.map(id => allCards.find(c => c.id === id)).filter((c): c is CardDefinition => !!c);

  const canAddToDeck = (cardId: string): boolean => {
    if (deckCards.length >= DECK_MAX_SIZE) return false;
    const card = allCards.find(c => c.id === cardId);
    if (card && card.rarity !== Rarity.Starter && card.cardType !== CardType.Land) {
      const currentCopies = deckCards.filter(id => id === cardId).length;
      if (currentCopies >= MAX_CARD_COPIES) return false;
    }
    return true;
  };

  const addToDeck = (cardId: string) => {
    if (!canAddToDeck(cardId)) return;
    setDeckCards([...deckCards, cardId]);
  };

  const removeFromDeck = (index: number) => {
    setDeckCards(deckCards.filter((_, i) => i !== index));
  };

  const loadStarterDeck = () => {
    const starterCards = allCards
      .filter(c => c.rarity === Rarity.Starter && (c.cardClass === selectedClass || c.cardClass === CardClass.Neutral))
      .map(c => c.id);
    setDeckCards(starterCards);
    setDeckName(`${selectedClass} Starter Deck`);
  };

  const manaCurve = deckCardDefs.reduce((acc, c) => {
    const cost = Math.min(c.manaCost, 7);
    acc[cost] = (acc[cost] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const maxCurve = Math.max(...Object.values(manaCurve), 1);

  const copyCount = (cardId: string) => deckCards.filter(id => id === cardId).length;

  const saveDeck = async () => {
    try {
      await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deckName,
          playerId: 'local',
          cardClass: selectedClass,
          cardIds: deckCards,
        }),
      });
      alert('Deck saved!');
    } catch (err) {
      alert('Failed to save deck');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ color: '#ffd700', margin: 0 }}>Deck Builder</h2>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            style={{ fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={saveDeck} disabled={deckCards.length < DECK_MIN_SIZE} style={{ background: '#66bb6a' }}>
            Save Deck ({deckCards.length}/{DECK_MIN_SIZE}-{DECK_MAX_SIZE})
          </button>
          <button onClick={() => setView('menu')} style={{ background: '#333' }}>
            Back
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Card Pool */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Filters */}
          <div style={{ padding: '8px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value as CardClass); setDeckCards([]); }}>
              {Object.values(CardClass).filter(c => c !== 'Neutral').map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}>
              <option value="all">All Rarities</option>
              {Object.values(Rarity).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="Creature">Creature</option>
              <option value="Spell">Spell</option>
              <option value="Equipment">Equipment</option>
              <option value="Land">Land</option>
              <option value="Enchantment">Enchantment</option>
              <option value="Consumable">Consumable</option>
              <option value="Trap">Trap</option>
            </select>
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '120px' }}
            />
          </div>

          {/* Card Grid */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start',
          }}>
            {filteredCards.map(card => {
              const copies = copyCount(card.id);
              const canAdd = canAddToDeck(card.id);
              return (
                <div key={card.id} style={{ position: 'relative' }}>
                  <div onClick={() => setDetailCard(card)}>
                    <CardView card={card} />
                  </div>
                  {/* Add to deck button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addToDeck(card.id); }}
                    disabled={!canAdd}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      left: '-4px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: canAdd ? '#66bb6a' : '#555',
                      color: canAdd ? '#000' : '#888',
                      border: '2px solid #1a1a2e',
                      cursor: canAdd ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      lineHeight: 1,
                      zIndex: 2,
                      padding: 0,
                    }}
                    title={canAdd ? 'Add to deck' : 'Cannot add more copies'}
                  >
                    +
                  </button>
                  {/* Copy count badge */}
                  {copies > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '-4px',
                      minWidth: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      background: '#e94560',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      border: '2px solid #1a1a2e',
                      zIndex: 2,
                      padding: '0 4px',
                    }}>
                      {copies} in deck
                    </div>
                  )}
                </div>
              );
            })}
            {filteredCards.length === 0 && (
              <div style={{ color: '#555', padding: '24px', width: '100%', textAlign: 'center' }}>
                {cardsLoaded ? 'No cards match your filters' : 'Loading cards...'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Deck List */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', padding: '8px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>
            Deck ({deckCards.length} cards)
          </h3>

          {/* Starter Deck Button */}
          <button
            onClick={loadStarterDeck}
            style={{
              marginBottom: '8px',
              background: '#8d6e63',
              color: '#fff',
              fontSize: '12px',
              padding: '6px 8px',
            }}
          >
            Load {selectedClass} Starter Deck
          </button>

          {/* Mana Curve */}
          <div style={{
            display: 'flex',
            gap: '2px',
            alignItems: 'flex-end',
            height: '50px',
            padding: '4px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            marginBottom: '8px',
          }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(cost => (
              <div key={cost} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}>
                <div style={{
                  width: '100%',
                  height: `${((manaCurve[cost] || 0) / maxCurve) * 30}px`,
                  background: '#4fc3f7',
                  borderRadius: '2px',
                  minHeight: manaCurve[cost] ? '4px' : '0',
                }} />
                <span style={{ fontSize: '8px', color: '#666' }}>{cost === 7 ? '7+' : cost}</span>
              </div>
            ))}
          </div>

          {/* Deck Cards */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {deckCardDefs.map((card, i) => (
              <div
                key={`${card.id}-${i}`}
                onClick={() => removeFromDeck(i)}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
                title="Click to remove"
              >
                <span>{card.name}</span>
                <span style={{ color: '#4fc3f7' }}>{card.manaCost}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setDeckCards([])}
            style={{ marginTop: '8px', background: '#333', fontSize: '12px' }}
          >
            Clear Deck
          </button>
        </div>
      </div>

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onAddToDeck={canAddToDeck(detailCard.id) ? () => addToDeck(detailCard.id) : undefined}
        />
      )}
    </div>
  );
}
