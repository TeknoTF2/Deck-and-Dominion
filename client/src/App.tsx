import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import MainMenu from './components/Lobby/MainMenu';
import LobbyView from './components/Lobby/LobbyView';
import GameBoard from './components/Board/GameBoard';
import DeckBuilder from './components/DeckBuilder/DeckBuilder';
import CardArtManager from './components/CardArtManager/CardArtManager';
import CollectionView from './components/DeckBuilder/CollectionView';

export default function App() {
  const { currentView, connect, loadCards, connected } = useGameStore();

  useEffect(() => {
    connect();
    loadCards();
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {currentView === 'menu' && <MainMenu />}
      {currentView === 'lobby' && <LobbyView />}
      {currentView === 'game' && <GameBoard />}
      {currentView === 'deck-builder' && <DeckBuilder />}
      {currentView === 'card-art-manager' && <CardArtManager />}
      {currentView === 'collection' && <CollectionView />}
    </div>
  );
}
