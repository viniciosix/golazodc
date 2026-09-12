import { pollGoals } from '../src/modules/football/worker.js';
import type { Context } from '../src/core/types.js';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { enableGoals, observeMatch } from '../src/modules/football/goals.js';
import type { Match } from '../src/modules/football/provider.js';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const channelId = randomUUID();
const match: Match = {
  id: 'fixture',
  date: new Date().toISOString(),
  state: 'in',
  clock: '30',
  home: { id: '2026', name: 'São Paulo', score: 0 },
  away: { id: '1', name: 'Outro', score: 0 },
};
describe.skipIf(!process.env.TEST_DATABASE_URL)('Alertas persistidos', () => {
  afterAll(async () => {
    await db.goalSubscription.deleteMany({ where: { channelId } });
    await db.$disconnect();
  });
  it('baseline, deduplicação, correção, desligamento e reativação', async () => {
    const data = {
      channelId,
      guildId: 'test',
      league: 'bra.1' as const,
      teamId: '2026',
      teamName: 'São Paulo',
    };
    const sub = await enableGoals(db, data, [match]);
    await observeMatch(db, sub, match);
    expect(
      await db.goalNotice.count({ where: { subscriptionId: sub.id } }),
    ).toBe(0);
    const goal = { ...match, home: { ...match.home, score: 1 } };
    await observeMatch(db, sub, goal);
    await observeMatch(db, sub, goal);
    expect(
      await db.goalNotice.count({ where: { subscriptionId: sub.id } }),
    ).toBe(1);
    await observeMatch(db, sub, match);
    expect(
      await db.goalNotice.count({ where: { subscriptionId: sub.id } }),
    ).toBe(2);
    await db.goalSubscription.update({
      where: { id: sub.id },
      data: { enabled: false },
    });
    await observeMatch(db, sub, goal);
    expect(
      await db.goalNotice.count({ where: { subscriptionId: sub.id } }),
    ).toBe(2);
    const current = await enableGoals(db, data, [goal]);
    await observeMatch(db, sub, { ...goal, home: { ...goal.home, score: 2 } });
    await observeMatch(db, current, goal);
    expect(
      await db.goalNotice.count({ where: { subscriptionId: sub.id } }),
    ).toBe(0);
  });
  it('entrega a fila, não repete e respeita desligamento', async () => {
    const sub = await enableGoals(
      db,
      {
        channelId,
        guildId: 'test',
        league: 'bra.1',
        teamId: '2026',
        teamName: 'São Paulo',
      },
      [match],
    );
    const goal = { ...match, home: { ...match.home, score: 1 } };
    await observeMatch(db, sub, goal);
    const send = vi.fn().mockResolvedValue({ id: 'message' });
    const context = {
      db,
      client: {
        channels: {
          fetch: vi.fn().mockResolvedValue({ isTextBased: () => true, send }),
        },
      },
    } as unknown as Context;
    await pollGoals(context, async () => [goal]);
    await pollGoals(context, async () => [goal]);
    expect(send).toHaveBeenCalledTimes(1);
    await observeMatch(db, sub, { ...goal, home: { ...goal.home, score: 2 } });
    await db.goalSubscription.update({
      where: { id: sub.id },
      data: { enabled: false },
    });
    await pollGoals(context, async () => []);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
