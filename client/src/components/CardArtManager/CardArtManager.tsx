import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CardClass } from '@deck-and-dominion/shared';

interface CardArtStatus {
  id: string;
  name: string;
  archetype: string;
  rarity: string;
  hasArt: boolean;
  artPath: string | null;
}

interface ClassArtInfo {
  cardClass: string;
  total: number;
  withArt: number;
  withoutArt: number;
  cards: CardArtStatus[];
}

const CLASS_COLORS: Record<string, string> = {
  Commander: '#f5f5f5',
  DPS: '#ef5350',
  Wizard: '#42a5f5',
  Sorcerer: '#7e57c2',
  Crafter: '#66bb6a',
};

export default function CardArtManager() {
  const { setView } = useGameStore();
  const [selectedClass, setSelectedClass] = useState<string>('Commander');
  const [classInfo, setClassInfo] = useState<ClassArtInfo | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [filterArt, setFilterArt] = useState<'all' | 'with' | 'without'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadClassArt = useCallback(async () => {
    try {
      const res = await fetch(`/api/card-art/class/${selectedClass}`);
      const data = await res.json();
      setClassInfo(data);
    } catch (err) {
      console.error('Failed to load card art info:', err);
    }
  }, [selectedClass]);

  useEffect(() => {
    loadClassArt();
  }, [loadClassArt]);

  const uploadArt = async (cardId: string, file: File) => {
    setUploading(cardId);
    try {
      const formData = new FormData();
      formData.append('art', file);
      const res = await fetch(`/api/card-art/${cardId}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await loadClassArt();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(null);
  };

  const deleteArt = async (cardId: string) => {
    try {
      await fetch(`/api/card-art/${cardId}`, { method: 'DELETE' });
      await loadClassArt();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDrop = (cardId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadArt(cardId, files[0]);
    }
  };

  const handleFileSelect = (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadArt(cardId, files[0]);
    }
  };

  const filteredCards = classInfo?.cards.filter(c => {
    if (filterArt === 'with' && !c.hasArt) return false;
    if (filterArt === 'without' && c.hasArt) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) || [];

  // Group by archetype
  const byArchetype: Record<string, CardArtStatus[]> = {};
  for (const card of filteredCards) {
    const arch = card.archetype || 'General';
    if (!byArchetype[arch]) byArchetype[arch] = [];
    byArchetype[arch].push(card);
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
          <h2 style={{ color: '#ffd700', margin: 0 }}>Card Art Manager</h2>
          <p style={{ color: '#a0a0a0', fontSize: '12px', margin: '4px 0 0' }}>
            Drag & drop JPG/PNG images onto cards to upload art
          </p>
        </div>
        <button onClick={() => setView('menu')} style={{ background: '#333' }}>Back</button>
      </div>

      {/* Class Tabs + Filters */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {Object.values(CardClass).filter(c => c !== 'Neutral').map(cls => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            style={{
              padding: '6px 14px',
              background: selectedClass === cls ? `${CLASS_COLORS[cls]}25` : 'rgba(255,255,255,0.03)',
              border: selectedClass === cls ? `2px solid ${CLASS_COLORS[cls]}` : '2px solid transparent',
              color: CLASS_COLORS[cls],
              fontWeight: selectedClass === cls ? 'bold' : 'normal',
              fontSize: '13px',
            }}
          >
            {cls}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select value={filterArt} onChange={(e) => setFilterArt(e.target.value as any)}>
          <option value="all">All Cards</option>
          <option value="with">With Art</option>
          <option value="without">Missing Art</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '180px' }}
        />
      </div>

      {/* Stats Bar */}
      {classInfo && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          gap: '16px',
          fontSize: '13px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ color: CLASS_COLORS[selectedClass], fontWeight: 'bold' }}>{selectedClass}</span>
          <span style={{ color: '#a0a0a0' }}>{classInfo.total} cards total</span>
          <span style={{ color: '#66bb6a' }}>{classInfo.withArt} with art</span>
          <span style={{ color: '#ef5350' }}>{classInfo.withoutArt} missing art</span>
          <div style={{
            flex: 1,
            maxWidth: '200px',
            height: '8px',
            background: '#333',
            borderRadius: '4px',
            overflow: 'hidden',
            alignSelf: 'center',
          }}>
            <div style={{
              width: `${classInfo.total > 0 ? (classInfo.withArt / classInfo.total) * 100 : 0}%`,
              height: '100%',
              background: '#66bb6a',
            }} />
          </div>
        </div>
      )}

      {/* Card Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {Object.entries(byArchetype).map(([archetype, cards]) => (
          <div key={archetype} style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: CLASS_COLORS[selectedClass] || '#fff',
              margin: '0 0 8px',
              fontSize: '16px',
              borderBottom: `1px solid ${CLASS_COLORS[selectedClass]}40`,
              paddingBottom: '4px',
            }}>
              {archetype} ({cards.length} cards)
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {cards.map(card => (
                <div
                  key={card.id}
                  onDrop={(e) => handleDrop(card.id, e)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(card.id); }}
                  onDragLeave={() => setDragOver(null)}
                  style={{
                    width: '160px',
                    background: dragOver === card.id ? 'rgba(102,187,106,0.15)' : 'rgba(255,255,255,0.03)',
                    border: dragOver === card.id ? '2px dashed #66bb6a' : '2px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '8px',
                    transition: '0.2s ease',
                  }}
                >
                  {/* Art Preview / Drop Zone */}
                  <div style={{
                    height: '100px',
                    background: card.hasArt
                      ? `url(/api/card-art/${card.id}) center/cover`
                      : 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    position: 'relative',
                  }}>
                    {!card.hasArt && (
                      <div style={{
                        textAlign: 'center',
                        color: '#555',
                        fontSize: '11px',
                        padding: '4px',
                      }}>
                        Drop JPG here
                        <br />
                        <span style={{ fontSize: '9px' }}>or click to browse</span>
                      </div>
                    )}
                    {uploading === card.id && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#66bb6a',
                        fontSize: '12px',
                      }}>
                        Uploading...
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => handleFileSelect(card.id, e)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </div>

                  {/* Card Info */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: '9px', color: '#a0a0a0' }}>
                    {card.rarity}
                  </div>

                  {/* Actions */}
                  {card.hasArt && (
                    <button
                      onClick={() => deleteArt(card.id)}
                      style={{
                        marginTop: '4px',
                        width: '100%',
                        padding: '3px',
                        fontSize: '9px',
                        background: '#333',
                      }}
                    >
                      Remove Art
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredCards.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', padding: '48px', fontSize: '14px' }}>
            {classInfo ? 'No cards match your filters' : 'Loading...'}
          </div>
        )}
      </div>
    </div>
  );
}
