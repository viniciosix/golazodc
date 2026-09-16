import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import {
  startMines,
  moveMines,
  resumeMines,
} from '../src/modules/mines/service.js';
import { payout } from '../src/modules/mines/rules.js';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const tag = `mines-${randomUUID()}`;
const actor = (n: number) => ({ id: `${tag}-${n}`, username: 'Mines test' });
const key = () => randomUUID();
async function fund(n: number, coins = 1000n) {
  return db.user.create({
    data: { discordId: actor(n).id, displayName: 'Test', coins },
  });
}
const balance = async (n: number) =>
  (await db.user.findUniqueOrThrow({ where: { discordId: actor(n).id } }))
    .coins;
describe.skipIf(!process.env.TEST_DATABASE_URL)('Mines with PostgreSQL', () => {
  afterAll(async () => {
    const users = await db.user.findMany({
      where: { discordId: { startsWith: tag } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await db.minesGame.deleteMany({ where: { userId: { in: ids } } });
    await db.walletEntry.deleteMany({ where: { userId: { in: ids } } });
    await db.economyOperation.deleteMany({
      where: { actorId: { startsWith: tag } },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it('charges once for replayed starts and enforces one active game under concurrency', async () => {
    await fund(1);
    const k = key();
    const [a, b] = await Promise.all([
      startMines(db, actor(1), k, 10, 3, 'guild'),
      startMines(db, actor(1), k, 10, 3, 'guild'),
    ]);
    expect(a.id).toBe(b.id);
    expect(await balance(1)).toBe(990n);
    await expect(
      startMines(db, actor(1), key(), 10, 3, 'guild'),
    ).rejects.toThrow('andamento');
    await fund(2);
    const results = await Promise.allSettled([
      startMines(db, actor(2), key(), 10, 3, 'guild'),
      startMines(db, actor(2), key(), 10, 3, 'guild'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(2)).toBe(990n);
  });
  it('does not create games or ledger entries without enough coins', async () => {
    const u = await fund(3, 0n);
    await expect(
      startMines(db, actor(3), key(), 10, 3, 'guild'),
    ).rejects.toThrow('insuficientes');
    expect(await db.minesGame.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.walletEntry.count({ where: { userId: u.id } })).toBe(0);
    expect(await balance(3)).toBe(0n);
  });
  it('survives a new client, blocks other owners/guilds and pays cashout exactly once', async () => {
    await fund(4);
    let g = await startMines(db, actor(4), key(), 10, 3, 'guild');
    const fresh = new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL,
    });
    try {
      expect((await resumeMines(fresh, actor(4).id, 'guild')).bombs).toEqual(
        g.bombs,
      );
    } finally {
      await fresh.$disconnect();
    }
    const cell = Array.from({ length: 16 }, (_, i) => i).find(
      (i) => !g.bombs.includes(i),
    )!;
    await expect(
      moveMines(db, actor(4), key(), g.id, 'wrong-guild', 0, cell),
    ).rejects.toThrow('própria');
    await expect(
      moveMines(db, actor(3), key(), g.id, 'guild', 0, cell),
    ).rejects.toThrow('própria');
    const k = key();
    g = await moveMines(db, actor(4), k, g.id, 'guild', 0, cell);
    expect(
      (await moveMines(db, actor(4), k, g.id, 'guild', 0, cell)).revision,
    ).toBe(1);
    const results = await Promise.allSettled([
      moveMines(db, actor(4), key(), g.id, 'guild', 1, 'cash'),
      moveMines(db, actor(4), key(), g.id, 'guild', 1, 'cash'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balance(4)).toBe(1001n);
    expect((await resumeMines(db, actor(4).id, 'guild')).status).toBe('CASHED');
    expect(
      (await db.minesGame.findUniqueOrThrow({ where: { id: g.id } }))
        .activeOwner,
    ).toBeNull();
  });
  it('rejects stale clicks, loses on a fixed bomb, allows a new round and refunds cancellation', async () => {
    await fund(5);
    let g = await startMines(db, actor(5), key(), 10, 3, 'guild');
    const safe = Array.from({ length: 16 }, (_, i) => i).filter(
      (i) => !g.bombs.includes(i),
    );
    const moves = await Promise.allSettled(
      safe
        .slice(0, 2)
        .map((cell) => moveMines(db, actor(5), key(), g.id, 'guild', 0, cell)),
    );
    expect(moves.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    g = await resumeMines(db, actor(5).id, 'guild');
    expect(g.revealed).toHaveLength(1);
    g = await moveMines(
      db,
      actor(5),
      key(),
      g.id,
      'guild',
      g.revision,
      g.bombs[0]!,
    );
    expect(g.status).toBe('LOST');
    expect(await balance(5)).toBe(990n);
    await expect(
      moveMines(db, actor(5), key(), g.id, 'guild', g.revision, 'cash'),
    ).rejects.toThrow('terminou');
    g = await startMines(db, actor(5), key(), 10, 3, 'guild');
    const k = key();
    await moveMines(db, actor(5), k, g.id, 'guild', 0, 'cash');
    await moveMines(db, actor(5), k, g.id, 'guild', 0, 'cash');
    expect(await balance(5)).toBe(990n);
  });
  it('automatically pays after all safe cells and never pays twice', async () => {
    await fund(6);
    let g = await startMines(db, actor(6), key(), 10, 8, 'guild');
    const safe = Array.from({ length: 16 }, (_, i) => i).filter(
      (i) => !g.bombs.includes(i),
    );
    for (const cell of safe)
      g = await moveMines(db, actor(6), key(), g.id, 'guild', g.revision, cell);
    expect(g.status).toBe('WON');
    expect(g.prize).toBe(payout(10n, 8, 8));
    expect(await balance(6)).toBe(990n + g.prize);
    await expect(
      moveMines(db, actor(6), key(), g.id, 'guild', g.revision, 'cash'),
    ).rejects.toThrow('terminou');
  });
});
