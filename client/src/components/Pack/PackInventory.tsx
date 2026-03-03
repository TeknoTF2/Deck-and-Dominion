import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { UnopenedPack } from '@deck-and-dominion/shared';

const TIER_COLORS: Record<string, string> = {
  Common: '#9e9e9e',
  Uncommon: '#66bb6a',
  Rare: '#42a5f5',
  Legendary: '#ffd700',
};

export default function PackInventory() {
  const { unopenedPacks, requestOpenPack } = useGameStore();

  if (unopenedPacks.length === 0) return null;

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#ffd700',
        marginBottom: '8px',
      }}>
        Unopened Packs ({unopenedPacks.length})
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {unopenedPacks.map((pack) => (
          <PackItem key={pack.id} pack={pack} onOpen={() => requestOpenPack(pack)} />
        ))}
      </div>
    </div>
  );
}

function PackItem({ pack, onOpen }: { pack: UnopenedPack; onOpen: () => void }) {
  const tierColor = TIER_COLORS[pack.tier] || '#9e9e9e';

  return (
    <div
      onClick={onOpen}
      style={{
        width: '80px',
        height: '110px',
        borderRadius: '8px',
        border: `2px solid ${tierColor}`,
        background: `linear-gradient(145deg, rgba(26,26,46,0.9), rgba(15,52,96,0.9))`,
        boxShadow: `0 0 12px ${tierColor}33`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '6px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${tierColor}55`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${tierColor}33`;
      }}
    >
      {/* Decorative stripe */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-linear-gradient(45deg, transparent, transparent 6px, ${tierColor}08 6px, ${tierColor}08 12px)`,
      }} />
      <div style={{
        fontSize: '9px',
        fontWeight: 'bold',
        color: tierColor,
        textAlign: 'center',
        zIndex: 1,
        lineHeight: '1.2',
      }}>
        {pack.tier}
      </div>
      <div style={{
        fontSize: '7px',
        color: '#a0a0a0',
        textAlign: 'center',
        zIndex: 1,
        lineHeight: '1.2',
      }}>
        {pack.filter.cardClass || 'Mixed'}
        {pack.filter.archetype ? `\n${pack.filter.archetype}` : ''}
      </div>
      <div style={{
        fontSize: '8px',
        color: '#888',
        zIndex: 1,
      }}>
        {pack.size} cards
      </div>
    </div>
  );
}
