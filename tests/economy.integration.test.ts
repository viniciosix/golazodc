import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  starter,
  reward,
  buyPack,
  recycle,
} from '../src/modules/economy/rewards.js';
import {
  sell,
  buyListing,
  proposeTrade,
  resolveTrade,
  expireTrades,
} from '../src/modules/economy/market.js';
const url = process.env.TEST_DATABASE_URL;
const db = new PrismaClient({ datasourceUrl: url });
const tag = randomUUID();
const actor = (n: number) => ({ id: `economy-${tag}-${n}`, username: 'Teste' });
const key = () => randomUUID();
const user = (n: number) =>
  db.user.findUniqueOrThrow({ where: { discordId: actor(n).id } });
describe.skipIf(!url)('Economia com PostgreSQL real', () => {
  afterAll(async () => {
    const users = await db.user.findMany({
      where: { discordId: { startsWith: `economy-${tag}` } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await db.marketListing.deleteMany({ where: { sellerId: { in: ids } } });
    await db.tradeOffer.deleteMany({ where: { senderId: { in: ids } } });
    await db.walletEntry.deleteMany({ where: { userId: { in: ids } } });
    await db.economyOperation.deleteMany({
      where: { actorId: { startsWith: `economy-${tag}` } },
    });
    await db.userCard.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it('importou as nove artes sem duplicar o catálogo', async () => {
    expect(
      await db.card.count({
        where: { slug: { startsWith: 'inicial-' }, artwork: { isNot: null } },
      }),
    ).toBe(9);
  });
  it('kit e diário não duplicam com concorrência ou reentrega', async () => {
    const k = key();
    const results = await Promise.all([
      starter(db, actor(1), k),
      starter(db, actor(1), k),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect((await user(1)).coins).toBe(100n);
    expect(new Set(results[0]!.cardIds).size).toBe(3);
    const daily = await Promise.allSettled([
      reward(db, actor(1), key(), 'daily'),
      reward(db, actor(1), key(), 'daily'),
    ]);
    expect(daily.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const total = (await user(1)).coins;
    expect(total >= 101n && total <= 105n).toBe(true);
    const repeatedKey = key();
    const next = new Date(Date.now() + 86400000 + 1000);
    await reward(db, actor(1), repeatedKey, 'daily', next);
    const after = (await user(1)).coins;
    expect(after - total >= 1n && after - total <= 5n).toBe(true);
    await reward(db, actor(1), repeatedKey, 'daily', next);
    expect((await user(1)).coins).toBe(after);
  });
  it('cobra pack uma vez e desfaz compra sem saldo', async () => {
    await db.user.update({
      where: { discordId: actor(1).id },
      data: { coins: 200n },
    });
    const k = key();
    const first = await buyPack(db, actor(1), k, 'basico');
    expect(first.copyIds).toHaveLength(3);
    expect(await buyPack(db, actor(1), k, 'basico')).toEqual(first);
    expect((await user(1)).coins).toBe(50n);
    await expect(buyPack(db, actor(1), key(), 'grande')).rejects.toThrow();
    expect((await user(1)).coins).toBe(50n);
    expect(
      await db.userCard.count({ where: { userId: (await user(1)).id } }),
    ).toBe(6);
  });
  it('vende a somente um comprador, conserva moedas e bloqueia carta anunciada', async () => {
    await starter(db, actor(2), key());
    await starter(db, actor(3), key());
    const copy = await db.userCard.findFirstOrThrow({
      where: { userId: (await user(1)).id },
    });
    await sell(db, actor(1), key(), copy.id, 40);
    await expect(recycle(db, actor(1), key(), copy.id)).rejects.toThrow();
    const listing = await db.marketListing.findFirstOrThrow({
      where: { userCardId: copy.id, status: 'OPEN' },
    });
    const results = await Promise.allSettled([
      buyListing(db, actor(2), key(), listing.id),
      buyListing(db, actor(3), key(), listing.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await user(1)).coins + (await user(2)).coins + (await user(3)).coins,
    ).toBe(250n);
  });
  it('recicla repetida uma vez e preserva última cópia', async () => {
    await starter(db, actor(4), key());
    const u = await user(4);
    const copy = await db.userCard.findFirstOrThrow({
      where: { userId: u.id },
    });
    await expect(recycle(db, actor(4), key(), copy.id)).rejects.toThrow();
    const duplicate = await db.userCard.create({
      data: { userId: u.id, cardId: copy.cardId },
    });
    const k = key();
    await recycle(db, actor(4), k, duplicate.id);
    await recycle(db, actor(4), k, duplicate.id);
    expect((await user(4)).coins).toBe(115n);
    await expect(recycle(db, actor(4), key(), copy.id)).rejects.toThrow();
  });
  it('exige consentimento e transfere as duas cópias atomicamente', async () => {
    const a = await user(2),
      b = await user(3);
    const offered = await db.userCard.findFirstOrThrow({
      where: { userId: a.id, locked: false },
    });
    const wanted = await db.userCard.findFirstOrThrow({
      where: { userId: b.id, locked: false },
    });
    await proposeTrade(db, actor(2), key(), actor(3).id, offered.id, wanted.id);
    const offer = await db.tradeOffer.findFirstOrThrow({
      where: { offeredId: offered.id, status: 'OPEN' },
    });
    await expect(
      resolveTrade(db, actor(1), key(), offer.id, true),
    ).rejects.toThrow();
    expect(
      (await db.userCard.findUniqueOrThrow({ where: { id: wanted.id } }))
        .locked,
    ).toBe(false);
    await resolveTrade(db, actor(3), key(), offer.id, true);
    expect(
      (await db.userCard.findUniqueOrThrow({ where: { id: offered.id } }))
        .userId,
    ).toBe(b.id);
    expect(
      (await db.userCard.findUniqueOrThrow({ where: { id: wanted.id } }))
        .userId,
    ).toBe(a.id);
    await proposeTrade(db, actor(3), key(), actor(2).id, offered.id, wanted.id);
    const exp = await db.tradeOffer.findFirstOrThrow({
      where: { offeredId: offered.id, status: 'OPEN' },
    });
    await db.tradeOffer.update({
      where: { id: exp.id },
      data: { expiresAt: new Date(0) },
    });
    await db.$transaction((tx) => expireTrades(tx), {
      isolationLevel: 'Serializable',
    });
    expect(
      (await db.userCard.findUniqueOrThrow({ where: { id: offered.id } }))
        .locked,
    ).toBe(false);
  });
});
