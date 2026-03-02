import { Router } from 'express';
import { getAllCards, getCardById, getCardsByClass, getCardsByRarity, getCardsByArchetype, searchCards, getCardCount, getCardCountByClass } from '../database/cards';
import { CardClass, Rarity } from '@deck-and-dominion/shared';

const router = Router();

// GET /api/cards - Get all cards with optional filters
router.get('/', (req, res) => {
  const { cardClass, rarity, archetype, search } = req.query;

  if (search && typeof search === 'string') {
    return res.json(searchCards(search));
  }
  if (cardClass && typeof cardClass === 'string') {
    return res.json(getCardsByClass(cardClass as CardClass));
  }
  if (rarity && typeof rarity === 'string') {
    return res.json(getCardsByRarity(rarity as Rarity));
  }
  if (archetype && typeof archetype === 'string') {
    return res.json(getCardsByArchetype(archetype));
  }

  return res.json(getAllCards());
});

// GET /api/cards/stats - Get card count stats
router.get('/stats', (_req, res) => {
  res.json({
    total: getCardCount(),
    byClass: getCardCountByClass(),
  });
});

// GET /api/cards/:id - Get single card
router.get('/:id', (req, res) => {
  const card = getCardById(req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }
  return res.json(card);
});

export default router;
