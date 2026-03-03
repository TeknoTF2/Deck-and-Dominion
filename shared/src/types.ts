// ==========================================
// Deck & Dominion - Shared Type Definitions
// ==========================================

// --- Enums ---

export enum CardClass {
  Commander = 'Commander',
  DPS = 'DPS',
  Wizard = 'Wizard',
  Sorcerer = 'Sorcerer',
  Crafter = 'Crafter',
  Neutral = 'Neutral',
}

export enum CardType {
  Creature = 'Creature',
  Spell = 'Spell',
  Equipment = 'Equipment',
  Land = 'Land',
  Enchantment = 'Enchantment',
  Trap = 'Trap',
  Consumable = 'Consumable',
  Token = 'Token',
  Reaction = 'Reaction',
}

export enum Rarity {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  Legendary = 'Legendary',
  Starter = 'Starter',
}

export enum Keyword {
  Haste = 'Haste',
  Trample = 'Trample',
  Deathtouch = 'Deathtouch',
  Lifelink = 'Lifelink',
  FirstStrike = 'First Strike',
  Taunt = 'Taunt',
  Persistent = 'Persistent',
  Tower = 'Tower',
  Shield = 'Shield',
  Reaction = 'Reaction',
  Poison = 'Poison',
}

export enum Phase {
  Draw = 'Draw',
  Mana = 'Mana',
  Play = 'Play',
  Attack = 'Attack',
  Resolution = 'Resolution',
  End = 'End',
}

export enum Zone {
  Hand = 'Hand',
  Deck = 'Deck',
  Board = 'Board',
  Graveyard = 'Graveyard',
  Exile = 'Exile',
  Collection = 'Collection',
}

export enum TriggerEvent {
  OnPlay = 'on_play',
  OnDeath = 'on_death',
  OnAttack = 'on_attack',
  OnDamageDealt = 'on_damage_dealt',
  OnDamageReceived = 'on_damage_received',
  OnKill = 'on_kill',
  OnSacrifice = 'on_sacrifice',
  StartOfTurn = 'start_of_turn',
  EndOfTurn = 'end_of_turn',
  WhenAnotherCreatureDies = 'when_another_creature_dies',
  GraveyardThreshold = 'graveyard_threshold',
  Conditional = 'conditional',
}

export enum DurationType {
  ThisTurn = 'this_turn',
  ThisAttack = 'this_attack',
  ForXTurns = 'for_x_turns',
  Permanent = 'permanent',
  WhileAlive = 'while_alive',
}

export enum ManaType {
  Burst = 'burst',
  Persistent = 'persistent',
}

// --- Card Definition (Database) ---

export interface CardDefinition {
  id: string;
  name: string;
  cardClass: CardClass;
  archetype: string;
  set: string;
  cardType: CardType;
  rarity: Rarity;
  manaCost: number;
  attack?: number;
  health?: number;
  shieldValue?: number;
  poisonValue?: number;
  effectText: string;
  keywords: Keyword[];
  triggers: TriggerDefinition[];
  artPath?: string;
  flavorText?: string;
}

export interface TriggerDefinition {
  event: TriggerEvent;
  effect: string;
  duration?: DurationType;
  durationValue?: number;
  condition?: string;
}

// --- Game State ---

export interface GameState {
  id: string;
  phase: Phase;
  currentPlayerIndex: number;
  turnOrder: string[];
  turnNumber: number;
  partyHP: number;
  maxPartyHP: number;
  dmHP: number;
  maxDmHP: number;
  manaPool: ManaPool;
  board: BoardState;
  graveyard: CardInstance[];
  exile: CardInstance[];
  players: Record<string, PlayerState>;
  dmState: DMState;
  combatLog: LogEntry[];
  activeEffects: ActiveEffect[];
  gameOver?: { winner: 'party' | 'dm'; message: string };
}

export interface ManaPool {
  persistent: number;
  burst: number;
}

export interface BoardState {
  playerCreatures: CardInstance[];
  dmCreatures: CardInstance[];
}

export interface PlayerState {
  id: string;
  name: string;
  cardClass: CardClass;
  hand: CardInstance[];
  deck: CardInstance[];
  mulligansLeft: number;
  hasDrawn: boolean;
  hasPlayedLand: boolean;
  reactionsAvailable: number;
}

export interface DMState {
  hand: CardInstance[];
  deck: CardInstance[];
  encounterDeck?: CardInstance[];
  landsPlayed: number;
  manaAvailable: number;
}

// --- Card Instance (in-game) ---

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  definition: CardDefinition;
  currentAttack?: number;
  currentHealth?: number;
  maxHealth?: number;
  currentShield?: number;
  activeKeywords: Keyword[];
  equipment: CardInstance[];
  buffs: Buff[];
  debuffs: Debuff[];
  tapped: boolean;
  canAttack: boolean;
  attacksRemaining: number;
  summonedThisTurn: boolean;
  poisonStacks: PoisonStack[];
  ownerId: string;
  zone: Zone;
  faceDown?: boolean;
}

export interface Buff {
  id: string;
  source: string;
  attackMod: number;
  healthMod: number;
  keywords: Keyword[];
  duration: DurationType;
  turnsRemaining?: number;
}

export interface Debuff {
  id: string;
  source: string;
  attackMod: number;
  healthMod: number;
  duration: DurationType;
  turnsRemaining?: number;
}

