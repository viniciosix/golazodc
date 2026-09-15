import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { GuildTextBasedChannel } from 'discord.js';
import type { Context } from '../src/core/types.js';
import type { Match } from '../src/modules/football/provider.js';
import { enableGoals, observeMatch } from '../src/modules/football/goals.js';
import {
  reactToNotice,
  CONCEDED_PHRASES,
} from '../src/modules/football/banter.js';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const channelId = randomUUID();
describe.skipIf(!process.env.TEST_DATABASE_URL)('persisted banter', () => {
  afterAll(async () => {
    await db.goalSubscription.deleteMany({ where: { channelId } });
    await db.goalBanter.deleteMany({ where: { channelId } });
    await db.$disconnect();
  });
  it('persists and deduplicates conceded goals, honors enabled settings and ignores corrections', async () => {
    const match: Match = {
      id: randomUUID(),
      date: new Date().toISOString(),
      state: 'in',
      clock: '30',
      home: { id: 'opponent', name: 'LDU', score: 0 },
      away: { id: '2026', name: 'São Paulo', score: 0 },
    };
    const sub = await enableGoals(
      db,
      {
        channelId,
        guildId: 'test',
        league: 'conmebol.sudamericana',
        teamId: '2026',
        teamName: 'São Paulo',
      },
      [match],
    );
    const conceded = { ...match, home: { ...match.home, score: 1 } };
    await observeMatch(db, sub, conceded);
    await observeMatch(db, sub, conceded);
    const notices = await db.goalNotice.findMany({
      where: { subscriptionId: sub.id },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0]!.kind).toBe('conceded');
    const send = vi.fn().mockResolvedValue({ id: 'sent' });
    const channel = { id: channelId, send } as unknown as GuildTextBasedChannel;
    await reactToNotice({ db } as Context, channel, notices[0]!, '2026');
    expect(send).not.toHaveBeenCalled();
    await db.goalBanter.create({ data: { channelId, guildId: 'test' } });
    await reactToNotice({ db } as Context, channel, notices[0]!, '2026');
    expect(CONCEDED_PHRASES).toContain(send.mock.calls[0]![0].content);
    await reactToNotice({ db } as Context, channel, notices[0]!, '2026');
    expect(send).toHaveBeenCalledTimes(1);
    await observeMatch(db, sub, match);
    const correction = await db.goalNotice.findFirstOrThrow({
      where: { subscriptionId: sub.id, kind: 'correction' },
    });
    await reactToNotice({ db } as Context, channel, correction, '2026');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
