import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/game.db');

let db: Database.Database;

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      card_class TEXT NOT NULL,
      archetype TEXT NOT NULL DEFAULT '',
      card_set TEXT NOT NULL DEFAULT '',
      card_type TEXT NOT NULL,
      rarity TEXT NOT NULL,
      mana_cost INTEGER NOT NULL DEFAULT 0,
      attack INTEGER,
      health INTEGER,
      shield_value INTEGER DEFAULT 0,
      poison_value INTEGER DEFAULT 0,
      effect_text TEXT NOT NULL DEFAULT '',
      keywords TEXT NOT NULL DEFAULT '[]',
      triggers TEXT NOT NULL DEFAULT '[]',
      art_path TEXT,
      flavor_text TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (card_id) REFERENCES cards(id),
      UNIQUE(player_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      player_id TEXT NOT NULL,
      card_class TEXT NOT NULL,
      card_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cards_class ON cards(card_class);
    CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type);
    CREATE INDEX IF NOT EXISTS idx_collections_player ON collections(player_id);
    CREATE INDEX IF NOT EXISTS idx_decks_player ON decks(player_id);
  `);

  // Initialize default settings
  db.prepare(`INSERT OR IGNORE INTO game_settings (key, value) VALUES ('max_card_copies', '2')`).run();
}

export function closeDB(): void {
  if (db) {
    db.close();
  }
}
