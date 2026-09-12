import type { PrismaClient, Rarity } from '@prisma/client';
import { ensureUser } from '../users/service.js';
export const PAGE_SIZE = 10;
export async function collection(
  db: PrismaClient,
  discordId: string,
  displayName: string,
  requestedPage = 0,
  rarity?: Rarity,
  playerId?: string,
) {
  const user = await ensureUser(db, discordId, displayName);
  const where = {
    userId: user.id,
    card: { ...(rarity ? { rarity } : {}), ...(playerId ? { playerId } : {}) },
  };
  return db.$transaction(
    async (tx) => {
      const total = await tx.userCard.count({ where });
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.max(
        0,
        Math.min(
          Number.isSafeInteger(requestedPage) ? requestedPage : 0,
          pages - 1,
        ),
      );
      const cards = await tx.userCard.findMany({
        where,
        include: { card: { include: { player: true } } },
        orderBy: [{ acquiredAt: 'desc' }, { id: 'asc' }],
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      return { total, page, pages, cards };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
