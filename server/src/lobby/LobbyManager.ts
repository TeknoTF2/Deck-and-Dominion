import { v4 as uuid } from 'uuid';
import { LobbyState, LobbyPlayer, CardClass } from '@deck-and-dominion/shared';

export class LobbyManager {
  private lobbies: Map<string, LobbyState> = new Map();
  private codeToLobby: Map<string, string> = new Map();

  createLobby(hostId: string, hostName: string): LobbyState {
    const id = uuid();
    const code = this.generateCode();

    const lobby: LobbyState = {
      id,
      code,
      host: hostId,
      players: [{
        id: hostId,
        name: hostName,
        ready: false,
        isDM: false,
      }],
      status: 'waiting',
      maxPlayers: 6,
    };

    this.lobbies.set(id, lobby);
    this.codeToLobby.set(code, id);

    return lobby;
  }

  joinLobby(code: string, playerId: string, playerName: string): LobbyState | null {
    const lobbyId = this.codeToLobby.get(code.toUpperCase());
    if (!lobbyId) return null;

    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    if (lobby.status !== 'waiting') return null;
    if (lobby.players.length >= lobby.maxPlayers) return null;
    if (lobby.players.some(p => p.id === playerId)) return lobby;

    lobby.players.push({
      id: playerId,
      name: playerName,
      ready: false,
      isDM: false,
    });

    return lobby;
  }

  leaveLobby(lobbyId: string, playerId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    lobby.players = lobby.players.filter(p => p.id !== playerId);

    if (lobby.players.length === 0) {
      this.lobbies.delete(lobbyId);
      this.codeToLobby.delete(lobby.code);
      return null;
    }

    // Transfer host if host left
    if (lobby.host === playerId) {
      lobby.host = lobby.players[0].id;
    }

    return lobby;
  }

  selectClass(lobbyId: string, playerId: string, cardClass: CardClass): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return null;

    // Check if class is already taken (unless 6+ players)
    if (lobby.players.length < 6) {
      const classTaken = lobby.players.some(p => p.id !== playerId && p.cardClass === cardClass);
      if (classTaken) return null;
    }

    player.cardClass = cardClass;
    return lobby;
  }

  setDM(lobbyId: string, playerId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    // Unset previous DM
    for (const p of lobby.players) {
      p.isDM = false;
    }

    const player = lobby.players.find(p => p.id === playerId);
    if (player) {
      player.isDM = true;
      lobby.dmId = playerId;
    }

    return lobby;
  }

  toggleReady(lobbyId: string, playerId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return null;

    player.ready = !player.ready;
    return lobby;
  }

  setDeck(lobbyId: string, playerId: string, deckId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.find(p => p.id === playerId);
    if (!player) return null;

    player.deckId = deckId;
    return lobby;
  }

  canStart(lobbyId: string): boolean {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;

    // Need at least 2 players (1 player + 1 DM)
    if (lobby.players.length < 2) return false;

    // Need a DM
    if (!lobby.dmId) return false;

    // All non-DM players must be ready with class and deck
    const gamePlayers = lobby.players.filter(p => !p.isDM);
    return gamePlayers.every(p => p.ready && p.cardClass && p.deckId);
  }

  startGame(lobbyId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    if (!this.canStart(lobbyId)) return null;

    lobby.status = 'in_game';
    return lobby;
  }

  getLobby(lobbyId: string): LobbyState | undefined {
    return this.lobbies.get(lobbyId);
  }

  getLobbyByCode(code: string): LobbyState | undefined {
    const lobbyId = this.codeToLobby.get(code.toUpperCase());
    if (!lobbyId) return undefined;
    return this.lobbies.get(lobbyId);
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (this.codeToLobby.has(code)) {
      return this.generateCode();
    }
    return code;
  }
}
