import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getCardById, getCardsByClass, updateCardArt } from '../database/cards';
import { CardClass } from '@deck-and-dominion/shared';

const CARD_ART_DIR = path.join(__dirname, '../../../card-art');

// Configure multer for card art uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const cardId = req.params.cardId;
    const card = getCardById(cardId);
    if (!card) {
      return cb(new Error('Card not found'), '');
    }
    const classDir = path.join(CARD_ART_DIR, card.cardClass.toLowerCase());
    fs.mkdirSync(classDir, { recursive: true });
    cb(null, classDir);
  },
  filename: (req, file, cb) => {
    const cardId = req.params.cardId;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${cardId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
    }
  },
});

const router = Router();

// POST /api/card-art/:cardId - Upload art for a specific card
router.post('/:cardId', upload.single('art'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const cardId = req.params.cardId;
  const card = getCardById(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const relativePath = `card-art/${card.cardClass.toLowerCase()}/${req.file.filename}`;
  updateCardArt(cardId, relativePath);

  return res.json({
    success: true,
    cardId,
    artPath: relativePath,
  });
});

// POST /api/card-art/bulk/:cardClass - Upload multiple card arts for a class
router.post('/bulk/:cardClass', upload.array('arts', 100), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];
  for (const file of files) {
    // Extract card ID from filename (expected format: cardId.ext)
    const cardId = path.parse(file.filename).name;
    const card = getCardById(cardId);
    if (card) {
      const relativePath = `card-art/${card.cardClass.toLowerCase()}/${file.filename}`;
      updateCardArt(cardId, relativePath);
      results.push({ cardId, artPath: relativePath, success: true });
    } else {
      results.push({ cardId, success: false, error: 'Card not found' });
    }
  }

  return res.json({ results });
});

// GET /api/card-art/:cardId - Get card art
router.get('/:cardId', (req, res) => {
  const card = getCardById(req.params.cardId);
  if (!card || !card.artPath) {
    return res.status(404).json({ error: 'Card art not found' });
  }

  const fullPath = path.join(__dirname, '../../../', card.artPath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Art file not found on disk' });
  }

  return res.sendFile(fullPath);
});

// GET /api/card-art/class/:cardClass - List all cards with/without art for a class
router.get('/class/:cardClass', (req, res) => {
  const cardClass = req.params.cardClass as CardClass;
  const cards = getCardsByClass(cardClass);

  const result = cards.map(card => ({
    id: card.id,
    name: card.name,
    archetype: card.archetype,
    rarity: card.rarity,
    hasArt: !!card.artPath,
    artPath: card.artPath || null,
  }));

  return res.json({
    cardClass,
    total: result.length,
    withArt: result.filter(c => c.hasArt).length,
    withoutArt: result.filter(c => !c.hasArt).length,
    cards: result,
  });
});

// DELETE /api/card-art/:cardId - Remove card art
router.delete('/:cardId', (req, res) => {
  const card = getCardById(req.params.cardId);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  if (card.artPath) {
    const fullPath = path.join(__dirname, '../../../', card.artPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    updateCardArt(card.id, '');
  }

  return res.json({ success: true });
});

export default router;
