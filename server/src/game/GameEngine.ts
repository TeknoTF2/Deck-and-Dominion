import { v4 as uuid } from 'uuid';
import {
  GameState, Phase, PlayerState, CardInstance, CardDefinition,
  GameAction, DMAction, LogEntry, ManaPool, BoardState, Zone,
  Keyword, Buff, Debuff, ActiveEffect, CardType, DMState,
  HP_PER_PLAYER, STARTING_HAND_SIZE, MAX_HAND_SIZE, MAX_MULLIGANS,
} from '@deck-and-dominion/shared';

export class GameEngine {
  private state: GameState;

  constructor(playerIds: string[], playerNames: string[], playerClasses: string[], playerDecks: CardDefinition[][], dmDeck: CardDefinition[], dmHP: number = 40) {
    const numPlayers = playerIds.length;
    const players: Record<string, PlayerState> = {};

    for (let i = 0; i < numPlayers; i++) {
      const deckInstances = playerDecks[i].map(card => this.createCardInstance(card, playerIds[i]));
      this.shuffleArray(deckInstances);

      players[playerIds[i]] = {
        id: playerIds[i],
        name: playerNames[i],
        cardClass: playerClasses[i] as any,
        hand: [],
        deck: deckInstances,
        mulligansLeft: MAX_MULLIGANS,
        hasDrawn: false,
        hasPlayedLand: false,
        reactionsAvailable: 1,
      };
    }

    const dmDeckInstances = dmDeck.map(card => this.createCardInstance(card, 'dm'));
    this.shuffleArray(dmDeckInstances);

    this.state = {
      id: uuid(),
      phase: Phase.Draw,
      currentPlayerIndex: 0,
      turnOrder: [...playerIds],
      turnNumber: 1,
      partyHP: HP_PER_PLAYER * numPlayers,
      maxPartyHP: HP_PER_PLAYER * numPlayers,
      dmHP,
      maxDmHP: dmHP,
      manaPool: { persistent: 0, burst: 0 },
      board: { playerCreatures: [], dmCreatures: [] },
      graveyard: [],
      exile: [],
      players,
      dmState: {
        hand: [],
        deck: dmDeckInstances,
      },
      combatLog: [],
      activeEffects: [],
    };

    // Draw starting hands
    for (const pid of playerIds) {
      for (let i = 0; i < STARTING_HAND_SIZE; i++) {
        this.drawCard(pid);
      }
    }
  }

  getState(): GameState {
    return this.state;
  }

  getPlayerView(playerId: string): GameState {
    // Return state with hidden info removed (other players' hands, decks)
    const view = JSON.parse(JSON.stringify(this.state)) as GameState;
    for (const pid of Object.keys(view.players)) {
      if (pid !== playerId) {
        view.players[pid].hand = view.players[pid].hand.map(c => ({ ...c, definition: { ...c.definition, effectText: '???' } }));
        view.players[pid].deck = [];
      } else {
        view.players[pid].deck = []; // Don't show own deck order either
      }
    }
    view.dmState.hand = [];
    view.dmState.deck = [];
    return view;
  }

