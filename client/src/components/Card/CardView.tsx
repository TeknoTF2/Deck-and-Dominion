import React from 'react';
import { CardDefinition, CardInstance, Rarity } from '@deck-and-dominion/shared';

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
  Neutral: '#9e9e9e',
};

const TYPE_ICONS: Record<string, string> = {
  Creature: 'C',
  Spell: 'S',
  Equipment: 'E',
  Land: 'L',
  Enchantment: 'N',
  Trap: 'T',
  Consumable: 'P',
  Token: 'K',
};

interface CardViewProps {
  card: CardDefinition | CardInstance;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showStats?: boolean;
}

export default function CardView({ card, onClick, selected, compact, showStats = true }: CardViewProps) {
  const def = 'definition' in card ? card.definition : card;
  const instance = 'definition' in card ? card : null;
  const rarityColor = RARITY_COLORS[def.rarity] || '#9e9e9e';
  const classColor = CLASS_COLORS[def.cardClass] || '#9e9e9e';

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          padding: '4px 8px',
          background: selected ? 'rgba(233,69,96,0.3)' : 'rgba(255,255,255,0.05)',
          borderRadius: '4px',
          cursor: onClick ? 'pointer' : 'default',
          border: `1px solid ${selected ? '#e94560' : rarityColor}40`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          gap: '4px',
        }}
      >
        <span style={{ color: rarityColor, fontWeight: 'bold' }}>{def.name}</span>
        <span style={{ color: '#a0a0a0' }}>
          {def.manaCost > 0 && `${def.manaCost}M `}
          {instance?.currentAttack !== undefined && `${instance.currentAttack}/${instance.currentHealth}`}
          {!instance && def.attack !== undefined && `${def.attack}/${def.health}`}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: '140px',
        height: '200px',
        background: `linear-gradient(135deg, ${classColor}15, ${rarityColor}10)`,
        border: `2px solid ${selected ? '#e94560' : rarityColor}80`,
        borderRadius: '8px',
        padding: '8px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        transition: '0.2s ease',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Mana cost badge */}
      {def.manaCost > 0 && (
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: '#4fc3f7',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px',
          border: '2px solid #1a1a2e',
        }}>
          {def.manaCost}
        </div>
      )}

      {/* Card art area */}
      <div style={{
        height: '70px',
        background: def.artPath ? `url(/card-art/${def.cardClass.toLowerCase()}/${def.id}.jpg) center/cover` : 'rgba(255,255,255,0.05)',
        borderRadius: '4px',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontSize: '24px',
      }}>
        {!def.artPath && TYPE_ICONS[def.cardType]}
      </div>

      {/* Name */}
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: rarityColor,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {def.name}
      </div>

      {/* Type line */}
      <div style={{ fontSize: '9px', color: classColor, opacity: 0.8 }}>
        {def.cardType} - {def.cardClass}
      </div>

      {/* Effect text */}
      <div style={{
        flex: 1,
        fontSize: '8px',
        color: '#ccc',
        overflow: 'hidden',
        lineHeight: '1.3',
        marginTop: '2px',
      }}>
        {def.effectText.substring(0, 100)}{def.effectText.length > 100 ? '...' : ''}
      </div>

      {/* Keywords */}
      {def.keywords && def.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '2px' }}>
          {def.keywords.map((kw, i) => (
            <span key={i} style={{
              fontSize: '7px',
              padding: '1px 4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              color: '#ffd700',
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      {showStats && (def.attack !== undefined || (instance && instance.currentAttack !== undefined)) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#ef5350',
          }}>
            {instance ? instance.currentAttack : def.attack}
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#66bb6a',
          }}>
            {instance ? instance.currentHealth : def.health}
          </span>
        </div>
      )}

      {/* Tapped indicator */}
      {instance?.tapped && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffa726',
          fontWeight: 'bold',
          fontSize: '10px',
        }}>
          TAPPED
        </div>
      )}
    </div>
  );
}
