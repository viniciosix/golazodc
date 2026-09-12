import { Rarity } from '@prisma/client';
import { UserError } from '../../core/errors.js';
export function checkOwner(actual: string, expected?: string) {
  if (actual !== expected)
    throw new UserError('Abra sua própria coleção com /colecao.');
}
export function parseRarity(value?: string): Rarity | undefined {
  if (!value || value === 'ALL') return undefined;
  if (!Object.values(Rarity).includes(value as Rarity))
    throw new UserError('Raridade inválida.');
  return value as Rarity;
}