  getDMView(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  // --- Card Instance Creation ---

  private createCardInstance(def: CardDefinition, ownerId: string): CardInstance {
    return {
      instanceId: uuid(),
      definitionId: def.id,
      definition: def,
      currentAttack: def.attack,
      currentHealth: def.health,
      maxHealth: def.health,
      currentShield: def.shieldValue || 0,
      activeKeywords: [...(def.keywords || [])],
      equipment: [],
      buffs: [],
      debuffs: [],
      tapped: false,
      canAttack: false,
      summonedThisTurn: true,
      poisonStacks: [],
      ownerId,
      zone: Zone.Deck,
    };
  }

  // --- Core Actions ---

  processAction(action: GameAction): { success: boolean; message: string } {
    switch (action.type) {
      case 'play_card':
        return this.playCard(action.playerId, action.cardInstanceId, action.targets);
      case 'attack':
        return this.declareAttack(action.playerId, action.attackerInstanceId, action.targetInstanceId, action.targetDM);
      case 'mulligan':
        return this.mulligan(action.playerId);
      case 'end_phase':
        return this.endPhase(action.playerId);
      case 'pass_turn':
        return this.passTurn(action.playerId, action.nextPlayerId);
      case 'reaction':
        return this.playReaction(action.playerId, action.cardInstanceId, action.targets);
      default:
        return { success: false, message: 'Unknown action type' };
    }
  }

  processDMAction(action: DMAction): { success: boolean; message: string } {
    switch (action.type) {
      case 'dm_edit_hp':
        return this.dmEditHP(action.target, action.value);
      case 'dm_move_card':
        return this.dmMoveCard(action.cardInstanceId, action.fromZone, action.toZone, action.toPlayerId);
      case 'dm_modify_creature':
        return this.dmModifyCreature(action.cardInstanceId, action);
      case 'dm_give_card':
        return this.dmGiveCard(action.cardDefinitionId, action.toPlayerId, action.toZone);
      case 'dm_end_battle':
        return this.dmEndBattle(action.winner);
      default:
        return { success: false, message: 'Unknown DM action type' };
    }
  }

  // --- Draw ---

  private drawCard(playerId: string): boolean {
    const player = this.state.players[playerId];
    if (!player) return false;
    if (player.deck.length === 0) return false;
    if (player.hand.length >= MAX_HAND_SIZE) return false;

    const card = player.deck.shift()!;
    card.zone = Zone.Hand;
    player.hand.push(card);
    return true;
  }

  // --- Play Card ---

  private playCard(playerId: string, cardInstanceId: string, targets?: string[]): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    if (this.state.phase !== Phase.Play) {
      return { success: false, message: 'Can only play cards during Play phase' };
    }

    const currentPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
      return { success: false, message: 'Not your turn' };
    }

    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return { success: false, message: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const totalMana = this.state.manaPool.persistent + this.state.manaPool.burst;

    if (card.definition.manaCost > totalMana) {
      return { success: false, message: 'Not enough mana' };
    }

    // Spend mana (burst first, then persistent)
    let remaining = card.definition.manaCost;
    if (this.state.manaPool.burst >= remaining) {
      this.state.manaPool.burst -= remaining;
    } else {
      remaining -= this.state.manaPool.burst;
      this.state.manaPool.burst = 0;
      this.state.manaPool.persistent -= remaining;
    }

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    // Resolve based on card type
    switch (card.definition.cardType) {
      case CardType.Creature:
        card.zone = Zone.Board;
        card.summonedThisTurn = true;
        card.canAttack = card.activeKeywords.includes(Keyword.Haste);
        this.state.board.playerCreatures.push(card);
        this.addLog('play', `${player.name} plays ${card.definition.name} (${card.currentAttack}/${card.currentHealth})`);
        break;

      case CardType.Land:
        if (player.hasPlayedLand) {
          // Refund mana and return to hand
          player.hand.push(card);
          return { success: false, message: 'Already played a land this turn' };
        }
        player.hasPlayedLand = true;
        card.zone = Zone.Board;
        card.tapped = false;
        this.state.board.playerCreatures.push(card);
        this.addLog('mana', `${player.name} plays ${card.definition.name}`);
        break;

      case CardType.Spell:
        this.resolveSpellEffect(card, playerId, targets);
        card.zone = Zone.Graveyard;
        this.state.graveyard.push(card);
        this.addLog('play', `${player.name} casts ${card.definition.name}`);
        break;

      case CardType.Equipment:
        if (targets && targets.length > 0) {
          const targetCreature = this.findCreatureOnBoard(targets[0]);
          if (targetCreature && targetCreature.ownerId !== 'dm') {
            if (targetCreature.equipment.length === 0 || targetCreature.definition.name.includes('Death Knight')) {
              card.zone = Zone.Board;
              targetCreature.equipment.push(card);
              this.applyEquipmentStats(card, targetCreature);
              this.addLog('play', `${player.name} equips ${card.definition.name} to ${targetCreature.definition.name}`);
            } else {
              return { success: false, message: 'Creature already has equipment' };
            }
          }
        } else {
          card.zone = Zone.Board;
          this.state.board.playerCreatures.push(card);
          this.addLog('play', `${player.name} plays ${card.definition.name} (unequipped)`);
        }
        break;

      case CardType.Enchantment:
        card.zone = Zone.Board;
        this.state.board.playerCreatures.push(card);
        this.addLog('play', `${player.name} plays enchantment ${card.definition.name}`);
        break;

      case CardType.Trap:
        card.zone = Zone.Board;
        this.state.board.playerCreatures.push(card);
        this.addLog('play', `${player.name} sets a trap`);
        break;

      case CardType.Consumable:
        this.resolveSpellEffect(card, playerId, targets);
        card.zone = Zone.Graveyard;
        this.state.graveyard.push(card);
        this.addLog('play', `${player.name} uses ${card.definition.name}`);
        break;

      default:
        card.zone = Zone.Board;
        this.state.board.playerCreatures.push(card);
        this.addLog('play', `${player.name} plays ${card.definition.name}`);
    }

    // Fire on_play triggers
    this.fireTriggers('on_play', card);

    return { success: true, message: `Played ${card.definition.name}` };
  }

