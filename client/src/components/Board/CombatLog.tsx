import React, { useRef, useEffect } from 'react';
import { LogEntry } from '@deck-and-dominion/shared';

const TYPE_COLORS: Record<string, string> = {
  play: '#66bb6a',
  attack: '#ef5350',
  damage: '#ff7043',
  trigger: '#ffd700',
  death: '#b71c1c',
  heal: '#4fc3f7',
  mana: '#42a5f5',
  phase: '#a0a0a0',
  system: '#ffa726',
  dm: '#e94560',
};

interface CombatLogProps {
  entries: LogEntry[];
}

export default function CombatLog({ entries }: CombatLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '8px',
      fontSize: '11px',
      lineHeight: '1.6',
    }}>
      {entries.map((entry, i) => (
        <div key={i} style={{
          padding: '2px 0',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          color: TYPE_COLORS[entry.type] || '#a0a0a0',
        }}>
          <span style={{ color: '#555', marginRight: '4px' }}>
            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {entry.message}
        </div>
      ))}
      {entries.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', padding: '16px' }}>
          No events yet
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
