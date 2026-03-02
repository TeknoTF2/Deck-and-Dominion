import React from 'react';
import { CardInstance } from '@deck-and-dominion/shared';
import CardView from '../Card/CardView';

interface ZoneBrowserProps {
  title: string;
  cards: CardInstance[];
  onClose: () => void;
  onCardClick?: (card: CardInstance) => void;
}

export default function ZoneBrowser({ title, cards, onClose, onCardClick }: ZoneBrowserProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '16px',
        maxWidth: '80vw',
        maxHeight: '80vh',
        minWidth: '300px',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: '16px' }}>
            {title} ({cards.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#a0a0a0',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            X
          </button>
        </div>
        <div style={{
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '4px',
        }}>
          {cards.length === 0 && (
            <div style={{ color: '#555', padding: '24px', textAlign: 'center', width: '100%' }}>
              No cards in {title.toLowerCase()}
            </div>
          )}
          {cards.map(card => (
            <div key={card.instanceId} onClick={() => onCardClick?.(card)} style={{ cursor: 'pointer' }}>
              <CardView card={card} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
