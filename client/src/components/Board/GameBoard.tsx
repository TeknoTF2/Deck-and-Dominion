import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import CardView from '../Card/CardView';
import CardDetailModal from '../Card/CardDetailModal';
import CombatLog from './CombatLog';
import GameHUD from '../GameHUD/GameHUD';
import { CardInstance, Phase } from '@deck-and-dominion/shared';

export default function GameBoard() {
  const { gameState, playerId, isDM, selectedCard, selectCard, sendGameAction } = useGameStore();
  const [detailCard, setDetailCard] = useState<CardInstance | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [attackMode, setAttackMode] = useState(false);

  if (!gameState) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading game...</div>;
  }

  const currentPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayerId === playerId;
  const currentPlayer = gameState.players[playerId];
  const phase = gameState.phase;

  const handlePlayCard = (card: CardInstance) => {
    if (!isMyTurn || phase !== Phase.Play) return;
    sendGameAction({
      type: 'play_card',
      playerId,
      cardInstanceId: card.instanceId,
    });
  };

  const handleAttack = (attacker: CardInstance, target?: CardInstance) => {
    if (!isMyTurn || phase !== Phase.Attack) return;
    sendGameAction({
      type: 'attack',
      playerId,
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: target?.instanceId,
      targetDM: !target,
    });
    setAttackMode(false);
    selectCard(null);
  };

  const handleEndPhase = () => {
    sendGameAction({ type: 'end_phase', playerId });
  };

  const handlePassTurn = () => {
    sendGameAction({ type: 'pass_turn', playerId });
  };

  const handleMulligan = () => {
    sendGameAction({ type: 'mulligan', playerId });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top: HUD with HP, Mana, Phase info */}
      <GameHUD
        gameState={gameState}
        isMyTurn={isMyTurn}
        isDM={isDM}
        playerId={playerId}
      />

      {/* Main Board Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Game Board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* DM Side */}
          <div style={{
            padding: '8px 12px',
            background: 'rgba(233,69,96,0.05)',
            borderBottom: '1px solid rgba(233,69,96,0.2)',
            minHeight: '80px',
          }}>
            <div style={{ fontSize: '11px', color: '#e94560', marginBottom: '4px', fontWeight: 'bold' }}>
              DM Creatures ({gameState.board.dmCreatures.length})
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {gameState.board.dmCreatures.map(creature => (
                <div
                  key={creature.instanceId}
                  onClick={() => {
                    if (attackMode && selectedCard) {
                      const attacker = gameState.board.playerCreatures.find(c => c.instanceId === selectedCard);
                      if (attacker) handleAttack(attacker, creature);
                    } else {
                      setDetailCard(creature);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CardView card={creature} compact />
                </div>
              ))}
              {gameState.board.dmCreatures.length === 0 && (
                <div style={{ color: '#555', fontSize: '12px', padding: '8px' }}>No DM creatures</div>
              )}
            </div>
          </div>

          {/* Center - shared board area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 12px',
            overflow: 'auto',
          }}>
            {/* Player Creatures */}
            <div>
              <div style={{ fontSize: '11px', color: '#66bb6a', marginBottom: '4px', fontWeight: 'bold' }}>
                Party Board ({gameState.board.playerCreatures.length})
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {gameState.board.playerCreatures.map(creature => (
                  <div
                    key={creature.instanceId}
                    onClick={() => {
                      if (attackMode && creature.canAttack && !creature.tapped) {
                        selectCard(creature.instanceId);
                      } else if (phase === Phase.Attack && isMyTurn && creature.canAttack && !creature.tapped && creature.ownerId === playerId) {
                        setAttackMode(true);
                        selectCard(creature.instanceId);
                      } else {
                        setDetailCard(creature);
                      }
                    }}
                  >
                    <CardView
                      card={creature}
                      selected={selectedCard === creature.instanceId}
                    />
                  </div>
                ))}
                {gameState.board.playerCreatures.length === 0 && (
                  <div style={{ color: '#555', fontSize: '12px', padding: '8px' }}>No creatures on board</div>
                )}
              </div>
            </div>
          </div>

          {/* Hand */}
          {currentPlayer && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              minHeight: '100px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#a0a0a0', fontWeight: 'bold' }}>
                  Your Hand ({currentPlayer.hand.length}/8)
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {currentPlayer.mulligansLeft > 0 && gameState.turnNumber === 1 && (
                    <button onClick={handleMulligan} style={{ fontSize: '11px', padding: '4px 8px', background: '#333' }}>
                      Mulligan ({currentPlayer.mulligansLeft})
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {currentPlayer.hand.map(card => (
                  <div
                    key={card.instanceId}
                    onDoubleClick={() => handlePlayCard(card)}
                    onClick={() => selectCard(card.instanceId === selectedCard ? null : card.instanceId)}
                  >
                    <CardView
                      card={card}
                      selected={selectedCard === card.instanceId}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Combat Log */}
        <div style={{
          width: showLog ? '280px' : '40px',
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          transition: '0.3s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <button
            onClick={() => setShowLog(!showLog)}
            style={{
              padding: '8px',
              background: 'transparent',
              color: '#a0a0a0',
              fontSize: '12px',
              borderRadius: 0,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {showLog ? 'Log <<' : '>>'}
          </button>
          {showLog && <CombatLog entries={gameState.combatLog} />}
        </div>
      </div>

      {/* Bottom: Action bar */}
      <div style={{
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.05)',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            color: isMyTurn ? '#ffd700' : '#666',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            {isMyTurn ? `Your Turn - ${phase} Phase` : `Waiting for ${gameState.players[currentPlayerId]?.name || 'DM'}...`}
          </span>
          {attackMode && (
            <span style={{ color: '#ef5350', fontSize: '12px' }}>
              Select target (click DM creature or "Attack DM" button)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMyTurn && selectedCard && phase === Phase.Play && (
            <button
              onClick={() => {
                const card = currentPlayer?.hand.find(c => c.instanceId === selectedCard);
                if (card) handlePlayCard(card);
              }}
              style={{ background: '#66bb6a' }}
            >
              Play Card
            </button>
          )}
          {attackMode && selectedCard && (
            <button
              onClick={() => {
                const attacker = gameState.board.playerCreatures.find(c => c.instanceId === selectedCard);
                if (attacker) handleAttack(attacker);
              }}
              style={{ background: '#ef5350' }}
            >
              Attack DM
            </button>
          )}
          {attackMode && (
            <button
              onClick={() => { setAttackMode(false); selectCard(null); }}
              style={{ background: '#666' }}
            >
              Cancel
            </button>
          )}
          {isMyTurn && (
            <>
              <button onClick={handleEndPhase} style={{ background: '#0f3460' }}>
                Next Phase
              </button>
              <button onClick={handlePassTurn} style={{ background: '#333' }}>
                End Turn
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card Detail Modal */}
      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </div>
  );
}
