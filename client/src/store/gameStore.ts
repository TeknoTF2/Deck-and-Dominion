import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  GameState, LobbyState, CardClass, ChatMessage,
  SocketEvent, GameAction, DMAction, CardDefinition, Rarity,
} from '@deck-and-dominion/shared';

interface GameStore {
  // Connection
  socket: Socket | null;
  connected: boolean;
  playerName: string;
  playerId: string;

  // Lobby
  lobby: LobbyState | null;
  isDM: boolean;

  // Game
  gameState: GameState | null;
  selectedCard: string | null;
  selectedTarget: string | null;
  gameOverResult: { winner: 'party' | 'dm'; message: string } | null;

  // Chat
  chatMessages: ChatMessage[];

  // Cards
  allCards: CardDefinition[];
  cardsLoaded: boolean;

  // Collection (player-owned cards: cardId -> quantity)
  collection: Record<string, number>;
  isDMMode: boolean;

  // Errors
  serverError: string | null;

  // View
  currentView: 'menu' | 'lobby' | 'deck-builder' | 'game' | 'card-art-manager' | 'collection';

  // Actions
  setPlayerName: (name: string) => void;
  connect: () => void;
  disconnect: () => void;
  createLobby: () => void;
  joinLobby: (code: string) => void;
  leaveLobby: () => void;
  selectClass: (cardClass: CardClass) => void;
  setAsDM: () => void;
  selectDeck: (deckId: string) => void;
  toggleReady: () => void;
  startGame: (dmHP?: number) => void;
  sendGameAction: (action: GameAction) => void;
  sendDMAction: (action: DMAction) => void;
  sendChat: (message: string, whisperTo?: string) => void;
  selectCard: (cardId: string | null) => void;
  selectTarget: (targetId: string | null) => void;
  setView: (view: GameStore['currentView']) => void;
  loadCards: () => Promise<void>;
  clearGameOver: () => void;
  setDMMode: (mode: boolean) => void;
  addToCollection: (cardId: string, qty?: number) => void;
  grantStarterCards: (cardClass: CardClass, archetype: string) => void;
  clearServerError: () => void;
  exportPlayerState: () => string;
  importPlayerState: (json: string) => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  connected: false,
  playerName: '',
  playerId: '',
  lobby: null,
  isDM: false,
  gameState: null,
  selectedCard: null,
  selectedTarget: null,
  gameOverResult: null,
  chatMessages: [],
  allCards: [],
  cardsLoaded: false,
  collection: {},
  isDMMode: false,
  serverError: null,
  currentView: 'menu',

  setPlayerName: (name) => set({ playerName: name }),

  connect: () => {
    const socket = io(window.location.origin);

    socket.on('connect', () => {
      set({ connected: true, playerId: socket.id || '' });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on(SocketEvent.LobbyUpdate, (lobby: LobbyState) => {
      const state = get();
      const player = lobby.players.find(p => p.id === state.playerId);
      set({ lobby, isDM: player?.isDM || false, isDMMode: player?.isDM || false });
    });

    socket.on(SocketEvent.GameStateUpdate, (gameState: GameState) => {
      set({ gameState, currentView: 'game' });
    });

    socket.on(SocketEvent.GameOver, (result: { winner: 'party' | 'dm'; message: string }) => {
      set({ gameOverResult: result });
    });

    socket.on(SocketEvent.ChatUpdate, (msg: ChatMessage) => {
      set(state => ({ chatMessages: [...state.chatMessages, msg] }));
    });

    socket.on(SocketEvent.Error, ({ message }: { message: string }) => {
      console.error('Server error:', message);
      set({ serverError: message });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  createLobby: () => {
    const { socket, playerName } = get();
    if (socket) {
      socket.emit(SocketEvent.CreateLobby, { name: playerName });
      set({ currentView: 'lobby' });
    }
  },

  joinLobby: (code) => {
    const { socket, playerName } = get();
    if (socket) {
      socket.emit(SocketEvent.JoinLobby, { code, name: playerName });
      set({ currentView: 'lobby' });
    }
  },

  leaveLobby: () => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.LeaveLobby);
      set({ lobby: null, currentView: 'menu' });
    }
  },

  selectClass: (cardClass) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.SelectClass, { cardClass });
    }
  },

  setAsDM: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('set_dm');
    }
  },

  selectDeck: (deckId) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.SelectDeck, { deckId });
    }
  },

  toggleReady: () => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.ToggleReady);
    }
  },

  startGame: (dmHP) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.StartGame, { dmHP });
    }
  },

  sendGameAction: (action) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.GameAction, action);
    }
  },

  sendDMAction: (action) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.DMAction, action);
    }
  },

  sendChat: (message, whisperTo) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.ChatMessage, { message, whisperTo });
    }
  },

  selectCard: (cardId) => set({ selectedCard: cardId }),
  selectTarget: (targetId) => set({ selectedTarget: targetId }),
  setView: (view) => set({ currentView: view }),
  clearGameOver: () => set({ gameOverResult: null, gameState: null, currentView: 'lobby' }),

  setDMMode: (mode) => set({ isDMMode: mode }),

  clearServerError: () => set({ serverError: null }),

  addToCollection: (cardId, qty = 1) => {
    set(state => ({
      collection: {
        ...state.collection,
        [cardId]: (state.collection[cardId] || 0) + qty,
      },
    }));
  },

  grantStarterCards: (cardClass, archetype) => {
    const { allCards } = get();
    const starterCards = allCards.filter(c =>
      c.rarity === Rarity.Starter &&
      (c.cardClass === cardClass || c.cardClass === CardClass.Neutral) &&
      (c.archetype === 'Shared' || c.archetype === archetype)
    );
    const newCollection: Record<string, number> = { ...get().collection };
    for (const card of starterCards) {
      newCollection[card.id] = Math.max(newCollection[card.id] || 0, 1);
    }
    set({ collection: newCollection });
  },

  exportPlayerState: () => {
    const { playerName, collection } = get();
    return JSON.stringify({ playerName, collection }, null, 2);
  },

  importPlayerState: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.collection && typeof data.collection === 'object') {
        set({
          collection: data.collection,
          playerName: data.playerName || get().playerName,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  loadCards: async () => {
    try {
      const res = await fetch('/api/cards');
      const cards = await res.json();
      set({ allCards: cards, cardsLoaded: true });
    } catch (err) {
      console.error('Failed to load cards:', err);
    }
  },
}));