export interface PoisonStack {
  damage: number;
  turnsRemaining: number;
}

export interface ActiveEffect {
  id: string;
  source: string;
  effect: string;
  duration: DurationType;
  turnsRemaining?: number;
}

// --- Actions ---

export interface PlayCardAction {
  type: 'play_card';
  playerId: string;
  cardInstanceId: string;
  targets?: string[];
}

export interface AttackAction {
  type: 'attack';
  playerId: string;
  attackerInstanceId: string;
  targetInstanceId?: string;
  targetDM?: boolean;
}

export interface DeclareReactionAction {
  type: 'reaction';
  playerId: string;
  cardInstanceId: string;
  triggerEventId: string;
  targets?: string[];
}

export interface MulliganAction {
  type: 'mulligan';
  playerId: string;
}

export interface EndPhaseAction {
  type: 'end_phase';
  playerId: string;
}

export interface PassTurnAction {
  type: 'pass_turn';
  playerId: string;
  nextPlayerId?: string;
}

export interface DrawOrKeepAction {
  type: 'draw_or_keep';
  playerId: string;
  choice: 'draw' | 'keep';
  discardInstanceId?: string; // required if choice is 'draw' and hand is full
}

export type GameAction =
  | PlayCardAction
  | AttackAction
  | DeclareReactionAction
  | MulliganAction
  | EndPhaseAction
  | PassTurnAction
  | DrawOrKeepAction;

// --- DM Actions ---

export interface DMEditHP {
  type: 'dm_edit_hp';
  target: 'party' | 'dm';
  value: number;
}

export interface DMMoveCard {
  type: 'dm_move_card';
  cardInstanceId: string;
  fromZone: Zone;
  toZone: Zone;
  toPlayerId?: string;
}

export interface DMModifyCreature {
  type: 'dm_modify_creature';
  cardInstanceId: string;
  attack?: number;
  health?: number;
  addKeywords?: Keyword[];
  removeKeywords?: Keyword[];
}

export interface DMGiveCard {
  type: 'dm_give_card';
  cardDefinitionId: string;
  toPlayerId: string;
  toZone: Zone;
}

export interface DMEndBattle {
  type: 'dm_end_battle';
  winner: 'party' | 'dm';
}

export type DMAction =
  | DMEditHP
  | DMMoveCard
  | DMModifyCreature
  | DMGiveCard
  | DMEndBattle;

// --- Log ---

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'play' | 'attack' | 'damage' | 'trigger' | 'death' | 'heal' | 'mana' | 'phase' | 'system' | 'dm';
  details?: Record<string, unknown>;
}

// --- Lobby ---

export interface LobbyState {
  id: string;
  code: string;
  host: string;
  players: LobbyPlayer[];
  dmId?: string;
  status: 'waiting' | 'in_game' | 'finished';
  maxPlayers: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  cardClass?: CardClass;
  deckId?: string;
  ready: boolean;
  isDM: boolean;
}

// --- Deck Building ---

export interface DeckDefinition {
  id: string;
  name: string;
  playerId: string;
  cardClass: CardClass;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const DECK_MIN_SIZE = 30;
export const DECK_MAX_SIZE = 60;
export const MAX_HAND_SIZE = 8;
export const STARTING_HAND_SIZE = 5;
export const MAX_MULLIGANS = 2;
export const HP_PER_PLAYER = 8;
export const MAX_CARD_COPIES = 2; // Max copies of a single card in a deck (Starter/Land exempt)

// --- Booster Packs ---

export enum PackTier {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  Legendary = 'Legendary',
}

export interface PackFilter {
  cardClass?: CardClass;
  archetype?: string;
  // If neither is set, the pack pulls from all non-Starter cards
}

export interface PackDefinition {
  id: string;
  tier: PackTier;
  size: number;
  filter: PackFilter;
  label: string; // Display name, e.g. "Rare Commander Pack"
}

export interface UnopenedPack {
  id: string;
  tier: PackTier;
  size: number;
  filter: PackFilter;
  label: string;
  // Card IDs are determined server-side and stored encrypted/obfuscated
  // so players can't peek during import/export
  sealedContents: string; // opaque base64 blob
}

export interface OpenedPackResult {
  packId: string;
  cardIds: string[];
}

// --- Socket Events ---

export enum SocketEvent {
  // Lobby
  CreateLobby = 'create_lobby',
  JoinLobby = 'join_lobby',
  LeaveLobby = 'leave_lobby',
  SelectClass = 'select_class',
  SelectDeck = 'select_deck',
  ToggleReady = 'toggle_ready',
  StartGame = 'start_game',
  LobbyUpdate = 'lobby_update',

  // Game
  GameAction = 'game_action',
  DMAction = 'dm_action',
  GameStateUpdate = 'game_state_update',
  GameOver = 'game_over',

  // Chat
  ChatMessage = 'chat_message',
  ChatUpdate = 'chat_update',

  // Card Art
  CardArtUpdated = 'card_art_updated',

  // Packs
  GrantPack = 'grant_pack',
  PackGranted = 'pack_granted',
  OpenPack = 'open_pack',
  PackOpened = 'pack_opened',

  // Error
  Error = 'error',
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  whisperTo?: string;
}
