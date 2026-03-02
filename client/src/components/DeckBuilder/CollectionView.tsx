import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import CardView from '../Card/CardView';
import CardDetailModal from '../Card/CardDetailModal';
import { CardDefinition, CardClass, Rarity } from '@deck-and-dominion/shared';

export default function CollectionView() {
  const { allCards, setView, cardsLoaded, loadCards } = useGameStore();
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailCard, setDetailCard] = useState<CardDefinition | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'mana' | 'rarity'>('name');

  useEffect(() => {
    if (!cardsLoaded) loadCards();
  }, []);

  let filteredCards = allCards.filter(c => {
    if (selectedClass !== 'all' && c.cardClass !== selectedClass) return false;
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.effectText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  filteredCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'mana') return a.manaCost - b.manaCost;
    const rarityOrder = { Starter: 0, Common: 1, Uncommon: 2, Rare: 3, Legendary: 4 };
    return (rarityOrder[a.rarity as keyof typeof rarityOrder] || 0) - (rarityOrder[b.rarity as keyof typeof rarityOrder] || 0);
  });

  const classCounts: Record<string, number> = {};
  for (const c of allCards) {
    classCounts[c.cardClass] = (classCounts[c.cardClass] || 0) + 1;
  }

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
        <div>
          <h2 style={{ color: '#ffd700', margin: 0 }}>Card Collection</h2>
          <span style={{ color: '#a0a0a0', fontSize: '12px' }}>
            {filteredCards.length} of {allCards.length} cards shown
          </span>
        </div>
        <button onClick={() => setView('menu')} style={{ background: '#333' }}>Back</button>
      </div>

      {/* Filters */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="all">All Classes ({allCards.length})</option>
          {Object.values(CardClass).map(cls => (
            <option key={cls} value={cls}>{cls} ({classCounts[cls] || 0})</option>
          ))}
        </select>
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}>
          <option value="all">All Rarities</option>
          {Object.values(Rarity).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="name">Sort by Name</option>
          <option value="mana">Sort by Mana Cost</option>
          <option value="rarity">Sort by Rarity</option>
        </select>
        <input
          type="text"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
      </div>

      {/* Card Grid */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignContent: 'flex-start',
      }}>
        {filteredCards.map(card => (
          <div key={card.id} onClick={() => setDetailCard(card)}>
            <CardView card={card} />
          </div>
        ))}
        {filteredCards.length === 0 && (
          <div style={{ color: '#555', padding: '48px', width: '100%', textAlign: 'center', fontSize: '16px' }}>
            {cardsLoaded ? 'No cards match your search' : 'Loading cards...'}
          </div>
        )}
      </div>

      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </div>
  );
}
