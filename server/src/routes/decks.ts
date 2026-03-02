import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB } from '../database/setup';
import { getCardById } from '../database/cards';
import { DeckDefinition, DECK_MIN_SIZE, DECK_MAX_SIZE, MAX_CARD_COPIES, CardClass, Rarity, CardType } from '@deck-and-dominion/shared';

const router = Router();

function rowToDeck(row: Record<string, unknown>): DeckDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    playerId: row.player_id as string,
    cardClass: row.card_class as CardClass,
    cardIds: JSON.parse(row.card_ids as string),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

// GET /api/decks?playerId=xxx
router.get('/', (req, res) => {
  const { playerId } = req.query;
  const db = getDB();

  if (playerId) {
    const rows = db.prepare('SELECT * FROM decks WHERE player_id = ? ORDER BY updated_at DESC').all(playerId);
    return res.json(rows.map(r => rowToDeck(r as Record<string, unknown>)));
  }

  const rows = db.prepare('SELECT * FROM decks ORDER BY updated_at DESC').all();
  return res.json(rows.map(r => rowToDeck(r as Record<string, unknown>)));
});

// GET /api/decks/:id
router.get('/:id', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Deck not found' });
  }
  return res.json(rowToDeck(row as Record<string, unknown>));
});

// POST /api/decks
router.post('/', (req, res) => {
  const { name, playerId, cardClass, cardIds } = req.body;

  if (!name || !playerId || !cardClass || !cardIds) {
    return res.status(400).json({ error: 'Missing required fields: name, playerId, cardClass, cardIds' });
  }

  if (!Array.isArray(cardIds)) {
    return res.status(400).json({ error: 'cardIds must be an array' });
  }

  if (cardIds.length < DECK_MIN_SIZE || cardIds.length > DECK_MAX_SIZE) {
    return res.status(400).json({ error: `Deck must have ${DECK_MIN_SIZE}-${DECK_MAX_SIZE} cards` });
  }

  // Validate card class restriction and copy limits
  const cardCounts: Record<string, number> = {};
  for (const cardId of cardIds) {
    const card = getCardById(cardId);
    if (!card) {
      return res.status(400).json({ error: `Card not found: ${cardId}` });
    }
    if (card.cardClass !== cardClass && card.cardClass !== 'Neutral') {
      return res.status(400).json({ error: `Card ${card.name} is ${card.cardClass}, not ${cardClass}` });
    }
    // Enforce per-card copy limits (Starter rarity and Land type are exempt)
    cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
    if (card.rarity !== Rarity.Starter && card.cardType !== CardType.Land && cardCounts[cardId] > MAX_CARD_COPIES) {
      return res.status(400).json({ error: `Too many copies of ${card.name} (max ${MAX_CARD_COPIES})` });
    }
  }

  const id = uuid();
  const now = Date.now();
  const db = getDB();

  db.prepare(`INSERT INTO decks (id, name, player_id, card_class, card_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, playerId, cardClass, JSON.stringify(cardIds), now, now
  );

  return res.status(201).json({
    id,
    name,
    playerId,
    cardClass,
    cardIds,
    createdAt: now,
    updatedAt: now,
  });
});

// PUT /api/decks/:id
router.put('/:id', (req, res) => {
  const { name, cardIds } = req.body;
  const db = getDB();

  const existing = db.prepare('SELECT * FROM decks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const deck = rowToDeck(existing as Record<string, unknown>);
  const updatedName = name || deck.name;
  const updatedCardIds = cardIds || deck.cardIds;

  if (Array.isArray(updatedCardIds) && (updatedCardIds.length < DECK_MIN_SIZE || updatedCardIds.length > DECK_MAX_SIZE)) {
    return res.status(400).json({ error: `Deck must have ${DECK_MIN_SIZE}-${DECK_MAX_SIZE} cards` });
  }

  const now = Date.now();
  db.prepare('UPDATE decks SET name = ?, card_ids = ?, updated_at = ? WHERE id = ?').run(
    updatedName, JSON.stringify(updatedCardIds), now, req.params.id
  );

  return res.json({
    ...deck,
    name: updatedName,
    cardIds: updatedCardIds,
    updatedAt: now,
  });
});

// DELETE /api/decks/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  const result = db.prepare('DELETE FROM decks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Deck not found' });
  }
  return res.json({ success: true });
});

export default router;
