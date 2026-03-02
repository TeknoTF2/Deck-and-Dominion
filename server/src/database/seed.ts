import path from 'path';
import fs from 'fs';
import { getDB } from './setup';
import { insertCards } from './cards';
import { CardDefinition } from '@deck-and-dominion/shared';

const CARD_DATA_DIR = path.join(__dirname, '../../data/cards');

function loadCardFile(filename: string): CardDefinition[] {
  const filePath = path.join(CARD_DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`Card file not found: ${filePath}`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const cards = JSON.parse(raw);
  return cards.map((card: any) => ({
    ...card,
    keywords: card.keywords || [],
    triggers: card.triggers || [],
  }));
}

function seed(): void {
  console.log('Initializing database...');
  getDB();

  const cardFiles = ['commander.json', 'dps.json', 'wizard.json', 'sorcerer.json', 'crafter.json'];
  let totalCards = 0;

  for (const file of cardFiles) {
    const cards = loadCardFile(file);
    if (cards.length > 0) {
      console.log(`Loading ${cards.length} cards from ${file}...`);
      insertCards(cards);
      totalCards += cards.length;
    }
  }

  console.log(`Seeded ${totalCards} cards into the database.`);
}

seed();
