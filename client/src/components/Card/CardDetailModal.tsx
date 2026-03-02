import React from 'react';
import { CardDefinition, CardInstance } from '@deck-and-dominion/shared';
import KeywordTooltip from './KeywordTooltip';

const RARITY_COLORS: Record<string, string> = {
  Common: '#9e9e9e',
  Uncommon: '#66bb6a',
  Rare: '#42a5f5',
  Legendary: '#ffd700',
  Starter: '#8d6e63',
};

const CLASS_COLORS: Record<string, string> = {
  Commander: '#f5f5f5',
  DPS: '#ef5350',
  Wizard: '#42a5f5',
  Sorcerer: '#7e57c2',
  Crafter: '#66bb6a',
};

interface CardDetailModalProps {
  card: CardDefinition | CardInstance;
  onClose: () => void;
}

export default function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  const def = 'definition' in card ? card.definition : card;
  const instance = 'definition' in card ? card : null;
  const rarityColor = RARITY_COLORS[def.rarity] || '#9e9e9e';
  const classColor = CLASS_COLORS[def.cardClass] || '#9e9e9e';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '360px',
          background: '#1a1a2e',
          border: `2px solid ${rarityColor}`,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: `0 0 40px ${rarityColor}40`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ color: rarityColor, fontSize: '22px', margin: 0 }}>{def.name}</h2>
            <p style={{ color: classColor, fontSize: '14px', margin: '4px 0 0' }}>
              {def.cardType} - {def.cardClass} ({def.archetype})
            </p>
          </div>
          {def.manaCost > 0 && (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#4fc3f7',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
            }}>
              {def.manaCost}
            </div>
          )}
        </div>

        {/* Card art */}
        <div style={{
          height: '180px',
          background: def.artPath ? `url(/${def.artPath}) center/cover` : 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#555',
          fontSize: '14px',
        }}>
          {!def.artPath && 'No art uploaded'}
        </div>

        {/* Rarity & Set */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <span style={{
            padding: '3px 10px',
            background: `${rarityColor}20`,
            border: `1px solid ${rarityColor}60`,
            borderRadius: '12px',
            fontSize: '12px',
            color: rarityColor,
            fontWeight: 'bold',
          }}>
            {def.rarity}
          </span>
          {def.set && (
            <span style={{
              padding: '3px 10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#a0a0a0',
            }}>
              {def.set}
            </span>
          )}
        </div>

        {/* Effect text */}
        <div style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#e8e8e8',
        }}>
          {def.effectText || 'No effect text'}
        </div>

        {/* Keywords */}
        {def.keywords && def.keywords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {def.keywords.map((kw, i) => (
              <KeywordTooltip key={i} keyword={kw} />
            ))}
          </div>
        )}

        {/* Stats */}
        {(def.attack !== undefined || instance?.currentAttack !== undefined) && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ef5350', fontWeight: 'bold', fontSize: '24px' }}>
                {instance ? instance.currentAttack : def.attack}
              </div>
              <div style={{ color: '#a0a0a0', fontSize: '11px' }}>ATK</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#66bb6a', fontWeight: 'bold', fontSize: '24px' }}>
                {instance ? instance.currentHealth : def.health}
              </div>
              <div style={{ color: '#a0a0a0', fontSize: '11px' }}>HP</div>
            </div>
            {((def.shieldValue && def.shieldValue > 0) || (instance?.currentShield && instance.currentShield > 0)) && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#78909c', fontWeight: 'bold', fontSize: '24px' }}>
                  {instance ? instance.currentShield : def.shieldValue}
                </div>
                <div style={{ color: '#a0a0a0', fontSize: '11px' }}>SHD</div>
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '10px', background: '#333' }}>
          Close
        </button>
      </div>
    </div>
  );
}
