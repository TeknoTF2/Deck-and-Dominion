import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  GameState, LobbyState, CardClass, ChatMessage,
  SocketEvent, GameAction, DMAction, CardDefinition, Rarity,
  UnopenedPack, PackTier, PackFilter, OpenedPackResult,
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

  // Game settings (server-synced)
  gameSettings: {
    maxCardCopies: number;
    starterDecks: Record<string, Record<string, string[]>>;
  };

  // Packs
  unopenedPacks: UnopenedPack[];
  openingPack: UnopenedPack | null;
  openedCardIds: string[] | null;

  // Errors
  serverError: string | null;

  // View
  currentView: 'menu' | 'lobby' | 'deck-builder' | 'game' | 'card-art-manager' | 'collection';
  previousView: 'menu' | 'lobby' | null;

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
  grantClassStarters: (cardClass: CardClass) => void;
  fetchStarterDeck: (cardClass: string, archetype: string) => Promise<string[]>;
  clearServerError: () => void;
  exportPlayerState: () => string;
  importPlayerState: (json: string) => boolean;
  grantPack: (targetPlayerId: string, tier: PackTier, size: number, filter: PackFilter, count?: number) => void;
  requestOpenPack: (pack: UnopenedPack) => void;
  closePackOpening: () => void;
  loadSettings: () => Promise<void>;
  updateCardLimit: (limit: number) => Promise<void>;
  updateStarterDeck: (cardClass: string, archetype: string, cardIds: string[]) => Promise<void>;
  resetStarterDeck: (cardClass: string, archetype: string) => Promise<void>;
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
  gameSettings: { maxCardCopies: 2, starterDecks: {} },
  unopenedPacks: [],
  openingPack: null,
  openedCardIds: null,
  serverError: null,
  currentView: 'menu',
  previousView: null,

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

    socket.on(SocketEvent.PackGranted, ({ packs }: { packs: UnopenedPack[] }) => {
      set(state => ({ unopenedPacks: [...state.unopenedPacks, ...packs] }));
    });

    socket.on(SocketEvent.PackOpened, ({ packId, cardIds }: OpenedPackResult) => {
      // Add cards to collection immediately
      const newCollection = { ...get().collection };
      for (const cardId of cardIds) {
        newCollection[cardId] = (newCollection[cardId] || 0) + 1;
      }
      set({
        collection: newCollection,
        openedCardIds: cardIds,
        unopenedPacks: get().unopenedPacks.filter(p => p.id !== packId),
      });
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
    const { socket, allCards } = get();
    if (socket) {
      socket.emit(SocketEvent.SelectClass, { cardClass });
      // Auto-grant all starter cards for this class to collection
      const starterCards = allCards.filter(c =>
        c.rarity === Rarity.Starter &&
        (c.cardClass === cardClass || c.cardClass === CardClass.Neutral)
      );
      const newCollection: Record<string, number> = { ...get().collection };
      for (const card of starterCards) {
        newCollection[card.id] = Math.max(newCollection[card.id] || 0, 1);
      }
      set({ collection: newCollection });
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
  setView: (view) => {
    const { currentView } = get();
    // Track where we came from when entering sub-views
    if (view === 'deck-builder' || view === 'collection' || view === 'card-art-manager') {
      if (currentView === 'menu' || currentView === 'lobby') {
        set({ currentView: view, previousView: currentView });
        return;
      }
    }
    set({ currentView: view });
  },
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

  grantClassStarters: (cardClass) => {
    const { allCards } = get();
    const starterCards = allCards.filter(c =>
      c.rarity === Rarity.Starter &&
      (c.cardClass === cardClass || c.cardClass === CardClass.Neutral)
    );
    const newCollection: Record<string, number> = { ...get().collection };
    for (const card of starterCards) {
      newCollection[card.id] = Math.max(newCollection[card.id] || 0, 1);
    }
    set({ collection: newCollection });
  },

  fetchStarterDeck: async (cardClass, archetype) => {
    try {
      const res = await fetch(`/api/settings/starter-decks/${encodeURIComponent(cardClass)}/${encodeURIComponent(archetype)}`);
      const data = await res.json();
      const cardIds: string[] = data.cardIds || [];
      // Grant the cards to collection with correct quantities
      const newCollection = { ...get().collection };
      const counts: Record<string, number> = {};
      for (const id of cardIds) counts[id] = (counts[id] || 0) + 1;
      for (const [id, qty] of Object.entries(counts)) {
        newCollection[id] = Math.max(newCollection[id] || 0, qty);
      }
      set({ collection: newCollection });
      return cardIds;
    } catch {
      // Fallback to local computation
      const { allCards } = get();
      const fallbackIds = allCards
        .filter(c =>
          c.rarity === Rarity.Starter &&
          (c.cardClass === cardClass || c.cardClass === CardClass.Neutral) &&
          (c.archetype === 'Shared' || c.archetype === archetype)
        )
        .map(c => c.id);
      const newCollection = { ...get().collection };
      for (const id of fallbackIds) {
        newCollection[id] = Math.max(newCollection[id] || 0, 1);
      }
      set({ collection: newCollection });
      return fallbackIds;
    }
  },

  loadSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      set({
        gameSettings: {
          maxCardCopies: data.maxCardCopies ?? 2,
          starterDecks: data.starterDecks ?? {},
        },
      });
    } catch {
      // Keep defaults
    }
  },

  updateCardLimit: async (limit) => {
    try {
      const res = await fetch('/api/settings/card-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: limit }),
      });
      const data = await res.json();
      if (data.maxCardCopies !== undefined) {
        set(state => ({
          gameSettings: { ...state.gameSettings, maxCardCopies: data.maxCardCopies },
        }));
      }
    } catch {
      // Ignore
    }
  },

  updateStarterDeck: async (cardClass, archetype, cardIds) => {
    try {
      await fetch(`/api/settings/starter-decks/${encodeURIComponent(cardClass)}/${encodeURIComponent(archetype)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds }),
      });
      set(state => ({
        gameSettings: {
          ...state.gameSettings,
          starterDecks: {
            ...state.gameSettings.starterDecks,
            [cardClass]: {
              ...(state.gameSettings.starterDecks[cardClass] || {}),
              [archetype]: cardIds,
            },
          },
        },
      }));
    } catch {
      // Ignore
    }
  },

  resetStarterDeck: async (cardClass, archetype) => {
    try {
      const res = await fetch(`/api/settings/starter-decks/${encodeURIComponent(cardClass)}/${encodeURIComponent(archetype)}/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      set(state => ({
        gameSettings: {
          ...state.gameSettings,
          starterDecks: {
            ...state.gameSettings.starterDecks,
            [cardClass]: {
              ...(state.gameSettings.starterDecks[cardClass] || {}),
              [archetype]: data.cardIds || [],
            },
          },
        },
      }));
    } catch {
      // Ignore
    }
  },

  exportPlayerState: () => {
    const { playerName, collection, unopenedPacks } = get();
    // Packs are exported with sealedContents intact (opaque blob) — contents stay hidden
    const exportPacks = unopenedPacks.map(p => ({
      id: p.id,
      tier: p.tier,
      size: p.size,
      filter: p.filter,
      label: p.label,
      sealedContents: p.sealedContents,
    }));
    return JSON.stringify({ playerName, collection, packs: exportPacks }, null, 2);
  },

  importPlayerState: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.collection && typeof data.collection === 'object') {
        set({
          collection: data.collection,
          playerName: data.playerName || get().playerName,
          unopenedPacks: Array.isArray(data.packs) ? data.packs : [],
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  grantPack: (targetPlayerId, tier, size, filter, count) => {
    const { socket } = get();
    if (socket) {
      socket.emit(SocketEvent.GrantPack, { targetPlayerId, tier, size, filter, count });
    }
  },

  requestOpenPack: (pack) => {
    const { socket } = get();
    if (socket) {
      set({ openingPack: pack, openedCardIds: null });
      socket.emit(SocketEvent.OpenPack, { pack });
    }
  },

  closePackOpening: () => {
    set({ openingPack: null, openedCardIds: null });
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
