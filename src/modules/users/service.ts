import type { PrismaClient } from '@prisma/client';
export function ensureUser(
  db: PrismaClient,
  discordId: string,
  displayName: string,
) {
  return db.user.upsert({
    where: { discordId },
    create: { discordId, displayName },
    update: { displayName },
  });
}
export async function profile(
  db: PrismaClient,
  discordId: string,
  displayName: string,
) {
  const user = await ensureUser(db, discordId, displayName);
  const cards = await db.userCard.count({
    where: { userId: user.id, destroyedAt: null },
  });
  return { ...user, cards };
}
