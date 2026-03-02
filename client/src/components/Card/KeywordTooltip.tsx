import React, { useState } from 'react';

const KEYWORD_DESCRIPTIONS: Record<string, string> = {
  'Haste': 'This creature may attack TWICE the turn it is summoned.',
  'Trample': 'Excess combat damage dealt beyond lethal is dealt to the DM\'s HP.',
  'Deathtouch': 'Any damage dealt by this creature to another creature is lethal, destroying it instantly.',
  'Lifelink': 'Damage dealt by this creature heals Party HP for the same amount.',
  'First Strike': 'This creature deals its combat damage first. If it kills the opponent, it takes no damage.',
  'Taunt': 'Enemy creatures must attack this creature before attacking others.',
  'Persistent': 'This card stays on the board with health, and can be targeted like a creature.',
  'Tower': 'A persistent structure with 0 attack that cannot attack. Must be destroyed to remove.',
  'Shield': 'Absorbs damage before HP is affected. Shield is consumed when hit.',
  'Reaction': 'Can be played during the opponent\'s turn in response to a trigger event.',
  'Poison': 'Applies poison stacks that deal damage at the start of each turn.',
};

interface KeywordTooltipProps {
  keyword: string;
  style?: React.CSSProperties;
}

export default function KeywordTooltip({ keyword, style }: KeywordTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const description = KEYWORD_DESCRIPTIONS[keyword] || 'No description available.';

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span style={{
        padding: '4px 10px',
        background: 'rgba(255,215,0,0.1)',
        border: '1px solid rgba(255,215,0,0.3)',
        borderRadius: '12px',
        fontSize: '12px',
        color: '#ffd700',
        fontWeight: 'bold',
        cursor: 'help',
      }}>
        {keyword}
      </span>
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '6px',
          padding: '8px 12px',
          background: '#222',
          border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#e0e0e0',
          lineHeight: '1.4',
          maxWidth: '250px',
          whiteSpace: 'normal',
          zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontWeight: 'bold', color: '#ffd700', marginBottom: '2px' }}>{keyword}</div>
          <div>{description}</div>
        </div>
      )}
    </span>
  );
}
