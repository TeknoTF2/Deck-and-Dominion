import { v4 as uuid } from 'uuid';
import {
  CardDefinition, Rarity, PackTier, PackFilter, UnopenedPack,
  CardClass,
} from '@deck-and-dominion/shared';

// --- Weighted rarity tables per pack tier ---
// Weights are relative; they don't need to sum to 100.

interface RarityWeights {
  [Rarity.Common]: number;
  [Rarity.Uncommon]: number;
  [Rarity.Rare]: number;
  [Rarity.Legendary]: number;
}

const TIER_WEIGHTS: Record<PackTier, { guaranteed: Rarity; remaining: RarityWeights }> = {
  [PackTier.Common]: {
    guaranteed: Rarity.Common,
    remaining: { Common: 80, Uncommon: 18, Rare: 2, Legendary: 0 },
  },
  [PackTier.Uncommon]: {
    guaranteed: Rarity.Uncommon,
    remaining: { Common: 40, Uncommon: 45, Rare: 13, Legendary: 2 },
  },
  [PackTier.Rare]: {
    guaranteed: Rarity.Rare,
    remaining: { Common: 20, Uncommon: 40, Rare: 30, Legendary: 10 },
  },
  [PackTier.Legendary]: {
    guaranteed: Rarity.Legendary,
    remaining: { Common: 10, Uncommon: 25, Rare: 40, Legendary: 25 },
  },
};

// Simple obfuscation key — not cryptographic, just prevents casual peeking
const OBFUSCATION_KEY = 'D&D_PACK_SEAL';

function obfuscate(cardIds: string[]): string {
  const json = JSON.stringify(cardIds);
  // XOR with repeating key, then base64
  let result = '';
  for (let i = 0; i < json.length; i++) {
    result += String.fromCharCode(
      json.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    );
  }
  return Buffer.from(result, 'binary').toString('base64');
}

export function deobfuscate(sealed: string): string[] {
  const binary = Buffer.from(sealed, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < binary.length; i++) {
    result += String.fromCharCode(
      binary.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    );
  }
  return JSON.parse(result);
}

function weightedRandomRarity(weights: RarityWeights): Rarity {
  const entries: [Rarity, number][] = [
    [Rarity.Common, weights.Common],
    [Rarity.Uncommon, weights.Uncommon],
    [Rarity.Rare, weights.Rare],
    [Rarity.Legendary, weights.Legendary],
  ];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return Rarity.Common; // fallback
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterCardPool(allCards: CardDefinition[], filter: PackFilter): CardDefinition[] {
  return allCards.filter(c => {
    // Never include Starter cards in packs
    if (c.rarity === Rarity.Starter) return false;
    if (filter.cardClass && c.cardClass !== filter.cardClass && c.cardClass !== CardClass.Neutral) {
      return false;
    }
    if (filter.archetype && c.archetype !== filter.archetype && c.archetype !== 'Shared') {
      return false;
    }
    return true;
  });
}

export function generatePack(
  allCards: CardDefinition[],
  tier: PackTier,
  size: number,
  filter: PackFilter,
): UnopenedPack {
  const pool = filterCardPool(allCards, filter);
  const tierConfig = TIER_WEIGHTS[tier];

  const selectedIds: string[] = [];

  // 1. Guaranteed slot
  const guaranteedPool = pool.filter(c => c.rarity === tierConfig.guaranteed);
  if (guaranteedPool.length > 0) {
    selectedIds.push(pickRandom(guaranteedPool).id);
  } else {
    // Fallback: pick any card from pool
    if (pool.length > 0) selectedIds.push(pickRandom(pool).id);
  }

  // 2. Remaining slots via weighted randomization
  const remainingSlots = size - selectedIds.length;
  for (let i = 0; i < remainingSlots; i++) {
    const rarity = weightedRandomRarity(tierConfig.remaining);
    const rarityPool = pool.filter(c => c.rarity === rarity);
    if (rarityPool.length > 0) {
      selectedIds.push(pickRandom(rarityPool).id);
    } else if (pool.length > 0) {
      // Fallback to any available card
      selectedIds.push(pickRandom(pool).id);
    }
  }

  // Build label
  const classLabel = filter.cardClass || 'Mixed';
  const archetypeLabel = filter.archetype ? ` ${filter.archetype}` : '';
  const label = `${tier}${archetypeLabel} ${classLabel} Pack`;

  return {
    id: uuid(),
    tier,
    size,
    filter,
    label,
    sealedContents: obfuscate(selectedIds),
  };
}

export function generateBulkPacks(
  allCards: CardDefinition[],
  tier: PackTier,
  size: number,
  filter: PackFilter,
  count: number,
): UnopenedPack[] {
  const packs: UnopenedPack[] = [];
  for (let i = 0; i < count; i++) {
    packs.push(generatePack(allCards, tier, size, filter));
  }
  return packs;
}

export function openPack(pack: UnopenedPack): string[] {
  return deobfuscate(pack.sealedContents);
}
