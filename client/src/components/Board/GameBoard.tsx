import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import CardView from '../Card/CardView';
import CardDetailModal from '../Card/CardDetailModal';
import CombatLog from './CombatLog';
import GameHUD from '../GameHUD/GameHUD';
import ChatPanel from '../Chat/ChatPanel';
import DMPanel from '../DMPanel/DMPanel';
import ZoneBrowser from './ZoneBrowser';
import GameOverOverlay from './GameOverOverlay';
import { CardInstance, Phase, MAX_HAND_SIZE } from '@deck-and-dominion/shared';

export default function GameBoard() {
  const { gameState, playerId, isDM, selectedCard, selectCard, sendGameAction, gameOverResult } = useGameStore();
  const [detailCard, setDetailCard] = useState<CardInstance | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [attackMode, setAttackMode] = useState(false);
  const [browsingZone, setBrowsingZone] = useState<'graveyard' | 'exile' | null>(null);
  const [drawOrKeepCard, setDrawOrKeepCard] = useState<string | null>(null);

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

  const handleDrawOrKeep = (choice: 'draw' | 'keep', discardInstanceId?: string) => {
    sendGameAction({
      type: 'draw_or_keep',
      playerId,
      choice,
      discardInstanceId,
    });
    setDrawOrKeepCard(null);
  };

  // Check if player needs to make a draw-or-keep decision
  const needsDrawOrKeep = isMyTurn && phase === Phase.Draw && currentPlayer &&
    currentPlayer.hand.length >= MAX_HAND_SIZE && !currentPlayer.hasDrawn;

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
        {/* DM Panel (left sidebar) */}
        {isDM && (
          <div style={{ width: '250px', overflow: 'hidden' }}>
            <DMPanel gameState={gameState} />
          </div>
        )}

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
            {/* Draw or Keep prompt */}
            {needsDrawOrKeep && (
              <div style={{
                padding: '12px',
                background: 'rgba(79,195,247,0.1)',
                border: '1px solid rgba(79,195,247,0.3)',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#4fc3f7', fontWeight: 'bold', marginBottom: '8px' }}>
                  Hand is full ({currentPlayer.hand.length}/{MAX_HAND_SIZE})
                </div>
                <div style={{ color: '#a0a0a0', fontSize: '12px', marginBottom: '8px' }}>
                  {drawOrKeepCard
                    ? 'Click "Draw & Discard" to draw a new card and discard the selected one.'
                    : 'Select a card from your hand to discard, or keep your current hand.'}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleDrawOrKeep('keep')}
                    style={{ padding: '6px 16px', background: '#333', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Keep Hand
                  </button>
                  {drawOrKeepCard && (
                    <button
                      onClick={() => handleDrawOrKeep('draw', drawOrKeepCard)}
                      style={{ padding: '6px 16px', background: '#0f3460', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Draw & Discard
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  Your Hand ({currentPlayer.hand.length}/{MAX_HAND_SIZE})
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
                    onClick={() => {
                      if (needsDrawOrKeep) {
                        setDrawOrKeepCard(card.instanceId === drawOrKeepCard ? null : card.instanceId);
                      } else {
                        selectCard(card.instanceId === selectedCard ? null : card.instanceId);
                      }
                    }}
                  >
                    <CardView
                      card={card}
                      selected={selectedCard === card.instanceId || drawOrKeepCard === card.instanceId}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Log & Chat */}
        <div style={{
          width: (showLog || showChat) ? '280px' : '40px',
          background: 'rgba(255,255,255,0.02)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          transition: '0.3s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex' }}>
            <button
              onClick={() => { setShowLog(!showLog); setShowChat(false); }}
              style={{
                flex: 1,
                padding: '6px',
                background: showLog ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: showLog ? '#e0e0e0' : '#a0a0a0',
                fontSize: '10px',
                borderRadius: 0,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {(showLog || showChat) ? 'Log' : '>>'}
            </button>
            {(showLog || showChat) && (
              <button
                onClick={() => { setShowChat(!showChat); setShowLog(false); }}
                style={{
                  flex: 1,
                  padding: '6px',
                  background: showChat ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: showChat ? '#e0e0e0' : '#a0a0a0',
                  fontSize: '10px',
                  borderRadius: 0,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}
              >
                Chat
              </button>
            )}
          </div>
          {showLog && <CombatLog entries={gameState.combatLog} />}
          {showChat && <ChatPanel />}
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Zone browsers */}
          <button
            onClick={() => setBrowsingZone('graveyard')}
            style={{
              padding: '4px 8px',
              background: 'rgba(126,87,194,0.2)',
              color: '#7e57c2',
              fontSize: '10px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid rgba(126,87,194,0.3)',
            }}
          >
            Graveyard ({gameState.graveyard.length})
          </button>
          <button
            onClick={() => setBrowsingZone('exile')}
            style={{
              padding: '4px 8px',
              background: 'rgba(255,152,0,0.2)',
              color: '#ff9800',
              fontSize: '10px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid rgba(255,152,0,0.3)',
            }}
          >
            Exile ({gameState.exile.length})
          </button>

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

      {/* Zone Browser Modal */}
      {browsingZone === 'graveyard' && (
        <ZoneBrowser
          title="Graveyard"
          cards={gameState.graveyard}
          onClose={() => setBrowsingZone(null)}
          onCardClick={(card) => setDetailCard(card)}
        />
      )}
      {browsingZone === 'exile' && (
        <ZoneBrowser
          title="Exile"
          cards={gameState.exile}
          onClose={() => setBrowsingZone(null)}
          onCardClick={(card) => setDetailCard(card)}
        />
      )}

      {/* Card Detail Modal */}
      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}

      {/* Game Over Overlay */}
      <GameOverOverlay />
    </div>
  );
}
