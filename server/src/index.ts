import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { getDB } from './database/setup';
import { getAllCards, getCardById } from './database/cards';
import { GameEngine } from './game/GameEngine';
import { LobbyManager } from './lobby/LobbyManager';
import cardsRouter from './routes/cards';
import cardArtRouter from './routes/cardArt';
import decksRouter from './routes/decks';
import {
  SocketEvent, GameAction, DMAction, CardClass, CardDefinition, GameState,
  PackTier, PackFilter, UnopenedPack,
} from '@deck-and-dominion/shared';
import { generatePack, generateBulkPacks, openPack } from './game/PackGenerator';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve card art as static files
app.use('/card-art', express.static(path.join(__dirname, '../../card-art')));

// Serve client build in production
const clientBuild = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuild));

// API Routes
app.use('/api/cards', cardsRouter);
app.use('/api/card-art', cardArtRouter);
app.use('/api/decks', decksRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- Game State ---
const lobbyManager = new LobbyManager();
const activeGames: Map<string, GameEngine> = new Map();
const playerToLobby: Map<string, string> = new Map();
const disconnectedPlayers: Map<string, { lobbyId: string; playerName: string; timeout: ReturnType<typeof setTimeout> }> = new Map();

// Helper: broadcast game state to all players in a lobby and check for game over
function broadcastGameState(lobbyId: string, engine: GameEngine) {
  const lobby = lobbyManager.getLobby(lobbyId);
  if (!lobby) return;

  const state = engine.getState();

  for (const gp of lobby.players.filter(p => !p.isDM)) {
    const playerSocket = io.sockets.sockets.get(gp.id);
    if (playerSocket) {
      playerSocket.emit(SocketEvent.GameStateUpdate, engine.getPlayerView(gp.id));
    }
  }
  if (lobby.dmId) {
    const dmSocket = io.sockets.sockets.get(lobby.dmId);
    if (dmSocket) {
      dmSocket.emit(SocketEvent.GameStateUpdate, engine.getDMView());
    }
  }

  // Check for game over
  if (state.gameOver) {
    io.to(lobbyId).emit(SocketEvent.GameOver, state.gameOver);
  }
}

// --- Socket.IO ---
io.on('connection', (socket) => {
  let playerId = socket.id;
  let playerName = 'Player';

  socket.on(SocketEvent.CreateLobby, ({ name }: { name: string }) => {
    playerName = name;
    const lobby = lobbyManager.createLobby(playerId, playerName);
    playerToLobby.set(playerId, lobby.id);
    socket.join(lobby.id);
    socket.emit(SocketEvent.LobbyUpdate, lobby);
  });

  socket.on(SocketEvent.JoinLobby, ({ code, name }: { code: string; name: string }) => {
    playerName = name;
    const lobby = lobbyManager.joinLobby(code, playerId, playerName);
    if (lobby) {
      playerToLobby.set(playerId, lobby.id);
      socket.join(lobby.id);
      io.to(lobby.id).emit(SocketEvent.LobbyUpdate, lobby);
    } else {
      socket.emit(SocketEvent.Error, { message: 'Could not join lobby' });
    }
  });

  socket.on(SocketEvent.LeaveLobby, () => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.leaveLobby(lobbyId, playerId);
    playerToLobby.delete(playerId);
    socket.leave(lobbyId);

    if (lobby) {
      io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
    }
  });

  socket.on(SocketEvent.SelectClass, ({ cardClass }: { cardClass: CardClass }) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.selectClass(lobbyId, playerId, cardClass);
    if (lobby) {
      io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
    } else {
      socket.emit(SocketEvent.Error, { message: 'Class already taken' });
    }
  });

  socket.on('set_dm', () => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.setDM(lobbyId, playerId);
    if (lobby) {
      io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
    }
  });

  socket.on(SocketEvent.SelectDeck, ({ deckId }: { deckId: string }) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.setDeck(lobbyId, playerId, deckId);
    if (lobby) {
      io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
    }
  });

  socket.on(SocketEvent.ToggleReady, () => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.toggleReady(lobbyId, playerId);
    if (lobby) {
      io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
    }
  });

  socket.on(SocketEvent.StartGame, ({ dmHP }: { dmHP?: number } = {}) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby) return;
    if (lobby.host !== playerId) {
      socket.emit(SocketEvent.Error, { message: 'Only host can start game' });
      return;
    }

    const result = lobbyManager.startGame(lobbyId);
    if (!result.lobby) {
      socket.emit(SocketEvent.Error, { message: result.reason || 'Cannot start game' });
      return;
    }

    // Build game state
    const gamePlayers = lobby.players.filter(p => !p.isDM);
    const playerIds = gamePlayers.map(p => p.id);
    const playerNames = gamePlayers.map(p => p.name);
    const playerClasses = gamePlayers.map(p => p.cardClass!);

    // Load player decks from database
    const db = getDB();
    const playerDecks: CardDefinition[][] = gamePlayers.map(p => {
      if (!p.deckId) return [];
      const deckRow = db.prepare('SELECT * FROM decks WHERE id = ?').get(p.deckId) as any;
      if (!deckRow) return [];
      const cardIds: string[] = JSON.parse(deckRow.card_ids);
      return cardIds.map(id => getCardById(id)).filter((c): c is CardDefinition => c !== undefined);
    });

    // Create a simple DM encounter deck from all cards
    const allCards = getAllCards();
    const dmDeck = allCards.slice(0, 40); // Simple default DM deck

    const engine = new GameEngine(playerIds, playerNames, playerClasses, playerDecks, dmDeck, dmHP || 40);
    activeGames.set(lobbyId, engine);

    broadcastGameState(lobbyId, engine);
  });

  socket.on(SocketEvent.GameAction, (action: GameAction) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const engine = activeGames.get(lobbyId);
    if (!engine) return;

    const result = engine.processAction({ ...action, playerId });

    if (result.success) {
      broadcastGameState(lobbyId, engine);
    } else {
      socket.emit(SocketEvent.Error, { message: result.message });
    }
  });

  socket.on(SocketEvent.DMAction, (action: DMAction) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || lobby.dmId !== playerId) {
      socket.emit(SocketEvent.Error, { message: 'Only DM can perform DM actions' });
      return;
    }

    const engine = activeGames.get(lobbyId);
    if (!engine) return;

    // Handle dm_give_card with DB lookup
    let cardDef: CardDefinition | undefined;
    if (action.type === 'dm_give_card') {
      cardDef = getCardById(action.cardDefinitionId);
      if (!cardDef) {
        socket.emit(SocketEvent.Error, { message: `Card not found: ${action.cardDefinitionId}` });
        return;
      }
    }

    const result = engine.processDMAction(action, cardDef);

    if (result.success) {
      broadcastGameState(lobbyId, engine);
    } else {
      socket.emit(SocketEvent.Error, { message: result.message });
    }
  });

  socket.on(SocketEvent.ChatMessage, ({ message, whisperTo }: { message: string; whisperTo?: string }) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const chatMsg = {
      playerId,
      playerName,
      message,
      timestamp: Date.now(),
      whisperTo,
    };

    if (whisperTo) {
      // Whisper to specific player
      const targetSocket = io.sockets.sockets.get(whisperTo);
      if (targetSocket) {
        targetSocket.emit(SocketEvent.ChatUpdate, chatMsg);
      }
      socket.emit(SocketEvent.ChatUpdate, chatMsg);
    } else {
      // Broadcast to lobby
      io.to(lobbyId).emit(SocketEvent.ChatUpdate, chatMsg);
    }
  });

  // --- Pack System ---
  socket.on(SocketEvent.GrantPack, (data: {
    targetPlayerId: string;
    tier: PackTier;
    size: number;
    filter: PackFilter;
    count?: number;
  }) => {
    const lobbyId = playerToLobby.get(playerId);
    if (!lobbyId) return;

    const lobby = lobbyManager.getLobby(lobbyId);
    if (!lobby || lobby.dmId !== playerId) {
      socket.emit(SocketEvent.Error, { message: 'Only DM can grant packs' });
      return;
    }

    const allCards = getAllCards();
    const count = Math.min(data.count || 1, 10); // cap at 10
    const packSize = Math.max(3, Math.min(data.size || 5, 10)); // 3-10 cards per pack

    const packs = count === 1
      ? [generatePack(allCards, data.tier, packSize, data.filter)]
      : generateBulkPacks(allCards, data.tier, packSize, data.filter, count);

    const targetSocket = io.sockets.sockets.get(data.targetPlayerId);
    if (targetSocket) {
      targetSocket.emit(SocketEvent.PackGranted, { packs });
    } else {
      socket.emit(SocketEvent.Error, { message: 'Target player not connected' });
    }
  });

  socket.on(SocketEvent.OpenPack, (data: { pack: UnopenedPack }) => {
    const cardIds = openPack(data.pack);
    socket.emit(SocketEvent.PackOpened, { packId: data.pack.id, cardIds });
  });

  // Reconnect support
  socket.on('reconnect_attempt', ({ name, lobbyCode }: { name: string; lobbyCode: string }) => {
    // Try to find the lobby and rejoin
    const lobby = lobbyManager.getLobbyByCode(lobbyCode);
    if (lobby) {
      playerName = name;
      playerToLobby.set(playerId, lobby.id);
      socket.join(lobby.id);

      const engine = activeGames.get(lobby.id);
      if (engine) {
        socket.emit(SocketEvent.GameStateUpdate, engine.getPlayerView(playerId));
      } else {
        socket.emit(SocketEvent.LobbyUpdate, lobby);
      }
    } else {
      socket.emit(SocketEvent.Error, { message: 'Lobby not found for reconnection' });
    }
  });

  socket.on('disconnect', () => {
    const lobbyId = playerToLobby.get(playerId);
    if (lobbyId) {
      const engine = activeGames.get(lobbyId);
      if (engine) {
        // Game is active: hold player slot for 60 seconds
        const timeout = setTimeout(() => {
          disconnectedPlayers.delete(playerId);
          const lobby = lobbyManager.leaveLobby(lobbyId, playerId);
          playerToLobby.delete(playerId);
          if (lobby) {
            io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
          }
        }, 60000);

        disconnectedPlayers.set(playerId, { lobbyId, playerName, timeout });
        io.to(lobbyId).emit(SocketEvent.ChatUpdate, {
          playerId: 'system',
          playerName: 'System',
          message: `${playerName} disconnected. Waiting 60 seconds for reconnection...`,
          timestamp: Date.now(),
        });
      } else {
        // No active game, leave immediately
        const lobby = lobbyManager.leaveLobby(lobbyId, playerId);
        playerToLobby.delete(playerId);
        if (lobby) {
          io.to(lobbyId).emit(SocketEvent.LobbyUpdate, lobby);
        }
      }
    }
  });
});

// Initialize database on startup
getDB();

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Deck & Dominion server running on port ${PORT}`);
});
