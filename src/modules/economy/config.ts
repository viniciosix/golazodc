import type { Rarity } from '@prisma/client';
export const ECONOMY = {
  starterCoins: 100,
  starterCards: 3,
  dailyCoins: 100,
  streakBonus: 10,
  streakCap: 7,
  dailyMs: 86400000,
  workMs: 14400000,
  workMin: 25,
  workMax: 45,
  tradeMs: 86400000,
  maxPrice: 1000000,
} as const;
export const PACKS = {
  basico: { name: 'Pack Básico', cost: 150, count: 3 },
  grande: { name: 'Pack Grande', cost: 250, count: 5 },
} as const;
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  COMMON: 70,
  RARE: 22,
  EPIC: 7,
  LEGENDARY: 1,
};
export const RECYCLE: Record<Rarity, number> = {
  COMMON: 15,
  RARE: 40,
  EPIC: 100,
  LEGENDARY: 300,
};