  // --- Combat ---

  private declareAttack(playerId: string, attackerInstanceId: string, targetInstanceId?: string, targetDM?: boolean): { success: boolean; message: string } {
    if (this.state.phase !== Phase.Attack) {
      return { success: false, message: 'Can only attack during Attack phase' };
    }

    const attacker = this.findCreatureOnBoard(attackerInstanceId);
    if (!attacker) return { success: false, message: 'Attacker not found on board' };
    if (attacker.ownerId === 'dm') return { success: false, message: 'Cannot control DM creatures' };
    if (!attacker.canAttack) return { success: false, message: 'This creature cannot attack' };
    if (attacker.tapped) return { success: false, message: 'Creature is tapped' };
    if (attacker.definition.cardType !== CardType.Creature) return { success: false, message: 'Only creatures can attack' };

    // Check for taunt
    const dmTaunters = this.state.board.dmCreatures.filter(c =>
      c.activeKeywords.includes(Keyword.Taunt) && c.definition.cardType === CardType.Creature
    );

    if (targetDM && dmTaunters.length > 0) {
      return { success: false, message: 'Must attack a creature with Taunt first' };
    }

    if (targetInstanceId && dmTaunters.length > 0) {
      const target = this.findCreatureOnBoard(targetInstanceId);
      if (target && !target.activeKeywords.includes(Keyword.Taunt)) {
        return { success: false, message: 'Must attack a creature with Taunt first' };
      }
    }

    attacker.tapped = true;
    attacker.canAttack = false;

    // Fire on_attack triggers
    this.fireTriggers('on_attack', attacker);

    if (targetDM || !targetInstanceId) {
      // Direct attack on DM
      const damage = attacker.currentAttack || 0;
      this.state.dmHP = Math.max(0, this.state.dmHP - damage);
      this.addLog('damage', `${attacker.definition.name} attacks DM for ${damage} damage (DM HP: ${this.state.dmHP})`);

      if (this.state.dmHP <= 0) {
        this.addLog('system', 'DM HP reached 0! Party wins!');
      }
    } else {
      // Attack creature
      const target = this.findCreatureOnBoard(targetInstanceId);
      if (!target) return { success: false, message: 'Target not found' };

      this.resolveCombat(attacker, target);
    }

    return { success: true, message: 'Attack declared' };
  }

  private resolveCombat(attacker: CardInstance, defender: CardInstance): void {
    const attackerDamage = attacker.currentAttack || 0;
    const defenderDamage = defender.currentAttack || 0;
    const attackerHasFirstStrike = attacker.activeKeywords.includes(Keyword.FirstStrike);
    const defenderHasFirstStrike = defender.activeKeywords.includes(Keyword.FirstStrike);

    if (attackerHasFirstStrike && !defenderHasFirstStrike) {
      // Attacker strikes first
      const killed = this.dealDamageToCreature(attacker, defender, attackerDamage);
      if (!killed) {
        this.dealDamageToCreature(defender, attacker, defenderDamage);
      }
    } else if (defenderHasFirstStrike && !attackerHasFirstStrike) {
      // Defender strikes first
      const killed = this.dealDamageToCreature(defender, attacker, defenderDamage);
      if (!killed) {
        this.dealDamageToCreature(attacker, defender, attackerDamage);
      }
    } else {
      // Simultaneous
      this.dealDamageToCreature(attacker, defender, attackerDamage);
      this.dealDamageToCreature(defender, attacker, defenderDamage);
    }

    this.addLog('attack', `${attacker.definition.name} (${attackerDamage} ATK) fights ${defender.definition.name} (${defenderDamage} ATK)`);
  }

