import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export default function ChatPanel() {
  const { chatMessages, sendChat, playerId } = useGameStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        padding: '6px 8px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#a0a0a0',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        Chat
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{
            fontSize: '11px',
            color: msg.playerId === 'system' ? '#ffa726' : '#e0e0e0',
            padding: '2px 0',
          }}>
            {msg.playerId !== 'system' && (
              <span style={{
                fontWeight: 'bold',
                color: msg.playerId === playerId ? '#4fc3f7' : '#66bb6a',
              }}>
                {msg.playerName}:{' '}
              </span>
            )}
            <span>{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px 8px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '4px',
            padding: '4px 8px',
            color: '#e0e0e0',
            fontSize: '11px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '4px 8px',
            background: '#0f3460',
            fontSize: '11px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
