import { Router } from 'express';
import { getDB } from '../database/setup';
import { getAllCards } from '../database/cards';
import { Rarity, CardClass } from '@deck-and-dominion/shared';

const router = Router();

const CLASS_ARCHETYPES: Record<string, string[]> = {
  Commander: ['Marshal', 'Tactician', 'Warden'],
  DPS: ['Swarm', 'Big', 'Undead'],
  Wizard: ['Enchanter', 'Illusionist', 'Abjurer'],
  Sorcerer: ['Necromancer', 'Dark Ritualist', 'Hexer'],
  Crafter: ['Blacksmith', 'Farmer', 'Alchemist'],
};

function getSettingValue(key: string): string | null {
  const db = getDB();
  const row = db.prepare('SELECT value FROM game_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

function setSettingValue(key: string, value: string): void {
  const db = getDB();
  db.prepare('INSERT OR REPLACE INTO game_settings (key, value) VALUES (?, ?)').run(key, value);
}

function computeDefaultStarterDeckIds(cardClass: string, archetype: string): string[] {
  const allCards = getAllCards();
  return allCards
    .filter(c =>
      c.rarity === Rarity.Starter &&
      (c.cardClass === cardClass || c.cardClass === CardClass.Neutral) &&
      (c.archetype === 'Shared' || c.archetype === archetype)
    )
    .map(c => c.id);
}

function getStarterDeckIds(cardClass: string, archetype: string): string[] {
  const key = `starter_deck:${cardClass}:${archetype}`;
  const stored = getSettingValue(key);
  if (stored) return JSON.parse(stored);
  const defaults = computeDefaultStarterDeckIds(cardClass, archetype);
  setSettingValue(key, JSON.stringify(defaults));
  return defaults;
}

// GET /api/settings — all settings
router.get('/', (_req, res) => {
  const maxCardCopies = parseInt(getSettingValue('max_card_copies') || '2', 10);

  const starterDecks: Record<string, Record<string, string[]>> = {};
  for (const [cls, archetypes] of Object.entries(CLASS_ARCHETYPES)) {
    starterDecks[cls] = {};
    for (const archetype of archetypes) {
      starterDecks[cls][archetype] = getStarterDeckIds(cls, archetype);
    }
  }

  return res.json({ maxCardCopies, starterDecks });
});

// GET /api/settings/card-limit
router.get('/card-limit', (_req, res) => {
  const maxCardCopies = parseInt(getSettingValue('max_card_copies') || '2', 10);
  return res.json({ maxCardCopies });
});

// PUT /api/settings/card-limit
router.put('/card-limit', (req, res) => {
  const { value } = req.body;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
    return res.status(400).json({ error: 'Invalid card limit (must be integer 1–10)' });
  }
  setSettingValue('max_card_copies', String(value));
  return res.json({ maxCardCopies: value });
});

// GET /api/settings/starter-decks/:cardClass/:archetype
router.get('/starter-decks/:cardClass/:archetype', (req, res) => {
  const { cardClass, archetype } = req.params;
  const cardIds = getStarterDeckIds(cardClass, archetype);
  return res.json({ cardClass, archetype, cardIds });
});

// PUT /api/settings/starter-decks/:cardClass/:archetype
router.put('/starter-decks/:cardClass/:archetype', (req, res) => {
  const { cardClass, archetype } = req.params;
  const { cardIds } = req.body;
  if (!Array.isArray(cardIds) || !cardIds.every(id => typeof id === 'string')) {
    return res.status(400).json({ error: 'cardIds must be an array of strings' });
  }
  const key = `starter_deck:${cardClass}:${archetype}`;
  setSettingValue(key, JSON.stringify(cardIds));
  return res.json({ cardClass, archetype, cardIds });
});

// POST /api/settings/starter-decks/:cardClass/:archetype/reset
router.post('/starter-decks/:cardClass/:archetype/reset', (req, res) => {
  const { cardClass, archetype } = req.params;
  const cardIds = computeDefaultStarterDeckIds(cardClass, archetype);
  const key = `starter_deck:${cardClass}:${archetype}`;
  setSettingValue(key, JSON.stringify(cardIds));
  return res.json({ cardClass, archetype, cardIds });
});

export { getSettingValue };
export default router;