  private dealDamageToCreature(source: CardInstance, target: CardInstance, damage: number): boolean {
    if (damage <= 0) return false;

    // Shield absorbs first
    if (target.currentShield && target.currentShield > 0) {
      const absorbed = Math.min(target.currentShield, damage);
      target.currentShield -= absorbed;
      damage -= absorbed;
      this.addLog('damage', `${target.definition.name}'s shield absorbs ${absorbed} damage`);
    }

    if (damage <= 0) return false;

    // Apply damage to health
    if (target.currentHealth !== undefined) {
      target.currentHealth -= damage;
      this.addLog('damage', `${target.definition.name} takes ${damage} damage (${target.currentHealth}/${target.maxHealth} HP)`);
    }

    // Deathtouch
    if (source.activeKeywords.includes(Keyword.Deathtouch) && damage > 0) {
      if (target.currentHealth !== undefined) {
        target.currentHealth = 0;
        this.addLog('damage', `${source.definition.name}'s Deathtouch kills ${target.definition.name}!`);
      }
    }

    // Lifelink
    if (source.activeKeywords.includes(Keyword.Lifelink) && damage > 0) {
      if (source.ownerId !== 'dm') {
        this.state.partyHP = Math.min(this.state.maxPartyHP, this.state.partyHP + damage);
        this.addLog('heal', `${source.definition.name}'s Lifelink restores ${damage} HP`);
      }
    }

    // Trample - excess damage to HP
    if (source.activeKeywords.includes(Keyword.Trample) && target.currentHealth !== undefined && target.currentHealth <= 0) {
      const excess = Math.abs(target.currentHealth);
      if (excess > 0) {
        if (target.ownerId === 'dm') {
          // Trample hits DM HP
          this.state.dmHP = Math.max(0, this.state.dmHP - excess);
          this.addLog('damage', `${source.definition.name} tramples for ${excess} damage to DM HP`);
        } else {
          // Trample hits party HP
          this.state.partyHP = Math.max(0, this.state.partyHP - excess);
          this.addLog('damage', `${source.definition.name} tramples for ${excess} damage to party HP`);
        }
      }
    }

    // Check for death
    if (target.currentHealth !== undefined && target.currentHealth <= 0) {
      this.destroyCreature(target);
      return true;
    }

    // Poison
    if (source.definition.poisonValue && source.definition.poisonValue > 0) {
      target.poisonStacks.push({ damage: source.definition.poisonValue, turnsRemaining: 3 });
      this.addLog('damage', `${target.definition.name} is poisoned for ${source.definition.poisonValue}/turn for 3 turns`);
    }

    this.fireTriggers('on_damage_dealt', source);
    this.fireTriggers('on_damage_received', target);

    return false;
  }

  private destroyCreature(creature: CardInstance): void {
    this.addLog('death', `${creature.definition.name} is destroyed`);

    // Remove from board
    const playerIdx = this.state.board.playerCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (playerIdx !== -1) {
      this.state.board.playerCreatures.splice(playerIdx, 1);
    }
    const dmIdx = this.state.board.dmCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (dmIdx !== -1) {
      this.state.board.dmCreatures.splice(dmIdx, 1);
    }

    // Move equipment to graveyard
    for (const equip of creature.equipment) {
      equip.zone = Zone.Graveyard;
      this.state.graveyard.push(equip);
    }
    creature.equipment = [];

    // Move to graveyard
    creature.zone = Zone.Graveyard;
    this.state.graveyard.push(creature);

    // Fire death triggers
    this.fireTriggers('on_death', creature);

    // Fire "when another creature dies" for all board creatures
    for (const c of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
      this.fireTriggers('when_another_creature_dies', c);
    }
  }

  // --- Spell Resolution ---

