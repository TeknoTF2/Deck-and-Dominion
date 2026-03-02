import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  GameState, LobbyState, CardClass, ChatMessage,
  SocketEvent, GameAction, DMAction, CardDefinition,
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
      set({ lobby, isDM: player?.isDM || false });
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
