import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CardDefinition } from '@deck-and-dominion/shared';
import CardView from '../Card/CardView';

const TIER_COLORS: Record<string, string> = {
  Common: '#9e9e9e',
  Uncommon: '#66bb6a',
  Rare: '#42a5f5',
  Legendary: '#ffd700',
};

type OpeningPhase = 'sealed' | 'tearing' | 'reveal';

export default function PackOpening() {
  const { openingPack, openedCardIds, allCards, closePackOpening } = useGameStore();
  const [phase, setPhase] = useState<OpeningPhase>('sealed');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [tearProgress, setTearProgress] = useState(0);

  // Reset phase when a new pack opens
  useEffect(() => {
    if (openingPack) {
      setPhase('sealed');
      setCurrentCardIndex(0);
      setTearProgress(0);
    }
  }, [openingPack?.id]);

  // Animate tear progress
  useEffect(() => {
    if (phase !== 'tearing') return;
    const interval = setInterval(() => {
      setTearProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setPhase('reveal');
          return 100;
        }
        return prev + 4;
      });
    }, 20);
    return () => clearInterval(interval);
  }, [phase]);

  if (!openingPack) return null;

  const tierColor = TIER_COLORS[openingPack.tier] || '#9e9e9e';

  const revealedCards: CardDefinition[] = openedCardIds
    ? openedCardIds.map(id => allCards.find(c => c.id === id)).filter((c): c is CardDefinition => !!c)
    : [];

  const currentCard = revealedCards[currentCardIndex];

  const handleOpenClick = () => {
    if (phase === 'sealed') {
      setPhase('tearing');
    }
  };

  return (
    <div
      onClick={(e) => {
        if (phase === 'reveal' && (e.target as HTMLElement).dataset.backdrop) {
          closePackOpening();
        }
      }}
      data-backdrop="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {/* Sealed / Tearing Phase */}
      {(phase === 'sealed' || phase === 'tearing') && (
        <div
          onClick={handleOpenClick}
          style={{
            cursor: phase === 'sealed' ? 'pointer' : 'default',
            position: 'relative',
            width: '200px',
            height: '280px',
          }}
        >
          {/* Pack box */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '12px',
            border: `3px solid ${tierColor}`,
            background: `linear-gradient(145deg, rgba(26,26,46,0.95), rgba(15,52,96,0.95))`,
            boxShadow: `0 0 30px ${tierColor}44, inset 0 0 20px ${tierColor}22`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            {/* Decorative pattern */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${tierColor}08 10px, ${tierColor}08 20px)`,
            }} />

            {/* Pack label */}
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: tierColor,
              textShadow: `0 0 10px ${tierColor}88`,
              textAlign: 'center',
              padding: '0 16px',
              zIndex: 1,
            }}>
              {openingPack.label}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#a0a0a0',
              zIndex: 1,
            }}>
              {openingPack.size} cards
            </div>

            {phase === 'sealed' && (
              <div style={{
                fontSize: '13px',
                color: '#ffd700',
                marginTop: '16px',
                zIndex: 1,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                Click to open
              </div>
            )}

            {/* Tear effect overlay */}
            {phase === 'tearing' && (
              <>
                {/* Top half sliding up */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: `linear-gradient(145deg, rgba(26,26,46,0.98), rgba(15,52,96,0.98))`,
                  borderBottom: `2px solid ${tierColor}`,
                  transform: `translateY(${-tearProgress * 1.5}%)`,
                  transition: 'transform 0.05s linear',
                  zIndex: 2,
                  overflow: 'hidden',
                }}>
                  {/* Jagged tear edge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: 0,
                    right: 0,
                    height: '12px',
                    background: `repeating-conic-gradient(${tierColor} 0% 25%, transparent 0% 50%) 0 0 / 12px 12px`,
                    opacity: Math.min(1, tearProgress / 30),
                  }} />
                </div>
                {/* Bottom half sliding down */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: `linear-gradient(145deg, rgba(15,52,96,0.98), rgba(26,26,46,0.98))`,
                  borderTop: `2px solid ${tierColor}`,
                  transform: `translateY(${tearProgress * 1.5}%)`,
                  transition: 'transform 0.05s linear',
                  zIndex: 2,
                  overflow: 'hidden',
                }}>
                  {/* Jagged tear edge */}
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: 0,
                    right: 0,
                    height: '12px',
                    background: `repeating-conic-gradient(${tierColor} 0% 25%, transparent 0% 50%) 0 0 / 12px 12px`,
                    opacity: Math.min(1, tearProgress / 30),
                  }} />
                </div>
                {/* Glow from inside */}
                <div style={{
                  position: 'absolute',
                  top: '40%',
                  left: '10%',
                  right: '10%',
                  height: '20%',
                  background: `radial-gradient(ellipse, ${tierColor}${Math.floor(Math.min(255, tearProgress * 2.5)).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                  zIndex: 1,
                }} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Reveal Phase — Card display with arrows */}
      {phase === 'reveal' && revealedCards.length > 0 && (
        <div
          data-backdrop="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: tierColor,
            textShadow: `0 0 12px ${tierColor}88`,
          }}>
            {openingPack.label}
          </div>

          {/* Card counter */}
          <div style={{ fontSize: '12px', color: '#a0a0a0' }}>
            Card {currentCardIndex + 1} of {revealedCards.length}
          </div>

          {/* Navigation row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}>
            {/* Left arrow */}
            <button
              onClick={() => setCurrentCardIndex(i => Math.max(0, i - 1))}
              disabled={currentCardIndex === 0}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: currentCardIndex === 0 ? '#222' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${currentCardIndex === 0 ? '#333' : tierColor}`,
                color: currentCardIndex === 0 ? '#444' : tierColor,
                fontSize: '20px',
                cursor: currentCardIndex === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#9664;
            </button>

            {/* Card display */}
            {currentCard && (
              <div style={{
                transform: 'scale(1.5)',
                transformOrigin: 'center center',
              }}>
                <CardView card={currentCard} />
              </div>
            )}

            {/* Right arrow */}
            <button
              onClick={() => setCurrentCardIndex(i => Math.min(revealedCards.length - 1, i + 1))}
              disabled={currentCardIndex === revealedCards.length - 1}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: currentCardIndex === revealedCards.length - 1 ? '#222' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${currentCardIndex === revealedCards.length - 1 ? '#333' : tierColor}`,
                color: currentCardIndex === revealedCards.length - 1 ? '#444' : tierColor,
                fontSize: '20px',
                cursor: currentCardIndex === revealedCards.length - 1 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#9654;
            </button>
          </div>

          {/* Card dot indicators */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {revealedCards.map((_, i) => (
              <div
                key={i}
                onClick={() => setCurrentCardIndex(i)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: i === currentCardIndex ? tierColor : '#444',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
            Cards have been added to your collection.
          </div>

          {/* Confirm button */}
          <button
            onClick={closePackOpening}
            style={{
              padding: '10px 32px',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '8px',
              background: tierColor,
              color: '#1a1a2e',
              border: 'none',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Confirm
          </button>
        </div>
      )}

      {/* Loading state */}
      {phase === 'reveal' && !openedCardIds && (
        <div style={{ color: '#a0a0a0', fontSize: '14px' }}>
          Opening pack...
        </div>
      )}

      {/* Inject pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
