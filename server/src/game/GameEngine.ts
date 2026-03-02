import { v4 as uuid } from 'uuid';
import {
  GameState, Phase, PlayerState, CardInstance, CardDefinition,
  GameAction, DMAction, LogEntry, ManaPool, BoardState, Zone,
  Keyword, Buff, Debuff, ActiveEffect, CardType, DMState,
  DurationType, TriggerEvent,
  HP_PER_PLAYER, STARTING_HAND_SIZE, MAX_HAND_SIZE, MAX_MULLIGANS,
} from '@deck-and-dominion/shared';

// Keyword lookup for text parsing
const KEYWORD_MAP: Record<string, Keyword> = {
  'haste': Keyword.Haste,
  'trample': Keyword.Trample,
  'deathtouch': Keyword.Deathtouch,
  'lifelink': Keyword.Lifelink,
  'first strike': Keyword.FirstStrike,
  'taunt': Keyword.Taunt,
  'persistent': Keyword.Persistent,
  'tower': Keyword.Tower,
  'flying': Keyword.Flying,
};

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

  // ============================================================
  // COMPREHENSIVE CARD EFFECT RESOLUTION SYSTEM
  // Handles: damage, draw, heal, mana, shield, buffs, debuffs,
  // keywords, tokens, sacrifice, resurrection, exile, counter,
  // untap, bounce, destroy, and conditional effects.
  // ============================================================

  private resolveSpellEffect(card: CardInstance, casterId: string, targets?: string[]): void {
    this.resolveEffect(card.definition.effectText, card, casterId, targets);
  }

  private resolveEffect(effectText: string, source: CardInstance, casterId: string, targets?: string[]): void {
    const effect = effectText.toLowerCase();

    // --- Deal damage ---
    if (effect.includes('damage')) {
      this.resolveEffectDamage(effect, source, casterId, targets);
    }

    // --- Draw cards ---
    if (effect.includes('draw')) {
      this.resolveEffectDraw(effect, source, casterId);
    }

    // --- Restore / Heal HP ---
    if (effect.includes('restore') || effect.includes('heal')) {
      this.resolveEffectHeal(effect, source, casterId, targets);
    }

    // --- Generate mana ---
    if (effect.includes('generate') && effect.includes('mana')) {
      this.resolveEffectMana(effect, source);
    }

    // --- Shield ---
    if (effect.includes('shield') && !effect.includes('shieldvalue')) {
      this.resolveEffectShield(effect, source, targets);
    }

    // --- Buff: +X/+Y ---
    if (effect.includes('+') && effect.includes('/+')) {
      this.resolveEffectBuff(effect, source, casterId, targets);
    }

    // --- Debuff: -X/-Y ---
    if (effect.includes('-') && effect.includes('/-')) {
      this.resolveEffectDebuff(effect, source, targets);
    }

    // --- Grant keywords ---
    if (effect.includes('gain') || effect.includes('give') || effect.includes('grant')) {
      this.resolveEffectKeywords(effect, source, targets);
    }

    // --- Create tokens ---
    if (effect.includes('create') || effect.includes('summon')) {
      this.resolveEffectTokens(effect, source, casterId);
    }

    // --- Destroy creature ---
    if (effect.includes('destroy')) {
      this.resolveEffectDestroy(effect, source, targets);
    }

    // --- Return to hand (bounce) ---
    if (effect.includes('return') && effect.includes('hand')) {
      this.resolveEffectBounce(effect, source, casterId, targets);
    }

    // --- Untap ---
    if (effect.includes('untap')) {
      this.resolveEffectUntap(effect, source, casterId, targets);
    }

    // --- Sacrifice ---
    if (effect.includes('sacrifice')) {
      this.resolveEffectSacrifice(effect, source, casterId, targets);
    }

    // --- Resurrection / Graveyard return to board ---
    if (effect.includes('graveyard') && effect.includes('board')) {
      this.resolveEffectResurrection(effect, source, casterId, targets);
    }

    // --- Exile from graveyard ---
    if (effect.includes('exile')) {
      this.resolveEffectExile(effect, source);
    }

    // --- Track persistent enchantment effects ---
    if (source.definition.cardType === CardType.Enchantment && effect.includes('persistent')) {
      this.state.activeEffects.push({
        id: uuid(),
        source: source.instanceId,
        effect: effectText,
        duration: DurationType.WhileAlive,
      });
    }
  }

  // --- Damage resolution ---
  private resolveEffectDamage(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    // "deal X damage to target" / "deal X damage to all enemy creatures"
    const dmgMatch = effect.match(/deal\s+(\d+)\s+damage/);
    if (dmgMatch) {
      const damage = parseInt(dmgMatch[1]);

      if (effect.includes('all enemy') || effect.includes('each enemy')) {
        const enemies = source.ownerId === 'dm'
          ? [...this.state.board.playerCreatures]
          : [...this.state.board.dmCreatures];
        for (const enemy of enemies) {
          if (enemy.definition.cardType === CardType.Creature) {
            this.dealDamageToCreature(source, enemy, damage);
          }
        }
        this.addLog('damage', `${source.definition.name} deals ${damage} damage to all enemy creatures`);
      } else if (effect.includes('all creatures') || effect.includes('each creature')) {
        const allCreatures = [...this.state.board.playerCreatures, ...this.state.board.dmCreatures];
        for (const creature of allCreatures) {
          if (creature.definition.cardType === CardType.Creature) {
            this.dealDamageToCreature(source, creature, damage);
          }
        }
        this.addLog('damage', `${source.definition.name} deals ${damage} damage to all creatures`);
      } else if (targets && targets.length > 0) {
        for (const targetId of targets) {
          if (targetId === 'dm') {
            this.state.dmHP = Math.max(0, this.state.dmHP - damage);
            this.addLog('damage', `${source.definition.name} deals ${damage} damage to DM`);
          } else {
            const target = this.findCreatureOnBoard(targetId);
            if (target) {
              this.dealDamageToCreature(source, target, damage);
            }
          }
        }
      }
      return;
    }

    // "deal damage equal to creatures in graveyard (max X)"
    const equalGraveyardMatch = effect.match(/deal damage (?:to target )?equal to (?:the number of )?creatures? in graveyard/);
    if (equalGraveyardMatch && targets && targets.length > 0) {
      let damage = this.getGraveyardCreatureCount();
      const maxMatch = effect.match(/\(max\s+(\d+)\)/);
      if (maxMatch) damage = Math.min(damage, parseInt(maxMatch[1]));

      for (const targetId of targets) {
        if (targetId === 'dm') {
          this.state.dmHP = Math.max(0, this.state.dmHP - damage);
        } else {
          const target = this.findCreatureOnBoard(targetId);
          if (target) this.dealDamageToCreature(source, target, damage);
        }
      }
      this.addLog('damage', `${source.definition.name} deals ${damage} graveyard-scaled damage`);
      return;
    }

    // "deal damage equal to its attack to target"
    if (effect.includes('deal damage equal to') && effect.includes('attack') && targets && targets.length > 1) {
      const sacrificed = this.findCreatureOnBoard(targets[0]);
      if (sacrificed) {
        const damage = sacrificed.currentAttack || 0;
        for (let i = 1; i < targets.length; i++) {
          const target = this.findCreatureOnBoard(targets[i]);
          if (target) this.dealDamageToCreature(source, target, damage);
        }
      }
    }
  }

  // --- Draw resolution ---
  private resolveEffectDraw(effect: string, source: CardInstance, casterId: string): void {
    const drawMatch = effect.match(/draw\s+(\d+)\s+card/);
    if (!drawMatch) return;

    const count = parseInt(drawMatch[1]);

    // Check for graveyard conditional: "If graveyard has 5+ cards, draw X instead"
    const condGrave = effect.match(/if graveyard has (\d+)\+?\s*cards?,?\s*draw\s+(\d+)\s+instead/);
    if (condGrave) {
      const threshold = parseInt(condGrave[1]);
      const altCount = parseInt(condGrave[2]);
      const finalCount = this.state.graveyard.length >= threshold ? altCount : count;
      for (let i = 0; i < finalCount; i++) this.drawCard(casterId);
      this.addLog('system', `${this.state.players[casterId]?.name} draws ${finalCount} card(s)`);
      return;
    }

    for (let i = 0; i < count; i++) this.drawCard(casterId);
    this.addLog('system', `${this.state.players[casterId]?.name} draws ${count} card(s)`);
  }

  // --- Heal resolution ---
  private resolveEffectHeal(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    // "restore X party HP" / "restore X HP"
    const partyHealMatch = effect.match(/restore\s+(\d+)\s+(?:party\s+)?hp/);
    if (partyHealMatch) {
      const amount = parseInt(partyHealMatch[1]);
      this.state.partyHP = Math.min(this.state.maxPartyHP, this.state.partyHP + amount);
      this.addLog('heal', `${source.definition.name} restores ${amount} party HP`);
    }

    // "restore target creature to full health"
    if (effect.includes('restore target creature to full health') || effect.includes('full health')) {
      if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target && target.currentHealth !== undefined && target.maxHealth !== undefined) {
            target.currentHealth = target.maxHealth;
            this.addLog('heal', `${target.definition.name} restored to full health`);
          }
        }
      } else if (effect.includes('all friendly')) {
        for (const creature of this.state.board.playerCreatures) {
          if (creature.definition.cardType === CardType.Creature && creature.currentHealth !== undefined && creature.maxHealth !== undefined) {
            creature.currentHealth = creature.maxHealth;
          }
        }
        this.addLog('heal', 'All friendly creatures restored to full health');
      }
    }
  }

  // --- Mana generation ---
  private resolveEffectMana(effect: string, source: CardInstance): void {
    const manaMatch = effect.match(/generate\s+(\d+)\s+(?:(burst|persistent)\s+)?mana/);
    if (manaMatch) {
      const amount = parseInt(manaMatch[1]);
      if (manaMatch[2] === 'persistent') {
        this.state.manaPool.persistent += amount;
        this.addLog('mana', `${source.definition.name} generates ${amount} persistent mana`);
      } else {
        this.state.manaPool.burst += amount;
        this.addLog('mana', `${source.definition.name} generates ${amount} burst mana`);
      }
    }
  }

  // --- Shield ---
  private resolveEffectShield(effect: string, source: CardInstance, targets?: string[]): void {
    const shieldMatch = effect.match(/shield\s+(\d+)/i);
    if (!shieldMatch) return;
    const amount = parseInt(shieldMatch[1]);

    if (effect.includes('all friendly')) {
      for (const creature of this.state.board.playerCreatures) {
        if (creature.definition.cardType === CardType.Creature) {
          creature.currentShield = (creature.currentShield || 0) + amount;
        }
      }
      this.addLog('system', `All friendly creatures gain Shield ${amount}`);
    } else if (targets && targets.length > 0) {
      for (const targetId of targets) {
        const target = this.findCreatureOnBoard(targetId);
        if (target) {
          target.currentShield = (target.currentShield || 0) + amount;
          this.addLog('system', `${target.definition.name} gains Shield ${amount}`);
        }
      }
    }
  }

  // --- Buff: +X/+Y ---
  private resolveEffectBuff(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    const buffMatch = effect.match(/\+(\d+)\/\+(\d+)/);
    if (!buffMatch) return;

    const atkBuff = parseInt(buffMatch[1]);
    const hpBuff = parseInt(buffMatch[2]);
    const isPermanent = effect.includes('permanent');
    const duration = isPermanent ? DurationType.Permanent : DurationType.ThisTurn;

    if (effect.includes('all friendly creatures') || effect.includes('all other friendly')) {
      for (const creature of this.state.board.playerCreatures) {
        if (creature.definition.cardType === CardType.Creature) {
          if (effect.includes('all other') && creature.instanceId === source.instanceId) continue;
          this.applyBuff(creature, atkBuff, hpBuff, duration, source.instanceId);
        }
      }
      this.addLog('system', `All friendly creatures get +${atkBuff}/+${hpBuff}${isPermanent ? ' permanently' : ' this turn'}`);
    } else if (targets && targets.length > 0) {
      for (const targetId of targets) {
        const target = this.findCreatureOnBoard(targetId);
        if (target) {
          this.applyBuff(target, atkBuff, hpBuff, duration, source.instanceId);
          this.addLog('system', `${target.definition.name} gets +${atkBuff}/+${hpBuff}`);
        }
      }
    }
  }

  // --- Debuff: -X/-Y ---
  private resolveEffectDebuff(effect: string, source: CardInstance, targets?: string[]): void {
    const debuffMatch = effect.match(/-(\d+)\/-(\d+)/);
    if (!debuffMatch) return;

    const atkDebuff = parseInt(debuffMatch[1]);
    const hpDebuff = parseInt(debuffMatch[2]);
    const isPermanent = effect.includes('permanent');
    const duration = isPermanent ? DurationType.Permanent : DurationType.ThisTurn;

    if (effect.includes('all enemy creatures') || effect.includes('each enemy')) {
      const enemies = source.ownerId === 'dm'
        ? [...this.state.board.playerCreatures]
        : [...this.state.board.dmCreatures];
      for (const enemy of enemies) {
        if (enemy.definition.cardType === CardType.Creature) {
          this.applyDebuff(enemy, atkDebuff, hpDebuff, duration, source.instanceId);
        }
      }
      this.addLog('system', `All enemy creatures get -${atkDebuff}/-${hpDebuff}`);
    } else if (targets && targets.length > 0) {
      for (const targetId of targets) {
        const target = this.findCreatureOnBoard(targetId);
        if (target) {
          this.applyDebuff(target, atkDebuff, hpDebuff, duration, source.instanceId);
          this.addLog('system', `${target.definition.name} gets -${atkDebuff}/-${hpDebuff}`);
        }
      }
    }
  }

  // --- Keyword granting ---
  private resolveEffectKeywords(effect: string, source: CardInstance, targets?: string[]): void {
    const isPermanent = effect.includes('permanently');
    const duration = isPermanent ? DurationType.Permanent : DurationType.ThisTurn;

    for (const [kwText, kwEnum] of Object.entries(KEYWORD_MAP)) {
      if (!effect.includes(kwText)) continue;
      // Only match if it's a grant pattern, not just a mention
      if (!effect.match(new RegExp(`(?:gain|give|grant|gets?)\\s+.*?${kwText}`, 'i'))) continue;

      if (effect.includes('all friendly')) {
        for (const creature of this.state.board.playerCreatures) {
          if (creature.definition.cardType === CardType.Creature) {
            this.grantKeyword(creature, kwEnum, duration);
          }
        }
        this.addLog('system', `All friendly creatures gain ${kwEnum}`);
      } else if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target) {
            this.grantKeyword(target, kwEnum, duration);
            this.addLog('system', `${target.definition.name} gains ${kwEnum}`);
          }
        }
      }
    }
  }

  // --- Token creation ---
  private resolveEffectTokens(effect: string, source: CardInstance, casterId: string): void {
    // Match: "create/summon [count] X/Y Name token(s)"
    const tokenMatch = effect.match(/(?:create|summon)\s+(?:a\s+|an\s+)?(?:(\d+|two|three|four)\s+)?(\d+)\/(\d+)\s+([\w\s]+?)\s*tokens?/i);
    if (!tokenMatch) return;

    let count = 1;
    const countStr = tokenMatch[1];
    if (countStr === 'two') count = 2;
    else if (countStr === 'three') count = 3;
    else if (countStr === 'four') count = 4;
    else if (countStr) count = parseInt(countStr) || 1;

    const atk = parseInt(tokenMatch[2]);
    const hp = parseInt(tokenMatch[3]);
    const name = tokenMatch[4].trim();

    const tokenKeywords: Keyword[] = [];
    if (effect.includes('with haste') || (effect.includes('haste') && effect.includes('token'))) tokenKeywords.push(Keyword.Haste);
    if (effect.includes('with taunt') || (effect.includes('taunt') && effect.includes('token'))) tokenKeywords.push(Keyword.Taunt);
    if (effect.includes('with trample')) tokenKeywords.push(Keyword.Trample);

    for (let i = 0; i < count; i++) {
      this.createToken(name, atk, hp, casterId, tokenKeywords);
    }
    this.addLog('system', `${source.definition.name} creates ${count} ${atk}/${hp} ${name} token(s)`);
  }

  // --- Destroy creature ---
  private resolveEffectDestroy(effect: string, source: CardInstance, targets?: string[]): void {
    if (effect.includes('destroy target creature') || effect.includes('destroy target enemy')) {
      if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target) this.destroyCreature(target);
        }
      }
    }

    if (effect.includes('destroy all creatures') || effect.includes('destroy all enemy creatures')) {
      if (effect.includes('all enemy')) {
        const enemies = source.ownerId === 'dm'
          ? [...this.state.board.playerCreatures]
          : [...this.state.board.dmCreatures];
        for (const enemy of enemies) {
          if (enemy.definition.cardType === CardType.Creature) this.destroyCreature(enemy);
        }
      } else {
        const all = [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]
          .filter(c => c.definition.cardType === CardType.Creature && c.instanceId !== source.instanceId);
        for (const creature of all) this.destroyCreature(creature);
      }
    }

    // "destroy target equipment"
    if (effect.includes('destroy target equipment') && targets && targets.length > 0) {
      for (const creature of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
        for (let i = creature.equipment.length - 1; i >= 0; i--) {
          if (creature.equipment[i].instanceId === targets[0]) {
            const equip = creature.equipment.splice(i, 1)[0];
            equip.zone = Zone.Graveyard;
            this.state.graveyard.push(equip);
            this.addLog('system', `${equip.definition.name} destroyed`);
          }
        }
      }
    }
  }

  // --- Return to hand (bounce) ---
  private resolveEffectBounce(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    // "return target creature from graveyard to hand"
    if (effect.includes('graveyard') && effect.includes('hand')) {
      // Count-based: "return 3 creatures from graveyard to hand"
      const countMatch = effect.match(/return\s+(\d+)\s+creatures?\s+from\s+graveyard/);
      if (countMatch) {
        const count = parseInt(countMatch[1]);
        const graveyardCreatures = this.state.graveyard
          .filter(c => c.definition.cardType === CardType.Creature)
          .slice(0, count);
        for (const card of graveyardCreatures) {
          this.resurrectFromGraveyard(card, Zone.Hand, casterId);
        }
        return;
      }

      // Target-based
      if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const card = this.state.graveyard.find(c => c.instanceId === targetId);
          if (card) this.resurrectFromGraveyard(card, Zone.Hand, casterId);
        }
      }
      return;
    }

    // "return target creature to hand" (from board)
    if (effect.includes('return target creature to') && effect.includes('hand')) {
      if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target) this.bounceToHand(target);
        }
      }
    }

    // "return target friendly creature to hand"
    if (effect.includes('return target friendly creature') && effect.includes('hand')) {
      if (targets && targets.length > 0) {
        const target = this.findCreatureOnBoard(targets[0]);
        if (target) this.bounceToHand(target);
      }
    }
  }

  // --- Untap ---
  private resolveEffectUntap(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    if (effect.includes('untap all friendly') || effect.includes('untap all creatures')) {
      for (const creature of this.state.board.playerCreatures) {
        if (creature.ownerId === casterId || !effect.includes('friendly')) {
          creature.tapped = false;
          creature.canAttack = true;
        }
      }
      this.addLog('system', 'All friendly creatures untapped');
    } else if (effect.includes('untap target')) {
      if (targets && targets.length > 0) {
        for (const targetId of targets) {
          const target = this.findCreatureOnBoard(targetId);
          if (target) {
            target.tapped = false;
            target.canAttack = true;
            this.addLog('system', `${target.definition.name} untapped`);
          }
        }
      }
    }
  }

  // --- Sacrifice ---
  private resolveEffectSacrifice(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    // "sacrifice all other friendly creatures"
    if (effect.includes('sacrifice all') && (effect.includes('friendly') || effect.includes('other'))) {
      const toSacrifice = this.state.board.playerCreatures
        .filter(c => c.ownerId === casterId && c.instanceId !== source.instanceId && c.definition.cardType === CardType.Creature);
      for (const creature of [...toSacrifice]) {
        this.sacrificeCreature(creature, casterId);
      }
      return;
    }

    // "sacrifice X creatures"
    const sacCountMatch = effect.match(/sacrifice\s+(\d+)\s+creatures?/);
    if (sacCountMatch && targets && targets.length > 0) {
      const count = parseInt(sacCountMatch[1]);
      for (let i = 0; i < Math.min(count, targets.length); i++) {
        const target = this.findCreatureOnBoard(targets[i]);
        if (target && target.ownerId === casterId) this.sacrificeCreature(target, casterId);
      }
      return;
    }

    // "sacrifice a creature" / "sacrifice target creature"
    if (effect.match(/sacrifice\s+(?:a|target)\s+creature/) && targets && targets.length > 0) {
      const target = this.findCreatureOnBoard(targets[0]);
      if (target && target.ownerId === casterId) this.sacrificeCreature(target, casterId);
    }
  }

  // --- Resurrection ---
  private resolveEffectResurrection(effect: string, source: CardInstance, casterId: string, targets?: string[]): void {
    // "return all creatures from graveyard to board"
    if (effect.includes('return all creatures from graveyard')) {
      const costMatch = effect.match(/cost\s+(\d+)\s+or\s+less/);
      const maxCost = costMatch ? parseInt(costMatch[1]) : Infinity;
      const graveyardCreatures = [...this.state.graveyard].filter(
        c => c.definition.cardType === CardType.Creature && c.definition.manaCost <= maxCost
      );
      for (const card of graveyardCreatures) {
        this.resurrectFromGraveyard(card, Zone.Board, casterId);
        if (effect.includes('with 1 health') && card.currentHealth !== undefined) card.currentHealth = 1;
      }
      return;
    }

    // "return target creature from graveyard to board"
    if (targets && targets.length > 0) {
      for (const targetId of targets) {
        const card = this.state.graveyard.find(c => c.instanceId === targetId);
        if (card) {
          this.resurrectFromGraveyard(card, Zone.Board, casterId);
          if (effect.includes('with 1 health') && card.currentHealth !== undefined) card.currentHealth = 1;
          if (effect.includes('destroy it at end of turn')) {
            card.buffs.push({
              id: uuid(), source: 'end_of_turn_destroy', attackMod: 0, healthMod: 0,
              keywords: [], duration: DurationType.ThisTurn, turnsRemaining: 1,
            });
          }
        }
      }
    }
  }

  // --- Exile from graveyard ---
  private resolveEffectExile(effect: string, source: CardInstance): void {
    if (effect.includes('exile entire graveyard') || effect.includes('exile all cards from graveyard')) {
      const count = this.state.graveyard.length;
      while (this.state.graveyard.length > 0) {
        const card = this.state.graveyard.pop()!;
        card.zone = Zone.Exile;
        this.state.exile.push(card);
      }
      if (count > 0) this.addLog('system', `${source.definition.name} exiles ${count} card(s) from graveyard`);
      return;
    }

    const exileMatch = effect.match(/exile\s+(\d+)\s+cards?\s*(?:from\s+)?(?:the\s+)?(?:graveyard)?/);
    if (exileMatch) {
      const count = parseInt(exileMatch[1]);
      let exiled = 0;
      for (let i = 0; i < count && this.state.graveyard.length > 0; i++) {
        const card = this.state.graveyard.pop()!;
        card.zone = Zone.Exile;
        this.state.exile.push(card);
        exiled++;
      }
      if (exiled > 0) this.addLog('system', `${source.definition.name} exiles ${exiled} card(s) from graveyard`);
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
      this.applyBuff(creature, atkBuff, hpBuff, DurationType.WhileAlive, equipment.instanceId);
    }

    // Parse -X patterns (e.g. "but -1 max health")
    const penaltyMatch = effect.match(/but\s+-(\d+)\s+(?:max\s+)?health/);
    if (penaltyMatch) {
      const hpPenalty = parseInt(penaltyMatch[1]);
      this.applyDebuff(creature, 0, hpPenalty, DurationType.WhileAlive, equipment.instanceId);
    }

    // Parse Shield X grants
    const shieldMatch = effect.match(/shield\s+(\d+)/i);
    if (shieldMatch) {
      creature.currentShield = (creature.currentShield || 0) + parseInt(shieldMatch[1]);
    }

    // Parse keyword grants
    for (const [kwText, kwEnum] of Object.entries(KEYWORD_MAP)) {
      if (kwText === 'persistent' || kwText === 'shield') continue; // skip non-combat keywords
      if (effect.includes(kwText)) {
        this.grantKeyword(creature, kwEnum, DurationType.WhileAlive);
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
    const effectText = source.definition.effectText.toLowerCase();

    // --- Structured triggers from definition ---
    if (source.definition.triggers) {
      for (const trigger of source.definition.triggers) {
        if (trigger.event === event) {
          this.addLog('trigger', `Trigger: ${source.definition.name} - ${trigger.effect}`);
          this.resolveEffect(trigger.effect, source, source.ownerId);
        }
      }
    }

    // --- Effect-text based triggers (parsed from effectText) ---

    // ON PLAY triggers
    if (event === 'on_play') {
      const onPlayMatch = effectText.match(/on play:\s*(.+?)(?:\.|$)/i);
      if (onPlayMatch) {
        this.addLog('trigger', `On Play: ${source.definition.name}`);
        this.resolveEffect(onPlayMatch[1], source, source.ownerId);
      }
    }

    // ON DEATH triggers
    if (event === 'on_death') {
      const onDeathMatch = effectText.match(/on death:\s*(.+?)(?:\.|$)/i);
      if (onDeathMatch) {
        this.addLog('trigger', `On Death: ${source.definition.name}`);
        this.resolveEffect(onDeathMatch[1], source, source.ownerId);
      }

      // "Destroyed at end of turn" creatures (already dead, so no action needed)
      // Check for "on death: return this to your hand"
      if (effectText.includes('on death') && effectText.includes('return this to your hand')) {
        const player = this.state.players[source.ownerId];
        if (player && player.hand.length < MAX_HAND_SIZE) {
          const idx = this.state.graveyard.findIndex(c => c.instanceId === source.instanceId);
          if (idx !== -1) {
            this.state.graveyard.splice(idx, 1);
            source.zone = Zone.Hand;
            source.currentAttack = source.definition.attack;
            source.currentHealth = source.definition.health;
            source.maxHealth = source.definition.health;
            source.buffs = [];
            source.debuffs = [];
            source.poisonStacks = [];
            player.hand.push(source);
            this.addLog('trigger', `${source.definition.name} returns to hand on death`);
          }
        }
      }

      // Process enchantment triggers for creature death
      this.processEnchantmentTrigger('creature_death', source, source.ownerId);
    }

    // ON ATTACK triggers
    if (event === 'on_attack') {
      const onAttackMatch = effectText.match(/on attack:\s*(.+?)(?:\.|$)/i);
      if (onAttackMatch) {
        this.addLog('trigger', `On Attack: ${source.definition.name}`);
        this.resolveEffect(onAttackMatch[1], source, source.ownerId);
      }

      // "when attacks, defender gets -X/-Y"
      if (effectText.includes('when attacks') && effectText.includes('defender gets')) {
        const debuffMatch = effectText.match(/-(\d+)\/-(\d+)/);
        if (debuffMatch) {
          // The defender was the last combat target - apply debuff via active effects
          this.addLog('trigger', `${source.definition.name} weakens the defender`);
        }
      }
    }

    // ON SACRIFICE triggers
    if (event === 'on_sacrifice') {
      // Process enchantment triggers for sacrifice
      this.processEnchantmentTrigger('sacrifice', source, source.ownerId);
    }

    // START OF TURN triggers
    if (event === 'start_of_turn') {
      if (effectText.includes('at start of turn') || effectText.includes('at the start of turn')) {
        const startMatch = effectText.match(/at (?:the )?start of turn[,:]\s*(.+?)(?:\.|$)/i);
        if (startMatch) {
          this.addLog('trigger', `Start of turn: ${source.definition.name}`);
          this.resolveEffect(startMatch[1], source, source.ownerId);
        }
      }
    }

    // END OF TURN triggers
    if (event === 'end_of_turn') {
      if (effectText.includes('at end of turn') || effectText.includes('at the end of turn')) {
        const endMatch = effectText.match(/at (?:the )?end of (?:each )?turn[,:]\s*(.+?)(?:\.|$)/i);
        if (endMatch) {
          this.addLog('trigger', `End of turn: ${source.definition.name}`);
          this.resolveEffect(endMatch[1], source, source.ownerId);
        }
      }

      // "destroyed at end of turn"
      if (effectText.includes('destroyed at end of turn') || effectText.includes('destroy it at end of turn')) {
        this.destroyCreature(source);
      }

      // Check buffs tagged for end-of-turn destruction
      const destroyBuff = source.buffs.find(b => b.source === 'end_of_turn_destroy');
      if (destroyBuff) {
        this.destroyCreature(source);
      }
    }

    // WHEN ANOTHER CREATURE DIES triggers
    if (event === 'when_another_creature_dies') {
      if (effectText.includes('whenever another friendly creature dies') ||
          effectText.includes('whenever a friendly creature dies')) {
        const whenDiesMatch = effectText.match(/whenever (?:another )?friendly creature dies[,:]\s*(.+?)(?:\.|$)/i);
        if (whenDiesMatch) {
          this.resolveEffect(whenDiesMatch[1], source, source.ownerId);
        }
      }

      // "gets +X/+Y for each creature in graveyard" - recalculate
      if (effectText.includes('for each creature in graveyard')) {
        // These are continuous effects that scale, handled by stat recalculation
        const gravCount = this.getGraveyardCreatureCount();
        const scaleMatch = effectText.match(/\+(\d+)\/\+(\d+)\s+for each creature in graveyard/);
        if (scaleMatch) {
          // Reset to base and recalculate
          const baseAtk = source.definition.attack || 0;
          const baseHp = source.definition.health || 0;
          const maxMatch = effectText.match(/\(max\s+\+(\d+)\)/);
          const maxBonus = maxMatch ? parseInt(maxMatch[1]) : Infinity;
          const bonus = Math.min(gravCount * parseInt(scaleMatch[1]), maxBonus);
          source.currentAttack = baseAtk + bonus;
        }
      }
    }
  }

  private cleanupExpiredEffects(): void {
    for (const creature of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
      // Clean up buffs
      for (let i = creature.buffs.length - 1; i >= 0; i--) {
        const buff = creature.buffs[i];
        if (buff.duration === DurationType.ThisTurn || (buff.turnsRemaining !== undefined && buff.turnsRemaining <= 0)) {
          // Reverse stat modifications
          creature.currentAttack = (creature.currentAttack || 0) - buff.attackMod;
          creature.currentHealth = (creature.currentHealth || 0) - buff.healthMod;

          // Remove granted keywords
          if (buff.keywords && buff.keywords.length > 0) {
            for (const kw of buff.keywords) {
              const kwIdx = creature.activeKeywords.indexOf(kw);
              if (kwIdx !== -1) creature.activeKeywords.splice(kwIdx, 1);
            }
          }

          creature.buffs.splice(i, 1);
        } else if (buff.turnsRemaining !== undefined) {
          buff.turnsRemaining--;
        }
      }

      // Clean up debuffs
      for (let i = creature.debuffs.length - 1; i >= 0; i--) {
        const debuff = creature.debuffs[i];
        if (debuff.duration === DurationType.ThisTurn || (debuff.turnsRemaining !== undefined && debuff.turnsRemaining <= 0)) {
          // Reverse stat modifications (debuffs subtract, so reversal adds back)
          creature.currentAttack = (creature.currentAttack || 0) + debuff.attackMod;
          creature.currentHealth = (creature.currentHealth || 0) + debuff.healthMod;
          creature.debuffs.splice(i, 1);
        } else if (debuff.turnsRemaining !== undefined) {
          debuff.turnsRemaining--;
        }
      }
    }

    // Clean up global active effects and remove enchantment effects whose source left the board
    for (let i = this.state.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.state.activeEffects[i];

      // Check if source enchantment is still on board
      if (effect.duration === DurationType.WhileAlive) {
        const sourceOnBoard = this.findCreatureOnBoard(effect.source);
        if (!sourceOnBoard) {
          this.state.activeEffects.splice(i, 1);
          continue;
        }
      }

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

  // ============================================================
  // HELPER METHODS: Token, Sacrifice, Resurrection, Buff/Debuff
  // ============================================================

  private createToken(name: string, attack: number, health: number, ownerId: string, keywords: Keyword[] = []): CardInstance {
    const token: CardInstance = {
      instanceId: uuid(),
      definitionId: `token_${name.toLowerCase().replace(/\s+/g, '_')}`,
      definition: {
        id: `token_${name.toLowerCase().replace(/\s+/g, '_')}`,
        name: `${name} Token`,
        cardClass: 'Neutral' as any,
        archetype: 'Token',
        set: 'Token',
        cardType: CardType.Token,
        rarity: 'Common' as any,
        manaCost: 0,
        attack,
        health,
        shieldValue: 0,
        poisonValue: 0,
        effectText: '',
        keywords: [...keywords],
        triggers: [],
      },
      currentAttack: attack,
      currentHealth: health,
      maxHealth: health,
      currentShield: 0,
      activeKeywords: [...keywords],
      equipment: [],
      buffs: [],
      debuffs: [],
      tapped: false,
      canAttack: keywords.includes(Keyword.Haste),
      summonedThisTurn: true,
      poisonStacks: [],
      ownerId,
      zone: Zone.Board,
    };

    if (ownerId === 'dm') {
      this.state.board.dmCreatures.push(token);
    } else {
      this.state.board.playerCreatures.push(token);
    }
    return token;
  }

  private sacrificeCreature(creature: CardInstance, casterId: string): void {
    this.addLog('system', `${creature.definition.name} is sacrificed`);

    // Remove from board
    const playerIdx = this.state.board.playerCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (playerIdx !== -1) this.state.board.playerCreatures.splice(playerIdx, 1);
    const dmIdx = this.state.board.dmCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (dmIdx !== -1) this.state.board.dmCreatures.splice(dmIdx, 1);

    // Move equipment to graveyard
    for (const equip of creature.equipment) {
      equip.zone = Zone.Graveyard;
      this.state.graveyard.push(equip);
    }
    creature.equipment = [];

    // Move to graveyard
    creature.zone = Zone.Graveyard;
    this.state.graveyard.push(creature);

    // Fire sacrifice triggers on the sacrificed creature
    this.fireTriggers('on_sacrifice', creature);

    // Fire on_death too since sacrifice counts as dying
    this.fireTriggers('on_death', creature);

    // Fire "when another creature dies" for all remaining board creatures
    for (const c of [...this.state.board.playerCreatures, ...this.state.board.dmCreatures]) {
      this.fireTriggers('when_another_creature_dies', c);
    }
  }

  private resurrectFromGraveyard(card: CardInstance, toZone: Zone, ownerId: string): void {
    const idx = this.state.graveyard.findIndex(c => c.instanceId === card.instanceId);
    if (idx === -1) return;

    this.state.graveyard.splice(idx, 1);
    card.zone = toZone;

    if (toZone === Zone.Board) {
      // Reset creature state for board
      if (card.currentHealth !== undefined && card.maxHealth !== undefined) {
        card.currentHealth = card.maxHealth;
      }
      card.tapped = false;
      card.canAttack = false;
      card.summonedThisTurn = true;
      card.buffs = [];
      card.debuffs = [];
      card.poisonStacks = [];
      card.activeKeywords = [...(card.definition.keywords || [])];

      if (card.ownerId === 'dm') {
        this.state.board.dmCreatures.push(card);
      } else {
        this.state.board.playerCreatures.push(card);
      }

      // Check for resurrection bonuses
      const resEffect = card.definition.effectText.toLowerCase();
      if (resEffect.includes('when resurrected')) {
        const resBuff = resEffect.match(/when resurrected[,.]?\s*(?:gets?|gains?)\s*\+(\d+)\/\+(\d+)/);
        if (resBuff) {
          this.applyBuff(card, parseInt(resBuff[1]), parseInt(resBuff[2]), DurationType.Permanent, card.instanceId);
        }
        if (resEffect.includes('taunt') && resEffect.includes('resurrected')) {
          this.grantKeyword(card, Keyword.Taunt, DurationType.Permanent);
        }
      }

      this.addLog('system', `${card.definition.name} is resurrected to the board`);
    } else if (toZone === Zone.Hand) {
      const player = this.state.players[ownerId];
      if (player && player.hand.length < MAX_HAND_SIZE) {
        // Reset card state
        card.currentAttack = card.definition.attack;
        card.currentHealth = card.definition.health;
        card.maxHealth = card.definition.health;
        card.activeKeywords = [...(card.definition.keywords || [])];
        card.buffs = [];
        card.debuffs = [];
        card.poisonStacks = [];
        player.hand.push(card);
        this.addLog('system', `${card.definition.name} returned from graveyard to hand`);
      }
    }
  }

  private applyBuff(creature: CardInstance, atkMod: number, hpMod: number, duration: DurationType, sourceId: string): void {
    creature.buffs.push({
      id: uuid(),
      source: sourceId,
      attackMod: atkMod,
      healthMod: hpMod,
      keywords: [],
      duration,
      turnsRemaining: duration === DurationType.ThisTurn ? 1 : undefined,
    });
    creature.currentAttack = (creature.currentAttack || 0) + atkMod;
    creature.currentHealth = (creature.currentHealth || 0) + hpMod;
    if (duration !== DurationType.ThisTurn) {
      creature.maxHealth = (creature.maxHealth || 0) + hpMod;
    }
  }

  private applyDebuff(creature: CardInstance, atkMod: number, hpMod: number, duration: DurationType, sourceId: string): void {
    creature.debuffs.push({
      id: uuid(),
      source: sourceId,
      attackMod: atkMod,
      healthMod: hpMod,
      duration,
      turnsRemaining: duration === DurationType.ThisTurn ? 1 : undefined,
    });
    creature.currentAttack = Math.max(0, (creature.currentAttack || 0) - atkMod);
    creature.currentHealth = (creature.currentHealth || 0) - hpMod;

    // Check if debuff kills the creature
    if (creature.currentHealth !== undefined && creature.currentHealth <= 0) {
      this.destroyCreature(creature);
    }
  }

  private grantKeyword(creature: CardInstance, keyword: Keyword, duration: DurationType): void {
    if (!creature.activeKeywords.includes(keyword)) {
      creature.activeKeywords.push(keyword);
    }
    if (duration === DurationType.ThisTurn) {
      creature.buffs.push({
        id: uuid(),
        source: 'keyword_grant',
        attackMod: 0,
        healthMod: 0,
        keywords: [keyword],
        duration: DurationType.ThisTurn,
        turnsRemaining: 1,
      });
    }
  }

  private bounceToHand(creature: CardInstance): void {
    // Remove from board
    const playerIdx = this.state.board.playerCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (playerIdx !== -1) this.state.board.playerCreatures.splice(playerIdx, 1);
    const dmIdx = this.state.board.dmCreatures.findIndex(c => c.instanceId === creature.instanceId);
    if (dmIdx !== -1) this.state.board.dmCreatures.splice(dmIdx, 1);

    // Move equipment to graveyard
    for (const equip of creature.equipment) {
      equip.zone = Zone.Graveyard;
      this.state.graveyard.push(equip);
    }
    creature.equipment = [];

    // Return to owner's hand
    const player = this.state.players[creature.ownerId];
    if (player && player.hand.length < MAX_HAND_SIZE) {
      creature.zone = Zone.Hand;
      creature.currentAttack = creature.definition.attack;
      creature.currentHealth = creature.definition.health;
      creature.maxHealth = creature.definition.health;
      creature.currentShield = creature.definition.shieldValue || 0;
      creature.activeKeywords = [...(creature.definition.keywords || [])];
      creature.buffs = [];
      creature.debuffs = [];
      creature.poisonStacks = [];
      player.hand.push(creature);
      this.addLog('system', `${creature.definition.name} returned to hand`);
    } else {
      creature.zone = Zone.Graveyard;
      this.state.graveyard.push(creature);
      this.addLog('system', `${creature.definition.name} sent to graveyard (hand full)`);
    }
  }

  private getGraveyardCreatureCount(): number {
    return this.state.graveyard.filter(c => c.definition.cardType === CardType.Creature).length;
  }

  // --- Enchantment trigger processing ---
  private processEnchantmentTrigger(triggerType: string, triggerSource: CardInstance, casterId: string): void {
    for (const card of [...this.state.board.playerCreatures]) {
      if (card.definition.cardType !== CardType.Enchantment) continue;
      const effect = card.definition.effectText.toLowerCase();

      // SACRIFICE triggers
      if (triggerType === 'sacrifice' && effect.includes('whenever') && effect.includes('sacrifice')) {
        if (effect.includes('draw')) {
          const drawMatch = effect.match(/draw\s+(\d+)\s+card/);
          if (drawMatch) {
            const count = parseInt(drawMatch[1]);
            for (let i = 0; i < count; i++) this.drawCard(card.ownerId);
            this.addLog('trigger', `${card.definition.name}: draw ${count} card(s)`);
          }
        }
        if (effect.includes('restore') && effect.includes('hp')) {
          const healMatch = effect.match(/restore\s+(\d+)\s+(?:party\s+)?hp/);
          if (healMatch) {
            const amount = parseInt(healMatch[1]);
            this.state.partyHP = Math.min(this.state.maxPartyHP, this.state.partyHP + amount);
            this.addLog('trigger', `${card.definition.name}: restore ${amount} party HP`);
          }
        }
        if (effect.includes('all friendly creatures get')) {
          const buffMatch = effect.match(/all friendly creatures get \+(\d+)\/\+(\d+)/);
          if (buffMatch) {
            for (const creature of this.state.board.playerCreatures) {
              if (creature.definition.cardType === CardType.Creature) {
                this.applyBuff(creature, parseInt(buffMatch[1]), parseInt(buffMatch[2]), DurationType.ThisTurn, card.instanceId);
              }
            }
          }
        }
        if (effect.includes('generate') && effect.includes('mana')) {
          const manaMatch = effect.match(/generate\s+(\d+)\s+(?:burst\s+)?mana/);
          if (manaMatch) {
            this.state.manaPool.burst += parseInt(manaMatch[1]);
            this.addLog('trigger', `${card.definition.name}: generate ${manaMatch[1]} burst mana`);
          }
        }
      }

      // CREATURE DEATH triggers
      if (triggerType === 'creature_death' && effect.includes('whenever') &&
          (effect.includes('creature dies') || effect.includes('creature enters the graveyard'))) {
        if (effect.includes('draw')) {
          const drawMatch = effect.match(/draw\s+(\d+)\s+card/);
          if (drawMatch) {
            const count = parseInt(drawMatch[1]);
            for (let i = 0; i < count; i++) this.drawCard(card.ownerId);
            this.addLog('trigger', `${card.definition.name}: draw ${count} card(s)`);
          }
        }
        if (effect.includes('generate') && effect.includes('mana')) {
          const manaMatch = effect.match(/generate\s+(\d+)\s+(?:burst\s+)?mana/);
          if (manaMatch) {
            this.state.manaPool.burst += parseInt(manaMatch[1]);
            this.addLog('trigger', `${card.definition.name}: generate ${manaMatch[1]} burst mana`);
          }
        }
        if (effect.includes('return it to your hand') || effect.includes('return it to hand')) {
          if (triggerSource.ownerId === card.ownerId) {
            this.resurrectFromGraveyard(triggerSource, Zone.Hand, card.ownerId);
          }
        }
        if (effect.includes('opponent must sacrifice a creature') || effect.includes('dm sacrifices a creature')) {
          // Force DM to sacrifice a creature
          if (this.state.board.dmCreatures.length > 0) {
            const dmCreatures = this.state.board.dmCreatures.filter(c => c.definition.cardType === CardType.Creature);
            if (dmCreatures.length > 0) {
              const victim = dmCreatures[Math.floor(Math.random() * dmCreatures.length)];
              this.sacrificeCreature(victim, 'dm');
              this.addLog('trigger', `${card.definition.name} forces DM to sacrifice ${victim.definition.name}`);
            }
          }
        }
      }
    }
  }
}