  private resolveSpellEffect(card: CardInstance, casterId: string, targets?: string[]): void {
    // Generic spell resolution - effect text is parsed for common patterns
    const effect = card.definition.effectText.toLowerCase();

    if (effect.includes('deal') && effect.includes('damage')) {
      const dmgMatch = effect.match(/deal\s+(\d+)\s+damage/);
      if (dmgMatch) {
        const damage = parseInt(dmgMatch[1]);
        if (targets && targets.length > 0) {
          for (const targetId of targets) {
            if (targetId === 'dm') {
              this.state.dmHP = Math.max(0, this.state.dmHP - damage);
              this.addLog('damage', `${card.definition.name} deals ${damage} damage to DM`);
            } else {
              const target = this.findCreatureOnBoard(targetId);
              if (target) {
                this.dealDamageToCreature(card, target, damage);
              }
            }
          }
        }
      }
    }

    if (effect.includes('draw') && effect.includes('card')) {
      const drawMatch = effect.match(/draw\s+(\d+)\s+card/);
      if (drawMatch) {
        const count = parseInt(drawMatch[1]);
        for (let i = 0; i < count; i++) {
          this.drawCard(casterId);
        }
        this.addLog('system', `${this.state.players[casterId]?.name} draws ${count} card(s)`);
      }
    }

    if (effect.includes('restore') || effect.includes('heal')) {
      const healMatch = effect.match(/(?:restore|heal)\s+(\d+)\s+(?:hp|health|life)/);
      if (healMatch) {
        const amount = parseInt(healMatch[1]);
        this.state.partyHP = Math.min(this.state.maxPartyHP, this.state.partyHP + amount);
        this.addLog('heal', `${card.definition.name} restores ${amount} HP`);
      }
    }

    if (effect.includes('generate') && effect.includes('mana')) {
      const manaMatch = effect.match(/generate\s+(\d+)\s+mana/);
      if (manaMatch) {
        const amount = parseInt(manaMatch[1]);
        this.state.manaPool.burst += amount;
        this.addLog('mana', `${card.definition.name} generates ${amount} burst mana`);
      }
    }

    if (effect.includes('shield')) {
      const shieldMatch = effect.match(/shield\s+(\d+)/i);
      if (shieldMatch && targets && targets.length > 0) {
        const amount = parseInt(shieldMatch[1]);
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target) {
            target.currentShield = (target.currentShield || 0) + amount;
            this.addLog('system', `${target.definition.name} gains Shield ${amount}`);
          }
        }
      }
    }
  }

  // --- Equipment ---

  private applyEquipmentStats(equipment: CardInstance, creature: CardInstance): void {
    const effect = equipment.definition.effectText.toLowerCase();

    // Parse +X/+Y patterns
    const statMatch = effect.match(/\+(\d+)\/\+(\d+)/);
    if (statMatch) {
      const atkBuff = parseInt(statMatch[1]);
      const hpBuff = parseInt(statMatch[2]);
      creature.buffs.push({
        id: uuid(),
        source: equipment.instanceId,
        attackMod: atkBuff,
        healthMod: hpBuff,
        keywords: [],
        duration: 'while_alive' as any,
      });
      creature.currentAttack = (creature.currentAttack || 0) + atkBuff;
      creature.currentHealth = (creature.currentHealth || 0) + hpBuff;
      creature.maxHealth = (creature.maxHealth || 0) + hpBuff;
    }

    // Parse keyword grants
    for (const kw of Object.values(Keyword)) {
      if (effect.includes(kw.toLowerCase())) {
        if (!creature.activeKeywords.includes(kw)) {
          creature.activeKeywords.push(kw);
        }
      }
    }
  }

  // --- Phase Management ---

  private endPhase(playerId: string): { success: boolean; message: string } {
    const currentPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
      return { success: false, message: 'Not your turn' };
    }

    const nextPhase = this.getNextPhase(this.state.phase);

    // Phase transition logic
    if (this.state.phase === Phase.Draw) {
      const player = this.state.players[playerId];
      if (player && !player.hasDrawn) {
        this.drawCard(playerId);
        player.hasDrawn = true;
      }
    }

    if (this.state.phase === Phase.Mana) {
      // Untap creatures owned by this player
      for (const creature of this.state.board.playerCreatures) {
        if (creature.ownerId === playerId) {
          creature.tapped = false;
        }
      }
      // Generate mana from lands
      for (const card of this.state.board.playerCreatures) {
        if (card.definition.cardType === CardType.Land && card.ownerId === playerId && !card.tapped) {
          this.state.manaPool.persistent += 1;
          card.tapped = true;
        }
      }
    }

    if (this.state.phase === Phase.Attack) {
      // Enable attacks for creatures that can
      for (const creature of this.state.board.playerCreatures) {
        if (creature.ownerId === playerId && !creature.summonedThisTurn) {
          creature.canAttack = true;
        }
      }
    }

    if (this.state.phase === Phase.Resolution) {
      // Process poison ticks
      for (const creature of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
        for (let i = creature.poisonStacks.length - 1; i >= 0; i--) {
          const poison = creature.poisonStacks[i];
          this.dealDamageToCreature(creature, creature, poison.damage);
          poison.turnsRemaining--;
          if (poison.turnsRemaining <= 0) {
            creature.poisonStacks.splice(i, 1);
          }
        }
      }

      // Process end-of-turn triggers
      for (const creature of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
        this.fireTriggers('end_of_turn', creature);
      }

      // Clean up expired buffs/debuffs
      this.cleanupExpiredEffects();
    }

    this.state.phase = nextPhase;
    this.addLog('phase', `Phase: ${nextPhase}`);

    return { success: true, message: `Advanced to ${nextPhase} phase` };
  }

  private passTurn(playerId: string, nextPlayerId?: string): { success: boolean; message: string } {
    const currentPlayerId = this.state.turnOrder[this.state.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
      return { success: false, message: 'Not your turn' };
    }

    // Reset player turn state
    const player = this.state.players[playerId];
    if (player) {
      player.hasDrawn = false;
      player.hasPlayedLand = false;
      player.reactionsAvailable = 1;

      // Mark creatures as no longer summoned this turn
      for (const creature of this.state.board.playerCreatures) {
        if (creature.ownerId === playerId) {
          creature.summonedThisTurn = false;
        }
      }
    }

    // Clear burst mana at end of turn
    this.state.manaPool.burst = 0;

    // Determine next player
    if (nextPlayerId && this.state.players[nextPlayerId]) {
      this.state.currentPlayerIndex = this.state.turnOrder.indexOf(nextPlayerId);
    } else {
      this.state.currentPlayerIndex++;
    }

    // If all players have gone, it's DM turn
    if (this.state.currentPlayerIndex >= this.state.turnOrder.length) {
      this.processDMTurn();
      this.state.currentPlayerIndex = 0;
      this.state.turnNumber++;
      this.addLog('phase', `--- Turn ${this.state.turnNumber} ---`);
    }

    this.state.phase = Phase.Draw;
    this.addLog('system', `${this.state.players[this.state.turnOrder[this.state.currentPlayerIndex]]?.name}'s turn`);

    return { success: true, message: 'Turn passed' };
  }

  // --- DM Turn ---

  private processDMTurn(): void {
    this.addLog('dm', '--- DM Turn ---');

    const numPlayers = Object.keys(this.state.players).length;

    // DM draws cards equal to player count
    for (let i = 0; i < numPlayers; i++) {
      if (this.state.dmState.deck.length > 0) {
        const card = this.state.dmState.deck.shift()!;
        card.zone = Zone.Hand;
        this.state.dmState.hand.push(card);
      }
    }

    // Untap DM creatures
    for (const creature of this.state.board.dmCreatures) {
      creature.tapped = false;
      creature.canAttack = true;
      creature.summonedThisTurn = false;
    }

    // Start of turn triggers for DM creatures
    for (const creature of this.state.board.dmCreatures) {
      this.fireTriggers('start_of_turn', creature);
    }

    // Auto-play DM cards (simplified AI - plays affordable cards)
    const totalMana = this.state.manaPool.persistent; // DM uses separate mana in full impl
    let dmMana = numPlayers * 2 + this.state.turnNumber; // Scaling DM mana

    for (let i = this.state.dmState.hand.length - 1; i >= 0; i--) {
      const card = this.state.dmState.hand[i];
      if (card.definition.manaCost <= dmMana) {
        dmMana -= card.definition.manaCost;
        this.state.dmState.hand.splice(i, 1);

        if (card.definition.cardType === CardType.Creature) {
          card.zone = Zone.Board;
          card.canAttack = false; // DM creatures can't attack the turn they're played
          this.state.board.dmCreatures.push(card);
          this.addLog('dm', `DM plays ${card.definition.name} (${card.currentAttack}/${card.currentHealth})`);
        } else {
          // DM spells resolve immediately
          card.zone = Zone.Graveyard;
          this.state.graveyard.push(card);
          this.addLog('dm', `DM casts ${card.definition.name}`);
        }
      }
    }

    // DM creatures attack
    for (const creature of this.state.board.dmCreatures) {
      if (creature.canAttack && !creature.tapped && creature.definition.cardType === CardType.Creature) {
        // DM creatures attack player creatures with taunt first, then party HP
        const playerTaunters = this.state.board.playerCreatures.filter(c =>
          c.activeKeywords.includes(Keyword.Taunt) && c.definition.cardType === CardType.Creature
        );

        if (playerTaunters.length > 0) {
          this.resolveCombat(creature, playerTaunters[0]);
        } else if (this.state.board.playerCreatures.some(c => c.definition.cardType === CardType.Creature)) {
          // Attack a random player creature
          const targets = this.state.board.playerCreatures.filter(c => c.definition.cardType === CardType.Creature);
          const target = targets[Math.floor(Math.random() * targets.length)];
          this.resolveCombat(creature, target);
        } else {
          // Attack party HP directly
          const damage = creature.currentAttack || 0;
          this.state.partyHP = Math.max(0, this.state.partyHP - damage);
          this.addLog('damage', `${creature.definition.name} attacks party for ${damage} damage (Party HP: ${this.state.partyHP})`);
        }
        creature.tapped = true;
      }
    }

    // Check win condition
    if (this.state.partyHP <= 0) {
      this.addLog('system', 'Party HP reached 0! DM wins!');
    }
  }

  // --- Mulligan ---

  private mulligan(playerId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };
    if (player.mulligansLeft <= 0) return { success: false, message: 'No mulligans remaining' };

    // Return hand to deck
    while (player.hand.length > 0) {
      const card = player.hand.pop()!;
      card.zone = Zone.Deck;
      player.deck.push(card);
    }

    // Shuffle deck
    this.shuffleArray(player.deck);

    // Draw new hand
    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      this.drawCard(playerId);
    }

    player.mulligansLeft--;
    this.addLog('system', `${player.name} mulligans (${player.mulligansLeft} remaining)`);

    return { success: true, message: `Mulliganed. ${player.mulligansLeft} mulligans remaining` };
  }

  // --- Reactions ---

  private playReaction(playerId: string, cardInstanceId: string, targets?: string[]): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };
    if (player.reactionsAvailable <= 0) return { success: false, message: 'No reactions available this trigger' };

    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return { success: false, message: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const totalMana = this.state.manaPool.persistent + this.state.manaPool.burst;

    if (card.definition.manaCost > totalMana) {
      return { success: false, message: 'Not enough mana for reaction' };
    }

    // Spend mana
    let remaining = card.definition.manaCost;
    if (this.state.manaPool.burst >= remaining) {
      this.state.manaPool.burst -= remaining;
    } else {
      remaining -= this.state.manaPool.burst;
      this.state.manaPool.burst = 0;
      this.state.manaPool.persistent -= remaining;
    }

    player.hand.splice(cardIndex, 1);
    player.reactionsAvailable--;

    this.resolveSpellEffect(card, playerId, targets);
    card.zone = Zone.Graveyard;
    this.state.graveyard.push(card);

    this.addLog('play', `${player.name} plays reaction: ${card.definition.name}`);
    return { success: true, message: `Played reaction: ${card.definition.name}` };
  }

  // --- DM Direct Actions ---

  private dmEditHP(target: 'party' | 'dm', value: number): { success: boolean; message: string } {
    if (target === 'party') {
      this.state.partyHP = Math.max(0, Math.min(this.state.maxPartyHP, value));
      this.addLog('dm', `DM set party HP to ${this.state.partyHP}`);
    } else {
      this.state.dmHP = Math.max(0, value);
      this.addLog('dm', `DM set DM HP to ${this.state.dmHP}`);
    }
    return { success: true, message: `HP updated` };
  }

  private dmMoveCard(cardInstanceId: string, fromZone: Zone, toZone: Zone, toPlayerId?: string): { success: boolean; message: string } {
    const card = this.findCardAnywhere(cardInstanceId);
    if (!card) return { success: false, message: 'Card not found' };

    // Remove from current location
    this.removeCardFromCurrentZone(card);

    // Add to new location
    card.zone = toZone;
    switch (toZone) {
      case Zone.Board:
        if (card.ownerId === 'dm') {
          this.state.board.dmCreatures.push(card);
        } else {
          this.state.board.playerCreatures.push(card);
        }
        break;
      case Zone.Graveyard:
        this.state.graveyard.push(card);
        break;
      case Zone.Exile:
        this.state.exile.push(card);
        break;
      case Zone.Hand:
        if (toPlayerId && this.state.players[toPlayerId]) {
          this.state.players[toPlayerId].hand.push(card);
        }
        break;
      case Zone.Deck:
        if (toPlayerId && this.state.players[toPlayerId]) {
          this.state.players[toPlayerId].deck.push(card);
        }
        break;
    }

    this.addLog('dm', `DM moved ${card.definition.name} to ${toZone}`);
    return { success: true, message: `Card moved to ${toZone}` };
  }

  private dmModifyCreature(cardInstanceId: string, mods: { attack?: number; health?: number; addKeywords?: Keyword[]; removeKeywords?: Keyword[] }): { success: boolean; message: string } {
    const creature = this.findCreatureOnBoard(cardInstanceId);
    if (!creature) return { success: false, message: 'Creature not found on board' };

    if (mods.attack !== undefined) creature.currentAttack = mods.attack;
    if (mods.health !== undefined) {
      creature.currentHealth = mods.health;
      creature.maxHealth = Math.max(creature.maxHealth || 0, mods.health);
    }
    if (mods.addKeywords) {
      for (const kw of mods.addKeywords) {
        if (!creature.activeKeywords.includes(kw)) {
          creature.activeKeywords.push(kw);
        }
      }
    }
    if (mods.removeKeywords) {
      creature.activeKeywords = creature.activeKeywords.filter(kw => !mods.removeKeywords!.includes(kw));
    }

    this.addLog('dm', `DM modified ${creature.definition.name}`);
    return { success: true, message: 'Creature modified' };
  }

  private dmGiveCard(cardDefinitionId: string, toPlayerId: string, toZone: Zone): { success: boolean; message: string } {
    // This would need the card database - placeholder
    this.addLog('dm', `DM gave card ${cardDefinitionId} to ${toPlayerId}`);
    return { success: true, message: 'Card given' };
  }

  private dmEndBattle(winner: 'party' | 'dm'): { success: boolean; message: string } {
    this.addLog('system', `DM ended battle. Winner: ${winner}`);
    return { success: true, message: `Battle ended. ${winner} wins!` };
  }

  // --- Helpers ---

  private findCreatureOnBoard(instanceId: string): CardInstance | undefined {
    return this.state.board.playerCreatures.find(c => c.instanceId === instanceId)
      || this.state.board.dmCreatures.find(c => c.instanceId === instanceId);
  }

  private findCardAnywhere(instanceId: string): CardInstance | undefined {
    // Check board
    const onBoard = this.findCreatureOnBoard(instanceId);
    if (onBoard) return onBoard;

    // Check graveyard
    const inGrave = this.state.graveyard.find(c => c.instanceId === instanceId);
    if (inGrave) return inGrave;

    // Check exile
    const inExile = this.state.exile.find(c => c.instanceId === instanceId);
    if (inExile) return inExile;

    // Check hands and decks
    for (const player of Object.values(this.state.players)) {
      const inHand = player.hand.find(c => c.instanceId === instanceId);
      if (inHand) return inHand;
      const inDeck = player.deck.find(c => c.instanceId === instanceId);
      if (inDeck) return inDeck;
    }

    // Check DM
    const inDMHand = this.state.dmState.hand.find(c => c.instanceId === instanceId);
    if (inDMHand) return inDMHand;
    const inDMDeck = this.state.dmState.deck.find(c => c.instanceId === instanceId);
    if (inDMDeck) return inDMDeck;

    return undefined;
  }

  private removeCardFromCurrentZone(card: CardInstance): void {
    // Remove from player creatures
    let idx = this.state.board.playerCreatures.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.board.playerCreatures.splice(idx, 1); return; }

    // Remove from DM creatures
    idx = this.state.board.dmCreatures.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.board.dmCreatures.splice(idx, 1); return; }

    // Remove from graveyard
    idx = this.state.graveyard.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.graveyard.splice(idx, 1); return; }

    // Remove from exile
    idx = this.state.exile.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.exile.splice(idx, 1); return; }

    // Remove from player hands/decks
    for (const player of Object.values(this.state.players)) {
      idx = player.hand.findIndex(c => c.instanceId === card.instanceId);
      if (idx !== -1) { player.hand.splice(idx, 1); return; }
      idx = player.deck.findIndex(c => c.instanceId === card.instanceId);
      if (idx !== -1) { player.deck.splice(idx, 1); return; }
    }

    // Remove from DM hand/deck
    idx = this.state.dmState.hand.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.dmState.hand.splice(idx, 1); return; }
    idx = this.state.dmState.deck.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) { this.state.dmState.deck.splice(idx, 1); return; }
  }

  private fireTriggers(event: string, source: CardInstance): void {
    // Trigger system - fires triggers based on event type
    if (!source.definition.triggers) return;
    for (const trigger of source.definition.triggers) {
      if (trigger.event === event) {
        this.addLog('trigger', `Trigger: ${source.definition.name} - ${trigger.effect}`);
      }
    }
  }

  private cleanupExpiredEffects(): void {
    for (const creature of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
      // Clean up buffs
      for (let i = creature.buffs.length - 1; i >= 0; i--) {
        const buff = creature.buffs[i];
        if (buff.duration === 'this_turn' as any || (buff.turnsRemaining !== undefined && buff.turnsRemaining <= 0)) {
          creature.currentAttack = (creature.currentAttack || 0) - buff.attackMod;
          creature.currentHealth = (creature.currentHealth || 0) - buff.healthMod;
          creature.buffs.splice(i, 1);
        } else if (buff.turnsRemaining !== undefined) {
          buff.turnsRemaining--;
        }
      }

      // Clean up debuffs
      for (let i = creature.debuffs.length - 1; i >= 0; i--) {
        const debuff = creature.debuffs[i];
        if (debuff.duration === 'this_turn' as any || (debuff.turnsRemaining !== undefined && debuff.turnsRemaining <= 0)) {
          creature.currentAttack = (creature.currentAttack || 0) - debuff.attackMod;
          creature.currentHealth = (creature.currentHealth || 0) - debuff.healthMod;
          creature.debuffs.splice(i, 1);
        } else if (debuff.turnsRemaining !== undefined) {
          debuff.turnsRemaining--;
        }
      }
    }

    // Clean up global active effects
    for (let i = this.state.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.state.activeEffects[i];
      if (effect.turnsRemaining !== undefined) {
        effect.turnsRemaining--;
        if (effect.turnsRemaining <= 0) {
          this.state.activeEffects.splice(i, 1);
        }
      }
    }
  }

  private getNextPhase(current: Phase): Phase {
    const order = [Phase.Draw, Phase.Mana, Phase.Play, Phase.Attack, Phase.Resolution, Phase.End];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  }

  private addLog(type: LogEntry['type'], message: string): void {
    this.state.combatLog.push({
      timestamp: Date.now(),
      message,
      type,
    });
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
