import React from 'react';
import { CardInstance } from '@deck-and-dominion/shared';
import CardView from '../Card/CardView';

interface HandViewProps {
  cards: CardInstance[];
  selectedCard: string | null;
  onSelectCard: (id: string | null) => void;
  onPlayCard: (card: CardInstance) => void;
  canPlay: boolean;
}

export default function HandView({ cards, selectedCard, onSelectCard, onPlayCard, canPlay }: HandViewProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      padding: '4px',
    }}>
      {cards.map((card) => (
        <div
          key={card.instanceId}
          onDoubleClick={() => canPlay && onPlayCard(card)}
          onClick={() => onSelectCard(card.instanceId === selectedCard ? null : card.instanceId)}
        >
          <CardView
            card={card}
            selected={selectedCard === card.instanceId}
          />
        </div>
      ))}
    </div>
  );
}
