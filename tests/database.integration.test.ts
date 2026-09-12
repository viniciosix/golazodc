import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ensureUser } from '../src/modules/users/service.js';
import { collection } from '../src/modules/collection/service.js';
const url = process.env.TEST_DATABASE_URL;
const db = new PrismaClient({ datasourceUrl: url });
const tag = randomUUID();
const ids = [`test-${tag}`, `other-${tag}`];
let playerId: string;
let cardId: string;
describe.skipIf(!url)('PostgreSQL real', () => {
  beforeAll(async () => {
    const player = await db.player.create({
      data: { name: `Demo ${tag}`, country: 'BR', position: 'ATA' },
    });
    playerId = player.id;
    const card = await db.card.create({
      data: { slug: tag, playerId, rating: 80, rarity: 'RARE' },
    });
    cardId = card.id;
  });
  afterAll(async () => {
    await db.userCard.deleteMany({
      where: { user: { discordId: { in: ids } } },
    });
    await db.user.deleteMany({ where: { discordId: { in: ids } } });
    if (cardId) await db.card.delete({ where: { id: cardId } });
    if (playerId) await db.player.delete({ where: { id: playerId } });
    await db.$disconnect();
  });
  it('cria um único usuário com chamadas concorrentes', async () => {
    const users = await Promise.all(
      Array.from({ length: 5 }, () => ensureUser(db, ids[0]!, 'Teste')),
    );
    expect(new Set(users.map((u) => u.id)).size).toBe(1);
    expect(users[0]!.coins).toBe(0n);
  });
  it('preserva cópias, pagina, filtra e isola inventários', async () => {
    const user = await ensureUser(db, ids[0]!, 'Teste');
    await db.userCard.createMany({
      data: Array.from({ length: 12 }, () => ({ userId: user.id, cardId })),
    });
    const first = await collection(db, ids[0]!, 'Teste');
    const last = await collection(db, ids[0]!, 'Teste', 999);
    expect(first.total).toBe(12);
    expect(first.cards).toHaveLength(10);
    expect(last.cards).toHaveLength(2);
    expect(last.page).toBe(1);
    expect(new Set([...first.cards, ...last.cards].map((c) => c.id)).size).toBe(
      12,
    );
    expect((await collection(db, ids[0]!, 'Teste', 0, 'COMMON')).total).toBe(0);
    expect((await collection(db, ids[1]!, 'Outro')).total).toBe(0);
  });
});
