import { getDB } from './setup';
import { CardDefinition, CardClass, Rarity, CardType } from '@deck-and-dominion/shared';

export function insertCard(card: CardDefinition): void {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO cards (id, name, card_class, archetype, card_set, card_type, rarity, mana_cost, attack, health, shield_value, poison_value, effect_text, keywords, triggers, art_path, flavor_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    card.id,
    card.name,
    card.cardClass,
    card.archetype,
    card.set,
    card.cardType,
    card.rarity,
    card.manaCost,
    card.attack ?? null,
    card.health ?? null,
    card.shieldValue ?? 0,
    card.poisonValue ?? 0,
    card.effectText,
    JSON.stringify(card.keywords),
    JSON.stringify(card.triggers || []),
    card.artPath ?? null,
    card.flavorText ?? '',
  );
}

export function insertCards(cards: CardDefinition[]): void {
  const db = getDB();
  const insertMany = db.transaction((cards: CardDefinition[]) => {
    for (const card of cards) {
      insertCard(card);
    }
  });
  insertMany(cards);
}

function rowToCard(row: Record<string, unknown>): CardDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    cardClass: row.card_class as CardClass,
    archetype: row.archetype as string,
    set: row.card_set as string,
    cardType: row.card_type as CardType,
    rarity: row.rarity as Rarity,
    manaCost: row.mana_cost as number,
    attack: row.attack as number | undefined,
    health: row.health as number | undefined,
    shieldValue: row.shield_value as number | undefined,
    poisonValue: row.poison_value as number | undefined,
    effectText: row.effect_text as string,
    keywords: JSON.parse(row.keywords as string),
    triggers: JSON.parse(row.triggers as string),
    artPath: row.art_path as string | undefined,
    flavorText: row.flavor_text as string | undefined,
  };
}

export function getAllCards(): CardDefinition[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM cards ORDER BY card_class, rarity, name').all();
  return rows.map(r => rowToCard(r as Record<string, unknown>));
}

export function getCardById(id: string): CardDefinition | undefined {
  const db = getDB();
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  return row ? rowToCard(row as Record<string, unknown>) : undefined;
}

export function getCardsByClass(cardClass: CardClass): CardDefinition[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM cards WHERE card_class = ? ORDER BY rarity, name').all(cardClass);
  return rows.map(r => rowToCard(r as Record<string, unknown>));
}

export function getCardsByRarity(rarity: Rarity): CardDefinition[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM cards WHERE rarity = ? ORDER BY card_class, name').all(rarity);
  return rows.map(r => rowToCard(r as Record<string, unknown>));
}

export function getCardsByArchetype(archetype: string): CardDefinition[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM cards WHERE archetype = ? ORDER BY rarity, name').all(archetype);
  return rows.map(r => rowToCard(r as Record<string, unknown>));
}

export function searchCards(query: string): CardDefinition[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM cards WHERE name LIKE ? OR effect_text LIKE ? ORDER BY card_class, name').all(`%${query}%`, `%${query}%`);
  return rows.map(r => rowToCard(r as Record<string, unknown>));
}

export function updateCardArt(cardId: string, artPath: string): void {
  const db = getDB();
  db.prepare('UPDATE cards SET art_path = ? WHERE id = ?').run(artPath, cardId);
}

export function getCardCount(): number {
  const db = getDB();
  const row = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
  return row.count;
}

export function getCardCountByClass(): Record<string, number> {
  const db = getDB();
  const rows = db.prepare('SELECT card_class, COUNT(*) as count FROM cards GROUP BY card_class').all() as Array<{ card_class: string; count: number }>;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.card_class] = row.count;
  }
  return result;
}
